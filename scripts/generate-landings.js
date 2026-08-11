/**
 * Generate service + industry landing pages, hub indexes, and update sitemap entries.
 */
const fs = require("fs");
const path = require("path");
const data = require("./landing-data");

const ROOT = path.resolve(__dirname, "..");
const SITE = data.site;

const PROCESS = [
  ["1", "Discovery", "Goals, audience, and constraints."],
  ["2", "Planning", "Scope, sitemap, and milestones."],
  ["3", "UI/UX Design", "Wireframes and visual direction."],
  ["4", "Development", "Build, integrate, and optimize."],
  ["5", "Testing", "QA across devices and flows."],
  ["6", "Launch", "Deploy, verify, and hand over."],
  ["7", "Support", "Improvements and maintenance."],
];

// Load portfolio thumbs from portfolio-data by evaluating lightly
const portfolioDataCandidates = [
  path.join(ROOT, "public/shared/js/portfolio-data.js"),
  path.join(ROOT, "src/shared/js/portfolio-data.js"),
];
const portfolioDataPath = portfolioDataCandidates.find((p) => fs.existsSync(p));
const portfolioJs = portfolioDataPath ? fs.readFileSync(portfolioDataPath, "utf8") : "";
const portfolioMatch = portfolioJs.match(/ONAIRO\.portfolio\s*=\s*(\[[\s\S]*?\]);/);
let portfolio = [];
if (portfolioMatch) {
  try {
    portfolio = Function(`"use strict"; return (${portfolioMatch[1]});`)();
  } catch (_) {
    portfolio = [];
  }
}
const portfolioById = Object.fromEntries(portfolio.map((p) => [p.id, p]));

