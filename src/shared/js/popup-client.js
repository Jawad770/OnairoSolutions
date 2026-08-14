/**
 * Promotional popup client — loads active CMS popup asynchronously.
 * Never blocks page render; fails silently if API/storage/image issues occur.
 */
(function (global) {
  const ONAIRO = (global.ONAIRO = global.ONAIRO || {});
  const STORAGE_PREFIX = "onairo_popup_";
  const STYLE_ID = "onairo-popup-styles";
  const ROOT_ID = "onairo-promo-popup";

  const esc = (v) =>
    typeof ONAIRO.escapeHtml === "function"
      ? ONAIRO.escapeHtml(v)
      : String(v == null ? "" : v)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

  const safeUrl = (v, fb) =>
    typeof ONAIRO.safeUrl === "function" ? ONAIRO.safeUrl(v, fb) : v || fb || "";

  function apiBase() {
    if (typeof ONAIRO.apiBase === "function") return ONAIRO.apiBase();
    return "";
  }

  function pagePath() {
    try {
      return location.pathname || "/";
    } catch (_e) {
      return "/";
    }
  }

  function isHomepage() {
    const p = pagePath().replace(/\/index\.html$/i, "/").replace(/\/+$/, "") || "/";
    return p === "/" || p === "";
  }

  function storageGet(store, key) {
    try {
      return store.getItem(key);
    } catch (_e) {
      return null;
    }
  }

  function storageSet(store, key, value) {
    try {
      store.setItem(key, value);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function dayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function shouldShow(popup) {
    const id = popup && popup.id;
    if (!id) return false;
    const freq = String(popup.displayFrequency || "once_per_session");
    if (freq === "always") return true;
    if (freq === "once_per_day") {
      const key = `${STORAGE_PREFIX}day_${id}`;
      return storageGet(localStorage, key) !== dayKey();
    }
    // once_per_session (default)
    const key = `${STORAGE_PREFIX}session_${id}`;
    return storageGet(sessionStorage, key) !== "1";
  }

  function markShown(popup) {
    const id = popup && popup.id;
    if (!id) return;
    const freq = String(popup.displayFrequency || "once_per_session");
    if (freq === "always") return;
    if (freq === "once_per_day") {
      storageSet(localStorage, `${STORAGE_PREFIX}day_${id}`, dayKey());
      return;
    }
    storageSet(sessionStorage, `${STORAGE_PREFIX}session_${id}`, "1");
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${ROOT_ID}{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));opacity:0;pointer-events:none;transition:opacity .28s ease}
#${ROOT_ID}.is-open{opacity:1;pointer-events:auto}
#${ROOT_ID} .op-backdrop{position:absolute;inset:0;background:rgba(11,18,32,.58);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
#${ROOT_ID} .op-dialog{position:relative;width:min(540px,100%);max-height:min(88vh,760px);overflow:auto;background:#fff;color:#0f172a;border-radius:18px;box-shadow:0 28px 90px rgba(0,0,0,.35);transform:translateY(12px) scale(.985);transition:transform .32s cubic-bezier(.22,1,.36,1);-webkit-overflow-scrolling:touch}
#${ROOT_ID}.is-open .op-dialog{transform:none}
#${ROOT_ID} .op-close{position:absolute;top:10px;right:10px;z-index:2;width:40px;height:40px;border:0;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font-size:22px;line-height:1;cursor:pointer;display:grid;place-items:center}
#${ROOT_ID} .op-close:focus-visible{outline:2px solid #fff;outline-offset:2px}
#${ROOT_ID} .op-media{display:block;width:100%;max-height:min(58vh,440px);object-fit:contain;background:linear-gradient(180deg,#f8fafc,#eef2f7);border:0}
#${ROOT_ID} .op-body{padding:18px 20px 22px}
#${ROOT_ID} .op-title{margin:0;font:700 1.2rem/1.25 Georgia,"Times New Roman",serif;letter-spacing:-.01em}
#${ROOT_ID} .op-desc{margin:8px 0 0;color:#475569;font:400 .95rem/1.5 system-ui,-apple-system,sans-serif}
#${ROOT_ID} .op-cta{display:inline-flex;align-items:center;justify-content:center;margin-top:14px;min-height:42px;padding:10px 16px;border-radius:11px;background:#0f172a;color:#fff;text-decoration:none;font:600 .92rem/1 system-ui,sans-serif}
#${ROOT_ID} .op-cta:hover{background:#1e293b}
@media (max-width:520px){
  #${ROOT_ID}{padding:12px}
  #${ROOT_ID} .op-dialog{border-radius:14px;max-height:90vh}
  #${ROOT_ID} .op-media{max-height:min(46vh,340px)}
  #${ROOT_ID} .op-body{padding:14px 14px 18px}
  #${ROOT_ID} .op-title{font-size:1.05rem}
}
@media (prefers-reduced-motion:reduce){
  #${ROOT_ID},#${ROOT_ID} .op-dialog{transition:none}
}
`;
    document.head.appendChild(style);
  }

  let lastFocus = null;
  let scrollLocked = false;
  let prevOverflow = "";

  function lockScroll() {
    if (scrollLocked) return;
    scrollLocked = true;
    prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
  }

  function unlockScroll() {
    if (!scrollLocked) return;
    scrollLocked = false;
    document.documentElement.style.overflow = prevOverflow || "";
    document.body.style.overflow = "";
  }

  function closePopup(root) {
    if (!root) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    unlockScroll();
    const remove = () => {
      try {
        root.remove();
      } catch (_e) {
        /* ignore */
      }
    };
    window.setTimeout(remove, 320);
    if (lastFocus && typeof lastFocus.focus === "function") {
      try {
        lastFocus.focus();
      } catch (_e) {
        /* ignore */
      }
    }
  }

  function openPopup(popup) {
    if (document.getElementById(ROOT_ID)) return;
    ensureStyles();
    lastFocus = document.activeElement;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("aria-hidden", "true");

    const titleText = String(popup.title || "").trim();
    const descText = String(popup.description || "").trim();
    const btnText = String(popup.buttonText || "").trim();
    const btnHref = safeUrl(popup.buttonUrl, "");
    const imgSrc = safeUrl(popup.imageUrl, "");

    const titleHtml = titleText ? `<h2 class="op-title" id="onairo-popup-title">${esc(titleText)}</h2>` : "";
    const descHtml = descText ? `<p class="op-desc">${esc(descText)}</p>` : "";
    const ctaHtml =
      btnText && btnHref
        ? `<a class="op-cta" href="${esc(btnHref)}">${esc(btnText)}</a>`
        : "";
    const bodyNeeded = titleHtml || descHtml || ctaHtml;
    const imgHtml = imgSrc
      ? `<img class="op-media" src="${esc(imgSrc)}" alt="${esc(titleText || "Promotion")}" loading="lazy" decoding="async">`
      : "";

    if (!imgHtml && !bodyNeeded) return;

    root.innerHTML = `
      <div class="op-backdrop" data-op-close="1"></div>
      <div class="op-dialog" role="dialog" aria-modal="true" ${titleText ? 'aria-labelledby="onairo-popup-title"' : 'aria-label="Promotion"'}>
        <button type="button" class="op-close" data-op-close="1" aria-label="Close">×</button>
        ${imgHtml}
        ${bodyNeeded ? `<div class="op-body">${titleHtml}${descHtml}${ctaHtml}</div>` : ""}
      </div>`;

    const img = root.querySelector(".op-media");
    if (img) {
      img.addEventListener("error", () => {
        img.remove();
        if (!root.querySelector(".op-body")) closePopup(root);
      });
    }

    root.addEventListener("click", (e) => {
      const t = e.target;
      if (t && t.getAttribute && t.getAttribute("data-op-close") === "1") {
        closePopup(root);
      }
    });

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePopup(root);
        document.removeEventListener("keydown", onKey);
      }
    }
    document.addEventListener("keydown", onKey);

    document.body.appendChild(root);
    lockScroll();
    requestAnimationFrame(() => {
      root.classList.add("is-open");
      root.setAttribute("aria-hidden", "false");
      const closeBtn = root.querySelector(".op-close");
      if (closeBtn) closeBtn.focus();
    });
    markShown(popup);
  }

  function schedule(popup) {
    const delay = Math.max(0, Math.min(60000, Number(popup.delayMs) || 800));
    window.setTimeout(() => {
      try {
        if (!shouldShow(popup)) return;
        openPopup(popup);
      } catch (_e) {
        /* never break the page */
      }
    }, delay);
  }

  function boot() {
    try {
      // Skip portal / non-public shells
      if (/^\/portal(\/|$)/i.test(pagePath())) return;

      const url = `${apiBase()}/api/public/popups/active?page=${encodeURIComponent(pagePath())}`;
      fetch(url, { headers: { Accept: "application/json" }, credentials: "same-origin" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !data.ok) return;
          const popup = data.popup || (Array.isArray(data.popups) && data.popups[0]) || null;
          if (!popup || !popup.id) return;
          if (String(popup.targetPages || "") === "homepage_only" && !isHomepage()) return;
          if (!shouldShow(popup)) return;
          schedule(popup);
        })
        .catch(() => {});
    } catch (_e) {
      /* ignore */
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // bfcache restore: unlock scroll if a stale overlay lingered
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    const stale = document.getElementById(ROOT_ID);
    if (stale) closePopup(stale);
    else unlockScroll();
  });
})(typeof window !== "undefined" ? window : globalThis);
