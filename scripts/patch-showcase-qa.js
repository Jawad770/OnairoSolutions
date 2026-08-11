/**
 * Lightweight showcase QA patches:
 * - Stack floating CTAs with safe-area insets
 * - Tighten mobile grids that crush cards
 * Applied only where patterns already exist.
 */
const fs = require("fs");
const path = require("path");

const demosDir = path.join(__dirname, "..", "public", "demos");

const FLOAT_BLOCK = `
    /* Showcase QA: floating CTA stack + safe areas */
    :root {
      --float-right: max(1rem, env(safe-area-inset-right, 0px));
      --float-gap: 0.75rem;
      --float-size: 52px;
      --float-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
    }
`;

function ensureOverflowX(css) {
  if (/html\s*\{[^}]*overflow-x:\s*hidden/.test(css) || /body\s*\{[^}]*overflow-x:\s*hidden/.test(css)) {
    return css;
  }
  return css.replace(/(html\s*\{)/, "$1\n      overflow-x: hidden;");
}

function patchCarrental(html) {
  // Replace float positioning block
  const oldFloat = `    .wa-float {
      position: fixed; bottom: 5.5rem; right: 1.25rem; z-index: 400;
      width: 56px; height: 56px; border-radius: 50%;
      background: var(--wa); display: grid; place-items: center;
      box-shadow: 0 8px 28px rgba(37, 211, 102, 0.45); transition: transform 0.25s;
    }
    .wa-float:hover { transform: scale(1.06); }
    .wa-float svg { width: 28px; height: 28px; fill: #fff; }

    .book-sticky {
      position: fixed; bottom: 1.25rem; right: 1.25rem; z-index: 400;
      padding: 0.75rem 1.35rem; border-radius: 999px;
      background: linear-gradient(135deg, var(--red), #b91c1c);
      color: #fff; text-decoration: none; font-weight: 700; font-size: 0.88rem;
      box-shadow: 0 8px 28px rgba(220, 38, 38, 0.4);
    }
    .back-top {
      position: fixed; bottom: 1.25rem; left: 1.25rem; z-index: 400;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--carbon); border: 1px solid var(--glass-border);
      color: var(--white); display: grid; place-items: center; text-decoration: none;
      opacity: 0; visibility: hidden; transition: opacity 0.3s;
    }
    .back-top.show { opacity: 1; visibility: visible; }`;

  const newFloat = `    .wa-float {
      position: fixed;
      right: max(1rem, env(safe-area-inset-right, 0px));
      bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px));
      z-index: 400;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--wa); display: grid; place-items: center;
      box-shadow: 0 8px 28px rgba(37, 211, 102, 0.45); transition: transform 0.25s;
    }
    .wa-float:hover { transform: scale(1.06); }
    .wa-float svg { width: 26px; height: 26px; fill: #fff; }

    .book-sticky {
      position: fixed;
      right: max(1rem, env(safe-area-inset-right, 0px));
      bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
      z-index: 400;
      padding: 0.7rem 1.2rem; border-radius: 999px;
      background: linear-gradient(135deg, var(--red), #b91c1c);
      color: #fff; text-decoration: none; font-weight: 700; font-size: 0.85rem;
      box-shadow: 0 8px 28px rgba(220, 38, 38, 0.4);
      max-width: calc(100vw - 5.5rem);
      white-space: nowrap;
    }
    .back-top {
      position: fixed;
      left: max(1rem, env(safe-area-inset-left, 0px));
      bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
      z-index: 400;
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--carbon); border: 1px solid var(--glass-border);
      color: var(--white); display: grid; place-items: center; text-decoration: none;
      opacity: 0; visibility: hidden; transition: opacity 0.3s;
    }
    .back-top.show { opacity: 1; visibility: visible; }
    @media (max-width: 600px) {
      .wa-float {
        bottom: calc(4.5rem + env(safe-area-inset-bottom, 0px));
        width: 48px; height: 48px;
      }
      .book-sticky {
        font-size: 0.8rem;
        padding: 0.65rem 1.05rem;
      }
      .vehicle-grid { grid-template-columns: 1fr !important; gap: 1rem; }
      .vehicle-actions { flex-direction: column; }
      .vehicle-actions .btn { width: 100%; min-width: 0; }
      .section { padding-top: 3.25rem; padding-bottom: 3.25rem; }
      .section-head { margin-bottom: 1.75rem; }
    }
    @media (max-width: 900px) {
      .detail-layout, .detail-grid, .detail-body, .detail-shell .detail-columns {
        grid-template-columns: 1fr !important;
      }
    }`;

  if (!html.includes(oldFloat)) {
    console.log("carrental: float block not exact match, trying softer patch");
    html = html.replace(
      /\.wa-float \{[\s\S]*?\.back-top\.show \{ opacity: 1; visibility: visible; \}/,
      newFloat.trim()
    );
  } else {
    html = html.replace(oldFloat, newFloat);
  }

  // Vehicle grid minmax a bit safer on narrow phones
  html = html.replace(
    ".vehicle-grid {\n      display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));",
    ".vehicle-grid {\n      display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));"
  );

  // Prevent horizontal overflow
  if (!html.includes("overflow-x: hidden") || !/body\s*\{[^}]*overflow-x:\s*hidden/.test(html)) {
    html = html.replace(
      /(body\s*\{[^}]*)(overflow-x:\s*hidden;)?/,
      (m, start, has) => (has ? m : start.replace(/\{/, "{ overflow-x: hidden;"))
    );
  }

  return html;
}

function patchDental(html) {
  // Float stack + mobile 1-col for treat/ba when narrow
  const floatOld = `    .wa-float, .back-top, .book-float {
      position: fixed; right: 1.25rem; z-index: 180;
      display: grid; place-items: center; text-decoration: none;
      box-shadow: 0 8px 28px rgba(30,58,95,0.2); transition: transform 0.25s, opacity 0.3s;
    }
    .wa-float {
      bottom: 1.25rem; width: 52px; height: 52px; border-radius: 50%; background: var(--wa);
      animation: bounceSoft 3s ease-in-out infinite;
    }
    .wa-float svg { width: 26px; height: 26px; fill: #fff; }
    .book-float {
      bottom: 5.5rem; background: var(--sky-deep); color: #fff;
      padding: 0.7rem 1.15rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700;
      white-space: nowrap;
    }
    .book-float:hover { background: var(--mint-deep); transform: scale(1.04); }
    .back-top {
      bottom: 9.5rem; width: 44px; height: 44px; border-radius: 50%;
      background: var(--white); color: var(--sky-deep); border: 1px solid var(--silver);
      opacity: 0; pointer-events: none;
    }
    .back-top.show { opacity: 1; pointer-events: auto; }`;

  const floatNew = `    .wa-float, .back-top, .book-float {
      position: fixed;
      right: max(1rem, env(safe-area-inset-right, 0px));
      z-index: 180;
      display: grid; place-items: center; text-decoration: none;
      box-shadow: 0 8px 28px rgba(30,58,95,0.2); transition: transform 0.25s, opacity 0.3s;
    }
    .wa-float {
      bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
      width: 52px; height: 52px; border-radius: 50%; background: var(--wa);
      animation: bounceSoft 3s ease-in-out infinite;
    }
    .wa-float svg { width: 26px; height: 26px; fill: #fff; }
    .book-float {
      bottom: calc(4.85rem + env(safe-area-inset-bottom, 0px));
      background: var(--sky-deep); color: #fff;
      padding: 0.7rem 1.15rem; border-radius: 999px; font-size: 0.78rem; font-weight: 700;
      white-space: nowrap; max-width: calc(100vw - 2rem);
    }
    .book-float:hover { background: var(--mint-deep); transform: scale(1.04); }
    .back-top {
      bottom: calc(8.75rem + env(safe-area-inset-bottom, 0px));
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--white); color: var(--sky-deep); border: 1px solid var(--silver);
      opacity: 0; pointer-events: none;
    }
    .back-top.show { opacity: 1; pointer-events: auto; }`;

  if (html.includes(floatOld)) html = html.replace(floatOld, floatNew);
  else console.log("dental: float block soft-skip");

  // Mobile: prefer 1 column for treatment/gallery cards under 420px
  html = html.replace(
    `@media (max-width: 600px) {
      section { padding: 3.5rem 1.15rem; }
      nav { padding: 0.75rem 1rem; }
      .why-grid, .treat-grid, .doc-grid, .tech-grid, .tips-grid, .pay-grid, .resource-grid {
        grid-template-columns: 1fr 1fr; gap: 0.65rem;
      }`,
    `@media (max-width: 600px) {
      section { padding: 3.25rem 1.15rem; }
      nav { padding: 0.75rem 1rem; }
      .why-grid, .treat-grid, .doc-grid, .tech-grid, .tips-grid, .pay-grid, .resource-grid {
        grid-template-columns: 1fr; gap: 0.85rem;
      }
      .ba-grid { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }
      .book-float { bottom: calc(4.6rem + env(safe-area-inset-bottom, 0px)); font-size: 0.72rem; padding: 0.65rem 0.95rem; }
      .back-top { bottom: calc(8.1rem + env(safe-area-inset-bottom, 0px)); }`
  );

  // At 980 keep 2-col but hide book-float (already) — also stack ba-grid better
  html = html.replace(
    `.ba-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.35rem; }`,
    `.ba-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 1.35rem; }`
  );

  return html;
}

function patchTravel(html) {
  // Fix tablet overlap: book-float stays at 5.5 while back moves to 5rem
  html = html.replace(
    `@media (max-width: 980px) {
      .wa-float, .back-top { right: 1rem; }
      .back-top { bottom: 5rem; width: 48px; height: 48px; }
      .wa-float { bottom: 1rem; width: 48px; height: 48px; }
      #quote-popup { left: 1rem; bottom: 5.5rem; }`,
    `@media (max-width: 980px) {
      .wa-float, .back-top, .book-float { right: max(0.85rem, env(safe-area-inset-right, 0px)); }
      .wa-float { bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); width: 48px; height: 48px; }
      .book-float { bottom: calc(4.6rem + env(safe-area-inset-bottom, 0px)); }
      .back-top { bottom: calc(8.4rem + env(safe-area-inset-bottom, 0px)); width: 44px; height: 44px; }
      #quote-popup { left: 1rem; bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px)); max-width: min(300px, calc(100vw - 5.5rem)); }`
  );

  html = html.replace(
    `@media (max-width: 600px) {
      section { padding: 3.5rem 1.15rem; }
      nav { padding: 0.75rem 1rem; }
      .masonry { columns: 1; }
      .ig-grid { grid-template-columns: repeat(2, 1fr); }
      .stats-bar { grid-template-columns: 1fr 1fr; }
      .pkg-grid, .dest-grid, .hotel-grid, .exp-grid, .why-grid, .blog-grid {
        grid-template-columns: 1fr 1fr;`,
    `@media (max-width: 600px) {
      section { padding: 3.25rem 1.15rem; }
      nav { padding: 0.75rem 1rem; }
      .masonry { columns: 1; }
      .ig-grid { grid-template-columns: repeat(2, 1fr); }
      .stats-bar { grid-template-columns: 1fr 1fr; }
      .pkg-grid, .dest-grid, .hotel-grid, .exp-grid, .why-grid, .blog-grid {
        grid-template-columns: 1fr;`
  );

  return html;
}

function patchGym(html) {
  html = html.replace(
    `.wa-float, .back-top {
      position: fixed; right: 1.25rem; z-index: 180;
      width: 52px; height: 52px; border-radius: 50%;
      display: grid; place-items: center; text-decoration: none;
      box-shadow: 0 8px 28px rgba(0,0,0,0.4); transition: transform 0.25s, opacity 0.3s;
    }
    .wa-float {
      bottom: 1.25rem; background: var(--wa);
      animation: ctaFloat 3s ease-in-out infinite;
    }
    .wa-float svg { width: 26px; height: 26px; fill: #fff; }
    .wa-float:hover { transform: scale(1.08); }
    .back-top {
      bottom: 5.5rem; background: var(--surface); border: 1px solid var(--glass-border);
      color: var(--cyan); font-size: 1.2rem; opacity: 0; pointer-events: none;
    }
    .back-top.show { opacity: 1; pointer-events: auto; }`,
    `.wa-float, .back-top {
      position: fixed;
      right: max(1rem, env(safe-area-inset-right, 0px));
      z-index: 180;
      width: 52px; height: 52px; border-radius: 50%;
      display: grid; place-items: center; text-decoration: none;
      box-shadow: 0 8px 28px rgba(0,0,0,0.4); transition: transform 0.25s, opacity 0.3s;
    }
    .wa-float {
      bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); background: var(--wa);
      animation: ctaFloat 3s ease-in-out infinite;
    }
    .wa-float svg { width: 26px; height: 26px; fill: #fff; }
    .wa-float:hover { transform: scale(1.08); }
    .back-top {
      bottom: calc(4.85rem + env(safe-area-inset-bottom, 0px));
      background: var(--surface); border: 1px solid var(--glass-border);
      color: var(--cyan); font-size: 1.2rem; opacity: 0; pointer-events: none;
    }
    .back-top.show { opacity: 1; pointer-events: auto; }`
  );

  html = html.replace(
    `.features-grid, .community-grid, .programs-grid, .trainers-grid,
      .supp-grid, .challenge-grid { grid-template-columns: 1fr; }`,
    `.features-grid, .community-grid, .programs-grid, .trainers-grid,
      .supp-grid, .challenge-grid, .price-grid { grid-template-columns: 1fr; }
      .form-row { grid-template-columns: 1fr; }`
  );

  return html;
}

function patchLawfirm(html) {
  html = html.replace(
    `.wa-float, .back-top { right: 1rem; }
      .back-top { bottom: 5rem; width: 48px; height: 48px; }
      .wa-float { bottom: 1rem; width: 48px; height: 48px; }
      .practice-grid { grid-template-columns: 1fr 1fr; }
      .attorneys-grid { grid-template-columns: 1fr 1fr; }`,
    `.wa-float, .back-top, .consult-float { right: max(0.85rem, env(safe-area-inset-right, 0px)); }
      .wa-float { bottom: calc(1rem + env(safe-area-inset-bottom, 0px)); width: 48px; height: 48px; }
      .consult-float { bottom: calc(4.6rem + env(safe-area-inset-bottom, 0px)); }
      .back-top { bottom: calc(8.4rem + env(safe-area-inset-bottom, 0px)); width: 44px; height: 44px; }
      .practice-grid { grid-template-columns: 1fr 1fr; }
      .attorneys-grid { grid-template-columns: 1fr 1fr; }`
  );
  return html;
}

function patchGenericOverflow(html) {
  if (/body\s*\{[^}]*overflow-x:\s*hidden/.test(html)) return html;
  if (/body\s*\{/.test(html)) {
    return html.replace(/body\s*\{/, "body {\n      overflow-x: hidden;");
  }
  return html;
}

const patches = {
  "carrental.html": (h) => patchGenericOverflow(patchCarrental(h)),
  "dental.html": (h) => patchGenericOverflow(patchDental(h)),
  "travel.html": (h) => patchGenericOverflow(patchTravel(h)),
  "gym.html": (h) => patchGenericOverflow(patchGym(h)),
  "lawfirm.html": (h) => patchGenericOverflow(patchLawfirm(h)),
};

for (const [file, fn] of Object.entries(patches)) {
  const p = path.join(demosDir, file);
  const before = fs.readFileSync(p, "utf8");
  const after = fn(before);
  if (after === before) console.log("NO CHANGE", file);
  else {
    fs.writeFileSync(p, after, "utf8");
    console.log("PATCHED", file, "delta", after.length - before.length);
  }
}

// Soft mobile 1-col for remaining premium demos with 2-col at 600
for (const file of ["it.html", "school.html", "clinic.html", "restaurant.html", "salon.html", "menssalon.html", "realestate.html", "building.html", "carshowroom.html"]) {
  const p = path.join(demosDir, file);
  if (!fs.existsSync(p)) continue;
  let html = fs.readFileSync(p, "utf8");
  const orig = html;
  html = patchGenericOverflow(html);
  // Add a late mobile rule if missing a strong 1fr collapse for card grids
  if (!html.includes("/* showcase-qa-mobile */") && html.includes("@media (max-width: 600px)")) {
    html = html.replace(
      /@media \(max-width: 600px\) \{/,
      `@media (max-width: 600px) {\n      /* showcase-qa-mobile */\n      img, video, iframe, svg { max-width: 100%; height: auto; }\n      .form-row { grid-template-columns: 1fr !important; }`
    );
  }
  if (html !== orig) {
    fs.writeFileSync(p, html, "utf8");
    console.log("SOFT", file);
  } else console.log("skip", file);
}

console.log("done");
