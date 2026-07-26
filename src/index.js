import { Logger } from "./logger.js";
import { ReportPayload } from "../shared/payload.js";
import { reportContentSignature } from "../shared/reportDedup.js";
import {
  getStoredToken,
  setStoredToken,
  generateSessionId,
  pollForToken,
} from "./auth.js";
import { showLoginLink, hideLoginLink } from "./ui/loginPrompt.js";
import {
  injectSettingsButton,
  injectStaleIndicator,
  setStaleIndicatorState,
} from "./ui/settingsMenu.js";
import { FEATURE_FLAGS } from "./featureFlags.js";
import {
  watchDefenseHeader,
  readCurrentCityTroops,
  readCurrentCityName,
  readCityDefenseBreakdown,
  readWorldId,
  incrementIndexCount,
  flashIndexButtonSuccess,
  registerSpamClick,
  resetSpamMeter,
  injectTownIndicator,
  watchTownName,
  setTownIndicatorState,
  watchTownGroupsList,
} from "./ui/troopIndexer.js";

const logger = new Logger("main");

const API_BASE = __API_BASE__; // injected at build time from config.cjs, see build.cjs

// Shared by every authenticated request: attaches the stored token, and on
// a 401 shows the login modal, polls until the popup reports a token, then
// retries once with it. Returns null (rather than a Response) if the user
// never completes login, so callers can short-circuit without also having
// to special-case a 401 Response.
//
// Concurrent 401s (e.g. the town indicator re-checking on a city switch
// while the startup check is still pending login) share one pendingLogin
// promise instead of each opening their own session/poll loop — only the
// first shows a login link at all, since showLoginLink is itself a no-op
// while one is already showing.
let pendingLogin = null;

async function authenticatedFetch(makeRequest) {
  let token = getStoredToken();
  let res = await makeRequest(token);

  if (res.status === 401) {
    if (!pendingLogin) {
      logger.warn("auth required, showing login link");
      const sessionId = generateSessionId();
      const loginUrl = `${API_BASE}/login?session=${encodeURIComponent(sessionId)}`;
      showLoginLink(loginUrl);

      pendingLogin = pollForToken(API_BASE, sessionId)
        .then((polledToken) => {
          setStoredToken(polledToken);
          return polledToken;
        })
        .catch((err) => {
          logger.error("login failed or timed out", err);
          return null;
        })
        .finally(() => {
          hideLoginLink();
          pendingLogin = null;
        });
    }

    token = await pendingLogin;
    if (!token) return null;

    res = await makeRequest(token);
  }

  return res;
}

