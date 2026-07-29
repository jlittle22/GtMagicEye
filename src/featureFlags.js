import { isUsingCustomBackend } from "./backendConfig.js";

const STORAGE_KEY = "gt_feature_flags";

// Both of these talk to the configured backend (message is currently
// hardcoded client-side, but is meant to eventually come from the server;
// checkCityStaleness always does) — a custom backend isn't guaranteed to
// implement either, so they're force-disabled rather than left toggleable
// and silently broken.
export const CUSTOM_BACKEND_DISABLED_FLAGS = ["message", "checkCityStaleness"];

const DEFAULTS = {
  // When true, a hardcoded message shows at the top of the settings panel.
  message: true,
  // Gates the unattended check (src/index.js) that fetches the last report
  // time for the current city — on load and on every city switch — to
  // drive the town indicator's stale dot. Prompts login if needed, since
  // that fetch is authenticated.
  checkCityStaleness: true,
  // When false, hides the GT icon injected next to the city title
  // (buildTownIndicator in troopIndexer.js) but keeps its stale dot, for
  // users who want the staleness signal without the icon itself.
  showTownIcon: true,
};

function loadOverrides() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Snapshot of what the custom-backend-disabled flags were set to right
// before a custom backend got enabled — separate from STORAGE_KEY itself,
// since the forcing below is a runtime-only mutation that never persists
// (see the isUsingCustomBackend block), so this is the only record of the
// pre-enable values once the page reloads.
const CUSTOM_BACKEND_SNAPSHOT_KEY = "gt_feature_flags_custom_backend_snapshot";

// Called right before enabling a custom backend (see settingsMenu.js) —
// captures the disabled flags' current values so disabling it later can
// restore them instead of leaving them at their forced-off state.
export function snapshotFlagsForCustomBackend() {
  const snapshot = {};
  for (const key of CUSTOM_BACKEND_DISABLED_FLAGS) {
    snapshot[key] = FEATURE_FLAGS[key];
  }
  try {
    localStorage.setItem(CUSTOM_BACKEND_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

// Called right before disabling a custom backend — puts the disabled flags
// back to whatever they were snapshotted as, falling back to DEFAULTS for
// any flag missing from the snapshot (e.g. no custom backend was ever
// enabled this browser). Consumes the snapshot so a later re-enable starts
// from a clean capture rather than a stale one.
export function restoreFlagsFromCustomBackendSnapshot() {
  let snapshot = {};
  try {
    const raw = localStorage.getItem(CUSTOM_BACKEND_SNAPSHOT_KEY);
    snapshot = raw ? JSON.parse(raw) : {};
  } catch {
    snapshot = {};
  }

  for (const key of CUSTOM_BACKEND_DISABLED_FLAGS) {
    const value = key in snapshot ? snapshot[key] : DEFAULTS[key];
    setFeatureFlag(key, value);
  }

  try {
    localStorage.removeItem(CUSTOM_BACKEND_SNAPSHOT_KEY);
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

// Settings-menu toggles mutate this object directly and persist via
// setFeatureFlag — everything reading FEATURE_FLAGS.x just sees the latest
// value, but code that branches on a flag at script-load time (e.g. which
// button-injection watcher to start) won't re-run until the page reloads.
export const FEATURE_FLAGS = { ...DEFAULTS, ...loadOverrides() };

if (isUsingCustomBackend()) {
  for (const key of CUSTOM_BACKEND_DISABLED_FLAGS) {
    FEATURE_FLAGS[key] = false;
  }
}

export function setFeatureFlag(key, value) {
  FEATURE_FLAGS[key] = value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(FEATURE_FLAGS));
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}
