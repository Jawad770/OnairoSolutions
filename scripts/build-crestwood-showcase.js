/**
 * Build static Crestwood Academy showcase pages from the professional school site design.
 * Output: public/demos/crestwood.html + public/demos/crestwood/*.html
 */
const fs = require("fs");
const path = require("path");

const demos = path.join(__dirname, "..", "public", "demos");
const siteDir = path.join(demos, "crestwood");
const ASSET = "/showcase/crestwood/assets";
const BASE = "/showcase/crestwood";

const school = {
  name: "Crestwood Academy",
  tagline: "Excellence in Learning, Character, and Community",
  phone: "0327 234 0505",
  phoneTel: "+923272340505",
  email: "info@crestwoodacademy.edu",
  address: "1200 Crestwood Drive, Maple Ridge",
  wa: "923272340505",
};

const primaryNav = [
  { label: "Home", href: BASE, id: "home" },
  { label: "About", href: `${BASE}/about.html`, id: "about" },
  { label: "Academics", href: `${BASE}/academics.html`, id: "academics" },
  { label: "Admissions", href: `${BASE}/admissions.html`, id: "admissions" },
  { label: "News", href: `${BASE}/news.html`, id: "news" },
  { label: "Events", href: `${BASE}/events.html`, id: "events" },
  { label: "Contact", href: `${BASE}/contact.html`, id: "contact" },
];

const moreNav = [
  { label: "Campus", href: `${BASE}/campus.html`, id: "campus" },
  { label: "Student Life", href: `${BASE}/student-life.html`, id: "student-life" },
  { label: "Faculty", href: `${BASE}/faculty.html`, id: "faculty" },
  { label: "Achievements", href: `${BASE}/achievements.html`, id: "achievements" },
  { label: "Gallery", href: `${BASE}/gallery.html`, id: "gallery" },
  { label: "Careers", href: `${BASE}/careers.html`, id: "careers" },
];

function img(file) {
  return `${ASSET}/images/stock/${file}`;
}

