const STORAGE_KEY = 'gt_feature_flags';

const DEFAULTS = {
  // When true, a hardcoded message shows at the top of the settings panel.
  message: true,
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
