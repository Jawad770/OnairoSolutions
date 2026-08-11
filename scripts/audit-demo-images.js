/**
 * Verify local image paths referenced by showcase demos exist on disk.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const demosDir = path.join(root, "public", "demos");
const publicDir = path.join(root, "public");

const missing = [];
const checked = new Set();

function resolveLocal(src, fromFile) {
  if (!src || src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("//")) {
    return null;
  }
  let clean = src.split("?")[0].split("#")[0];
  if (clean.startsWith("/")) return path.join(publicDir, clean.replace(/^\//, ""));
  return path.resolve(path.dirname(fromFile), clean);
}

for (const file of fs.readdirSync(demosDir).filter((f) => f.endsWith(".html"))) {
  const full = path.join(demosDir, file);
  const html = fs.readFileSync(full, "utf8");
  const re = /(?:src|href|data-before|data-after|data-src|poster)=["']([^"']+\.(?:jpg|jpeg|png|webp|gif|svg|avif))["']/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = m[1];
    const abs = resolveLocal(src, full);
    if (!abs) continue;
    const key = file + " → " + src;
    if (checked.has(key)) continue;
    checked.add(key);
    if (!fs.existsSync(abs)) missing.push({ file, src, abs });
  }
  // url(...) in CSS
  const cssRe = /url\(["']?([^)"']+\.(?:jpg|jpeg|png|webp|gif|svg|avif))["']?\)/gi;
  while ((m = cssRe.exec(html))) {
    const src = m[1];
    const abs = resolveLocal(src, full);
    if (!abs) continue;
    const key = file + " css → " + src;
    if (checked.has(key)) continue;
    checked.add(key);
    if (!fs.existsSync(abs)) missing.push({ file, src, abs });
  }
}

console.log("Checked", checked.size, "local image refs");
if (missing.length) {
  console.log("MISSING:");
  for (const row of missing) console.log("-", row.file, row.src);
  process.exitCode = 1;
} else {
  console.log("All local showcase image paths resolve.");
}
