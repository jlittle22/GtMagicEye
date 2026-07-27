import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import next from "next";
import { ObjectId } from "mongodb";
import { ReportPayload } from "../shared/payload.js";
import { reportContentSignature } from "../shared/reportDedup.js";
import { connectDb, getDb } from "./db.js";
import { loginUser } from "./auth.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { storeSessionToken, consumeSessionToken } from "./loginSessions.js";
import { ReportDocument } from "./database/reportDocument.js";
import { CityStateDocument } from "./database/cityStateDocument.js";
import { PlayerDocument } from "./database/playerDocument.js";
import { reportsLimiter, loginLimiter } from "./middleware/rateLimit.js";

// Mongo's driver serializes explicit `undefined` values rather than
// omitting them, which would turn "this report didn't capture a field" into
// "overwrite the projection's existing value with null" on the next upsert.
// Stripping them keeps partial updates partial.
function stripUndefined(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

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

// Static assets (install page, logo) — served by name (install.html, not
// index.html), so this doesn't auto-claim "/"; that's the Next.js app's now.
app.use(express.static(path.join(__dirname, "public")));

app.get("/install", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "install.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get("/privacy", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "privacy.html"));
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
      // Assigned up front (rather than relying on the driver to mutate
      // docsToInsert with generated ids) so the cityState projection below
      // can point lastReportId at the exact row it was derived from.
      for (const doc of docsToInsert) doc._id = new ObjectId();
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

  // Best-effort, same reasoning as above. Runs for every report in the
  // batch, including dedup-suppressed ones — cityName/allianceId aren't part
  // of the dedup signature (see reportContentSignature), so a
  // content-duplicate report can still carry a genuine name/alliance
  // change. A duplicate has no doc._id (nothing new was inserted for it),
  // so its cityState upsert refreshes everything except lastReportId,
  // which keeps pointing at whichever report actually backs it.
  try {
    const cityStateOps = docs.map((doc) => {
      const candidate = CityStateDocument.parse({
        worldId: doc.worldId,
        cityId: doc.cityId,
        cityName: doc.cityName,
        playerId: doc.playerId,
        playerName: doc.playerName,
        allianceId: doc.allianceId,
        x: doc.x,
        y: doc.y,
        troops: doc.troops,
        supportTroops: doc.supportTroops,
        supportDetails: doc.supportDetails,
        lastObservedAt: doc.observedAt,
        lastReportedAt: insertedAt,
        lastReportId: doc._id,
        lastReportedBy: doc.submittedBy,
      });
      return {
        updateOne: {
          filter: { worldId: doc.worldId, cityId: doc.cityId },
          update: { $set: stripUndefined(candidate) },
          upsert: true,
        },
      };
    });
    if (cityStateOps.length > 0) {
      await getDb().collection("cityState").bulkWrite(cityStateOps);
    }

    // Keyed on the real Grepolis player id (Game.player_id). A batch is
    // currently always one report, but if that ever changes, the
    // most-recently-observed one wins rather than array order.
    const latestDoc = docs.reduce(
      (latest, doc) => (!latest || doc.observedAt > latest.observedAt ? doc : latest),
      null
    );
    // playerId is optional on CityReport — older/un-updated clients won't
    // send it yet, and there's no player identity to upsert without it.
    if (latestDoc && latestDoc.playerId != null) {
      const playerCandidate = PlayerDocument.parse({
        worldId: latestDoc.worldId,
        playerId: latestDoc.playerId,
        playerName: latestDoc.playerName,
        submittedById: latestDoc.submittedBy._id,
        username: latestDoc.submittedBy.username,
        currentAllianceId: latestDoc.allianceId,
        lastCityId: latestDoc.cityId,
        lastCityName: latestDoc.cityName,
        lastReportedAt: insertedAt,
      });
      await getDb()
        .collection("players")
        .updateOne(
          { worldId: latestDoc.worldId, playerId: latestDoc.playerId },
          { $set: stripUndefined(playerCandidate) },
          { upsert: true }
        );
    }
  } catch (err) {
    console.error("[server] failed to update cityState/players projections", err);
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

// Same worldId requirement as /api/reports/last, same reason. Projects only
// native troops + freshness — supportTroops/supportDetails/identity fields
// are deliberately left out since the only consumer (the in-game city report
// panel) shows native counts only.
app.get("/api/reports/cityState", requireAuth, async (req, res) => {
  const cityId = Number(req.query.cityId);
  const worldId = req.query.worldId;

  if (!Number.isInteger(cityId) || typeof worldId !== "string" || !worldId) {
    return res.status(400).json({ error: "cityId and worldId are required" });
  }

  try {
    const state = await getDb()
      .collection("cityState")
      .findOne({ cityId, worldId }, { projection: { troops: 1, lastReportedAt: 1 } });

    res.status(200).json({
      troops: state ? state.troops : null,
      lastReportedAt: state ? state.lastReportedAt : null,
    });
  } catch (err) {
    console.error("[server] failed to look up city state", err);
    res.status(500).json({ error: "failed to look up city state" });
  }
});

// Dashboard webapp, mounted into this same process/domain rather than run as
// a separate service — magiceye.grasstouchers.gg needs to stay the one
// domain, and the two don't need runtime isolation from each other. Its
// pages (/overview, /scenarios, ...) own everything not already claimed by a
// route or static file above, including "/" itself.
const nextApp = next({
  dev: process.env.NODE_ENV !== "production",
  dir: path.join(__dirname, "..", "webapp"),
});
const handleNextRequest = nextApp.getRequestHandler();
app.all("*", (req, res) => handleNextRequest(req, res));

const port = process.env.PORT || 8080;

Promise.all([connectDb(), nextApp.prepare()])
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`Server listening on :${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server", err);
    process.exit(1);
  });
