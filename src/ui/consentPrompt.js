import { SECONDARY_COLOR, PRIMARY_COLOR, WARNING_RED } from "./theme.js";
import logoVertical from "../../assets/logo-vertical.png";

const OVERLAY_ID = "gt-consent-overlay";

// Blocking, explicit opt-in — resolves true/false based on the user's
// choice, and nothing that touches game data is allowed to run until this
// resolves true (see ensureConsentInFlight in index.js). Closing/declining
// resolves false rather than leaving the caller hanging.
export function showConsentPrompt() {
  return new Promise((resolve) => {
    if (document.getElementById(OVERLAY_ID)) {
      // ensureConsentInFlight's own in-flight guard is what actually
      // prevents concurrent calls; this just avoids a stuck promise if
      // that's ever bypassed.
      resolve(false);
      return;
    }

    const finish = (accepted) => {
      overlay.remove();
      resolve(accepted);
    };

    const overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:100000",
      "background:rgba(0,0,0,0.5)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
    ].join(";");

    const box = document.createElement("div");
    box.style.cssText = [
      "position:relative",
      `background:${PRIMARY_COLOR}`,
      "color:#fff",
      "font:14px sans-serif",
      "padding:24px 28px",
      "border-radius:8px",
      "box-shadow:0 4px 16px rgba(0,0,0,0.5)",
      "text-align:center",
      "min-width:280px",
      "max-width:420px",
      "box-sizing:border-box",
    ].join(";");

    const logo = document.createElement("img");
    logo.alt = "Grass Touchers";
    logo.src = logoVertical;
    logo.style.cssText =
      "display:block;width:110px;height:auto;margin:0 auto 14px;";
    box.appendChild(logo);

    const title = document.createElement("div");
    title.textContent = "Data collection consent";
    title.style.cssText = "font-weight:600;margin-bottom:10px;";
    box.appendChild(title);

    const message = document.createElement("div");
    message.style.cssText = [
      "text-align:left",
      "font-size:12.5px",
      "line-height:1.5",
      "margin-bottom:12px",
    ].join(";");
    message.textContent =
      "When you index a city, GT Magic Eye collects the following data:";
    box.appendChild(message);

    const list = document.createElement("ul");
    list.style.cssText = [
      "text-align:left",
      "font-size:12.5px",
      "line-height:1.5",
      "margin:0 0 12px",
      // Injected straight into the Grepolis page with no style isolation —
      // its own CSS resets list markers, so the "- " prefixes below are the
      // only bullet that actually shows up; list-style:none makes that
      // explicit instead of leaving it looking accidental.
      "padding-left:20px",
      "list-style:none",
    ].join(";");
    for (const item of [
      "- Troop counts for the city",
      "- City ID, name, and coordinates",
      "- Your player and alliance IDs",
    ]) {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    }
    box.appendChild(list);

    const note = document.createElement("div");
    note.style.cssText =
      "text-align:left;font-size:12.5px;line-height:1.5;margin-bottom:14px;";
    note.textContent =
      "This data is only accessible by yourself and admins of any teams you've joined on GT Magic Eye.";
    box.appendChild(note);

    const privacyLink = document.createElement("a");
    privacyLink.textContent = "Read the full privacy policy";
    privacyLink.href = `${__API_BASE__}/privacy`;
    privacyLink.target = "_blank";
    privacyLink.rel = "noopener noreferrer";
    privacyLink.style.cssText = [
      "display:block",
      "margin-bottom:16px",
      "font-size:12px",
      `color:${SECONDARY_COLOR}`,
    ].join(";");
    box.appendChild(privacyLink);

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display:flex;gap:8px;";

    const declineBtn = document.createElement("button");
    declineBtn.type = "button";
    declineBtn.textContent = "Decline";
    declineBtn.style.cssText = [
      "flex:1",
      "padding:8px 12px",
      "background:transparent",
      `border:1px solid ${WARNING_RED}`,
      `color:${WARNING_RED}`,
      "border-radius:4px",
      "cursor:pointer",
      "font:inherit",
    ].join(";");
    declineBtn.addEventListener("click", () => finish(false));

    const allowBtn = document.createElement("button");
    allowBtn.type = "button";
    allowBtn.textContent = "Allow";
    allowBtn.style.cssText = [
      "flex:1",
      "padding:8px 12px",
      `background:${SECONDARY_COLOR}`,
      "border:none",
      `color:${PRIMARY_COLOR}`,
      "font-weight:600",
      "border-radius:4px",
      "cursor:pointer",
      "font:inherit",
    ].join(";");
    allowBtn.addEventListener("click", () => finish(true));

    buttonRow.appendChild(declineBtn);
    buttonRow.appendChild(allowBtn);
    box.appendChild(buttonRow);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}

const REVOKE_OVERLAY_ID = "gt-consent-revoke-overlay";

// Confirmation for withdrawing consent via the settings panel's checkbox
// (src/ui/settingsMenu.js) — resolves true only on explicit confirmation;
// closing/canceling resolves false, and the caller should put the checkbox
// back to checked.
export function showRevokeConsentWarning() {
  return new Promise((resolve) => {
    if (document.getElementById(REVOKE_OVERLAY_ID)) {
      resolve(false);
      return;
    }

    const finish = (confirmed) => {
      overlay.remove();
      resolve(confirmed);
    };

    const overlay = document.createElement("div");
    overlay.id = REVOKE_OVERLAY_ID;
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:100002",
      "background:rgba(0,0,0,0.5)",
      "display:flex",
      "align-items:center",
      "justify-content:center",
    ].join(";");

    const box = document.createElement("div");
    box.style.cssText = [
      "position:relative",
      `background:${PRIMARY_COLOR}`,
      "color:#fff",
      "font:14px sans-serif",
      "padding:24px 28px",
      "border-radius:8px",
      "box-shadow:0 4px 16px rgba(0,0,0,0.5)",
      "text-align:center",
      "min-width:280px",
      "max-width:380px",
      "box-sizing:border-box",
    ].join(";");

    const title = document.createElement("div");
    title.textContent = "Withdraw consent?";
    title.style.cssText = `font-weight:600;margin-bottom:10px;color:${WARNING_RED};`;
    box.appendChild(title);

    const message = document.createElement("div");
    message.style.cssText = [
      "text-align:left",
      "font-size:12.5px",
      "line-height:1.5",
      "margin-bottom:16px",
    ].join(";");
    message.textContent =
      "This will break the tool's functionality. Are you sure you want to proceed?";
    box.appendChild(message);

    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display:flex;gap:8px;";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = [
      "flex:1",
      "padding:8px 12px",
      "background:transparent",
      `border:1px solid ${SECONDARY_COLOR}`,
      "color:#fff",
      "border-radius:4px",
      "cursor:pointer",
      "font:inherit",
    ].join(";");
    cancelBtn.addEventListener("click", () => finish(false));

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "button";
    confirmBtn.textContent = "Withdraw consent";
    confirmBtn.style.cssText = [
      "flex:1",
      "padding:8px 12px",
      `background:${WARNING_RED}`,
      "border:none",
      "color:#fff",
      "font-weight:600",
      "border-radius:4px",
      "cursor:pointer",
      "font:inherit",
    ].join(";");
    confirmBtn.addEventListener("click", () => finish(true));

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(confirmBtn);
    box.appendChild(buttonRow);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  });
}
