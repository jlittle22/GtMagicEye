import { SECONDARY_COLOR, PRIMARY_COLOR } from "./theme.js";
import logoIcon from "../../assets/logo-icon.png";

const UNIT_BOX_SELECTOR = ".nui_units_box";
const DEFENSE_HEADER_SELECTOR = "#defense_header";
const DEFENSE_BUTTON_ID = "gt-index-troops-btn-defense";

export function readCurrentCityTroops() {
  const box = document.querySelector(UNIT_BOX_SELECTOR);
  if (!box) return null;

  const troops = {};
  box.querySelectorAll(".unit_icon40x40.unit[data-type]").forEach((el) => {
    const type = el.dataset.type;
    const valueEl = el.querySelector(".value");
    const count = valueEl ? parseInt(valueEl.textContent, 10) : NaN;
    if (type && Number.isFinite(count)) {
      troops[type] = count;
    }
  });
  return troops;
}

// e.g. "us145.grepolis.com" -> "us145". Grepolis puts the world on the
// subdomain, so this is derivable anywhere the script runs in-game.
const WORLD_ID_PATTERN = /^([a-z0-9]+)\.grepolis\.com$/i;

export function readWorldId() {
  const match = window.location.hostname.match(WORLD_ID_PATTERN);
  return match ? match[1] : null;
}

const TOWN_NAME_SELECTOR = ".town_name_area .town_name";

// Part of the persistent top toolbar (with the prev/next-town arrows), unlike
// the coordinates popup or the Defense tab — always available.
export function readCurrentCityName() {
  const el = document.querySelector(TOWN_NAME_SELECTOR);
  const name = el?.textContent.trim();
  return name || null;
}

const DEFENSE_BOX_SELECTOR = "#place_defense";

// The town/player links in the Defense tab encode their data as base64 JSON
// in the href, e.g. #eyJpZCI6MTY2MSwiaXgiOjQ0OSwiaXkiOjUxNCwidHAiOiJ0b3duIiwibmFtZSI6IkludGVncmF0ZWQgQ2lyY3VpdCJ9
// -> {"id":1661,"ix":449,"iy":514,"tp":"town","name":"Integrated Circuit"}
function decodeHashPayload(href) {
  if (!href || !href.startsWith("#")) return null;
  try {
    return JSON.parse(atob(href.slice(1)));
  } catch {
    return null;
  }
}

function readUnitCounts(li) {
  const troops = {};
  li.querySelectorAll(".place_unit[data-unit_id]").forEach((unitEl) => {
    const type = unitEl.dataset.unit_id;
    const count = parseInt(unitEl.dataset.unit_count, 10);
    if (type && Number.isFinite(count)) {
      troops[type] = (troops[type] || 0) + count;
    }
  });
  return troops;
}

function mergeCounts(target, source) {
  for (const [type, count] of Object.entries(source)) {
    target[type] = (target[type] || 0) + count;
  }
}

// Splits native vs incoming-support troops, plus per-origin support detail,
// using the Agora ("Place" building) Defense tab. Unlike .nui_units_box, this
// element only exists in the DOM while that window is open (it's a jQuery-UI
// dialog created on open, removed on close) — returns null if it isn't, so
// the caller can fall back.
export function readCityDefenseBreakdown() {
  const box = document.querySelector(DEFENSE_BOX_SELECTOR);
  if (!box) return null;

  const native = {};
  const support = {};
  const supportDetails = [];

  box.querySelectorAll(".game_list > li.place_units").forEach((li) => {
    if (li.id === "support_units") return; // merged total row, redundant with .nui_units_box

    const troops = readUnitCounts(li);

    if (!li.classList.contains("support_units_from_other_town")) {
      mergeCounts(native, troops);
      return;
    }

    mergeCounts(support, troops);

    const town = decodeHashPayload(
      li.querySelector(".gp_town_link")?.getAttribute("href"),
    );
    const player = decodeHashPayload(
      li.querySelector(".gp_player_link")?.getAttribute("href"),
    );
    const supportId = parseInt((li.id || "").replace("support_units_", ""), 10);

    supportDetails.push({
      ...(Number.isFinite(supportId) ? { supportId } : {}),
      ...(town
        ? {
            originTownId: town.id,
            originTownName: town.name,
            originX: town.ix,
            originY: town.iy,
          }
        : {}),
      ...(player
        ? { originPlayerId: player.id, originPlayerName: player.name }
        : {}),
      troops,
    });
  });

  return { native, support, supportDetails };
}

const BADGE_RED = "#c0392b";

// Session-scoped only (resets on page reload) — not persisted anywhere.
let indexCount = 0;

function badgeId(buttonId) {
  return `${buttonId}-badge`;
}

