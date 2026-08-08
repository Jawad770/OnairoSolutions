#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const ARTIFACT_DIR = path.join(ROOT, "artifacts", "responsive");
const BASE_URL = String(process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const WIDTHS = [320, 360, 375, 390, 412, 430, 480, 600, 768, 820, 834, 912, 1024, 1280];
const SCREENSHOT_WIDTHS = new Set([390, 768]);
const PAGE_ROOTS = [
  path.join(ROOT, "src", "pages"),
  path.join(ROOT, "src", "services"),
  path.join(ROOT, "src", "industries"),
  path.join(ROOT, "src", "portfolio"),
  path.join(ROOT, "src", "products"),
];
const EXCLUDED_SEGMENTS = new Set(["portal", "admin", "node_modules"]);
const CONCURRENCY = Math.max(1, Number(process.env.AUDIT_CONCURRENCY || 2));
let mergeChain = Promise.resolve();

function mergeResults(report, pageResults) {
  mergeChain = mergeChain.then(() => {
    for (const result of pageResults) {
      report.summary.checks += 1;
      report.summary[result.passed ? "passed" : "failed"] += 1;
      report.results.push(result);
    }
  });
  return mergeChain;
}

function walkHtml(directory, output = []) {
  if (!fs.existsSync(directory)) return output;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const relativeSegments = path.relative(ROOT, fullPath).split(path.sep);
    if (relativeSegments.some((segment) => EXCLUDED_SEGMENTS.has(segment.toLowerCase()))) continue;
    if (entry.isDirectory()) walkHtml(fullPath, output);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) output.push(fullPath);
  }
  return output;
}

function publicUrls() {
  const files = fs.existsSync(path.join(ROOT, "index.html")) ? [path.join(ROOT, "index.html")] : [];
  PAGE_ROOTS.forEach((directory) => walkHtml(directory, files));
  const urls = [...new Set(files.map((file) => {
    const relative = path.relative(ROOT, file).split(path.sep).map(encodeURIComponent).join("/");
    return relative === "index.html" ? "/" : `/${relative}`;
  }))].sort();

  const limit = Number(process.env.AUDIT_LIMIT || 0);
  return limit > 0 ? urls.slice(0, limit) : urls;
}

