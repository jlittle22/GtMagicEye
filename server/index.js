import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { ObjectId } from "mongodb";
import { ReportPayload } from "../shared/payload.js";
import { reportContentSignature } from "../shared/reportDedup.js";
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

// Same city, same troop/support content, reported again within this
// window — treated as a duplicate and not written again. Grepolis towns
// can only be indexed by their own owner (nobody else sees their Defense
// tab), so this only ever guards against the same user re-submitting
// unchanged data, not a cross-user race.
const REPORT_DEDUPE_WINDOW_MS = 60 * 1000;

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

  const cutoff = new Date(insertedAt.getTime() - REPORT_DEDUPE_WINDOW_MS);
  let docsToInsert;
  try {
    docsToInsert = [];
    for (const doc of docs) {
      const recent = await getDb()
        .collection("reports")
        .find(
          { cityId: doc.cityId, worldId: doc.worldId, insertedAt: { $gte: cutoff } },
          { projection: { troops: 1, supportTroops: 1, supportDetails: 1 } }
        )
        .toArray();

      const signature = reportContentSignature(doc);
      const isDuplicate = recent.some((existing) => reportContentSignature(existing) === signature);
      if (!isDuplicate) docsToInsert.push(doc);
    }
  } catch (err) {
    console.error("[server] failed to check for duplicate reports", err);
    return res.status(500).json({ error: "failed to check for duplicate reports" });
  }

  if (docsToInsert.length > 0) {
    try {
      await getDb().collection("reports").insertMany(docsToInsert);
    } catch (err) {
      console.error("[server] failed to persist reports", err);
      return res.status(500).json({ error: "failed to persist reports" });
    }
  }

  // Best-effort — the reports themselves are already persisted, so a hiccup
  // here shouldn't fail the request or block the response. Runs even for an
  // all-duplicates request: the user did still confirm the city, even if
  // nothing new was written.
  try {
    await getDb()
      .collection("users")
      .updateOne({ _id: new ObjectId(req.user._id) }, { $set: { lastReportedAt: insertedAt } });
  } catch (err) {
    console.error("[server] failed to update lastReportedAt", err);
  }

  const skipped = docs.length - docsToInsert.length;
  console.log(
    `[server] persisted ${docsToInsert.length}/${docs.length} report(s) from ${req.user.username}` +
      (skipped > 0 ? ` (${skipped} duplicate, skipped)` : "")
  );

  res.status(204).end();
});

// worldId is required alongside cityId since Grepolis town ids aren't
// globally unique across worlds — cityId alone could match the wrong city
// on a different server.
app.get("/api/reports/last", requireAuth, async (req, res) => {
  const cityId = Number(req.query.cityId);
  const worldId = req.query.worldId;

  if (!Number.isInteger(cityId) || typeof worldId !== "string" || !worldId) {
    return res.status(400).json({ error: "cityId and worldId are required" });
  }

  try {
    const report = await getDb()
      .collection("reports")
      .findOne({ cityId, worldId }, { sort: { insertedAt: -1 }, projection: { insertedAt: 1 } });

    res.status(200).json({ lastReportedAt: report ? report.insertedAt : null });
  } catch (err) {
    console.error("[server] failed to look up last report", err);
    res.status(500).json({ error: "failed to look up last report" });
  }
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
