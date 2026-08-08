#!/usr/bin/env node
/**
 * Diagnostic: perform a real portal login over HTTP (CSRF + cookies) and report
 * where it fails. Usage: node scripts/check-login.js [email] [password]
 */
require("dotenv").config();

const base = `http://127.0.0.1:${process.env.PORT || 3000}`;
const route = process.env.PORTAL_ROUTE || "/portal";
const email = process.argv[2] || process.env.INIT_ADMIN_EMAIL;
const password = process.argv[3] || process.env.INIT_ADMIN_PASSWORD;

const cookies = new Map();

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function absorb(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  raw.forEach((line) => {
    const [pair] = line.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) cookies.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  });
}

(async () => {
  const page = await fetch(`${base}${route}/login`, { redirect: "manual" });
  absorb(page);
  const html = await page.text();
  const csrf = (html.match(/name="CSRFToken" value="([^"]+)"/) || [])[1];
  if (!csrf) throw new Error("Could not read CSRF token from the login page.");

  const res = await fetch(`${base}${route}/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookieHeader(),
    },
    body: new URLSearchParams({ CSRFToken: csrf, email, password }).toString(),
  });
  const body = await res.text();
  const error = (body.match(/class="error"[^>]*>([^<]+)</) || [])[1];

  console.log(
    JSON.stringify(
      {
        email,
        status: res.status,
        redirectedTo: res.headers.get("location"),
        result: res.status === 302 ? "SUCCESS" : "FAILED",
        serverMessage: error ? error.trim() : null,
      },
      null,
      2
    )
  );
  process.exitCode = res.status === 302 ? 0 : 1;
})().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
