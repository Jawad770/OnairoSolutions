/**
 * Catalog client — hydrate marketing pages from /api/catalog/*.
 * Falls back to ONAIRO.products / static markup when API is unavailable.
 */
(function (global) {
  const ONAIRO = (global.ONAIRO = global.ONAIRO || {});

  function apiBase() {
    if (typeof ONAIRO.apiBase === "function") return ONAIRO.apiBase();
    return "";
  }

  async function fetchJson(path) {
    const res = await fetch(`${apiBase()}${path}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(`Catalog API ${res.status}`);
    return res.json();
  }

  ONAIRO.catalog = {
    async listItems(opts = {}) {
      const params = new URLSearchParams();
      if (opts.category) params.set("category", opts.category);
      if (opts.type) params.set("type", opts.type);
      if (opts.channel) params.set("channel", opts.channel);
      const qs = params.toString();
      const data = await fetchJson(`/api/catalog/items${qs ? `?${qs}` : ""}`);
      return data.items || [];
    },

    async getItem(slug) {
      const data = await fetchJson(`/api/catalog/items/${encodeURIComponent(slug)}`);
      return data;
    },

    async listPricing() {
      const data = await fetchJson("/api/catalog/pricing");
      return data;
    },

    async notify(slug, payload) {
      const res = await fetch(`${apiBase()}/api/catalog/items/${encodeURIComponent(slug)}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      return res.json();
    },

    async applyPromotion(opts) {
      const res = await fetch(`${apiBase()}/api/catalog/promotions/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(opts),
      });
      return res.json();
    },

    storeAppliedPromotion(quote) {
      try {
        if (quote && quote.ok) sessionStorage.setItem("onairo_promo", JSON.stringify(quote));
        else sessionStorage.removeItem("onairo_promo");
      } catch (_e) {
        /* ignore */
      }
    },

    loadAppliedPromotion() {
      try {
        const raw = sessionStorage.getItem("onairo_promo");
        return raw ? JSON.parse(raw) : null;
      } catch (_e) {
        return null;
      }
    },

    mountDiscountBox(container, { productSlug, planId, planName, amount, onApplied } = {}) {
      if (!container) return;
      container.innerHTML = `<div class="promo-box" style="margin-top:12px">
        <label style="display:block;font-weight:600;margin-bottom:6px">Discount Code</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="text" class="promo-code-input" placeholder="e.g. WELCOME10" style="flex:1;min-width:140px;padding:8px 10px">
          <button type="button" class="btn btn-secondary promo-apply-btn">Apply</button>
        </div>
        <div class="promo-result muted" style="margin-top:8px"></div>
      </div>`;
      const input = container.querySelector(".promo-code-input");
      const btn = container.querySelector(".promo-apply-btn");
      const out = container.querySelector(".promo-result");
      const run = async () => {
        out.textContent = "Checking…";
        const result = await this.applyPromotion({
          code: input.value,
          productSlug,
          planId: typeof planId === "function" ? planId() : planId,
          planName: typeof planName === "function" ? planName() : planName,
        });
        out.textContent = "";
        if (!result.ok) {
          const err = document.createElement("span");
          err.style.color = "#b91c1c";
          err.textContent = String(result.error || "Invalid code");
          out.appendChild(err);
          this.storeAppliedPromotion(null);
          return;
        }
        this.storeAppliedPromotion(result);
        const strike = document.createElement("div");
        const s = document.createElement("s");
        s.textContent = `${result.currency} ${Number(result.original).toLocaleString()}`;
        strike.appendChild(s);
        const disc = document.createElement("div");
        disc.textContent = `Discount ${result.label || ""}`;
        const final = document.createElement("div");
        const strong = document.createElement("strong");
        strong.textContent = `Final Price ${result.currency} ${Number(result.final).toLocaleString()}`;
        final.appendChild(strong);
        const saved = document.createElement("div");
        saved.textContent = String(result.savingsText || "");
        out.appendChild(strike);
        out.appendChild(disc);
        out.appendChild(final);
        out.appendChild(saved);
        if (typeof onApplied === "function") onApplied(result);
      };
      btn.addEventListener("click", run);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          run();
        }
      });
    },

    toLegacyProduct(card) {
      return {
        id: card.slug,
        name: card.name,
        tagline: card.tagline || "",
        description: card.description || card.tagline || "",
        status: card.comingSoon || card.status === "coming" ? "coming" : "live",
        href: card.href || card.ctaLink || null,
        accent: card.accent || "#2563EB",
        features: card.features || [],
        pricing: card.comingSoon ? "Coming Soon" : "Plans available — request a quote",
        ctaText: card.ctaText,
        notifyMeEnabled: card.notifyMeEnabled,
      };
    },

    async loadProductsInto(globalKey = "products") {
      try {
        const items = await this.listItems({ category: "software" });
        if (!items.length) return ONAIRO[globalKey] || [];
        const mapped = items.map((c) => this.toLegacyProduct(c));
        ONAIRO[globalKey] = mapped;
        return mapped;
      } catch (_err) {
        return ONAIRO[globalKey] || [];
      }
    },

    formatMoney(amount, currency) {
      if (amount == null || amount === "") return "Custom";
      const n = Number(amount);
      if (!Number.isFinite(n)) return "Custom";
      if (currency === "PKR") {
        if (n >= 1000) return `Rs. ${Math.round(n / 1000)}k`;
        return `Rs. ${n.toLocaleString()}`;
      }
      return `$${n.toLocaleString()}`;
    },

    centerFeaturedPlan(container) {
      if (!container || !global.matchMedia("(max-width: 980px)").matches) return;
      const featured = container.querySelector(".featured");
      if (!featured) return;
      global.requestAnimationFrame(() => {
        const left =
          featured.offsetLeft -
          (container.clientWidth - featured.offsetWidth) / 2;
        container.scrollTo({ left: Math.max(0, left), behavior: "auto" });
      });
    },

    async hydratePricingGrid(container) {
      if (!container) return false;
      try {
        const data = await this.listPricing();
        if (data && data.showPricing === false) {
          container.innerHTML = "";
          const section = container.closest("section");
          if (section) section.hidden = true;
          return true;
        }
        const packages = (data && data.packages) || [];
        if (!packages.length) return false;
        container.hidden = false;
        const section = container.closest("section");
        if (section) section.hidden = false;
        container.innerHTML = packages
          .map((pkg) => {
            const plan = (pkg.plans && pkg.plans[0]) || {};
            const featured = pkg.featured || plan.popular || plan.recommended;
            const features = (plan.features || [])
              .filter((f) => f.included !== false)
              .map((f) => `<li>${escapeHtml(f.title || f.valueText || "")}</li>`)
              .join("");
            const cta = pkg.ctaText || plan.ctaText || `Ask about ${pkg.name}`;
            const waMsg = `Hi Onairo Solutions, I'm interested in the ${pkg.name} website package. Please share plan details and next steps.`;
            const waHref =
              typeof ONAIRO.waUrl === "function" ? ONAIRO.waUrl(waMsg) : "#";
            return `<article class="price-card${featured ? " featured" : ""} reveal">
              ${plan.badge || featured ? `<span class="badge">${escapeHtml(plan.badge || "Popular")}</span>` : ""}
              <h3>${escapeHtml(pkg.name)}</h3>
              <p class="tagline">${escapeHtml(pkg.tagline || "")}</p>
              <p class="note">${escapeHtml(pkg.description || "")}</p>
              <ul>${features}</ul>
              <a class="btn ${featured ? "btn-primary" : "btn-secondary"}" href="${waHref}" target="_blank" rel="noopener">${escapeHtml(cta)}</a>
            </article>`;
          })
          .join("");
        this.centerFeaturedPlan(container);
        return true;
      } catch (_err) {
        return false;
      }
    },

    async hydrateEduTrack(pricingEl, compareEl) {
      try {
        const data = await this.getItem("edutrack");
        if (data && data.showPricing === false) {
          if (pricingEl) {
            pricingEl.innerHTML = "";
            const section = pricingEl.closest("section");
            if (section) section.hidden = true;
          }
          if (compareEl) {
            compareEl.innerHTML = "";
            const section = compareEl.closest("section");
            if (section) section.hidden = true;
          }
          return true;
        }
        const item = data.item;
        if (!item || !item.plans?.length) return false;
        if (pricingEl) {
          const section = pricingEl.closest("section");
          if (section) section.hidden = false;
        }
        if (compareEl) {
          const section = compareEl.closest("section");
          if (section) section.hidden = false;
        }

        if (pricingEl) {
          pricingEl.innerHTML = item.plans
            .map((plan) => {
              const featured = plan.recommended || plan.popular;
              const noteBits = [];
              const studentFeat = (plan.features || []).find((f) => /approx students/i.test(f.title));
              if (studentFeat?.valueText) noteBits.push(`Up to ${studentFeat.valueText} students`);
              const lis = (plan.features || [])
                .filter((f) => f.included && !/approx students/i.test(f.title))
                .slice(0, 8)
                .map((f) => `<li>${escapeHtml(f.title)}</li>`)
                .join("");
              const cta = plan.ctaText || `Get ${plan.name}`;
              const wa = `Hi Onairo Solutions, I'm interested in the EduTrack ${plan.name} plan. Please share setup details.`;
              const waHref = typeof ONAIRO.waUrl === "function" ? ONAIRO.waUrl(wa) : "#";
              return `<article class="et-price${featured ? " featured" : ""} reveal">
                ${plan.badge ? `<div class="et-price-badge">${escapeHtml(plan.badge)}</div>` : ""}
                <h3>${escapeHtml(plan.name)}</h3>
                <p class="et-price-desc">${escapeHtml(plan.subtitle || "")}</p>
                <p class="et-price-note">${escapeHtml(noteBits.join(" · ") || plan.subtitle || "")}</p>
                <ul>${lis}</ul>
                <a class="btn ${featured ? "btn-primary btn-et" : "btn-secondary"} et-wa" data-wa="${escapeAttr(wa)}" href="${waHref}">${escapeHtml(cta)}</a>
              </article>`;
            })
            .join("");
          this.centerFeaturedPlan(pricingEl);
        }

        const comparison = data.comparison;
        if (compareEl && comparison?.columns?.length) {
          const head = comparison.columns
            .map(
              (c) =>
                `<th class="${c.recommended ? "highlight" : ""}">${escapeHtml(c.name)}${c.badge ? `<div class="muted" style="font-weight:500;font-size:12px">${escapeHtml(c.badge)}</div>` : ""}</th>`
            )
            .join("");
          const body = (comparison.rows || [])
            .map((row) => {
              const cells = row.cells
                .map((cell, i) => {
                  const hl = comparison.columns[i]?.recommended ? "highlight" : "";
                  let cls = "maybe";
                  let text = cell.value || "—";
                  if (cell.included && (text === "✓" || text === "Yes")) {
                    cls = "yes";
                    text = "✓";
                  } else if (!cell.included || text === "—" || text === "No") {
                    cls = "no";
                    text = text === "—" ? "—" : text;
                  }
                  return `<td class="${hl} ${cls}">${escapeHtml(String(text))}</td>`;
                })
                .join("");
              return `<tr><td>${escapeHtml(row.title)}</td>${cells}</tr>`;
            })
            .join("");
          compareEl.innerHTML = `<table class="et-compare"><thead><tr><th>Feature</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
        }

        const changelogEl = document.querySelector("[data-catalog-changelog]");
        if (changelogEl && item.changelogs?.length) {
          changelogEl.innerHTML = item.changelogs
            .slice(0, 5)
            .map(
              (c) =>
                `<article class="reveal"><strong>${escapeHtml(c.version || "")} — ${escapeHtml(c.title || "")}</strong><p>${escapeHtml(c.body || "")}</p></article>`
            )
            .join("");
        }
        return true;
      } catch (_err) {
        return false;
      }
    },
  };

  function escapeHtml(s) {
    if (typeof ONAIRO.escapeHtml === "function") return ONAIRO.escapeHtml(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function escapeAttr(s) {
    if (typeof ONAIRO.escapeAttr === "function") return ONAIRO.escapeAttr(s);
    return escapeHtml(s).replace(/`/g, "&#96;");
  }
})(typeof window !== "undefined" ? window : globalThis);
