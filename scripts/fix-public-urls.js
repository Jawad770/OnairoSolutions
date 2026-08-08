const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function fix(s) {
  s = s.replace(/\/src\/portfolio\/demos\/([a-z0-9-]+)\.html/gi, "/showcase/$1");
  s = s.replace(/src\/portfolio\/demos\/([a-z0-9-]+)\.html/gi, "/showcase/$1");
  s = s.replace(/thumb:\s*'src\/portfolio\/images\//g, "thumb: '/images/");
  s = s.replace(/thumb:\s*"src\/portfolio\/images\//g, 'thumb: "/images/');
  s = s.replace(/'src\/portfolio\/images\//g, "'/images/");
  s = s.replace(/"src\/portfolio\/images\//g, '"/images/');
  s = s.replace(/p\('src\//g, "p('");
  s = s.replace(/p\("src\//g, 'p("');
  s = s.replace(/ONAIRO\.path\('src\//g, "ONAIRO.path('");
  s = s.replace(/ONAIRO\.path\("src\//g, 'ONAIRO.path("');
  s = s.replace(/"demo":\s*"\/src\/portfolio\/demos\/([a-z0-9-]+)\.html"/gi, '"demo": "/showcase/$1"');
  s = s.replace(/demo:\s*'\/(demo|showcase)\//g, "demo: '/showcase/"); // idempotent
  s = s.replace(/\/demo\//g, "/showcase/");

  return s;
}

const files = [
  "public/shared/js/portfolio-data.js",
  "src/shared/js/portfolio-data.js",
  "server/ai/knowledge/portfolio.json",
  "public/components/chrome.js",
  "src/components/chrome.js",
  "public/shared/js/config.js",
  "src/shared/js/config.js",
  "public/shared/js/seo-data.js",
  "src/shared/js/seo-data.js",
  "public/sitemap.xml",
  "sitemap.xml",
];

for (const rel of files) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.log("skip", rel);
    continue;
  }
  const before = fs.readFileSync(file, "utf8");
  const after = fix(before);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    console.log("fixed", rel);
  } else {
    console.log("unchanged", rel);
  }
}