function artifactName(urlPath, width) {
  const slug = urlPath === "/"
    ? "home"
    : decodeURIComponent(urlPath).replace(/\.html$/i, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return `${slug}-${width}.png`;
}

function isRepresentative(urlPath) {
  return [
    "/",
    "/src/portfolio/index.html",
    "/src/products/edutrack.html",
    "/src/pages/pricing.html",
    "/src/pages/contact.html",
    "/src/pages/request-quote.html",
    "/showcase/realestate",
  ].includes(urlPath);
}

function isNoisyConsole(text) {
  return /favicon\.ico|ipapi\.co|Failed to load resource: the server responded with a status of 4\d\d|net::ERR_FAILED/i.test(text);
}

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

function writeReport(report) {
  fs.writeFileSync(path.join(ARTIFACT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}

async function auditUrl(browser, urlPath) {
  const context = await browser.newContext({ viewport: { width: WIDTHS[0], height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const results = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!isNoisyConsole(text)) consoleErrors.push(text);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const absolute = `${BASE_URL}${urlPath}`;
  let status = null;

  try {
    const response = await page.goto(absolute, {
      waitUntil: process.env.AUDIT_WAIT_UNTIL || "domcontentloaded",
      timeout: Number(process.env.AUDIT_TIMEOUT_MS || 25000),
    });
    status = response ? response.status() : null;
    await page.waitForTimeout(200);

    for (const width of WIDTHS) {
      const consoleBefore = consoleErrors.length;
      const pageBefore = pageErrors.length;

      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(80);

      const layout = await page.evaluate(() => {
        const root = document.documentElement;
        const selector = ".nav-toggle, #navToggle, #nav-toggle, [data-nav-toggle], .btn, .wa-float, #waFloat";
        const touchTargets = [...document.querySelectorAll(selector)]
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              selector: element.id
                ? `#${element.id}`
                : element.className
                  ? `${element.tagName.toLowerCase()}.${String(element.className).trim().split(/\s+/).join(".")}`
                  : element.tagName.toLowerCase(),
              text: String(element.getAttribute("aria-label") || element.textContent || "").trim().slice(0, 80),
              width: Math.round(rect.width * 10) / 10,
              height: Math.round(rect.height * 10) / 10,
            };
          });
        return {
          scrollWidth: root.scrollWidth,
          clientWidth: root.clientWidth,
          touchTargets,
        };
      });

      const result = {
        path: urlPath,
        url: absolute,
        width,
        status,
        overflow: layout.scrollWidth > layout.clientWidth + 1,
        documentWidth: layout.scrollWidth,
        viewportWidth: layout.clientWidth,
        consoleErrors: consoleErrors.slice(consoleBefore),
        pageErrors: pageErrors.slice(pageBefore),
        touchTargetViolations: layout.touchTargets.filter(
          (target) => target.width < 44 || target.height < 44
        ),
        screenshot: null,
        passed: false,
      };

      if (SCREENSHOT_WIDTHS.has(width) && isRepresentative(urlPath)) {
        const screenshotPath = path.join(ARTIFACT_DIR, artifactName(urlPath, width));
        await page.screenshot({ path: screenshotPath, fullPage: true });
        result.screenshot = path.relative(ROOT, screenshotPath).split(path.sep).join("/");
      }

      result.passed =
        result.status >= 200 &&
        result.status < 400 &&
        !result.overflow &&
        !result.consoleErrors.length &&
        !result.pageErrors.length &&
        !result.touchTargetViolations.length;

      results.push(result);
    }
  } catch (error) {
    for (const width of WIDTHS) {
      results.push({
        path: urlPath,
        url: absolute,
        width,
        status,
        overflow: null,
        documentWidth: null,
        viewportWidth: null,
        consoleErrors: [],
        pageErrors: [`Audit failure: ${error.message}`],
        touchTargetViolations: [],
        screenshot: null,
        passed: false,
      });
    }
  } finally {
    await context.close();
  }

  return results;
}

async function mapPool(items, limit, worker) {
  const executing = new Set();
  for (const item of items) {
    const task = Promise.resolve()
      .then(() => worker(item))
      .finally(() => executing.delete(task));
    executing.add(task);
    if (executing.size >= limit) await Promise.race(executing);
  }
  await Promise.all(executing);
}

async function main() {
  await assertReachable();
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const urls = publicUrls();
  if (!urls.length) throw new Error("No public HTML pages were found.");

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    browserChannel: process.env.BROWSER_CHANNEL || "chrome",
    widths: WIDTHS,
    pages: urls,
    summary: { checks: 0, passed: 0, failed: 0, overflowFailures: 0, touchFailures: 0, errorFailures: 0 },
    results: [],
  };

  console.log(`Auditing ${urls.length} pages × ${WIDTHS.length} widths (concurrency ${CONCURRENCY})…`);

  let browser;
  let completed = 0;
  try {
    browser = await chromium.launch({
      channel: report.browserChannel,
      headless: true,
    });

    await mapPool(urls, CONCURRENCY, async (urlPath) => {
      const pageResults = await auditUrl(browser, urlPath);
      await mergeResults(report, pageResults);
      completed += 1;
      if (completed % 5 === 0 || completed === urls.length) {
        writeReport(report);
        console.log(`Progress: ${completed}/${urls.length} pages — ${report.summary.passed}/${report.summary.checks} checks passed`);
      }
    });
    await mergeChain;
  } catch (error) {
    report.fatalError = error.message;
    throw error;
  } finally {
    if (browser) await browser.close();
    report.summary.overflowFailures = report.results.filter((r) => r.overflow).length;
    report.summary.touchFailures = report.results.filter((r) => r.touchTargetViolations?.length).length;
    report.summary.errorFailures = report.results.filter(
      (r) => (r.consoleErrors?.length || 0) + (r.pageErrors?.length || 0) > 0
    ).length;
    writeReport(report);
  }

  console.log(`Responsive audit: ${report.summary.passed}/${report.summary.checks} checks passed.`);
  console.log(`Overflow failures: ${report.summary.overflowFailures}`);
  console.log(`Touch-target failures: ${report.summary.touchFailures}`);
  console.log(`Console/page error failures: ${report.summary.errorFailures}`);
  console.log(`Report: ${path.join(ARTIFACT_DIR, "report.json")}`);
  if (report.summary.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  if (/executable|browserType\.launch/i.test(error.message)) {
    console.error("Install Google Chrome, or set BROWSER_CHANNEL=msedge to use installed Microsoft Edge.");
  }
  process.exitCode = 1;
});
