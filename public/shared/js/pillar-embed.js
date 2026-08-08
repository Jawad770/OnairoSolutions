/**
 * Reuse the canonical homepage pillar showcase on its matching hub page.
 * The homepage remains the single source of truth, preventing the premium
 * compositions from drifting apart across Services, Industries, Portfolio,
 * and Products.
 */
(function () {
  const pageToSection = {
    services: "services-preview",
    industries: "portfolio-preview",
    portfolio: "portfolio-preview",
    products: "products-preview",
  };

  async function mountPillarShowcase() {
    const page = document.body?.dataset?.page;
    const sectionId = pageToSection[page];
    const header = document.querySelector("body > header");
    if (!sectionId || !header || document.getElementById(sectionId)) return;

    const placeholder = document.createElement("div");
    placeholder.className = "hub-pillar-loading";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.innerHTML =
      '<div class="container"><span></span><span></span><span></span></div>';
    header.after(placeholder);

    try {
      const homeUrl =
        typeof ONAIRO !== "undefined" && typeof ONAIRO.path === "function"
          ? ONAIRO.path("index.html")
          : "/index.html";
      const response = await fetch(homeUrl, {
        headers: { Accept: "text/html" },
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error(`Homepage ${response.status}`);

      const html = await response.text();
      const source = new DOMParser().parseFromString(html, "text/html");
      const section = source.getElementById(sectionId);
      if (!section) throw new Error(`Missing #${sectionId}`);

      // Convert homepage-relative links to stable same-origin URLs before the
      // section moves into a nested public page.
      section.querySelectorAll("[href], [src]").forEach((element) => {
        ["href", "src"].forEach((attribute) => {
          const value = element.getAttribute(attribute);
          if (!value || value.startsWith("#") || value.startsWith("mailto:") || value.startsWith("tel:")) {
            return;
          }
          const resolved = new URL(value, response.url);
          if (resolved.origin === window.location.origin) {
            element.setAttribute(
              attribute,
              `${resolved.pathname}${resolved.search}${resolved.hash}`
            );
          }
        });
      });

      section.classList.add("hub-pillar-showcase");
      placeholder.replaceWith(section);

      if (typeof ONAIRO !== "undefined") {
        ONAIRO.observeReveals?.(section);
        ONAIRO.initPillarWorlds?.();
      }
    } catch (error) {
      // Hub content remains fully usable if the enhancement cannot load.
      placeholder.remove();
      console.warn("[Onairo] Pillar showcase unavailable:", error.message || error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountPillarShowcase);
  } else {
    mountPillarShowcase();
  }
})();
