import { Logger } from "../logger.js";

const logger = new Logger("cityReportWindow");

// Sourced from this world's own award descriptions (killed_units_*/
// train_units_*), not guessed — matches the game's actual English unit
// names. Ships included since a Defense tab can list them alongside land
// units; militia is native-only and never actually zero-filtered out below
// since it's frequently the whole garrison in an undefended city.
const UNIT_LABELS = {
  sword: "Swordsman",
  slinger: "Slinger",
  archer: "Archer",
  hoplite: "Hoplite",
  rider: "Horseman",
  chariot: "Chariot",
  catapult: "Catapult",
  minotaur: "Minotaur",
  manticore: "Manticore",
  zyklop: "Cyclops",
  harpy: "Harpy",
  medusa: "Medusa",
  centaur: "Centaur",
  pegasus: "Pegasus",
  cerberus: "Cerberus",
  fury: "Erinys",
  griffin: "Griffin",
  calydonian_boar: "Calydonian Boar",
  satyr: "Satyr",
  spartoi: "Spartoi",
  ladon: "Ladon",
  godsent: "Divine Envoy",
  big_transporter: "Transport Boat",
  bireme: "Bireme",
  attack_ship: "Light Ship",
  demolition_ship: "Fire Ship",
  small_transporter: "Fast Transport Ship",
  trireme: "Trireme",
  colonize_ship: "Colony Ship",
  sea_monster: "Hydra",
  siren: "Siren",
  militia: "Militia",
};

// Matches the game's own display order exactly — confirmed from two real
// DOM examples (player_units: sword, archer, hoplite, chariot,
// big_transporter, small_transporter; support_units's native total: archer,
// hoplite, rider, attack_ship, siren — both are exact subsequences of this
// list with zero-count types omitted) and independently from this world's
// own award list order (killed_units_*, which iterates units in this same
// sequence). militia isn't covered by either source — placed first as the
// pre-Barracks "tier 0" defender, but that position is an assumption, not
// evidence like the rest of this list.
const UNIT_DISPLAY_ORDER = [
  "militia",
  "sword",
  "slinger",
  "archer",
  "hoplite",
  "rider",
  "chariot",
  "catapult",
  "minotaur",
  "manticore",
  "zyklop",
  "harpy",
  "medusa",
  "centaur",
  "pegasus",
  "cerberus",
  "fury",
  "griffin",
  "calydonian_boar",
  "satyr",
  "spartoi",
  "ladon",
  "godsent",
  "big_transporter",
  "bireme",
  "attack_ship",
  "demolition_ship",
  "small_transporter",
  "trireme",
  "colonize_ship",
  "sea_monster",
  "siren",
];

function unitOrderIndex(type) {
  const index = UNIT_DISPLAY_ORDER.indexOf(type);
  return index === -1 ? UNIT_DISPLAY_ORDER.length : index;
}

// Fixed to America/New_York regardless of the viewer's own timezone/locale
// settings, per explicit requirement — this is a shared team reference
// point, not a personalized display.
function formatLastIndexed(date) {
  if (!date) return "never";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("hour")}:${get("minute")}:${get("second")} ${get("day")}/${get("month")}/${get("year")}`;
}

// Exact markup Grepolis itself uses for a unit icon+count (lifted from the
// Overview screen's "Total troops in this city" list): unit_icon40x40 plus
// the bare unit-type class select the sprite from the game's own already-
// loaded stylesheet, and .bold is the same class the game uses for the
// count overlay — so no icon asset or extra styling of our own is needed
// for those. UNIT_LABELS only feeds the title attribute (a plain hover
// tooltip); the game's own row has no separate visible name text, so we
// don't add one either.
function buildTroopRows(troops) {
  // troops is null only when no cityState document exists at all (never
  // indexed) — a report can legitimately carry an empty/all-zero troops
  // object for a city with no native garrison, which is a different case
  // and shouldn't show the same "never indexed" message.
  if (troops == null) {
    return '<p style="color:#000;font-style:italic;">This city has never been indexed</p>';
  }

  const entries = Object.entries(troops).filter(([, count]) => count > 0);
  entries.sort((a, b) => unitOrderIndex(a[0]) - unitOrderIndex(b[0]));

  if (entries.length === 0) {
    return '<p style="color:#000;font-style:italic;">No troops present</p>';
  }

  const icons = entries
    .map(([type, count]) => {
      const label = UNIT_LABELS[type] || type;
      return `
        <div class="place_unit unit unit_${type} unit_icon40x40 ${type}" data-unit_id="${type}" data-unit_count="${count}" title="${label}">
          <span class="bold">${count}</span>
        </div>
      `;
    })
    .join("");

  return `<div style="display:flex;flex-wrap:wrap;gap:6px;">${icons}</div>`;
}

export function buildCityReportHtml({ troops, lastReportedAt }) {
  return `
    <div style="font:13px sans-serif;color:#fff;padding:4px 2px;">
      <h4>Last indexed: ${formatLastIndexed(lastReportedAt)}</h4>
      <h4>Troops from this city:</h4>
      <div>${buildTroopRows(troops)}</div>
    </div>
  `;
}

const WINDOW_TITLE = "[GT Magic Eye] Last index";

// Holds the last-opened dialog's GPWindow instance so a city switch can
// re-render it in place instead of leaving it showing the previous city's
// troops. GPWindowMgr exposes no public "is this window still open" query
// (see GPWindowMgr.Create's source — open windows only live in a private
// closure array), so rather than guess what calling setContent on a
// closed/destroyed window does, presence is reconfirmed via the same real,
// observed DOM structure the reference userscript used to locate the
// dialog: a `.ui-dialog-title` element whose text matches ours.
let openWindow = null;

function isWindowStillOpen() {
  for (const el of document.getElementsByClassName("ui-dialog-title")) {
    if (el.textContent === WINDOW_TITLE) return true;
  }
  return false;
}

// GPWindowMgr is the game's own window manager (confirmed live: Layout.wnd
// === GPWindowMgr). TYPE_DIALOG gives a generic jQuery-UI-chrome'd window
// whose content we fully control via setContent — unlike every other
// TYPE_*, which is backed by a purpose-built handler we can't repurpose.
export function showCityReportWindow(data) {
  if (typeof window.GPWindowMgr === "undefined") {
    logger.warn("GPWindowMgr not available, cannot open city report window");
    return;
  }

  const wnd = window.GPWindowMgr.Create(
    window.GPWindowMgr.TYPE_DIALOG,
    WINDOW_TITLE,
  );
  if (!wnd) {
    logger.warn("GPWindowMgr.Create returned no window (concurrency cap?)");
    return;
  }

  openWindow = wnd;
  wnd.setWidth(480);
  wnd.setHeight(200);
  wnd.setContent(buildCityReportHtml(data || {}));
}

// Called on every city switch regardless of whether our dialog is open —
// a no-op unless it actually is, confirmed via isWindowStillOpen rather
// than assumed from openWindow alone (the user may have closed it since).
export function refreshCityReportWindowIfOpen(data) {
  if (!openWindow || !isWindowStillOpen()) {
    openWindow = null;
    return;
  }

  openWindow.setContent(buildCityReportHtml(data || {}));
}
