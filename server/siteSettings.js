/**
 * Website/system settings stored in system.system_settings (via state.settings).
 */
const { state, persist, nextId, now } = require("./db");

const KEYS = {
  SHOW_PRICING: "website.show_pricing",
};

function getSetting(key, fallback = null) {
  const row = (state.settings || []).find((s) => s.key === key);
  if (!row || row.value === undefined) return fallback;
  return row.value;
}

function setSetting(key, value) {
  const ts = now();
  let row = (state.settings || []).find((s) => s.key === key);
  if (!row) {
    row = {
      id: nextId("settings"),
      key,
      value,
      created_at: ts,
      updated_at: ts,
    };
    state.settings.push(row);
  } else {
    row.value = value;
    row.updated_at = ts;
  }
  return persist();
}

/** Default true — website keeps showing plans until Super Admin hides them. */
function isWebsitePricingVisible() {
  const v = getSetting(KEYS.SHOW_PRICING, true);
  if (v === false || v === 0 || v === "false" || v === "0") return false;
  if (typeof v === "object" && v !== null && Object.prototype.hasOwnProperty.call(v, "enabled")) {
    return Boolean(v.enabled);
  }
  return true;
}

function setWebsitePricingVisible(visible) {
  return setSetting(KEYS.SHOW_PRICING, Boolean(visible));
}

module.exports = {
  KEYS,
  getSetting,
  setSetting,
  isWebsitePricingVisible,
  setWebsitePricingVisible,
};
