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
      return;
    }

    hideLoginLink();
    setStoredToken(token);

    res = await postReports(payload, token);
  }

  if (!res.ok) {
    logger.error('failed to send reports', res.status);
    return;
  }

  logger.log(`sent ${reports.length} report(s)`);
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

  incrementIndexCount();

  sendReports([
    {
      cityId: cityId || 0,
      ...(cityName ? { cityName } : {}),
      ...(typeof allianceId === 'number' ? { allianceId } : {}),
      troops,
      ...(supportTroops ? { supportTroops } : {}),
      ...(supportDetails && supportDetails.length ? { supportDetails } : {}),
      observedAt: new Date().toISOString(),
    },
  ]).catch((err) => logger.error('sendReports failed', err));
}

watchDefenseHeader(indexCurrentCity);

injectSettingsButton();

logger.log('loaded');