function postReports(payload, token) {
  return fetch(`${API_BASE}/api/reports`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

export async function sendReports(reports) {
  const payload = ReportPayload.parse({
    scriptVersion: "0.1.0",
    reports,
  });

  const res = await authenticatedFetch((token) => postReports(payload, token));

  if (!res || !res.ok) {
    if (res) logger.error("failed to send reports", res.status);
    return false;
  }

  logger.log(`sent ${reports.length} report(s)`);
  return true;
}

function getLastReportTime(cityId, worldId, token) {
  const params = new URLSearchParams({ cityId: String(cityId), worldId });
  return fetch(`${API_BASE}/api/reports/last?${params}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// People flip through cities a lot, often revisiting one within seconds —
// a short client-side cache avoids a network round trip for every single
// switch. The staleness threshold this feeds into is measured in days, so
// a minute of slack here is a non-issue.
const LAST_REPORT_CACHE_TTL_MS = 60 * 1000;
const lastReportCache = new Map(); // `${worldId}:${cityId}` -> { value, expiresAt }

function lastReportCacheKey(cityId, worldId) {
  return `${worldId}:${cityId}`;
}

// Also used to prime the cache right after a successful index, so switching
// away and back within the TTL doesn't show a stale pre-index value.
function cacheLastReportTime(cityId, worldId, value) {
  lastReportCache.set(lastReportCacheKey(cityId, worldId), {
    value,
    expiresAt: Date.now() + LAST_REPORT_CACHE_TTL_MS,
  });
}

export async function fetchLastReportTime(cityId, worldId) {
  const key = lastReportCacheKey(cityId, worldId);
  const cached = lastReportCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const res = await authenticatedFetch((token) =>
    getLastReportTime(cityId, worldId, token),
  );

  if (!res || !res.ok) {
    if (res) logger.error("failed to fetch last report time", res.status);
    return null; // not cached — a failure shouldn't stick around for a minute
  }

  const data = await res.json();
  const value = data.lastReportedAt ? new Date(data.lastReportedAt) : null;
  cacheLastReportTime(cityId, worldId, value);
  return value;
}

// Session-scoped tally of distinct cities currently believed stale, keyed
// the same way as lastReportCache so revisiting a city (however many times)
// only ever counts its current state once. Storing explicit booleans (not
// just "seen" membership) is what lets a fresh->stale or stale->fresh
// transition be detected — a plain Set could dedupe but couldn't tell "no
// change" from "first time confirmed fresh".
const cityStaleness = new Map(); // `${worldId}:${cityId}` -> boolean
let staleCityCount = 0;

function registerCityStaleness(cityId, worldId, isStale) {
  const key = lastReportCacheKey(cityId, worldId);
  const wasStale = cityStaleness.get(key);
  if (wasStale === isStale) return;

  cityStaleness.set(key, isStale);

  if (isStale && !wasStale) {
    staleCityCount += 1;
  } else if (!isStale && wasStale) {
    staleCityCount -= 1;
  }

  setStaleIndicatorState(cityStaleness.size, staleCityCount);
}

// Updates everything that should reflect "this city's data is current as
// of right now" — used both after a real submit and after a client-side
// deduped skip, since in both cases the city genuinely is up to date.
function markCityFresh(cityId, worldId) {
  const now = new Date();
  const isStale = setTownIndicatorState(now);
  cacheLastReportTime(cityId, worldId, now);
  registerCityStaleness(cityId, worldId, isStale);
}

// Same-session, client-side half of dedup: if the troop/support content is
// unchanged since the last thing actually submitted for this city, skip
// the network call entirely rather than round-tripping just to have the
// server (which does its own signature check) discard it. Reuses the same
// TTL as lastReportCache — the window doesn't need to be its own knob.
const lastSubmittedSignature = new Map(); // `${worldId}:${cityId}` -> { signature, expiresAt }

function isDuplicateSubmission(
  cityId,
  worldId,
  troops,
  supportTroops,
  supportDetails,
) {
  const cached = lastSubmittedSignature.get(
    lastReportCacheKey(cityId, worldId),
  );
  if (!cached || cached.expiresAt <= Date.now()) return false;
  return (
    cached.signature ===
    reportContentSignature({ troops, supportTroops, supportDetails })
  );
}

function rememberSubmission(
  cityId,
  worldId,
  troops,
  supportTroops,
  supportDetails,
) {
  lastSubmittedSignature.set(lastReportCacheKey(cityId, worldId), {
    signature: reportContentSignature({
      troops,
      supportTroops,
      supportDetails,
    }),
    expiresAt: Date.now() + LAST_REPORT_CACHE_TTL_MS,
  });
}

function indexCurrentCity() {
  let troops = readCurrentCityTroops();
  if (!troops) {
    logger.warn("units box not found, nothing to index");
    return;
  }

  const worldId = readWorldId();
  if (!worldId) {
    logger.warn("could not parse world id from hostname, nothing to index");
    return;
  }

  const cityId = window.Game && window.Game.townId;
  if (!cityId) {
    logger.warn("Game.townId not available, cityId will be wrong");
  }

  const cityName = readCurrentCityName();
  if (!cityName) {
    logger.warn(
      ".town_name_area .town_name not found, cityName will be omitted",
    );
  }

  // Not every player is in an alliance, so a missing value here isn't a
  // warning-worthy failure the way a missing cityId/cityName would be.
  const allianceId = window.Game && window.Game.alliance_id;

  const playerId = window.Game && window.Game.player_id;
  const playerName = window.Game && window.Game.player_name;

  let supportTroops;
  let supportDetails;
  const breakdown = readCityDefenseBreakdown();
  if (breakdown) {
    troops = breakdown.native;
    supportTroops = breakdown.support;
    supportDetails = breakdown.supportDetails;
  } else {
    logger.warn("Agora Defense tab is not open, sending merged totals instead");
  }

  if (
    isDuplicateSubmission(
      cityId,
      worldId,
      troops,
      supportTroops,
      supportDetails,
    )
  ) {
    registerSpamClick();
    markCityFresh(cityId, worldId);
    return;
  }

  return sendReports([
    {
      cityId: cityId || 0,
      worldId,
      ...(cityName ? { cityName } : {}),
      ...(typeof playerId === "number" ? { playerId } : {}),
      ...(playerName ? { playerName } : {}),
      ...(typeof allianceId === "number" ? { allianceId } : {}),
      troops,
      ...(supportTroops ? { supportTroops } : {}),
      ...(supportDetails && supportDetails.length ? { supportDetails } : {}),
      observedAt: new Date(),
    },
  ])
    .then((success) => {
      if (success) {
        incrementIndexCount();
        resetSpamMeter();
        flashIndexButtonSuccess();
        markCityFresh(cityId, worldId);
        rememberSubmission(
          cityId,
          worldId,
          troops,
          supportTroops,
          supportDetails,
        );
      }
    })
    .catch((err) => logger.error("sendReports failed", err));
}

// The button stays fully clickable — no disabled/dimmed state — but a
// click while a request is already in flight doesn't fire a second one;
// it's just tallied instead (clicksWhileInFlight, currently only feeding
// the SPAM_CLICK_THRESHOLD log below — this is the hook point for the
// planned gamification hit on repeated clicks, not built yet). Once the
// in-flight request resolves, the next click is free to fire a real one
// again — indexCurrentCity's own client-side dedup check (fast, in-memory)
// is what keeps that from actually hitting the network on unchanged data,
// not this guard.
const SPAM_CLICK_THRESHOLD = 4;

function withSpamGuard(fn, threshold = SPAM_CLICK_THRESHOLD) {
  let inFlight = false;
  let clicksWhileInFlight = 0;

  return (...args) => {
    if (inFlight) {
      clicksWhileInFlight += 1;
      if (clicksWhileInFlight >= threshold) {
        logger.log("special thing");
      }
      return;
    }

    inFlight = true;
    clicksWhileInFlight = 0;

    Promise.resolve(fn(...args)).finally(() => {
      inFlight = false;
    });
  };
}

watchDefenseHeader(withSpamGuard(indexCurrentCity));

injectSettingsButton();

// The icon itself always renders — only the live staleness check (and the
// login prompt it can trigger) is gated by checkCityStaleness.
injectTownIndicator();

// Unattended, no click required — this is what surfaces the login modal at
// startup (via fetchLastReportTime -> authenticatedFetch) when the flag is
// on, rather than waiting for the user's first index click to hit a 401.
// Also re-runs on every city switch, keeping the indicator's dot current.
function refreshTownIndicator() {
  const cityId = window.Game && window.Game.townId;
  const worldId = readWorldId();
  if (!cityId || !worldId) {
    logger.warn(
      "checkCityStaleness: could not determine cityId/worldId, skipping",
    );
    return;
  }

  fetchLastReportTime(cityId, worldId)
    .then((lastReportedAt) => {
      const isStale = setTownIndicatorState(lastReportedAt);
      registerCityStaleness(cityId, worldId, isStale);
    })
    .catch((err) => logger.error("checkCityStaleness failed", err));
}

// Only reads already-known staleness (cityStaleness), doesn't check
// anything new — a city not yet visited/checked this session just gets no
// dot, same as its town indicator would show nothing until checked.
function isCityKnownStale(cityId) {
  const worldId = readWorldId();
  if (!worldId) return false;
  return cityStaleness.get(lastReportCacheKey(cityId, worldId)) === true;
}

if (FEATURE_FLAGS.checkCityStaleness) {
  injectStaleIndicator();
  refreshTownIndicator();
  watchTownName(refreshTownIndicator);
  watchTownGroupsList(isCityKnownStale);
}

logger.log("loaded");
