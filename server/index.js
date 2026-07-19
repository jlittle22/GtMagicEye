import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { ObjectId } from "mongodb";
import { ReportPayload } from "../shared/payload.js";
import { connectDb, getDb } from "./db.js";
import { loginUser } from "./auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { storeSessionToken, consumeSessionToken } from "./loginSessions.js";
import { ReportDocument } from "./database/reportDocument.js";
import { reportsLimiter, loginLimiter } from "./middleware/rateLimit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Cloud Run sits behind Google's front-end proxy — without this, req.ip
// (and thus IP-keyed rate limiting) sees the proxy's address for every
// request instead of the real client IP.
app.set("trust proxy", 1);
app.use(cors({ origin: /\.grepolis\.com$/ }));
app.use(express.json({ limit: "1mb" }));

// Serves the bundled payload (grass-touchers.js) and the installable shell
// (grass-touchers.user.js), both built by the gcp-build step before this
// container is finalized.
app.use(express.static(path.join(__dirname, "..", "dist")));

// Static assets (landing page, logo) — express.static serves index.html for
// "/" automatically, so this alone handles the landing page route.
app.use(express.static(path.join(__dirname, "public")));

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "username and password are required" });
  }

  try {
    const token = await loginUser(username, password);
    res.status(200).json({ token });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post("/api/auth/session/:sessionId", (req, res) => {
  const { token } = req.body || {};
  if (!token) {
    return res.status(400).json({ error: "token is required" });
  }
  storeSessionToken(req.params.sessionId, token);
  res.status(204).end();
});

app.get("/api/auth/session/:sessionId", (req, res) => {
  const token = consumeSessionToken(req.params.sessionId);
  if (!token) {
    return res.status(404).json({ error: "not ready" });
  }
  res.status(200).json({ token });
});

app.post("/api/reports", requireAuth, reportsLimiter, async (req, res) => {
  const result = ReportPayload.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten() });
  }

  const payload = result.data;
  const insertedAt = new Date();

  let docs;
  try {
    docs = payload.reports.map((report) =>
      ReportDocument.parse({
        scriptVersion: payload.scriptVersion,
        ...report,
        insertedAt,
        submittedBy: req.user,
      })
    );
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  try {
    await getDb().collection("reports").insertMany(docs);
  } catch (err) {
    console.error("[server] failed to persist reports", err);
    return res.status(500).json({ error: "failed to persist reports" });
  }

  // Best-effort — the reports themselves are already persisted, so a hiccup
  // here shouldn't fail the request or block the response.
  try {
    await getDb()
      .collection("users")
      .updateOne({ _id: new ObjectId(req.user._id) }, { $set: { lastReportedAt: insertedAt } });
  } catch (err) {
    console.error("[server] failed to update lastReportedAt", err);
  }

  console.log(`[server] persisted ${docs.length} report(s) from ${req.user.username}`);

  res.status(204).end();
});

const port = process.env.PORT || 8080;

connectDb()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server listening on :${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  });
