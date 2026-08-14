/**
 * Ensure public HTML pages reference root favicon assets.
 */
const fs = require("fs");
const path = require("path");

const PUBLIC = path.resolve(__dirname, "../public");
const BLOCK = [
  '<link rel="icon" type="image/png" href="/favicon.png" sizes="48x48"/>',
  '<link rel="icon" href="/favicon.ico" sizes="any"/>',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180"/>',
].join("\n  ");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, out);
    } else if (entry.name.endsWith(".html")) {
      out.push(full);
    }
  }
  return out;
}

let updated = 0;
for (const file of walk(PUBLIC)) {
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  html = html.replace(/\s*<link[^>]*rel=["']icon["'][^>]*>/gi, "");
  html = html.replace(/\s*<link[^>]*rel=["']apple-touch-icon["'][^>]*>/gi, "");
  if (/href=["']\/favicon\.png["']/i.test(html)) {
    // already has absolute png; still ensure full block after head/charset
  }
  if (/<meta\s+charset/i.test(html)) {
    html = html.replace(/(<meta\s+charset[^>]*>)/i, `$1\n  ${BLOCK}`);
  } else if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/(<head[^>]*>)/i, `$1\n  ${BLOCK}`);
  } else {
    continue;
  }
  // dedupe if script ran twice
  const seen = new Set();
  html = html.replace(/\s*<link[^>]*href=["']\/favicon\.(png|ico)["'][^>]*>/gi, (m) => {
    const key = m.includes("favicon.png") ? "png" : "ico";
    if (seen.has(key)) return "";
    seen.add(key);
    return m;
  });
  html = html.replace(/\s*<link[^>]*href=["']\/apple-touch-icon\.png["'][^>]*>/gi, (m) => {
    if (seen.has("apple")) return "";
    seen.add("apple");
    return m;
  });
  if (html !== before) {
    fs.writeFileSync(file, html);
    updated += 1;
  }
}
console.log("updated", updated, "html files");
