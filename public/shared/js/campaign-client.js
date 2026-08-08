/**
 * Marketing campaigns — hydrate banners/countdown from /api/marketing/campaigns/active.
 * All campaign fields are treated as untrusted text (never raw HTML).
 */
(function (global) {
  const ONAIRO = (global.ONAIRO = global.ONAIRO || {});
  const esc = (v) => (typeof ONAIRO.escapeHtml === "function" ? ONAIRO.escapeHtml(v) : String(v == null ? "" : v));
  const safeUrl = (v, fb) => (typeof ONAIRO.safeUrl === "function" ? ONAIRO.safeUrl(v, fb) : v || fb || "");
  const safeColor = (v, fb) => (typeof ONAIRO.safeColor === "function" ? ONAIRO.safeColor(v, fb) : v || fb || "");

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

  function productSlugFromPath() {
    const m = pagePath().match(/\/products\/([a-z0-9-]+)/i);
    if (!m) return null;
    const slug = m[1].replace(/\.html$/i, "");
    if (slug === "index" || slug === "detail") return null;
    return slug;
  }

  function sessionKey() {
    try {
      let k = sessionStorage.getItem("onairo_mkt_sid");
      if (!k) {
        k = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
        sessionStorage.setItem("onairo_mkt_sid", k);
      }
      return k;
    } catch (_e) {
      return null;
    }
  }

  function visitorKind() {
    try {
      const key = "onairo_visitor_seen";
      const seen = localStorage.getItem(key);
      if (!seen) {
        localStorage.setItem(key, "1");
        return "new";
      }
      return "returning";
    } catch (_e) {
      return "anonymous";
    }
  }

  function dismissedKey(slug) {
    return `onairo_mkt_dismiss_${slug}`;
  }

  function isDismissed(slug) {
    try {
      return localStorage.getItem(dismissedKey(slug)) === "1";
    } catch (_e) {
      return false;
    }
  }

  function dismiss(slug) {
    try {
      localStorage.setItem(dismissedKey(slug), "1");
    } catch (_e) {
      /* ignore */
    }
  }

  function track(slug, type) {
    fetch(`${apiBase()}/api/marketing/campaigns/${encodeURIComponent(slug)}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        type,
        pagePath: pagePath(),
        productSlug: productSlugFromPath(),
        sessionKey: sessionKey(),
        audience: visitorKind(),
      }),
    }).catch(() => {});
  }

  function matchesAudience(c) {
    const audience = String(c.audience || "all").toLowerCase();
    if (!audience || audience === "all" || audience === "anonymous") return true;
    const kind = visitorKind();
    if (audience === "new" || audience === "new_visitors") return kind === "new";
    if (audience === "returning" || audience === "returning_visitors") return kind === "returning";
    if (audience === "logged_in" || audience === "existing_customers") return false; // future
    return true;
  }

  function tickCountdowns(root) {
    root.querySelectorAll(".onairo-mkt-countdown").forEach((el) => {
      const ends = new Date(el.getAttribute("data-ends")).getTime();
      const diff = ends - Date.now();
      if (diff <= 0) {
        el.textContent = "";
        const banner = el.closest(".onairo-mkt-banner");
        if (banner) banner.remove();
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      el.textContent = `${d}d ${h}h ${m}m ${s}s`;
    });
  }

  function renderBanner(c) {
    if (!matchesAudience(c)) return null;
    if (c.dismissible && !c.persistent && isDismissed(c.slug)) return null;

    const theme = safeColor(c.themeColor, "#0f172a");
    const accent = safeColor(c.accentColor, "#2563EB");
    const place = c.bannerPlacement || "top_bar";
    const el = document.createElement("div");
    el.className = `onairo-mkt-banner onairo-mkt-${place}${c.animated ? " onairo-mkt-animated" : ""}${
      c.animationStyle ? ` onairo-mkt-anim-${String(c.animationStyle).replace(/[^a-z0-9_-]/gi, "")}` : ""
    }`;
    el.setAttribute("data-campaign", String(c.slug || ""));

    const bgImage = safeUrl(c.backgroundImageUrl, "");
    const bannerImage = safeUrl(c.bannerImageUrl, "");

    if (place === "sticky_bottom") {
      el.style.cssText = `position:fixed;left:0;right:0;bottom:0;z-index:9998;background:${theme};color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between;`;
    } else if (place === "floating_card" || place === "corner_badge") {
      el.style.cssText = `position:fixed;right:16px;bottom:80px;z-index:9998;max-width:320px;background:${theme};color:#fff;padding:14px;border-radius:12px;`;
    } else if (place === "hero_banner") {
      el.style.cssText = `background:${theme};color:#fff;padding:28px 20px;display:flex;gap:16px;align-items:center;justify-content:space-between;min-height:120px;`;
    } else {
      el.style.cssText = `background:${theme};color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:space-between;`;
    }
    if (bgImage) el.style.backgroundImage = `linear-gradient(rgba(15,23,42,.72),rgba(15,23,42,.72)),url("${bgImage.replace(/"/g, "")}")`;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";

    const left = document.createElement("div");
    left.style.cssText = "display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0";

    if (bannerImage) {
      const img = document.createElement("img");
      img.src = bannerImage;
      img.alt = "";
      img.style.cssText = "width:48px;height:48px;object-fit:cover;border-radius:8px;flex:0 0 auto";
      left.appendChild(img);
    }
    if (c.icon) {
      const icon = document.createElement("span");
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = String(c.icon).slice(0, 4);
      left.appendChild(icon);
    }
    if (c.promotionBadge) {
      const badge = document.createElement("span");
      badge.style.cssText = `background:${accent};padding:2px 8px;border-radius:999px;font-size:11px`;
      badge.textContent = String(c.promotionBadge);
      left.appendChild(badge);
    }
    const strong = document.createElement("strong");
    strong.textContent = String(c.headline || c.name || "");
    left.appendChild(strong);
    if (c.subHeading) {
      const sub = document.createElement("span");
      sub.style.opacity = "0.85";
      sub.textContent = String(c.subHeading);
      left.appendChild(sub);
    }
    if (c.discountValue != null) {
      const discount = document.createElement("span");
      discount.style.cssText = "opacity:.9;font-size:13px";
      const label =
        c.discountType === "percentage" ? `${c.discountValue}% off` : `${c.discountValue} off`;
      discount.textContent = c.autoApplyDiscount
        ? `${label} · auto applied`
        : c.discountCode
          ? `${label} · code ${c.discountCode}`
          : label;
      left.appendChild(discount);
    }
    if (c.showCountdown && c.endsAt) {
      const cd = document.createElement("span");
      cd.className = "onairo-mkt-countdown";
      cd.setAttribute("data-ends", String(c.endsAt));
      left.appendChild(cd);
    }

    const right = document.createElement("div");
    right.style.cssText = "display:flex;gap:8px;align-items:center;flex:0 0 auto";

    const href = safeUrl(c.buttonLink, "#") || "#";
    const cta = document.createElement("a");
    cta.className = "onairo-mkt-cta";
    cta.href = href;
    cta.style.cssText = `background:${accent};color:#fff;padding:6px 12px;border-radius:8px;text-decoration:none;font-weight:600`;
    cta.textContent = String(c.buttonText || "Learn more");
    cta.addEventListener("click", () => track(c.slug, "cta_click"));
    right.appendChild(cta);

    if (c.dismissible) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "onairo-mkt-dismiss";
      btn.setAttribute("aria-label", "Dismiss");
      btn.style.cssText = "background:transparent;border:0;color:#fff;font-size:18px;cursor:pointer";
      btn.textContent = "×";
      btn.addEventListener("click", () => {
        dismiss(c.slug);
        el.remove();
      });
      right.appendChild(btn);
    }

    el.appendChild(left);
    el.appendChild(right);
    el.addEventListener("click", (e) => {
      if (e.target.closest(".onairo-mkt-dismiss") || e.target.closest(".onairo-mkt-cta")) return;
      track(c.slug, "banner_click");
    });

    // Auto-apply without requiring a typed coupon
    if (c.autoApplyDiscount && ONAIRO.catalog?.applyPromotion) {
      const payload = {
        productSlug: productSlugFromPath(),
      };
      if (c.promotionId) payload.promotionId = c.promotionId;
      if (c.linkedPromotionCode) payload.code = c.linkedPromotionCode;
      else if (c.discountCode) payload.code = c.discountCode;
      if (payload.code || payload.promotionId) {
        ONAIRO.catalog
          .applyPromotion(payload)
          .then((quote) => {
            if (quote?.ok && ONAIRO.catalog.storeAppliedPromotion) {
              ONAIRO.catalog.storeAppliedPromotion(quote);
            }
          })
          .catch(() => {});
      }
    }

    track(c.slug, "view");
    void esc;
    return el;
  }

  ONAIRO.marketing = {
    async hydrate() {
      try {
        const params = new URLSearchParams({
          page: pagePath(),
          audience: visitorKind(),
        });
        const slug = productSlugFromPath();
        if (slug) params.set("product", slug);
        const res = await fetch(`${apiBase()}/api/marketing/campaigns/active?${params}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        const list = data.campaigns || [];
        if (!list.length) return;

        const root = document.body;
        if (!root) return;
        list.forEach((c) => {
          const banner = renderBanner(c);
          if (!banner) return;
          if (c.bannerPlacement === "sticky_bottom" || c.bannerPlacement === "floating_card" || c.bannerPlacement === "corner_badge") {
            root.appendChild(banner);
          } else {
            const host = document.getElementById("site-chrome") || document.getElementById("site-nav") || root.firstChild;
            if (host && host.parentNode) host.parentNode.insertBefore(banner, host);
            else root.insertBefore(banner, root.firstChild);
          }
        });
        tickCountdowns(document);
        setInterval(() => tickCountdowns(document), 1000);
      } catch (_err) {
        /* ignore */
      }
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => ONAIRO.marketing.hydrate());
  } else {
    ONAIRO.marketing.hydrate();
  }
})(typeof window !== "undefined" ? window : globalThis);
