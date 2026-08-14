/* Onairo Solutions — global config */
window.ONAIRO = window.ONAIRO || {};

ONAIRO.config = {
  brand: 'Onairo Solutions',
  email: 'hello@onairosolutions.com',
  waNumber: '923272340505',
  waDefaultMsg: "Hi Onairo Solutions, I'd like to learn more about your services.",
  year: 2026,
  siteUrl: 'https://onairosolutions.com',
  logoPath: '/favicon.png',
  locale: 'en',
  serviceArea: 'Worldwide remote delivery',
  /* Google Search Console verification meta content (replace placeholder) */
  gscVerification: '_bUTGwIiexdJC7sB3R5-VxpXfHDtvvNiK21m3E1CMpE',
  /* Optional Google Analytics 4 Measurement ID (leave empty to disable) */
  gaMeasurementId: '',
};

ONAIRO.waUrl = function (msg) {
  const text = encodeURIComponent(msg || ONAIRO.config.waDefaultMsg);
  return `https://wa.me/${ONAIRO.config.waNumber}?text=${text}`;
};

/** Resolve site root from <body data-root="..."> — "" at public root, ".." from nested pages */
ONAIRO.root = function () {
  const raw = document.body?.dataset?.root;
  if (raw === undefined || raw === null) return '';
  return raw === '' ? '' : raw.replace(/\/?$/, '/');
};

ONAIRO.path = function (rel) {
  const value = String(rel || '');
  if (!value) return ONAIRO.root() || '';
  // Absolute site paths and external URLs pass through unchanged
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('/')) return value;
  const root = ONAIRO.root();
  return root + value.replace(/^\//, '');
};

ONAIRO.absoluteUrl = function (path) {
  const base = (ONAIRO.config.siteUrl || '').replace(/\/$/, '');
  const clean = String(path || '').replace(/^\//, '');
  return base + '/' + clean;
};

ONAIRO.showcaseUrl = function (name) {
  const id = String(name || '')
    .replace(/^\/?(showcase|demo)\//, '')
    .replace(/\.html$/i, '');
  return '/showcase/' + id;
};
ONAIRO.demoUrl = ONAIRO.showcaseUrl;

/** Fixed EduTrack installer URL (no version in path). */
ONAIRO.edutrackDownloadUrl = '/downloads/EduTrack-Setup.exe';
