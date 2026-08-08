/**
 * Live smoke check for the running portal. Usage:
 *   node scripts/verify-portal.js [baseUrl] [email] [password]
 */
const BASE = process.argv[2] || "http://127.0.0.1:3000";
const EMAIL = process.argv[3] || "admin@onairosolutions.com";
const PASSWORD = process.argv[4] || "ChangeMeNow!123";

const cookies = new Map();
let csrf = null;

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function call(method, path, body) {
  const init = { method, redirect: "manual", headers: {} };
  if (cookies.size) init.headers.Cookie = cookieHeader();
  if (body) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams({ CSRFToken: csrf || "", ...body }).toString();
  }
  const res = await fetch(`${BASE}${path}`, init);
  (typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []).forEach((line) => {
    const [pair] = line.split(";");
    const i = pair.indexOf("=");
    if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  });
  const text = await res.text();
  const found = text.match(/name="CSRFToken" value="([^"]+)"/);
  if (found) csrf = found[1];
  return { status: res.status, location: res.headers.get("location"), text };
}

(async () => {
  let failures = 0;
  const check = (label, ok, extra = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? ` — ${extra}` : ""}`);
    if (!ok) failures++;
  };

  const publicPages = ["/", "/src/industries/index.html", "/src/services/index.html", "/src/products/edutrack.html"];
  for (const path of publicPages) {
    const res = await call("GET", path);
    check(`public ${path}`, res.status === 200, `${res.status}`);
  }

  const robots = await call("GET", "/robots.txt");
  check("robots.txt disallows /portal", robots.text.includes("Disallow: /portal"));

  const guestPortal = await call("GET", "/portal/settings/users");
  check("guest portal page redirects to login", guestPortal.status === 302 && /login/.test(guestPortal.location || ""));

  const guestApi = await fetch(`${BASE}/portal/api/leads/1/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Won" }),
  });
  check("guest API returns 401", guestApi.status === 401, `${guestApi.status}`);

  await call("GET", "/portal/login");
  const login = await call("POST", "/portal/login", { email: EMAIL, password: PASSWORD });
  check("super admin login", login.status === 302 && login.location === "/portal", `${login.status} ${login.location}`);
  if (login.status !== 302) {
    console.log("\nCannot continue without a session.");
    process.exit(1);
  }

  const portalPages = [
    "/portal",
    "/portal/crm",
    "/portal/crm/pipeline",
    "/portal/settings/users",
    "/portal/settings/roles",
    "/portal/audit-logs",
    "/portal/support",
    "/portal/invoices",
    "/portal/blog",
    "/portal/portfolio",
    "/portal/clients",
    "/portal/settings",
  ];
  for (const path of portalPages) {
    const res = await call("GET", path);
    check(`portal ${path}`, res.status === 200, `${res.status}, ${res.text.length} bytes`);
  }

  const crm = await call("GET", "/portal/crm");
  const leadCodes = [...crm.text.matchAll(/LD-\d{6}/g)].map((m) => m[0]);
  check("existing CRM leads still visible", leadCodes.length > 0, `${leadCodes.length} lead(s): ${leadCodes.join(", ")}`);

  const roles = await call("GET", "/portal/settings/roles");
  const expected = [
    "Super Admin",
    "Sales Manager",
    "Sales Executive",
    "Support Manager",
    "Support Agent",
    "Content Manager",
    "Finance Manager",
    "Viewer",
  ];
  const missing = expected.filter((name) => !roles.text.includes(name));
  check("all eight default roles present", missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : "");

  const matrix = await call("GET", `/portal/settings/roles/${(roles.text.match(/roles\/(\d+)"/) || [])[1] || 2}`);
  check("permission matrix renders", matrix.status === 200 && matrix.text.includes('name="permissions"'));
  check("matrix has module select/clear controls", matrix.text.includes("data-mod-select") && matrix.text.includes("permSearch"));

  const nav = await call("GET", "/portal");
  check("sidebar shows Users & Roles for super admin", nav.text.includes("Users &amp; Roles"));
  check("mobile drawer toggle present", nav.text.includes('id="drawerBtn"'));
  check("drawer scrim + off-canvas sidebar styles present", nav.includes ? true : nav.text.includes("drawer-open .side"));

  const usersPage = await call("GET", "/portal/settings/users");
  check("user table stacks into cards on mobile", usersPage.text.includes('table class="stack"') && usersPage.text.includes('data-label="Email"'));
  check("responsive breakpoints defined", usersPage.text.includes("@media (max-width:1100px)") && usersPage.text.includes("@media (max-width:760px)"));
  // Inline fixed pixel widths are what cause horizontal overflow on phones.
  check("no fixed pixel widths on elements", !/style="[^"]*[^-]width:\s*\d{3,}px/.test(usersPage.text));

  console.log(`\n${failures === 0 ? "All live checks passed." : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error("Verification error:", err.message);
  process.exit(1);
});
