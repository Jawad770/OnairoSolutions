/**
 * One-time (re-runnable) sync: build the production public/ tree from the
 * marketing site sources and rewrite URLs so /src is never required.
 *
 * Layout:
 *   public/index.html
 *   public/demos/*.html
 *   public/images/**
 *   public/{portfolio,industries,services,pages,products,shared,components}
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else copyFile(from, to);
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function rewriteText(text) {
  let s = text;

  // Absolute demo URLs → clean /showcase/:name
  s = s.replace(/\/src\/portfolio\/demos\/([a-z0-9-]+)\.html/gi, "/showcase/$1");
  s = s.replace(/src\/portfolio\/demos\/([a-z0-9-]+)\.html/gi, "/showcase/$1");
  s = s.replace(/\.\.\/portfolio\/demos\/([a-z0-9-]+)\.html/gi, "/showcase/$1");
  s = s.replace(/\.\.\/\.\.\/portfolio\/demos\/([a-z0-9-]+)\.html/gi, "/showcase/$1");

  // Portfolio images
  s = s.replace(/\/src\/portfolio\/images\//g, "/images/");
  s = s.replace(/src\/portfolio\/images\//g, "images/");
  // From demos folder, ../images already correct once images live at public/images
  // From industries (../portfolio/images/x) → ../images/x
  s = s.replace(/\.\.\/portfolio\/images\//g, "../images/");

  // Site sections: strip the /src/ prefix from public URLs
  s = s.replace(/https:\/\/onairosolutions\.com\/src\//g, "https://onairosolutions.com/");
  s = s.replace(/\/src\/(industries|services|pages|products|portfolio|shared|components)\//g, "/$1/");
  s = s.replace(/(["'`])src\/(industries|services|pages|products|portfolio|shared|components)\//g, "$1$2/");
  s = s.replace(/ONAIRO\.path\(\s*['"]src\//g, "ONAIRO.path('");
  s = s.replace(/p\(\s*['"]src\//g, "p('");

  // Root asset refs that used src/shared from index.html
  s = s.replace(/(href|src)=["']src\/shared\//g, '$1="shared/');
  s = s.replace(/(href|src)=["']src\/components\//g, '$1="components/');
  s = s.replace(/(href|src)=["']src\/portfolio\//g, '$1="portfolio/');
  s = s.replace(/(href|src)=["']src\/(pages|products|services|industries)\//g, '$1="$2/');

  // data-root: pages under public/* were written for src/* depth
  // public/pages/blog/* used ../../.. → still correct (3 levels to public root? wait)
  // Old: src/pages/blog/x → root is ../../.. (up to repo, then into nothing)
  // Actually old data-root pointed to REPO root so path('src/...') worked.
  // New: data-root should point to PUBLIC root (document root).
  // From public/industries/x.html → data-root=".."
  // From public/pages/x.html → data-root=".."
  // From public/pages/blog/x.html → data-root="../.."
  // From public/portfolio/x.html → data-root=".."
  // From public/index.html → data-root=""

  return s;
}

function rewriteFile(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".html", ".js", ".css", ".xml", ".json", ".md", ".txt", ".svg"].includes(ext)) return;
  const before = fs.readFileSync(file, "utf8");
  let after = rewriteText(before);

  // Fix data-root for depth under public/
  const rel = path.relative(PUBLIC, file).replace(/\\/g, "/");
  if (rel.endsWith(".html")) {
    const depth = rel.split("/").length - 1; // files in subdirs
    let rootAttr = 'data-root=""';
    if (depth === 1) rootAttr = 'data-root=".."';
    if (depth >= 2) rootAttr = `data-root="${"../".repeat(depth).slice(0, -1)}"`;

    after = after.replace(/data-root="[^"]*"/g, rootAttr);
    // Also seo paths that included /src/
    after = after.replace(/data-seo-path="\/src\//g, 'data-seo-path="/');
  }

  if (after !== before) fs.writeFileSync(file, after, "utf8");
}

function main() {
  console.log("Building public/ ...");
  ensureDir(PUBLIC);

  // Root site files
  for (const name of ["index.html", "favicon.svg", "robots.txt", "sitemap.xml"]) {
    const src = path.join(ROOT, name);
    if (fs.existsSync(src)) copyFile(src, path.join(PUBLIC, name));
  }

  // Marketing sections from src/
  for (const section of ["industries", "services", "pages", "products", "shared", "components"]) {
    copyDir(path.join(ROOT, "src", section), path.join(PUBLIC, section));
  }

  // Portfolio pages (not demos — demos are canonical under public/demos only)
  ensureDir(path.join(PUBLIC, "portfolio"));
  const portfolioSrc = path.join(ROOT, "src", "portfolio");
  if (fs.existsSync(portfolioSrc)) {
    for (const entry of fs.readdirSync(portfolioSrc, { withFileTypes: true })) {
      if (entry.name === "demos" || entry.name === "images") continue;
      const from = path.join(portfolioSrc, entry.name);
      const to = path.join(PUBLIC, "portfolio", entry.name);
      if (entry.isDirectory()) copyDir(from, to);
      else copyFile(from, to);
    }
  }

  // Demos: public/demos is the ONLY production source. Never overwrite from src/.
  ensureDir(path.join(PUBLIC, "demos"));
  if (!fs.existsSync(path.join(PUBLIC, "demos", "demo-globals.js"))) {
    console.warn(
      "Warning: public/demos looks incomplete (missing demo-globals.js). " +
        "Place showcase HTML/JS in public/demos/ — build:public will not copy demos from src/."
    );
  }

  // Images → public/images
  copyDir(path.join(ROOT, "src", "portfolio", "images"), path.join(PUBLIC, "images"));

  // Optional empty stubs for future assets
  for (const dir of ["videos", "logos", "icons"]) {
    ensureDir(path.join(PUBLIC, dir));
    const keep = path.join(PUBLIC, dir, ".gitkeep");
    if (!fs.existsSync(keep)) fs.writeFileSync(keep, "", "utf8");
  }

  // Rewrite every text file under public/
  const files = walk(PUBLIC);
  let rewritten = 0;
  for (const file of files) {
    const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    rewriteFile(file);
    const after = fs.readFileSync(file, "utf8");
    if (before !== after) rewritten += 1;
  }

  console.log(`Public tree ready: ${files.length} files, ${rewritten} rewritten.`);
}

main();
