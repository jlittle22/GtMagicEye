const STORAGE_KEY = "gt_feature_flags";

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

// Settings-menu toggles mutate this object directly and persist via
// setFeatureFlag — everything reading FEATURE_FLAGS.x just sees the latest
// value, but code that branches on a flag at script-load time (e.g. which
// button-injection watcher to start) won't re-run until the page reloads.
export const FEATURE_FLAGS = { ...DEFAULTS, ...loadOverrides() };

export function setFeatureFlag(key, value) {
  FEATURE_FLAGS[key] = value;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(FEATURE_FLAGS));
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}
