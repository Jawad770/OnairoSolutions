/**
 * Generates portfolio SEO pages, blog article pages, and sitemap.xml
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SITE = "https://onairosolutions.com";

const portfolioSeo = {
  gym: ["Gym Website Design Pakistan", "fitness website", "memberships, trainers, class schedules"],
  lawfirm: ["Law Firm Website Design Pakistan", "legal website", "practice areas and consultation booking"],
  dental: ["Dental Clinic Website Design Pakistan", "dental website", "treatments, smile gallery, appointments"],
  carrental: ["Rent A Car Website Design Pakistan", "car rental website", "fleet filters and WhatsApp reservations"],
  school: ["School Website Design Pakistan", "school website", "admissions, faculty, and events"],
  it: ["IT Company Website Design Pakistan", "software company website", "services, case studies, consultations"],
  carshowroom: ["Car Showroom Website Design", "dealership website", "inventory and test-drive booking"],
  travel: ["Travel Agency Website Design Pakistan", "tour website", "packages, destinations, trip planning"],
  boutique: ["Clothing Store Website Design", "boutique website", "collections and WhatsApp orders"],
  restaurant: ["Restaurant Website Design Pakistan", "restaurant website", "menus, gallery, table booking"],
  building: ["Construction Company Website Design", "construction website", "project progress and unit availability"],
  salon: ["Salon Website Design Pakistan", "beauty salon website", "services, gallery, appointments"],
  realestate: ["Real Estate Website Design Pakistan", "property website", "listings, agents, WhatsApp enquiries"],
  clinic: ["Medical Clinic Website Design Pakistan", "clinic website", "doctor profiles and appointments"],
  menssalon: ["Barber Shop Website Design", "mens salon website", "pricing, gallery, WhatsApp booking"],
};

const slugMap = {
  gym: "gym-website-design",
  lawfirm: "law-firm-website-design",
  dental: "dental-clinic-website-design",
  carrental: "rent-a-car-website-design",
  school: "school-website-design",
  it: "it-company-website-design",
  carshowroom: "car-showroom-website-design",
  travel: "travel-agency-website-design",
  boutique: "clothing-store-website-design",
  restaurant: "restaurant-website-design",
  building: "construction-company-website-design",
  salon: "salon-website-design",
  realestate: "real-estate-website-design",
  clinic: "medical-clinic-website-design",
  menssalon: "barber-shop-website-design",
};

const industrySlugMap = {
  gym: "gym-website-design",
  lawfirm: "law-firm-website-design",
  dental: "dental-clinic-website-design",
  carrental: "rent-a-car-website",
  school: "school-website-design",
  it: "it-company-website",
  travel: "travel-agency-website-design",
  boutique: "clothing-store-website",
  restaurant: "restaurant-website-design",
  building: "construction-company-website",
  salon: "salon-website",
  realestate: "real-estate-website",
  clinic: "medical-clinic-website",
  menssalon: "barber-shop-website",
};

const blogPosts = [
  {
    slug: "mobile-first-website-design-pakistan",
    title: "Why Mobile-First Website Design Still Wins More Customers in Pakistan",
    description: "Learn how mobile-first website design improves conversions for Pakistani businesses with faster CTAs, trust, and WhatsApp lead paths.",
    category: "Website Design",
    body: [
      "Most business traffic in Pakistan arrives on mobile. Yet many websites still hide CTAs, force tiny text, and make WhatsApp contact hard to find.",
      "A mobile-first website places your offer, proof, and next step above the fold. Visitors should understand what you do and how to contact you in seconds.",
      "Onairo Solutions designs industry websites with fast WhatsApp paths, clear services, and SEO foundations so mobile visitors become enquiries.",
    ],
  },
  {
    slug: "when-to-replace-spreadsheets-with-custom-software",
    title: "When to Leave Spreadsheets Behind for Custom Software",
    description: "Signs your business has outgrown Excel and needs custom software for multi-user workflows, reporting, and fewer errors.",
    category: "Software Development",
    body: [
      "Spreadsheets work until multiple people edit the same files, reports break, and nobody trusts the latest version.",
      "Custom software becomes valuable when you need permissions, audit history, dashboards, and repeatable workflows across teams.",
      "Start with one painful process — fee collection, inventory, or lead tracking — then expand. Onairo helps scope first versions that ship.",
    ],
  },
  {
    slug: "school-management-software-reduce-admin-hours",
    title: "How Schools Cut Admin Hours with Unified School Management Software",
    description: "How offline school ERP tools like EduTrack reduce attendance, fee, payroll, and parent communication chaos.",
    category: "School Management",
    body: [
      "School offices often juggle paper registers, Excel fee sheets, and personal WhatsApp chats. That creates delays and lost records.",
      "A unified school management system connects attendance, fees, payroll, ID cards, and reports in one Windows application.",
      "EduTrack is built for Pakistani schools that need offline-first reliability, QR attendance, and professional print documents.",
    ],
  },
  {
    slug: "digital-transformation-playbook-for-growing-businesses",
    title: "Digital Transformation That Actually Sticks",
    description: "A practical sequencing playbook for websites, automation, and software products so digital change compounds.",
    category: "Business Growth",
    body: [
      "Digital transformation fails when teams buy tools without fixing process order. Start with customer acquisition, then operations, then reporting.",
      "A strong website creates demand. Automation removes manual follow-up. Software products lock in efficiency.",
      "Onairo helps businesses sequence these layers so each investment supports the next.",
    ],
  },
  {
    slug: "high-converting-industry-website-design-patterns",
    title: "Industry Websites: What High-Converting Demos Get Right",
    description: "Conversion patterns from dental, law, gym, travel, and real estate website demos that turn visitors into leads.",
    category: "Website Design",
    body: [
      "High-converting industry websites lead with a clear promise, trusted proof, and one primary CTA.",
      "Clinics emphasize appointments. Law firms emphasize consultations. Gyms emphasize memberships. Travel sites emphasize packages.",
      "Explore our portfolio demos, then request a branded version adapted to your services and city.",
    ],
  },
  {
    slug: "practical-ai-integrations-for-small-businesses",
    title: "Practical AI Integrations for Small and Mid-Size Teams",
    description: "Where AI assistants and document intelligence pay off quickly — and where human judgment still matters.",
    category: "AI",
    body: [
      "AI is most useful when it removes repetitive drafting, tagging, or search work — not when it replaces customer trust.",
      "Good first projects include enquiry triage, document summaries, and internal knowledge assistants.",
      "Onairo integrates AI carefully into real workflows so teams stay in control of final decisions.",
    ],
  },
  {
    slug: "seo-for-service-businesses-pakistan",
    title: "SEO for Service Businesses in Pakistan: A Practical Starting Checklist",
    description: "Title tags, local SEO, portfolio pages, and internal linking tips for clinics, law firms, gyms, and agencies.",
    category: "SEO",
    body: [
      "SEO starts with clear titles, useful pages, and internal links between services, portfolio proof, and contact paths.",
      "Create dedicated pages for each service and city intent. Add FAQ schema and keep pages fast on mobile.",
      "Onairo builds SEO foundations into websites from day one so you are not redesigning later for search.",
    ],
  },
  {
    slug: "whatsapp-lead-systems-for-business-websites",
    title: "WhatsApp Lead Systems for Business Websites",
    description: "How to turn website traffic into WhatsApp conversations without losing enquiry context or follow-ups.",
    category: "Digital Marketing",
    body: [
      "WhatsApp converts when messages arrive with context: service interest, city, and budget.",
      "Pair website forms with CRM capture so no enquiry is lost, even if the chat window closes.",
      "Onairo websites and portal workflows are designed so marketing traffic becomes tracked sales conversations.",
    ],
  },
];

function portfolioPageHtml(id, slug, meta) {
  const [titleCore, label, features] = meta;
  const title = `${titleCore} | Onairo Solutions`;
  const desc = `Premium ${label} by Onairo Solutions with ${features}. View the live demo and request a custom build.`;
  const industrySlug = industrySlugMap[id];
  const industryLink = industrySlug
    ? `<a href="../industries/${industrySlug}.html">Full Industry Landing</a>`
    : `<a href="../industries/index.html">Industry Websites</a>`;
  const seoPath = `/portfolio/${slug}.html`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <meta name="description" content="${desc}"/>
  <link rel="canonical" href="${SITE}${seoPath}"/>
  <link rel="icon" href="../favicon.svg" type="image/svg+xml"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="../shared/css/tokens.css"/>
  <link rel="stylesheet" href="../shared/css/base.css"/>
  <link rel="stylesheet" href="../shared/css/components.css"/>
  <link rel="stylesheet" href="../shared/css/seo.css"/>
  <link rel="stylesheet" href="../shared/css/landing.css"/>
</head>
<body class="generated-page" data-root=".." data-page="portfolio" data-seo-title="${title}" data-seo-description="${desc}" data-seo-path="${seoPath}">
  <div id="site-nav"></div>
  <header class="section" style="padding-top:8rem;border-bottom:1px solid var(--border)">
    <div class="container" style="max-width:860px">
      <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
        <a href="../index.html">Home</a><span>/</span>
        <a href="index.html">Portfolio</a><span>/</span>
        <span>${titleCore}</span>
      </nav>
      <p class="section-tag">Website design portfolio</p>
      <h1 class="section-title" style="max-width:18ch;margin:0 0 1rem">${titleCore}</h1>
      <p class="section-sub" style="max-width:62ch;margin:0 0 1.5rem">Looking for a ${label}? Explore this Onairo Solutions demo featuring ${features}. We customize branding, content, SEO, and lead capture for your business in Pakistan or worldwide.</p>
      <div style="display:flex;flex-wrap:wrap;gap:.75rem">
        <a class="btn btn-primary" href="/showcase/${id}">View Live Demo</a>
        <a class="btn btn-secondary" href="../pages/request-quote.html">Request Custom Website</a>
        <a class="btn btn-ghost" href="index.html">All Portfolio</a>
      </div>
      <div class="seo-internal-links">
        ${industryLink}
        <a href="../services/website-development.html">Website Development</a>
        <a href="../services/seo-services.html">SEO Services</a>
        <a href="../pages/request-quote.html">Request Quote</a>
      </div>
    </div>
  </header>
  <section class="section">
    <div class="container" style="max-width:860px">
      <h2>Why businesses choose this website style</h2>
      <p style="color:var(--slate);line-height:1.75">A strong ${label} should load quickly, explain services clearly, and make contact effortless on mobile. Our demos are designed as conversion-focused starting points — not generic templates.</p>
      <h3>What you can customize</h3>
      <ul style="color:var(--slate);line-height:1.8">
        <li>Brand colors, typography, and photography</li>
        <li>Service pages and city-focused SEO content</li>
        <li>WhatsApp and form lead capture</li>
        <li>Portfolio proof, FAQs, and schema markup</li>
      </ul>
    </div>
  </section>
  <div id="site-footer"></div>
  <div id="site-chrome-end"></div>
  <script src="../shared/js/config.js"></script>
  <script src="../shared/js/seo-data.js"></script>
  <script src="../shared/js/seo.js"></script>
  <script src="../components/chrome.js"></script>
  <script src="../shared/js/main.js"></script>
</body>
</html>`;
}

function blogArticleHtml(post) {
  const title = `${post.title} | Onairo Solutions Blog`;
  const urlPath = `/pages/blog/${post.slug}.html`;
  const paragraphs = post.body.map((p) => `<p style="color:var(--slate);line-height:1.8;margin:0 0 1rem">${p}</p>`).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
  <meta name="description" content="${post.description}"/>
  <link rel="canonical" href="${SITE}${urlPath}"/>
  <link rel="icon" href="../../favicon.svg" type="image/svg+xml"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=Outfit:wght@500;600;700;800&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="../../shared/css/tokens.css"/>
  <link rel="stylesheet" href="../../shared/css/base.css"/>
  <link rel="stylesheet" href="../../shared/css/components.css"/>
  <link rel="stylesheet" href="../../shared/css/seo.css"/>
  <link rel="stylesheet" href="../../shared/css/landing.css"/>
</head>
<body class="generated-page" data-root="../.." data-page="blog" data-seo-title="${title}" data-seo-description="${post.description}" data-seo-path="${urlPath}">
  <div id="site-nav"></div>
  <article class="section" style="padding-top:8rem">
    <div class="container" style="max-width:760px">
      <nav class="seo-breadcrumbs" aria-label="Breadcrumb">
        <a href="../../index.html">Home</a><span>/</span>
        <a href="../blog.html">Blog</a><span>/</span>
        <span>${post.category}</span>
      </nav>
      <p class="section-tag">${post.category}</p>
      <h1 class="section-title" style="max-width:20ch;margin-bottom:1rem">${post.title}</h1>
      <p class="section-sub" style="margin-bottom:1.75rem">${post.description}</p>
      ${paragraphs}
      <div class="seo-internal-links">
        <a href="../../services/index.html">Services</a>
        <a href="../../portfolio/index.html">Portfolio</a>
        <a href="../../products/edutrack.html">EduTrack</a>
        <a href="../request-quote.html">Request Quote</a>
        <a href="../contact.html">Contact</a>
      </div>
    </div>
  </article>
  <div id="site-footer"></div>
  <div id="site-chrome-end"></div>
  <script src="../../shared/js/config.js"></script>
  <script src="../../shared/js/seo-data.js"></script>
  <script src="../../shared/js/seo.js"></script>
  <script src="../../components/chrome.js"></script>
  <script src="../../shared/js/main.js"></script>
</body>
</html>`;
}

const portfolioDir = path.join(ROOT, "public", "portfolio");
fs.mkdirSync(portfolioDir, { recursive: true });
Object.entries(portfolioSeo).forEach(([id, meta]) => {
  const slug = slugMap[id];
  fs.writeFileSync(path.join(portfolioDir, `${slug}.html`), portfolioPageHtml(id, slug, meta), "utf8");
});

const blogDir = path.join(ROOT, "public", "pages", "blog");
fs.mkdirSync(blogDir, { recursive: true });
blogPosts.forEach((post) => {
  fs.writeFileSync(path.join(blogDir, `${post.slug}.html`), blogArticleHtml(post), "utf8");
});

const urls = [
  "/",
  "/services/",
  "/services/index.html",
  "/industries/",
  "/industries/index.html",
  "/portfolio/index.html",
  "/products/index.html",
  "/products/edutrack.html",
  "/pages/about.html",
  "/pages/pricing.html",
  "/pages/blog.html",
  "/pages/contact.html",
  "/pages/request-quote.html",
];
Object.values(slugMap).forEach((slug) => urls.push(`/portfolio/${slug}.html`));
blogPosts.forEach((p) => urls.push(`/pages/blog/${p.slug}.html`));

try {
  const landings = require("./landing-data");
  landings.services.forEach((s) => urls.push(`/services/${s.slug}.html`));
  landings.industries.forEach((i) => urls.push(`/industries/${i.slug}.html`));
} catch (_) {
  /* landing-data optional if generator not yet present */
}

const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u === "/" ? "/" : u}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${u === "/" ? "1.0" : u.includes("edutrack") ? "0.9" : "0.7"}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");
fs.mkdirSync(path.join(ROOT, "public"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "public", "sitemap.xml"), sitemap, "utf8");

console.log("Generated", Object.keys(portfolioSeo).length, "portfolio SEO pages → public/portfolio/");
console.log("Generated", blogPosts.length, "blog articles → public/pages/blog/");
console.log("Wrote sitemap.xml (root + public/) with", urls.length, "URLs");
