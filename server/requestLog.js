/**
 * Production request logging — timestamp, method, url, status, duration.
 * Never logs bodies, cookies, or Authorization headers.
 */

function requestLoggingMiddleware({ isProd, logStream }) {
  return function requestLog(req, res, next) {
    if (!isProd) return next();
    const started = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - started;
      const line = [
        new Date().toISOString(),
        req.method,
        req.originalUrl || req.url,
        res.statusCode,
        `${duration}ms`,
      ].join(" ");
      if (logStream && typeof logStream.write === "function") {
        logStream.write(line + "\n");
      } else {
        // eslint-disable-next-line no-console
        console.log(line);
      }
    });
    next();
  };
}

module.exports = { requestLoggingMiddleware };