/** Normalize thumb paths for public/ document root */
function resolveThumb(thumb) {
  const t = String(thumb || "");
  if (!t) return "";
  if (/^https?:\/\//i.test(t) || t.startsWith("/")) return t;
  let s = t
    .replace(/^src\/portfolio\/images\//, "images/")
    .replace(/^portfolio\/images\//, "images/");
  if (s.startsWith("images/")) return "/" + s;
  const idx = s.indexOf("images/");
  if (idx >= 0) return "/" + s.slice(idx);
  return t;
}

function demoHref(id) {
  return `/showcase/${id}`;
}

function writeSitemap(xml) {
  const publicSitemap = path.join(ROOT, "public", "sitemap.xml");
  fs.mkdirSync(path.dirname(publicSitemap), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
  fs.writeFileSync(publicSitemap, xml, "utf8");
}

function stripSrcPrefix(url) {
  return String(url || "").replace(/\/src\//g, "/");
}

function esc(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function abs(p) {
  return SITE + (p.startsWith("/") ? p : "/" + p);
}

function unsplashSrcset(src, widths = [400, 800, 1200]) {
  if (!/^https:\/\/images\.unsplash\.com\//.test(src)) return "";
  return widths
    .map((width) => {
      const url = new URL(src);
      url.searchParams.set("w", String(width));
      return `${url.toString()} ${width}w`;
    })
    .join(", ");
}

function imageAttrs(src, { eager = false, sizes = "100vw" } = {}) {
  const srcset = unsplashSrcset(src);
  return [
    `src="${esc(src)}"`,
    srcset ? `srcset="${esc(srcset)}"` : "",
    srcset ? `sizes="${esc(sizes)}"` : "",
    `loading="${eager ? "eager" : "lazy"}"`,
    `decoding="${eager ? "sync" : "async"}"`,
    eager ? 'fetchpriority="high"' : 'fetchpriority="low"',
  ].filter(Boolean).join(" ");
}

function pageShell({
  title,
  description,
  canonical,
  bodyPage,
  seoPath,
  theme,
  mood,
  breadcrumbs,
  bodyHtml,
  schemaExtra,
  rootDepth,
}) {
  // public/services|industries → depth 2; public/pages/blog → depth 3
  const prefix = rootDepth === 2 ? "../" : rootDepth === 3 ? "../../" : "";
  const rootAttr = rootDepth === 2 ? ".." : "../..";
  const favicon = rootDepth === 2 ? "../favicon.svg" : "../../favicon.svg";
  const heroImage = bodyPage === "landing" && schemaExtra && schemaExtra.heroImage;
  const schemas = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        item: abs(b.path),
      })),
    },
  ].concat(schemaExtra || []);
  const moodAttr = mood ? ` data-mood="${esc(mood)}"` : "";
  const navAttr = bodyPage === "landing" && seoPath
    ? seoPath.includes("/industries/")
      ? ' data-nav="industries"'
      : seoPath.includes("/services/")
        ? ' data-nav="services"'
        : ""
    : "";
  const pathAttr = seoPath || canonical.replace(SITE, "") || "/";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}"/>
  <link rel="canonical" href="${esc(canonical)}"/>
  <meta property="og:type" content="website"/>
  <meta property="og:title" content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
  <meta property="og:url" content="${esc(canonical)}"/>
  <meta property="og:site_name" content="Onairo Solutions"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${esc(title)}"/>
  <meta name="twitter:description" content="${esc(description)}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="icon" href="${favicon}" type="image/svg+xml"/>
  ${heroImage ? `<link rel="preload" as="image" href="${esc(heroImage)}"${unsplashSrcset(heroImage) ? ` imagesrcset="${esc(unsplashSrcset(heroImage))}" imagesizes="(max-width: 720px) 100vw, 48vw"` : ""}/>` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="${prefix}shared/css/tokens.css"/>
  <link rel="stylesheet" href="${prefix}shared/css/base.css"/>
  <link rel="stylesheet" href="${prefix}shared/css/components.css"/>
  <link rel="stylesheet" href="${prefix}shared/css/seo.css"/>
  <link rel="stylesheet" href="${prefix}shared/css/landing.css"/>
  <link rel="stylesheet" href="${prefix}shared/css/form-ux.css"/>
  ${schemas.map((s, i) => `<script type="application/ld+json" id="lp-ld-${i}">${JSON.stringify(s)}</script>`).join("\n  ")}
</head>
<body class="lp-page" data-root="${rootAttr}" data-page="${bodyPage}"${navAttr}
  data-seo-title="${esc(title)}" data-seo-description="${esc(description)}" data-seo-path="${esc(pathAttr)}"${moodAttr}
  style="--lp-accent:${theme.accent};--lp-accent-2:${theme.accent2};--lp-glow:${theme.glow}">
  <div id="site-nav"></div>
  ${bodyHtml}
  <div id="site-footer"></div>
  <div id="site-chrome-end"></div>
  <script src="${prefix}shared/js/config.js"></script>
  <script src="${prefix}shared/js/seo-data.js"></script>
  <script src="${prefix}shared/js/seo.js"></script>
  <script src="${prefix}components/chrome.js"></script>
  <script src="${prefix}shared/js/main.js"></script>
  <script src="${prefix}shared/js/countries.js"></script>
  <script src="${prefix}shared/js/form-ux.js"></script>
  <script>
    (function () {
      document.querySelectorAll('.lp-wa').forEach(function (el) {
        var msg = el.getAttribute('data-wa') || "Hi Onairo Solutions, I'd like to discuss a project.";
        el.href = ONAIRO.waUrl(msg);
      });
      var form = document.getElementById('lpLeadForm');
      if (!form) return;
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var hint = document.getElementById('lpLeadHint');
        var btn = document.getElementById('lpLeadBtn');
        btn.disabled = true;
        hint.textContent = 'Submitting...';
        try {
          var fd = new FormData(form);
          var payload = Object.fromEntries(fd.entries());
          payload.topic = payload.interestedIn || payload.topic || 'Landing page enquiry';
          payload.message = payload.message || 'Landing page enquiry';
          payload.preferredContactMethod = payload.whatsapp ? 'WhatsApp' : (payload.email ? 'Email' : 'WhatsApp');
          var res = await fetch('/api/enquiries/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var data = await res.json();
          if (!res.ok || !data.ok) throw new Error((data && data.error) || 'Could not submit');
          hint.textContent = 'Received. Reference: ' + data.leadCode;
          form.reset();
        } catch (err) {
          hint.textContent = err.message || 'Submission failed. Please WhatsApp us.';
        } finally {
          btn.disabled = false;
        }
      });
    })();
  </script>
</body>
</html>`;
}

function ctaRow(waMsg, showDemo, demoHref) {
  return `<div class="lp-actions">
    <a class="btn btn-primary" href="../pages/request-quote.html">Get Free Quote</a>
    <a class="btn btn-secondary lp-wa" data-wa="${esc(waMsg)}" href="#">Book Consultation</a>
    <a class="btn btn-ghost lp-wa" data-wa="${esc(waMsg)}" href="#">WhatsApp Us</a>
    ${showDemo && demoHref ? `<a class="btn btn-ghost" href="${demoHref}">View Demo</a>` : ""}
  </div>`;
}

function portfolioCards(ids, { ctas = "full" } = {}) {
  return ids
    .map((id) => {
      const item = portfolioById[id];
      if (!item || !item.demo) return "";
      const thumb = resolveThumb(item.thumb);
      const href = demoHref(id);
      let actions = "";
      if (ctas === "full") {
        actions = `<div class="lp-actions" style="margin:0">
            <a class="btn btn-primary" href="${href}">View Demo</a>
            <a class="btn btn-secondary lp-wa" data-wa="Hello Onairo Solutions, I want a website similar to your ${esc(item.industry)} demo." href="#">Get This Website</a>
          </div>`;
      } else if (ctas === "demo") {
        actions = `<div class="lp-actions" style="margin:0">
            <a class="btn btn-primary" href="${href}">View Demo</a>
          </div>`;
      }
      return `<article class="lp-port-card">
        <div class="lp-port-thumb lp-media-skeleton">
          <img class="lp-media lp-media-fade" ${imageAttrs(thumb, { sizes: "(max-width: 720px) 100vw, (max-width: 1000px) 50vw, 33vw" })} width="800" height="500" alt="${esc(item.industry)} website demo" onload="this.classList.add('is-loaded')"/>
        </div>
        <div class="lp-port-body">
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.description)}</p>
          ${actions}
        </div>
      </article>`;
    })
    .join("");
}

function faqBlock(faqs) {
  return `<section class="section seo-faq" id="faq">
    <div class="container">
      <p class="section-tag">FAQ</p>
      <h2 class="lp-section-title">Frequently asked questions</h2>
      <div class="seo-faq-list">
        ${faqs
          .map(
            (f, i) => `<details class="seo-faq-item"${i === 0 ? " open" : ""}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function leadForm(defaultInterest) {
  return `<div class="lp-mini-form">
    <form id="lpLeadForm" novalidate>
      <div class="row">
        <div><label for="name">Full Name *</label><input id="name" name="name" required autocomplete="name"/></div>
        <div><label for="business">Business</label><input id="business" name="business" autocomplete="organization"/></div>
        <div><label for="email">Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@company.com"/></div>
        <div class="onairo-phone-host"><label for="whatsapp">WhatsApp</label><input id="whatsapp" name="whatsapp" placeholder="3XX XXXXXXX"/></div>
        <div class="full"><label for="interestedIn">Interested In</label>
          <select id="interestedIn" name="interestedIn">
            <option>${esc(defaultInterest)}</option>
            <option>Website</option>
            <option>Software</option>
            <option>EduTrack</option>
            <option>Other</option>
          </select>
        </div>
        <div class="full"><label for="message">Project notes *</label><textarea id="message" name="message" required placeholder="Tell us about your goals..."></textarea></div>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:0.85rem" id="lpLeadBtn" type="submit">Send Enquiry</button>
      <p class="lp-hint" id="lpLeadHint">Provide email or WhatsApp. Saved securely into our CRM.</p>
    </form>
  </div>`;
}

function generateService(svc) {
  const canonical = abs(`/services/${svc.slug}.html`);
  const wa = `Hi Onairo Solutions, I'm interested in ${svc.h1}. Please share next steps.`;
  const body = `
  <header class="lp-hero" data-pattern="${svc.theme.pattern}">
    <div class="container lp-hero-grid">
      <div>
        <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
          <a href="../index.html">Home</a><span>/</span>
          <a href="index.html">Services</a><span>/</span>
          <span>${esc(svc.slug.replace(/-/g, " "))}</span>
        </nav>
        <p class="lp-kicker">${svc.icon} Service</p>
        <h1>${esc(svc.h1)}</h1>
        <p class="lp-lead">${esc(svc.lead)}</p>
        ${ctaRow(wa, false)}
        <div class="seo-internal-links">
          ${svc.links.map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join("")}
        </div>
      </div>
      <div class="lp-visual" aria-hidden="true">
        <div class="lp-visual-inner">
          <div class="lp-visual-icon">${svc.icon}</div>
          <div class="lp-visual-label">${esc(svc.slug.replace(/-/g, " "))}</div>
          <div class="lp-visual-sub">Premium delivery by Onairo Solutions</div>
          <div class="lp-chip-row">${svc.tech.slice(0, 4).map((t) => `<span class="lp-chip">${esc(t)}</span>`).join("")}</div>
        </div>
      </div>
    </div>
  </header>

  <section class="section">
    <div class="container">
      <p class="section-tag">What we build</p>
      <h2 class="lp-section-title">Business value, not generic output</h2>
      <p class="lp-section-sub">${esc(svc.what)}</p>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <p class="section-tag">Benefits</p>
      <h2 class="lp-section-title">Why teams choose this service</h2>
      <div class="lp-benefit-grid">
        ${svc.benefits
          .map(([t, d]) => `<article class="lp-benefit"><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`)
          .join("")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <p class="section-tag">Our process</p>
      <h2 class="lp-section-title">From discovery to support</h2>
      <div class="lp-process">
        ${PROCESS.map(([n, t, d]) => `<div class="lp-step"><div class="num">${n}</div><h3>${t}</h3><p>${d}</p></div>`).join("")}
      </div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <p class="section-tag">Technology stack</p>
      <h2 class="lp-section-title">Tools we use when they fit</h2>
      <div class="lp-tech">${svc.tech.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <p class="section-tag">Portfolio</p>
      <h2 class="lp-section-title">Relevant demos</h2>
      <p class="lp-section-sub">Explore related industry demos, then request a branded build.</p>
      <div class="lp-port-grid">${portfolioCards(svc.portfolioIds)}</div>
    </div>
  </section>

  ${faqBlock(svc.faqs)}

  <section class="lp-cta-band" id="quote">
    <div class="container">
      <h2>Ready to start your project?</h2>
      <p>Let's build something amazing — tell us your goals and we'll recommend the right path.</p>
      <div class="lp-actions" style="justify-content:center">
        <a class="btn btn-primary" href="../pages/request-quote.html">Get Free Quote</a>
        <a class="btn btn-secondary lp-wa" data-wa="${esc(wa)}" href="#">WhatsApp Us</a>
        <a class="btn btn-ghost" href="../pages/contact.html">Contact</a>
        <a class="btn btn-ghost" href="tel:+923272340505">Call Now</a>
      </div>
      <div style="margin-top:1.75rem">${leadForm(svc.slug.replace(/-/g, " "))}</div>
    </div>
  </section>`;

  return pageShell({
    title: svc.title,
    description: svc.meta,
    canonical,
    bodyPage: "landing",
    seoPath: `/services/${svc.slug}.html`,
    theme: svc.theme,
    mood: svc.theme.mood || svc.theme.pattern,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Services", path: "/services/" },
      { name: svc.h1.split(" ").slice(0, 3).join(" "), path: `/services/${svc.slug}.html` },
    ],
    bodyHtml: body,
    schemaExtra: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: svc.h1,
        description: svc.meta,
        provider: { "@type": "Organization", name: "Onairo Solutions" },
        areaServed: "Pakistan",
        url: canonical,
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: svc.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
    rootDepth: 2,
  });
}

