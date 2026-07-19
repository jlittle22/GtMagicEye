import { Logger } from './logger.js';
import { ReportPayload } from '../shared/payload.js';
import { getStoredToken, setStoredToken, generateSessionId, pollForToken } from './auth.js';
import { showLoginLink, hideLoginLink } from './ui/loginPrompt.js';
import { injectSettingsButton } from './ui/settingsMenu.js';
import {
  watchDefenseHeader,
  readCurrentCityTroops,
  readCurrentCityName,
  readCityDefenseBreakdown,
  incrementIndexCount,
  setIndexButtonDisabled,
} from './ui/troopIndexer.js';

const logger = new Logger('main');

const API_BASE = __API_BASE__; // injected at build time from config.cjs, see build.cjs

function postReports(payload, token) {
  return fetch(`${API_BASE}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
}

export async function sendReports(reports) {
  const payload = ReportPayload.parse({
    scriptVersion: '0.1.0',
    reports,
  });

  let token = getStoredToken();
  let res = await postReports(payload, token);

  if (res.status === 401) {
    logger.warn('auth required, showing login link');
    const sessionId = generateSessionId();
    const loginUrl = `${API_BASE}/login?session=${encodeURIComponent(sessionId)}`;
    showLoginLink(loginUrl);

    try {
      token = await pollForToken(API_BASE, sessionId);
    } catch (err) {
      hideLoginLink();
      logger.error('login failed or timed out', err);
      return false;
    }

    hideLoginLink();
    setStoredToken(token);

    res = await postReports(payload, token);
  }

  if (!res.ok) {
    logger.error('failed to send reports', res.status);
    return false;
  }

  logger.log(`sent ${reports.length} report(s)`);
  return true;
}

function indexCurrentCity() {
  let troops = readCurrentCityTroops();
  if (!troops) {
    logger.warn('units box not found, nothing to index');
    return;
  }

  const cityId = window.Game && window.Game.townId;
  if (!cityId) {
    logger.warn('Game.townId not available, cityId will be wrong');
  }

  const cityName = readCurrentCityName();
  if (!cityName) {
    logger.warn('.town_name_area .town_name not found, cityName will be omitted');
  }

  // Not every player is in an alliance, so a missing value here isn't a
  // warning-worthy failure the way a missing cityId/cityName would be.
  const allianceId = window.Game && window.Game.alliance_id;

  let supportTroops;
  let supportDetails;
  const breakdown = readCityDefenseBreakdown();
  if (breakdown) {
    troops = breakdown.native;
    supportTroops = breakdown.support;
    supportDetails = breakdown.supportDetails;
  } else {
    logger.warn('Agora Defense tab is not open, sending merged totals instead');
  }

  return sendReports([
    {
      cityId: cityId || 0,
      ...(cityName ? { cityName } : {}),
      ...(typeof allianceId === 'number' ? { allianceId } : {}),
      troops,
      ...(supportTroops ? { supportTroops } : {}),
      ...(supportDetails && supportDetails.length ? { supportDetails } : {}),
      observedAt: new Date(),
    },
  ])
    .then((success) => {
      if (success) incrementIndexCount();
    })
    .catch((err) => logger.error('sendReports failed', err));
}

// Clicking while a request is already in flight doesn't fire a second one —
// the button is disabled (visually, though clicks still register so they can
// be tallied) until the in-flight window ends. That window is at least
// MIN_GUARD_DURATION_MS even if the request resolves faster, so a rapid
// double-click can't sneak a second request in right as the first finishes.
// Hitting the click threshold within that window means the user is
// spam-clicking rather than triggering occasional re-indexes.
//
// Disabled state is toggled via setIndexButtonDisabled (troopIndexer.js)
// rather than styling event.currentTarget directly: a city switch can wipe
// and recreate the button mid-request, and that module tracks the disabled
// flag independently so the newly created node still shows as disabled.
const SPAM_CLICK_THRESHOLD = 4;
const MIN_GUARD_DURATION_MS = 1000;

function withSpamGuard(fn, threshold = SPAM_CLICK_THRESHOLD, minDurationMs = MIN_GUARD_DURATION_MS) {
  let inFlight = false;
  let clicksWhileInFlight = 0;

  return (...args) => {
    if (inFlight) {
      clicksWhileInFlight += 1;
      if (clicksWhileInFlight >= threshold) {
        logger.log('special thing');
      }
      return;
    }

    inFlight = true;
    clicksWhileInFlight = 0;
    setIndexButtonDisabled(true);

    const minDuration = new Promise((resolve) => setTimeout(resolve, minDurationMs));

    Promise.all([Promise.resolve(fn(...args)), minDuration]).finally(() => {
      inFlight = false;
      setIndexButtonDisabled(false);
    });
  };
}

watchDefenseHeader(withSpamGuard(indexCurrentCity));

injectSettingsButton();

logger.log('loaded');
