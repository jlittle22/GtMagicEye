const STORAGE_KEY = "gt_backend_url_override";

function loadOverride() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, url: "" };
  } catch {
    return { enabled: false, url: "" };
  }
}

export function getBackendUrlOverride() {
  return loadOverride();
}

export function setBackendUrlOverride(enabled, url) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, url }));
  } catch {
    // ignore storage failures (e.g. private browsing)
  }
}

// Shared by getApiBase and isUsingCustomBackend so the two can't drift:
// the override only takes effect once both enabled and given a non-empty
// value, so flipping the checkbox on with a blank field doesn't blank out
// every request URL.
function isOverrideActive(override) {
  return !!(override.enabled && override.url);
}

// __API_BASE__ is injected at build time from config.cjs (see build.cjs).
export function getApiBase() {
  const override = loadOverride();
  if (isOverrideActive(override)) return override.url;
  return __API_BASE__;
}

export function isUsingCustomBackend() {
  return isOverrideActive(loadOverride());
}