function generateIndustry(ind) {
  const item = portfolioById[ind.portfolioId];
  const canonical = abs(`/industries/${ind.slug}.html`);
  const hrefDemo = item && item.demo ? demoHref(ind.portfolioId) : "../portfolio/index.html";
  const thumbCss = item ? resolveThumb(item.thumb) : "";
  const wa = `Hi Onairo Solutions, I want a ${ind.slug.replace(/-/g, " ")} for my business. Please share pricing and timeline.`;
  const body = `
  <header class="lp-hero" data-pattern="${ind.theme.pattern}">
    <div class="container lp-hero-grid">
      <div>
        <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
          <a href="../index.html">Home</a><span>/</span>
          <a href="index.html">Industries</a><span>/</span>
          <span>${esc(ind.h1.split(" ").slice(0, 3).join(" "))}</span>
        </nav>
        <p class="lp-kicker">Industry website</p>
        <h1>${esc(ind.h1)}</h1>
        <p class="lp-lead">${esc(ind.lead)}</p>
        <div class="lp-actions">
          <a class="btn btn-primary" href="${hrefDemo}">View Demo</a>
          <a class="btn btn-secondary lp-wa" data-wa="${esc(wa)}" href="#">Get This Website</a>
          <a class="btn btn-ghost" href="../pages/request-quote.html">Get Free Quote</a>
          <a class="btn btn-ghost lp-wa" data-wa="${esc(wa)}" href="#">WhatsApp Us</a>
        </div>
        <div class="seo-internal-links">
          ${ind.links.map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join("")}
        </div>
      </div>
      <div class="lp-visual lp-media-skeleton" aria-label="${esc(ind.h1)} preview">
        ${
          thumbCss
            ? `<img class="lp-media lp-media-fade" ${imageAttrs(thumbCss, { eager: true, sizes: "(max-width: 720px) 100vw, 48vw" })} width="800" height="500" alt="${esc(ind.h1)} preview" onload="this.classList.add('is-loaded')"/><span class="lp-media-scrim" aria-hidden="true"></span>`
            : `<div class="lp-visual-inner"><div class="lp-visual-icon">💼</div><div class="lp-visual-label">${esc(ind.slug)}</div></div>`
        }
      </div>
    </div>
  </header>

  <section class="section">
    <div class="container">
      <p class="section-tag">Industry need</p>
      <h2 class="lp-section-title">${esc(ind.whyTitle)}</h2>
      <p class="lp-section-sub">${esc(ind.why)}</p>
      <div class="lp-chip-row">${ind.whyPoints.map((p) => `<span class="lp-chip">${esc(p)}</span>`).join("")}</div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <p class="section-tag">Industry features</p>
      <h2 class="lp-section-title">Built for how this business actually works</h2>
      <div class="lp-benefit-grid">
        ${ind.features.map(([t, d]) => `<article class="lp-benefit"><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join("")}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <p class="section-tag">Portfolio</p>
      <h2 class="lp-section-title">Matching demo website</h2>
      <div class="lp-port-grid">${portfolioCards([ind.portfolioId], { ctas: "demo" })}</div>
    </div>
  </section>

  <section class="section section-alt">
    <div class="container">
      <p class="section-tag">Business benefits</p>
      <h2 class="lp-section-title">How this website helps you grow</h2>
      <div class="lp-benefit-grid">
        ${ind.benefits.map((b) => `<article class="lp-benefit"><h3>${esc(b)}</h3><p>Designed specifically for ${esc(ind.slug.replace(/-/g, " "))} search intent and conversion.</p></article>`).join("")}
      </div>
    </div>
  </section>

  ${faqBlock(ind.faqs)}

  <section class="lp-cta-band" id="quote">
    <div class="container">
      <h2>Ready for a website built for your industry?</h2>
      <p>Request a quote, book a consultation, or WhatsApp us with your city and requirements.</p>
      <div class="lp-actions" style="justify-content:center">
        <a class="btn btn-primary" href="../pages/request-quote.html">Get Free Quote</a>
        <a class="btn btn-secondary lp-wa" data-wa="${esc(wa)}" href="#">Book Consultation</a>
        <a class="btn btn-ghost" href="tel:+923272340505">Call Now</a>
      </div>
      <div style="margin-top:1.75rem">${leadForm(ind.slug.replace(/-/g, " "))}</div>
    </div>
  </section>`;

  return pageShell({
    title: ind.title,
    description: ind.meta,
    canonical,
    bodyPage: "landing",
    seoPath: `/industries/${ind.slug}.html`,
    theme: ind.theme,
    mood: ind.theme.mood || ind.theme.pattern,
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: "Industries", path: "/industries/" },
      { name: ind.h1.split(" ").slice(0, 4).join(" "), path: `/industries/${ind.slug}.html` },
    ],
    bodyHtml: body,
    schemaExtra: Object.assign([
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: ind.h1,
        description: ind.meta,
        provider: { "@type": "Organization", name: "Onairo Solutions" },
        areaServed: "Pakistan",
        url: canonical,
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: ind.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ], { heroImage: thumbCss || "" }),
    rootDepth: 2,
  });
}

function hubPage(kind, items) {
  const isServices = kind === "services";
  const title = isServices
    ? "Professional Website & Software Development Services | Onairo Solutions"
    : "Industry Website Design Pakistan | Onairo Solutions";
  const desc = isServices
    ? "Explore dedicated service landing pages for website development, software, AI, SEO, redesign, and more."
    : "Explore industry website landing pages for clinics, law firms, gyms, travel agencies, schools, real estate, and more.";
  const cards = items
    .map((item) => {
      const href = `${item.slug}.html`;
      const label = isServices ? item.h1 : item.h1;
      const blurb = isServices ? item.lead : item.lead;
      const icon = isServices ? item.icon : "◆";
      return `<a class="lp-benefit" href="${href}" style="text-decoration:none;color:inherit">
        <h3>${isServices ? icon + " " : ""}${esc(label)}</h3>
        <p>${esc(blurb)}</p>
      </a>`;
    })
    .join("");

  const body = `
  <header class="lp-hero" data-pattern="grid">
    <div class="container">
      <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
        <a href="../index.html">Home</a><span>/</span><span>${isServices ? "Services" : "Industries"}</span>
      </nav>
      <p class="lp-kicker">${isServices ? "Services hub" : "Industries hub"}</p>
      <h1>${isServices ? "Services built for real business outcomes" : "Industry websites with dedicated landing pages"}</h1>
      <p class="lp-lead">${esc(desc)}</p>
      <div class="seo-internal-links">
        <a href="../${isServices ? "industries" : "services"}/index.html">${isServices ? "Industries" : "Services"}</a>
        <a href="../portfolio/index.html">Portfolio</a>
        <a href="../pages/request-quote.html">Request Quote</a>
        <a href="../products/edutrack.html">EduTrack</a>
      </div>
    </div>
  </header>
  <section class="section">
    <div class="container">
      <div class="lp-benefit-grid">${cards}</div>
    </div>
  </section>`;

  return pageShell({
    title,
    description: desc,
    canonical: abs(`/${kind}/`),
    bodyPage: kind,
    seoPath: `/${kind}/`,
    theme: { accent: "#3B82F6", accent2: "#93C5FD", glow: "rgba(59,130,246,0.2)", pattern: "grid" },
    breadcrumbs: [
      { name: "Home", path: "/" },
      { name: isServices ? "Services" : "Industries", path: `/${kind}/` },
    ],
    bodyHtml: body,
    rootDepth: 2,
  });
}

// Write files into public/ document root
const servicesDir = path.join(ROOT, "public", "services");
const industriesDir = path.join(ROOT, "public", "industries");
fs.mkdirSync(servicesDir, { recursive: true });
fs.mkdirSync(industriesDir, { recursive: true });

data.services.forEach((svc) => {
  fs.writeFileSync(path.join(servicesDir, `${svc.slug}.html`), generateService(svc), "utf8");
});
data.industries.forEach((ind) => {
  fs.writeFileSync(path.join(industriesDir, `${ind.slug}.html`), generateIndustry(ind), "utf8");
});

// Keep existing services/index.html content-aware by writing hub (backup note: overwrites listing)
fs.writeFileSync(path.join(servicesDir, "index.html"), hubPage("services", data.services), "utf8");
fs.writeFileSync(path.join(industriesDir, "index.html"), hubPage("industries", data.industries), "utf8");

// Merge into sitemap (public + root)
const sitemapCandidates = [
  path.join(ROOT, "public", "sitemap.xml"),
  path.join(ROOT, "sitemap.xml"),
];
let urls = [];
for (const sitemapPath of sitemapCandidates) {
  if (!fs.existsSync(sitemapPath)) continue;
  const existing = fs.readFileSync(sitemapPath, "utf8");
  const locs = [...existing.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => stripSrcPrefix(m[1]));
  urls = urls.concat(locs);
}
const add = [];
data.services.forEach((s) => add.push(`${SITE}/services/${s.slug}.html`));
data.industries.forEach((i) => add.push(`${SITE}/industries/${i.slug}.html`));
add.push(`${SITE}/services/`);
add.push(`${SITE}/industries/`);
const all = Array.from(new Set(urls.concat(add).map(stripSrcPrefix)));
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map(
    (u) => `  <url>
    <loc>${u}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u.includes("edutrack") || u.endsWith(".com/") ? "0.9" : "0.75"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
writeSitemap(xml);

console.log("Generated", data.services.length, "service landings → public/services/");
console.log("Generated", data.industries.length, "industry landings → public/industries/");
console.log("Sitemap URLs:", all.length);
