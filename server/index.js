require("dotenv").config();
const fs = require("fs");
const path = require("path");
const http = require("http");
const app = require("./main");
const config = require("./config");
const { prisma } = require("./db");

let server = null;
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  // eslint-disable-next-line no-console
  console.log(`[shutdown] Received ${signal}, closing gracefully…`);

  const forceTimer = setTimeout(() => {
    // eslint-disable-next-line no-console
    console.error("[shutdown] Timed out — forcing exit");
    process.exit(1);
  }, 15000);
  forceTimer.unref?.();

  const closeHttp = new Promise((resolve) => {
    if (!server) return resolve();
    server.close((err) => {
      if (err) {
        // eslint-disable-next-line no-console
        console.error("[shutdown] HTTP close error:", err.message || err);
      } else {
        // eslint-disable-next-line no-console
        console.log("[shutdown] HTTP server closed");
      }
      resolve();
    });
  });

  closeHttp
    .then(() => prisma.$disconnect())
    .then(() => {
      // eslint-disable-next-line no-console
      console.log("[shutdown] Database connections closed");
      clearTimeout(forceTimer);
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[shutdown] Error during disconnect:", err.message || err);
      clearTimeout(forceTimer);
      process.exit(1);
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

app
  .ready()
  .then(() => {
    server = http.createServer(app);
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, () => {
        server.off("error", reject);
        resolve();
      });
    });
  })
  .then(() => {
    // eslint-disable-next-line no-console
    console.log(`Onairo Solutions v${config.version} running on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`Private portal route: ${config.portalRoute}`);
    // eslint-disable-next-line no-console
    console.log(`Environment: ${config.env}`);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start Onairo portal:", err.message || err);
    prisma.$disconnect().finally(() => {
      process.exit(1);
    });
  });
