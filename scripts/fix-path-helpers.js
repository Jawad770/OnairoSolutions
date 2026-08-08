const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

for (const rel of ["public/shared/js/portfolio-data.js", "src/shared/js/portfolio-data.js"]) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, "utf8");
  s = s.replace(/thumb:\s*'images\//g, "thumb: '/images/");
  s = s.replace(/thumb:\s*"images\//g, 'thumb: "/images/');
  fs.writeFileSync(file, s);
  console.log("ok", rel);
}

for (const rel of ["public/shared/js/main.js", "src/shared/js/main.js"]) {
  const file = path.join(ROOT, rel);
  let s = fs.readFileSync(file, "utf8");
  // Prefer absolute demo URLs
  s = s.replace(
    /const actions = item\.comingSoon \|\| !item\.demo\s*\n\s*\?[\s\S]*?: `([\s\S]*?)`;/,
    (match) => match // leave structure; fix path call below
  );
  s = s.replace(
    /\$\{ONAIRO\.path\(item\.demo\)\}/g,
    "${(item.demo && (item.demo.startsWith('/') || item.demo.startsWith('http'))) ? item.demo : ONAIRO.path(item.demo)}"
  );
  // Thumb absolute paths
  s = s.replace(
    /const thumb = item\.thumb\.startsWith\('http'\) \? item\.thumb : ONAIRO\.path\(item\.thumb\);/,
    "const thumb = (!item.thumb) ? '' : (item.thumb.startsWith('http') || item.thumb.startsWith('/')) ? item.thumb : ONAIRO.path(item.thumb);"
  );
  fs.writeFileSync(file, s);
  console.log("main ok", rel);
}
