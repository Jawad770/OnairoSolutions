#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ARTIFACT_DIR = path.join(ROOT, "artifacts", "lighthouse");
const BASE_URL = String(process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const TARGETS = [
  { name: "homepage", path: "/" },
  { name: "portfolio", path: "/src/portfolio/index.html" },
  { name: "edutrack", path: "/src/products/edutrack.html" },
  { name: "pricing", path: "/src/pages/pricing.html" },
  { name: "contact", path: "/src/pages/contact.html" },
  { name: "heavy-demo", path: "/showcase/realestate" },
];

async function assertReachable() {
  try {
    const response = await fetch(`${BASE_URL}/`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    throw new Error(
      `BASE_URL is unreachable: ${BASE_URL} (${error.message}). Start the site first, or set BASE_URL to its address.`
    );
  }
}

function metricValue(lhr, auditId) {
  const value = lhr.audits[auditId]?.numericValue;
  return Number.isFinite(value) ? value : null;
}

async function main() {
  await assertReachable();
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const limit = Number(process.env.LIGHTHOUSE_LIMIT || 0);
  const targets = limit > 0 ? TARGETS.slice(0, limit) : TARGETS;

  const [{ default: lighthouse }, chromeLauncherModule] = await Promise.all([
    import("lighthouse"),
    import("chrome-launcher"),
  ]);
  const chromeLauncher = chromeLauncherModule.default || chromeLauncherModule;
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH || undefined,
    chromeFlags: [
      "--headless=new",
      "--no-first-run",
      "--disable-gpu",
      "--disable-dev-shm-usage",
    ],
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    formFactor: "mobile",
    results: [],
  };

  try {
    for (const target of targets) {
      const url = `${BASE_URL}${target.path}`;
      try {
        const runnerResult = await lighthouse(url, {
          port: chrome.port,
          output: ["json", "html"],
          logLevel: process.env.LIGHTHOUSE_LOG_LEVEL || "info",
          onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
          formFactor: "mobile",
          screenEmulation: {
            mobile: true,
            width: 360,
            height: 640,
            deviceScaleFactor: 2,
            disabled: false,
          },
          throttlingMethod: "simulate",
        });

        if (!runnerResult) throw new Error("Lighthouse returned no result.");
        const reports = Array.isArray(runnerResult.report) ? runnerResult.report : [runnerResult.report];
        const jsonReport = reports.find((report) => String(report).trimStart().startsWith("{"));
        const htmlReport = reports.find((report) => String(report).trimStart().startsWith("<"));
        if (!jsonReport || !htmlReport) throw new Error("Lighthouse did not produce both JSON and HTML reports.");

        fs.writeFileSync(path.join(ARTIFACT_DIR, `${target.name}.json`), jsonReport);
        fs.writeFileSync(path.join(ARTIFACT_DIR, `${target.name}.html`), htmlReport);

        const lhr = runnerResult.lhr;
        summary.results.push({
          name: target.name,
          path: target.path,
          url,
          finalUrl: lhr.finalDisplayedUrl,
          scores: {
            performance: lhr.categories.performance?.score ?? null,
            accessibility: lhr.categories.accessibility?.score ?? null,
            seo: lhr.categories.seo?.score ?? null,
            bestPractices: lhr.categories["best-practices"]?.score ?? null,
          },
          metrics: {
            lcpMs: metricValue(lhr, "largest-contentful-paint"),
            cls: metricValue(lhr, "cumulative-layout-shift"),
          },
          artifacts: {
            json: `artifacts/lighthouse/${target.name}.json`,
            html: `artifacts/lighthouse/${target.name}.html`,
          },
        });
      } catch (error) {
        summary.results.push({
          name: target.name,
          path: target.path,
          url,
          error: error.message,
        });
      }
    }
  } finally {
    try {
      chrome.kill();
    } catch (error) {
      // Chrome can exit successfully while Windows still has a temporary
      // profile file locked. Preserve the completed reports in that case.
      summary.cleanupWarning = error.message;
      chrome.process?.unref();
    }
    fs.writeFileSync(path.join(ARTIFACT_DIR, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  }

  const failures = summary.results.filter((result) => result.error);
  console.log(`Lighthouse mobile audit: ${summary.results.length - failures.length}/${summary.results.length} completed.`);
  console.log(`Summary: ${path.join(ARTIFACT_DIR, "summary.json")}`);
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  if (/chrome|executable|ENOENT/i.test(error.message)) {
    console.error("Install Google Chrome, or set CHROME_PATH to an installed Chrome/Edge executable.");
  }
  process.exitCode = 1;
});