function shell(pageId, title, description, body, opts = {}) {
  const pageTitle = title ? `${title} | ${school.name}` : `${school.name} | Premier Private School`;
  const moreActive = moreNav.some((i) => i.id === pageId);
  const breadcrumb = opts.breadcrumb
    ? `<nav class="breadcrumb" aria-label="Breadcrumb"><div class="container"><ol class="breadcrumb-list"><li><a href="${BASE}">Home</a></li><li aria-current="page">${opts.breadcrumb}</li></ol></div></nav>`
    : "";

  const primaryLinks = primaryNav
    .map(
      (i) =>
        `<li><a class="nav-link${i.id === pageId ? " is-active" : ""}" href="${i.href}">${i.label}</a></li>`
    )
    .join("\n");

  const moreLinks = moreNav
    .map(
      (i) =>
        `<li><a class="nav-link${i.id === pageId ? " is-active" : ""}" href="${i.href}">${i.label}</a></li>`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageTitle}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="noindex,nofollow">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${ASSET}/css/main.css">
  <style>
    .demo-banner{background:linear-gradient(90deg,#0b1f3a,#16325a);color:#fff;text-align:center;padding:.55rem 1rem;font-size:.78rem;font-weight:500;position:relative;z-index:300}
    .demo-banner a{color:var(--gold-soft,#d4bb7a);font-weight:700}
    .demo-toast{position:fixed;left:50%;bottom:calc(5.5rem + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:400;max-width:min(92vw,380px);padding:.85rem 1.1rem;border-radius:12px;background:rgba(11,31,58,.96);color:#fff;font-size:.85rem;line-height:1.45;box-shadow:0 12px 40px rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .25s;text-align:center}
    .demo-toast.is-show{opacity:1}
  </style>
</head>
<body class="${opts.bodyClass || ""}">
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="demo-banner">This is a showcase site created by <a href="https://onairosolutions.com" target="_blank" rel="noopener noreferrer">Onairo Solutions</a> — onairosolutions.com</div>
  <div class="announce-bar" role="region" aria-label="Announcements">
    <div class="container announce-bar-inner">
      <p><strong>Admissions open</strong> — Applications for the upcoming academic year are now being accepted.</p>
    </div>
  </div>
  <header class="site-header" id="site-header">
    <div class="container header-inner">
      <a class="brand" href="${BASE}" aria-label="${school.name} home">
        <span class="brand-mark" aria-hidden="true">C</span>
        <span class="brand-text">
          <span class="brand-name">${school.name}</span>
          <span class="brand-tagline">${school.tagline}</span>
        </span>
      </a>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" data-nav-toggle>
        <span class="nav-toggle-bar"></span>
        <span class="nav-toggle-bar"></span>
        <span class="nav-toggle-bar"></span>
        <span class="visually-hidden">Menu</span>
      </button>
      <nav class="primary-nav primary-nav-desktop" aria-label="Primary desktop" data-primary-nav-desktop>
        <ul class="nav-list">
          ${primaryLinks}
          <li class="nav-item-more" data-nav-more>
            <button class="nav-link nav-more-btn${moreActive ? " is-active" : ""}" type="button" aria-expanded="false" aria-controls="nav-more-menu" data-nav-more-toggle>
              More<span class="nav-more-caret" aria-hidden="true"></span>
            </button>
            <ul class="nav-more-menu" id="nav-more-menu" data-nav-more-menu hidden>
              ${moreLinks}
            </ul>
          </li>
        </ul>
        <a class="btn btn-primary btn-sm nav-cta" href="${BASE}/apply.html">Apply Now</a>
      </nav>
    </div>
  </header>
  <nav class="primary-nav primary-nav-mobile" id="primary-nav" data-primary-nav aria-label="Primary mobile" hidden>
    <div class="nav-drawer-inner">
      <ul class="nav-list">${primaryLinks}</ul>
      <div class="nav-mobile-extra">
        <p class="nav-mobile-label">Explore</p>
        <ul class="nav-list nav-list-secondary">${moreLinks}</ul>
      </div>
      <a class="btn btn-primary btn-sm nav-cta" href="${BASE}/apply.html">Apply Now</a>
    </div>
  </nav>
  <div class="nav-backdrop" data-nav-backdrop hidden></div>
  ${breadcrumb}
  <main id="main">
${body}
  </main>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <a class="brand brand-footer" href="${BASE}">
          <span class="brand-mark" aria-hidden="true">C</span>
          <span class="brand-name">${school.name}</span>
        </a>
        <p>${school.tagline}</p>
        <p class="footer-address">${school.address}</p>
      </div>
      <div>
        <h2 class="footer-heading">Explore</h2>
        <ul class="footer-links">
          <li><a href="${BASE}/about.html">About</a></li>
          <li><a href="${BASE}/academics.html">Academics</a></li>
          <li><a href="${BASE}/admissions.html">Admissions</a></li>
          <li><a href="${BASE}/campus.html">Campus</a></li>
          <li><a href="${BASE}/student-life.html">Student Life</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer-heading">Resources</h2>
        <ul class="footer-links">
          <li><a href="${BASE}/faculty.html">Faculty</a></li>
          <li><a href="${BASE}/news.html">News</a></li>
          <li><a href="${BASE}/events.html">Events</a></li>
          <li><a href="${BASE}/gallery.html">Gallery</a></li>
          <li><a href="${BASE}/careers.html">Careers</a></li>
          <li><a href="${BASE}/contact.html">Contact</a></li>
        </ul>
      </div>
      <div>
        <h2 class="footer-heading">Contact</h2>
        <ul class="footer-contact">
          <li><a href="tel:${school.phoneTel}">${school.phone}</a></li>
          <li><a href="mailto:${school.email}">${school.email}</a></li>
        </ul>
        <p class="footer-cta-copy">Interested in joining our school?</p>
        <a class="btn btn-primary btn-sm" href="${BASE}/apply.html">Make an Inquiry</a>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="container footer-bottom-inner">
        <p>&copy; 2026 ${school.name}. All rights reserved.</p>
        <p class="powered-by">
          <a class="powered-by-link onairo-powered" href="https://onairosolutions.com" target="_blank" rel="noopener noreferrer" aria-label="Powered by Onairo Solutions">
            <span class="powered-by-label">Powered by</span>
            <img class="powered-by-logo" src="${ASSET}/images/onairo-logo.png" width="120" height="48" alt="Onairo Solutions" loading="lazy" decoding="async">
          </a>
        </p>
      </div>
    </div>
  </footer>
  <a class="whatsapp-float" href="https://wa.me/${school.wa}?text=${encodeURIComponent("Hi, I'd like to enquire about Crestwood Academy.")}" target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp">
    <svg class="whatsapp-float-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M19.11 17.4c-.3-.15-1.77-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.12-.27-.2-.57-.35z"/>
      <path fill="currentColor" d="M16.02 3C8.84 3 3 8.83 3 16c0 2.29.6 4.44 1.65 6.31L3 29l6.87-1.8A12.94 12.94 0 0 0 16.02 29C23.2 29 29 23.17 29 16S23.2 3 16.02 3zm0 23.5c-2.1 0-4.05-.56-5.74-1.54l-.41-.24-4.08 1.07 1.09-3.98-.27-.42A10.43 10.43 0 0 1 5.5 16c0-5.79 4.72-10.5 10.52-10.5S26.54 10.21 26.54 16 21.82 26.5 16.02 26.5z"/>
    </svg>
  </a>
  <div class="demo-toast" id="demoToast" role="status"></div>
  <script src="${ASSET}/js/main.js" defer></script>
  <script src="/showcase/demo-globals.js"></script>
  <script>
    if (window.DemoGlobals) DemoGlobals.init();
    (function () {
      var toast = document.getElementById("demoToast");
      var timer;
      function show(msg) {
        toast.textContent = msg;
        toast.classList.add("is-show");
        clearTimeout(timer);
        timer = setTimeout(function () { toast.classList.remove("is-show"); }, 3200);
      }
      document.querySelectorAll("[data-demo-form]").forEach(function (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          show("Demo inquiry received — this showcase does not send data to a server. Contact Onairo for a live build.");
          form.reset();
        });
      });
    })();
  </script>
</body>
</html>`;
}

const pages = {};

pages.home = shell(
  "home",
  null,
  "Crestwood Academy is a premier private school nurturing academic excellence, character, and community.",
  `
<section class="hero" aria-label="Welcome">
  <div class="container">
    <div class="hero-inner">
      <p class="hero-brand">${school.name}</p>
      <h1>Where curious minds become confident leaders</h1>
      <p>A welcoming private school community dedicated to rigorous academics, creative expression, and character that lasts a lifetime.</p>
      <div class="btn-group">
        <a class="btn btn-primary" href="${BASE}/apply.html">Apply for Admission</a>
        <a class="btn btn-secondary" href="${BASE}/about.html">Explore Our School</a>
      </div>
    </div>
  </div>
</section>
<section class="stats" aria-label="School statistics">
  <div class="container stats-grid">
    <div><span class="stat-value">42+</span><span class="stat-label">Years of Excellence</span></div>
    <div><span class="stat-value">1,200</span><span class="stat-label">Students</span></div>
    <div><span class="stat-value">110</span><span class="stat-label">Dedicated Faculty</span></div>
    <div><span class="stat-value">98%</span><span class="stat-label">University Placement</span></div>
  </div>
</section>
<section class="section section-alt">
  <div class="container grid-2 reveal">
    <div>
      <div class="section-heading">
        <span class="eyebrow">About Our School</span>
        <h2>A tradition of purposeful learning</h2>
        <p>Since 1984, Crestwood Academy has partnered with families to educate the whole child — intellectually, socially, and ethically.</p>
      </div>
      <ul class="feature-list">
        <li>Small class sizes with personalized attention</li>
        <li>Balanced curriculum across STEM, humanities, and the arts</li>
        <li>Safe, inclusive campus culture rooted in respect</li>
        <li>Strong college counseling and life-skills guidance</li>
      </ul>
      <a class="btn btn-outline" href="${BASE}/about.html">Learn more about us</a>
    </div>
    <div class="media-frame">
      <img loading="lazy" decoding="async" src="${img("classroom.jpg")}" alt="Students collaborating in a bright classroom">
    </div>
  </div>
</section>
<section class="section">
  <div class="container">
    <div class="section-heading reveal">
      <span class="eyebrow">Why Choose Us</span>
      <h2>What families value most</h2>
      <p>Thoughtful teaching, meaningful community, and opportunities that help every student thrive.</p>
    </div>
    <div class="grid-3">
      <article class="card reveal"><div class="card-icon">01</div><h3>Academic rigor</h3><p>Challenging coursework designed to build deep understanding, critical thinking, and lifelong curiosity.</p></article>
      <article class="card reveal"><div class="card-icon">02</div><h3>Caring mentors</h3><p>Experienced educators who know each student by name and support growth beyond the classroom.</p></article>
      <article class="card reveal"><div class="card-icon">03</div><h3>Vibrant campus</h3><p>Modern facilities, outdoor learning spaces, and programs that celebrate creativity and wellness.</p></article>
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <div class="section-head-row reveal">
      <div class="section-heading">
        <span class="eyebrow">Academics</span>
        <h2>A curriculum built for tomorrow</h2>
        <p>From foundational literacy to advanced research, our pathways inspire excellence at every stage.</p>
      </div>
      <a class="btn btn-outline" href="${BASE}/academics.html">View academics</a>
    </div>
    <div class="grid-3">
      <article class="card reveal"><h3>Primary Years</h3><p>Playful inquiry, literacy, numeracy, and social-emotional foundations that spark a love of learning.</p></article>
      <article class="card reveal"><h3>Middle School</h3><p>Guided independence, interdisciplinary projects, and explorative electives that build confidence.</p></article>
      <article class="card reveal"><h3>Senior School</h3><p>Advanced courses, university preparation, leadership opportunities, and real-world learning.</p></article>
    </div>
  </div>
</section>
<section class="section">
  <div class="container grid-2 reveal">
    <div class="media-frame wide">
      <img loading="lazy" decoding="async" src="${img("campus.jpg")}" alt="Crestwood Academy campus courtyard">
    </div>
    <div>
      <div class="section-heading">
        <span class="eyebrow">Campus &amp; Facilities</span>
        <h2>Spaces designed for discovery</h2>
        <p>Science labs, studios, athletic fields, and quiet libraries — every corner supports learning and belonging.</p>
      </div>
      <ul class="feature-list">
        <li>Innovation and science laboratories</li>
        <li>Performing arts theatre and music suites</li>
        <li>Athletics complex and wellness center</li>
      </ul>
      <a class="btn btn-outline" href="${BASE}/campus.html">Tour our campus</a>
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container reveal">
    <div class="principal">
      <div class="media-frame tall">
        <img loading="lazy" decoding="async" src="${img("principal.jpg")}" alt="Principal Dr. Amira Ellison">
      </div>
      <div class="principal-body">
        <div class="section-heading">
          <span class="eyebrow">Principal’s Message</span>
          <h2>Welcome to our community</h2>
        </div>
        <p class="principal-quote">“At Crestwood, we believe education is a partnership. Together with families, we help young people grow into thoughtful citizens ready to lead with kindness and courage.”</p>
        <p class="principal-meta"><strong>Dr. Amira Ellison</strong><span>Principal, Crestwood Academy</span></p>
      </div>
    </div>
  </div>
</section>
<section class="section">
  <div class="container">
    <div class="section-head-row reveal">
      <div class="section-heading">
        <span class="eyebrow">News &amp; Events</span>
        <h2>Latest from campus</h2>
      </div>
      <div class="btn-group">
        <a class="btn btn-outline" href="${BASE}/news.html">All news</a>
        <a class="btn btn-outline" href="${BASE}/events.html">All events</a>
      </div>
    </div>
    <div class="grid-3">
      <article class="card news-card reveal">
        <img loading="lazy" decoding="async" src="${img("open-house.jpg")}" alt="Spring Open House">
        <div class="news-card-body">
          <p class="news-meta">12 days ago</p>
          <h3>Spring Open House Highlights</h3>
          <p>Families toured classrooms, met teachers, and experienced Crestwood learning firsthand.</p>
          <a href="${BASE}/news.html">Read more</a>
        </div>
      </article>
      <article class="card news-card reveal">
        <img loading="lazy" decoding="async" src="${img("stem-fair.jpg")}" alt="STEM Fair">
        <div class="news-card-body">
          <p class="news-meta">5 days ago</p>
          <h3>Students Shine at Regional STEM Fair</h3>
          <p>Crestwood innovators earned recognition for robotics, sustainability, and coding projects.</p>
          <a href="${BASE}/news.html">Read more</a>
        </div>
      </article>
      <article class="card news-card reveal">
        <img loading="lazy" decoding="async" src="${img("literacy.jpg")}" alt="Literacy Week">
        <div class="news-card-body">
          <p class="news-meta">2 days ago</p>
          <h3>Literacy Week Celebrates Reading Culture</h3>
          <p>Book talks, author visits, and reading challenges filled campus with storytelling energy.</p>
          <a href="${BASE}/news.html">Read more</a>
        </div>
      </article>
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container">
    <div class="section-head-row reveal">
      <div class="section-heading">
        <span class="eyebrow">Gallery</span>
        <h2>Life at Crestwood</h2>
      </div>
      <a class="btn btn-outline" href="${BASE}/gallery.html">View gallery</a>
    </div>
    <div class="gallery-grid reveal">
      <a class="gallery-item" href="${BASE}/gallery.html"><img loading="lazy" decoding="async" src="${img("science-lab.jpg")}" alt="Science lab"></a>
      <a class="gallery-item" href="${BASE}/gallery.html"><img loading="lazy" decoding="async" src="${img("library.jpg")}" alt="Library"></a>
      <a class="gallery-item" href="${BASE}/gallery.html"><img loading="lazy" decoding="async" src="${img("sports.jpg")}" alt="Sports"></a>
      <a class="gallery-item" href="${BASE}/gallery.html"><img loading="lazy" decoding="async" src="${img("community.jpg")}" alt="Community"></a>
    </div>
  </div>
</section>
<section class="section">
  <div class="container reveal">
    <div class="cta-banner">
      <h2>Admissions open</h2>
      <p>Admissions for the upcoming academic year are now open. We welcome families ready to partner with us.</p>
      <div class="btn-group" style="justify-content:center;">
        <a class="btn btn-primary" href="${BASE}/apply.html">Apply Now</a>
        <a class="btn btn-secondary" href="${BASE}/contact.html">Talk to Admissions</a>
      </div>
    </div>
  </div>
</section>
<section class="section section-alt">
  <div class="container contact-panel reveal">
    <div class="contact-card">
      <div class="section-heading">
        <span class="eyebrow">Visit Us</span>
        <h2>Find Crestwood Academy</h2>
        <p>We would love to welcome you to campus for a tour and conversation.</p>
      </div>
      <ul class="feature-list">
        <li>${school.address}</li>
        <li>${school.phone}</li>
        <li>${school.email}</li>
      </ul>
      <a class="btn btn-outline" href="${BASE}/contact.html">Contact details</a>
    </div>
    <div class="map-placeholder" role="region" aria-label="Campus location">
      <div>
        <strong>${school.name}</strong>
        <p style="margin:0.5rem 0 0;">${school.address}</p>
      </div>
    </div>
  </div>
</section>
`,
  { bodyClass: "page-home" }
);

pages.about = shell(
  "about",
  "About",
  "Learn about Crestwood Academy’s mission, history, values, and commitment to whole-child education.",
  `
<section class="page-hero"><div class="container"><h1>About Crestwood Academy</h1><p>For more than four decades, we have guided students to grow with curiosity, integrity, and purpose.</p></div></section>
<section class="section section-alt"><div class="container grid-2"><div><div class="section-heading"><span class="eyebrow">Our Mission</span><h2>Educating minds. Nurturing character.</h2><p>Crestwood Academy partners with families to develop confident learners who think critically, communicate clearly, and contribute generously.</p></div><ul class="feature-list"><li>Student-centered teaching and mentoring</li><li>High expectations with compassionate support</li><li>Global awareness grounded in local responsibility</li></ul></div><div class="media-frame"><img loading="lazy" decoding="async" src="${img("students-outdoors.jpg")}" alt="Students on campus"></div></div></section>
<section class="section"><div class="container"><div class="section-heading"><span class="eyebrow">Our Values</span><h2>What guides every Crestwood day</h2></div><div class="grid-4"><article class="card"><h3>Respect</h3><p>We honor every voice and treat one another with dignity.</p></article><article class="card"><h3>Curiosity</h3><p>We ask thoughtful questions and pursue understanding.</p></article><article class="card"><h3>Courage</h3><p>We take responsible risks and learn from challenge.</p></article><article class="card"><h3>Service</h3><p>We use our talents to uplift others beyond ourselves.</p></article></div></div></section>
<section class="section section-alt"><div class="container grid-2"><div class="media-frame"><img loading="lazy" decoding="async" src="${img("mentoring.jpg")}" alt="Faculty mentoring students"></div><div><div class="section-heading"><span class="eyebrow">Our Story</span><h2>Growing with our community</h2><p>Founded in 1984 by educators and families who imagined a school where excellence and belonging could thrive together.</p></div><div class="timeline"><div class="timeline-item"><div class="timeline-year">1984</div><div><strong>Founding year</strong><p>Crestwood opens with two grade bands and a clear mission.</p></div></div><div class="timeline-item"><div class="timeline-year">1998</div><div><strong>Campus expansion</strong><p>New science wing and performing arts centre completed.</p></div></div><div class="timeline-item"><div class="timeline-year">2016</div><div><strong>Innovation labs</strong><p>STEM studios and digital learning hubs launched school-wide.</p></div></div><div class="timeline-item"><div class="timeline-year">Today</div><div><strong>Thriving community</strong><p>1,200 students learning across a vibrant campus.</p></div></div></div></div></div></section>
`,
  { breadcrumb: "About" }
);

pages.academics = shell(
  "academics",
  "Academics",
  "Explore Crestwood Academy academic pathways from primary years through senior school.",
  `
<section class="page-hero"><div class="container"><h1>Academics</h1><p>A balanced curriculum that builds mastery, creativity, and confidence at every stage.</p></div></section>
<section class="section"><div class="container grid-3"><article class="card"><h3>Primary Years</h3><p>Literacy, numeracy, inquiry, and social-emotional learning in nurturing classrooms.</p></article><article class="card"><h3>Middle School</h3><p>Interdisciplinary projects, electives, and guided independence for growing adolescents.</p></article><article class="card"><h3>Senior School</h3><p>Advanced coursework, university counseling, research opportunities, and leadership.</p></article></div></section>
<section class="section section-alt"><div class="container grid-2"><div><div class="section-heading"><span class="eyebrow">Learning Approach</span><h2>Depth over haste</h2><p>Teachers design lessons that connect ideas across subjects and invite students to apply knowledge in authentic contexts.</p></div><ul class="feature-list"><li>STEM and humanities in equal measure</li><li>Arts, languages, and physical education</li><li>Assessment that informs growth</li></ul></div><div class="media-frame"><img loading="lazy" decoding="async" src="${img("library.jpg")}" alt="School library"></div></div></section>
`,
  { breadcrumb: "Academics" }
);

pages.admissions = shell(
  "admissions",
  "Admissions",
  "Learn how to apply to Crestwood Academy and begin your admissions journey.",
  `
<section class="page-hero"><div class="container"><h1>Admissions</h1><p>A clear, welcoming process for families ready to join the Crestwood community.</p></div></section>
<section class="section"><div class="container"><div class="grid-3"><article class="card"><div class="card-icon">01</div><h3>Enquire</h3><p>Share your child’s details and preferred grade via our inquiry form or WhatsApp.</p></article><article class="card"><div class="card-icon">02</div><h3>Visit</h3><p>Tour campus, meet faculty, and experience classrooms in action.</p></article><article class="card"><div class="card-icon">03</div><h3>Offer</h3><p>Complete assessment and receive your formal offer and registration pack.</p></article></div><div style="margin-top:2rem;text-align:center;"><a class="btn btn-primary" href="${BASE}/apply.html">Start an inquiry</a></div></div></section>
`,
  { breadcrumb: "Admissions" }
);

pages.campus = shell(
  "campus",
  "Campus",
  "Tour Crestwood Academy facilities including labs, arts spaces, athletics, and libraries.",
  `
<section class="page-hero"><div class="container"><h1>Campus &amp; Facilities</h1><p>Modern spaces designed for discovery, collaboration, and wellbeing.</p></div></section>
<section class="section"><div class="container grid-3"><article class="card"><img loading="lazy" decoding="async" src="${img("science-lab.jpg")}" alt="Science lab"><h3>Science &amp; Innovation</h3><p>Laboratories and maker spaces for hands-on STEM learning.</p></article><article class="card"><img loading="lazy" decoding="async" src="${img("theatre.jpg")}" alt="Theatre"><h3>Arts &amp; Performance</h3><p>Theatre, music suites, and visual arts studios.</p></article><article class="card"><img loading="lazy" decoding="async" src="${img("sports.jpg")}" alt="Sports"><h3>Athletics &amp; Wellness</h3><p>Fields, courts, and wellness programs for every age.</p></article></div></section>
`,
  { breadcrumb: "Campus" }
);

pages["student-life"] = shell(
  "student-life",
  "Student Life",
  "Clubs, sports, arts, and community life at Crestwood Academy.",
  `
<section class="page-hero"><div class="container"><h1>Student Life</h1><p>Friendships, passions, and leadership beyond the timetable.</p></div></section>
<section class="section"><div class="container grid-3"><article class="card"><h3>Clubs &amp; Societies</h3><p>Robotics, debate, journalism, eco club, and more.</p></article><article class="card"><h3>Athletics</h3><p>Competitive and recreational programs that build teamwork.</p></article><article class="card"><h3>Arts</h3><p>Choir, band, drama, and gallery exhibitions throughout the year.</p></article></div></section>
`,
  { breadcrumb: "Student Life" }
);

pages.faculty = shell(
  "faculty",
  "Faculty",
  "Meet dedicated educators at Crestwood Academy.",
  `
<section class="page-hero"><div class="container"><h1>Our Faculty</h1><p>Experienced mentors who know every learner by name.</p></div></section>
<section class="section"><div class="container grid-3">
  <article class="card"><img loading="lazy" decoding="async" src="${img("principal.jpg")}" alt="Dr. Amira Ellison"><h3>Dr. Amira Ellison</h3><p>Principal</p></article>
  <article class="card"><img loading="lazy" decoding="async" src="${img("teacher-science.jpg")}" alt="Science teacher"><h3>Mr. Daniel Ortiz</h3><p>Head of Science</p></article>
  <article class="card"><img loading="lazy" decoding="async" src="${img("teacher-female.jpg")}" alt="Primary coordinator"><h3>Ms. Sara Khan</h3><p>Primary Coordinator</p></article>
  <article class="card"><img loading="lazy" decoding="async" src="${img("teacher-male.jpg")}" alt="Humanities"><h3>Mr. James Okonkwo</h3><p>Humanities Lead</p></article>
  <article class="card"><img loading="lazy" decoding="async" src="${img("arts.jpg")}" alt="Arts"><h3>Ms. Lena Park</h3><p>Arts Director</p></article>
  <article class="card"><img loading="lazy" decoding="async" src="${img("sports.jpg")}" alt="Athletics"><h3>Coach Rivera</h3><p>Athletics Director</p></article>
</div></section>
`,
  { breadcrumb: "Faculty" }
);

pages.achievements = shell(
  "achievements",
  "Achievements",
  "Celebrating Crestwood Academy awards in academics, athletics, and the arts.",
  `
<section class="page-hero"><div class="container"><h1>Achievements</h1><p>Recognizing excellence across academics, athletics, and the arts.</p></div></section>
<section class="section"><div class="container grid-3"><article class="card"><h3>National Science Olympiad</h3><p>Top-three recognition for environmental innovation research.</p></article><article class="card"><h3>Regional Debate Champions</h3><p>Public forum debate championship with distinction.</p></article><article class="card"><h3>Arts Showcase Honors</h3><p>Juried awards in music, visual arts, and short film.</p></article></div></section>
`,
  { breadcrumb: "Achievements" }
);

pages.news = shell(
  "news",
  "News",
  "Latest news from Crestwood Academy campus.",
  `
<section class="page-hero"><div class="container"><h1>News</h1><p>Stories and updates from across campus.</p></div></section>
<section class="section"><div class="container grid-3">
  <article class="card news-card"><img loading="lazy" decoding="async" src="${img("open-house.jpg")}" alt=""><div class="news-card-body"><p class="news-meta">March 2026</p><h3>Spring Open House Highlights</h3><p>Families toured classrooms and met faculty ambassadors.</p></div></article>
  <article class="card news-card"><img loading="lazy" decoding="async" src="${img("stem-fair.jpg")}" alt=""><div class="news-card-body"><p class="news-meta">March 2026</p><h3>Regional STEM Fair Success</h3><p>Robotics and sustainability projects earned top recognition.</p></div></article>
  <article class="card news-card"><img loading="lazy" decoding="async" src="${img("literacy.jpg")}" alt=""><div class="news-card-body"><p class="news-meta">February 2026</p><h3>Literacy Week</h3><p>Reading challenges and author visits across all grades.</p></div></article>
</div></section>
`,
  { breadcrumb: "News" }
);

pages.events = shell(
  "events",
  "Events",
  "Upcoming events at Crestwood Academy.",
  `
<section class="page-hero"><div class="container"><h1>Events</h1><p>Open houses, showcases, and community celebrations.</p></div></section>
<section class="section"><div class="container grid-3">
  <article class="card"><img loading="lazy" decoding="async" src="${img("open-house.jpg")}" alt=""><p class="news-meta">15 April 2026</p><h3>Autumn Open House</h3><p>Tour classrooms and meet faculty for the new academic year.</p></article>
  <article class="card"><img loading="lazy" decoding="async" src="${img("graduation.jpg")}" alt=""><p class="news-meta">20 June 2026</p><h3>Senior Graduation</h3><p>Celebrating the Class of 2026 on the main lawn.</p></article>
  <article class="card"><img loading="lazy" decoding="async" src="${img("arts.jpg")}" alt=""><p class="news-meta">8 May 2026</p><h3>Spring Arts Showcase</h3><p>Music, theatre, and visual arts in one evening.</p></article>
</div></section>
`,
  { breadcrumb: "Events" }
);

pages.gallery = shell(
  "gallery",
  "Gallery",
  "Campus life photo gallery from Crestwood Academy.",
  `
<section class="page-hero"><div class="container"><h1>Gallery</h1><p>Moments of learning, friendship, and celebration.</p></div></section>
<section class="section"><div class="container"><div class="gallery-grid">
  ${["campus.jpg", "classroom.jpg", "library.jpg", "science-lab.jpg", "sports.jpg", "music.jpg", "theatre.jpg", "community.jpg", "graduation.jpg", "arts.jpg", "friends.jpg", "stem-fair.jpg"]
    .map((f) => `<a class="gallery-item" href="${img(f)}"><img loading="lazy" decoding="async" src="${img(f)}" alt="Campus gallery"></a>`)
    .join("\n  ")}
</div></div></section>
`,
  { breadcrumb: "Gallery" }
);

pages.careers = shell(
  "careers",
  "Careers",
  "Join the Crestwood Academy faculty and staff team.",
  `
<section class="page-hero"><div class="container"><h1>Careers</h1><p>Grow your vocation with a community that values educators.</p></div></section>
<section class="section"><div class="container"><div class="section-heading"><span class="eyebrow">Open roles</span><h2>Current opportunities</h2></div><div class="grid-2"><article class="card"><h3>Secondary Mathematics Teacher</h3><p>Full-time · Starting August 2026</p><p>Inspire problem-solving and mathematical confidence across middle and senior grades.</p></article><article class="card"><h3>Primary Classroom Teacher</h3><p>Full-time · Starting August 2026</p><p>Lead a nurturing primary classroom with inquiry-based learning.</p></article></div><p style="margin-top:1.5rem;">This showcase accepts demo applications only — no files are uploaded.</p><form data-demo-form class="public-form" style="max-width:560px;margin-top:1rem;"><label>Full name<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Role of interest<input name="role" required></label><button class="btn btn-primary" type="submit">Submit demo application</button></form></div></section>
`,
  { breadcrumb: "Careers" }
);

pages.contact = shell(
  "contact",
  "Contact",
  "Contact Crestwood Academy admissions and front office.",
  `
<section class="page-hero"><div class="container"><h1>Contact</h1><p>We are here to help with admissions questions and campus visits.</p></div></section>
<section class="section"><div class="container contact-panel"><div class="contact-card"><div class="section-heading"><span class="eyebrow">Reach us</span><h2>Front office</h2></div><ul class="feature-list"><li>${school.address}</li><li><a href="tel:${school.phoneTel}">${school.phone}</a></li><li><a href="mailto:${school.email}">${school.email}</a></li><li>Monday–Friday, 8:00 AM – 4:00 PM</li></ul></div><div class="form-page"><form data-demo-form class="public-form"><h3>Send a message</h3><label>Name<input name="name" required></label><label>Email<input type="email" name="email" required></label><label>Message<textarea name="message" rows="4" required></textarea></label><button class="btn btn-primary" type="submit">Send demo message</button></form></div></div></section>
`,
  { breadcrumb: "Contact" }
);

pages.apply = shell(
  "apply",
  "Apply",
  "Submit an admissions inquiry to Crestwood Academy.",
  `
<section class="page-hero"><div class="container"><h1>Apply for Admission</h1><p>Tell us about your family and we will guide you through the next steps.</p></div></section>
<section class="section"><div class="container form-page"><form data-demo-form class="public-form"><label>Parent / guardian name<input name="parent" required></label><label>Email<input type="email" name="email" required></label><label>Phone<input name="phone" required></label><label>Student name<input name="student" required></label><label>Applying for grade<input name="grade" required></label><label>Message<textarea name="message" rows="4" placeholder="Tell us a little about your child"></textarea></label><button class="btn btn-primary" type="submit">Submit demo inquiry</button><p class="form-note">Showcase only — inquiries are not stored on a server. Prefer WhatsApp for a live demo conversation.</p></form></div></section>
`,
  { breadcrumb: "Apply" }
);

fs.mkdirSync(siteDir, { recursive: true });

// Homepage entry for /showcase/crestwood
fs.writeFileSync(path.join(demos, "crestwood.html"), pages.home, "utf8");
fs.writeFileSync(path.join(siteDir, "index.html"), pages.home, "utf8");

for (const [key, html] of Object.entries(pages)) {
  if (key === "home") continue;
  fs.writeFileSync(path.join(siteDir, `${key}.html`), html, "utf8");
}

console.log("Wrote crestwood.html +", Object.keys(pages).length - 1, "subpages in demos/crestwood/");
