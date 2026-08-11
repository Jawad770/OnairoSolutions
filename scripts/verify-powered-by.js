const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "public", "demos");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".html"));
const missing = files.filter(
  (f) => !fs.readFileSync(path.join(dir, f), "utf8").includes("demo-globals.js")
);
console.log("demos", files.length);
console.log("missing globals", missing.length ? missing : "none");

const school = fs.readFileSync(path.join(dir, "school.html"), "utf8");
console.log("school powered markup", school.includes('class="onairo-powered"'));
console.log(
  "school onairo link",
  school.includes('href="https://onairosolutions.com"')
);

const pd = fs.readFileSync(
  path.join(__dirname, "..", "public", "shared", "js", "portfolio-data.js"),
  "utf8"
);
console.log("portfolio school entry", pd.includes("id: 'school'"));
console.log("portfolio school demo", pd.includes("demo: '/showcase/school'"));

const globals = fs.readFileSync(path.join(dir, "demo-globals.js"), "utf8");
console.log(
  "injector present",
  globals.includes("installPoweredByOnairo") &&
    globals.includes("https://onairosolutions.com")
);