// Hidden at 0 (nothing indexed yet this session), then visible for the rest
// of the session once it ticks up at least once. Stays red throughout —
// no green "success" state, red is just the "you've indexed N" indicator.
function buildBadge(buttonId) {
  const badge = document.createElement("div");
  badge.id = badgeId(buttonId);
  badge.textContent = String(indexCount);
  badge.style.cssText = [
    "position:absolute",
    "top:-6px",
    "right:-6px",
    "width:12px",
    "height:12px",
    "border-radius:50%",
    `background:${BADGE_RED}`,
    "color:#fff",
    "font:bold 7px sans-serif",
    "align-items:center",
    "justify-content:center",
    "box-shadow:0 1px 3px rgba(0,0,0,0.5)",
    `display:${indexCount > 0 ? "flex" : "none"}`,
  ].join(";");
  return badge;
}

// Bumps the count and updates the currently-rendered badge in place, since
// watchAndInject may not re-run before the next click.
export function incrementIndexCount() {
  indexCount += 1;
  const el = document.getElementById(badgeId(DEFENSE_BUTTON_ID));
  if (el) {
    el.textContent = String(indexCount);
    el.style.display = "flex";
  }
}

const DEFAULT_POSITION = ["top:2px", "right:2px"];

// City switches (and reopening the Agora window) wipe and recreate the
// button via watchAndInject below, mid-request or not. Tracking the disabled
// state here (rather than only styling whatever node happened to be clicked)
// means a freshly recreated button picks up the correct look immediately,
// instead of momentarily rendering as enabled again while a request from the
// previous city is still in flight.
let indexButtonDisabled = false;

function applyDisabledStyle(btn) {
  btn.style.opacity = indexButtonDisabled ? "0.5" : "";
  btn.style.cursor = indexButtonDisabled ? "not-allowed" : "pointer";
}

export function setIndexButtonDisabled(disabled) {
  indexButtonDisabled = disabled;
  const btn = document.getElementById(DEFENSE_BUTTON_ID);
  if (btn) applyDisabledStyle(btn);
}

function buildButton(id, onClick, positionStyle = DEFAULT_POSITION) {
  const btn = document.createElement("div");
  btn.id = id;
  btn.title = "Index Troops";
  btn.style.cssText = [
    "position:absolute",
    ...positionStyle,
    "z-index:1000",
    "padding:3px",
    "line-height:0",
    "cursor:pointer",
    `background:${PRIMARY_COLOR}`,
    `border:1px solid ${SECONDARY_COLOR}`,
    "border-radius:4px",
    "box-shadow:0 1px 4px rgba(0,0,0,0.4)",
  ].join(";");

  const icon = document.createElement("img");
  icon.src = logoIcon;
  icon.alt = "Index Troops";
  icon.style.cssText = "display:block;width:18px;height:18px;";
  btn.appendChild(icon);

  btn.addEventListener("click", onClick);
  btn.appendChild(buildBadge(id));
  applyDisabledStyle(btn);
  return btn;
}

// #defense_header sits inside a dialog (#place_defense) whose total height
// Grepolis fixes via .game_list's inline min/max-height — growing the
// header to fit our button pushes .game_list and the "Return all units"
// footer below it down by the same amount, cutting the footer off past the
// dialog's visible bounds. Shrinking .game_list's height by exactly what
// the header grew keeps the total the same as it was unmodified.
function compensateSiblingListHeight(headerEl, growthPx) {
  if (!(growthPx > 0)) return;

  const list = headerEl.parentElement?.querySelector(".game_list");
  if (!list) return;

  const shrink = (styleValue) => {
    const px = parseFloat(styleValue);
    return Number.isFinite(px) ? `${px - growthPx}px` : styleValue;
  };

  if (list.style.minHeight) list.style.minHeight = shrink(list.style.minHeight);
  if (list.style.maxHeight) list.style.maxHeight = shrink(list.style.maxHeight);
}

function ensureButtonAt(selector, buttonId, onClick, options = {}) {
  const container = document.querySelector(selector);
  if (!container || container.querySelector(`#${buttonId}`)) return;

  if (!container.style.position) {
    container.style.position = "relative";
  }
  if (options.minHeight) {
    // Measured before/after (not assumed) since min-height only grows the
    // element if it's actually taller than the natural content — this way
    // the compensation is exactly right regardless of the header's real
    // native size, which isn't something we can see from here.
    const before = container.getBoundingClientRect().height;
    container.style.minHeight = options.minHeight;
    const after = container.getBoundingClientRect().height;
    compensateSiblingListHeight(container, after - before);
  }
  if (options.centerContent) {
    container.style.display = "flex";
    container.style.alignItems = "center";
  }
  container.appendChild(buildButton(buttonId, onClick, options.positionStyle));
}

// Both target elements get re-rendered by the game (city switch for the units
// box, window reopen for the defense header), wiping our button along with
// them. Watching and re-injecting is more resilient than inject-on-load.
function watchAndInject(selector, buttonId, onClick, options) {
  ensureButtonAt(selector, buttonId, onClick, options);
  const observer = new MutationObserver(() =>
    ensureButtonAt(selector, buttonId, onClick, options),
  );
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

// Only appears while the Agora Defense tab is open — matches where
// readCityDefenseBreakdown can actually read data from.
export function watchDefenseHeader(onClick) {
  return watchAndInject(DEFENSE_HEADER_SELECTOR, DEFENSE_BUTTON_ID, onClick, {
    minHeight: "32px",
    centerContent: true,
    positionStyle: ["top:50%", "right:10px", "transform:translateY(-50%)"],
  });
}

const TOWN_INDICATOR_ID = "gt-town-indicator";
const TOWN_INDICATOR_DOT_ID = `${TOWN_INDICATOR_ID}-dot`;
// __STALE_AFTER_DAYS__ injected at build time from config.cjs, see build.cjs
const STALE_THRESHOLD_MS = __STALE_AFTER_DAYS__ * 24 * 60 * 60 * 1000;

// Grepolis's own timestamps in-game are server-time, but there's no single
// server time here — always New York, regardless of viewer's local zone,
// so the value means the same thing to everyone reading it.
function formatNewYorkTimestamp(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}:${get("second")} ${get("day")}/${get("month")}/${get("year")}`;
}

function buildTownIndicator() {
  const wrap = document.createElement("span");
  wrap.id = TOWN_INDICATOR_ID;
  wrap.style.cssText = [
    "position:relative",
    "display:inline-flex",
    "align-items:center",
    "justify-content:center",
    "width:15px",
    "height:15px",
    "margin-right:4px",
    "vertical-align:middle",
  ].join(";");

  const icon = document.createElement("img");
  icon.src = logoIcon;
  icon.alt = "GT Magic Eye";
  icon.style.cssText =
    "display:block;width:14px;height:14px;pointer-events:none;";
  wrap.appendChild(icon);

  const dot = document.createElement("span");
  dot.id = TOWN_INDICATOR_DOT_ID;
  dot.style.cssText = [
    "position:absolute",
    "top:-2px",
    "right:-2px",
    "width:7px",
    "height:7px",
    "border-radius:50%",
    `background:${BADGE_RED}`,
    "box-shadow:0 0 0 1px rgba(0,0,0,0.45)",
    "display:none",
    "pointer-events:none",
  ].join(";");
  wrap.appendChild(dot);

  return wrap;
}

// .town_name sits inside .caption, which centers its (normally single)
// child — so rather than touch .caption's own layout (which broke that
// centering: .caption's centering turned out to depend on styling we can't
// see/preserve from here), .town_name is moved inside a wrapper alongside
// the icon. .caption still has exactly one child, just a wider one, so
// whatever centers it keeps centering — and the icon + name now move as a
// single unit since they're both inside that one child.
//
// .town_name_area is part of the persistent top toolbar (see
// readCurrentCityName above) rather than something the game
// destroys/recreates on city switch, so a one-time idempotent insert is
// enough — no watchAndInject-style resilience needed here.
export function injectTownIndicator() {
  if (document.getElementById(TOWN_INDICATOR_ID)) return;

  const nameEl = document.querySelector(TOWN_NAME_SELECTOR);
  if (!nameEl || !nameEl.parentElement) return;

  const group = document.createElement("span");
  group.style.cssText = "display:inline-flex;align-items:center;";

  nameEl.parentElement.insertBefore(group, nameEl);
  group.appendChild(buildTownIndicator());
  group.appendChild(nameEl);
}

// Updates the currently-rendered indicator in place: red dot when the last
// report is more than a week old (or there isn't one), plus a hover tooltip
// with the exact timestamp. lastReportedAt is a Date, or null if the city
// has never been indexed. Returns the computed isStale so callers (e.g. the
// stale-city tally) can reuse it instead of duplicating the threshold logic.
export function setTownIndicatorState(lastReportedAt) {
  const isStale =
    !lastReportedAt ||
    Date.now() - lastReportedAt.getTime() > STALE_THRESHOLD_MS;

  const wrap = document.getElementById(TOWN_INDICATOR_ID);
  if (wrap) {
    const dot = document.getElementById(TOWN_INDICATOR_DOT_ID);
    if (dot) dot.style.display = isStale ? "block" : "none";

    wrap.title = lastReportedAt
      ? `Last indexed: ${formatNewYorkTimestamp(lastReportedAt)} (server time)`
      : "Never indexed";
  }

  return isStale;
}

// .town_name's text is swapped out (not just mutated) whenever the game
// switches the displayed city, so childList+characterData on it is a
// reliable "city changed" signal without watching the whole, noisier
// .town_name_area subtree (culture counters, cast powers list, etc. also
// live in there and mutate on their own).
export function watchTownName(onChange) {
  const target = document.querySelector(TOWN_NAME_SELECTOR);
  if (!target) return null;

  const observer = new MutationObserver(() => onChange());
  observer.observe(target, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  return observer;
}
