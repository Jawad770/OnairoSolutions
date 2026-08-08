/**
 * Centralized HTTP error responses (JSON for APIs, HTML for portal pages).
 */

function wantsJson(req) {
  if (req.path.startsWith("/api/")) return true;
  if (req.path === "/health") return true;
  const accept = String(req.headers.accept || "");
  if (accept.includes("application/json")) return true;
  if (req.xhr) return true;
  return false;
}

function statusMessage(status) {
  switch (status) {
    case 400:
      return "Bad request.";
    case 401:
      return "Authentication required.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "Not found.";
    case 429:
      return "Too many requests. Please try again later.";
    case 503:
      return "Service temporarily unavailable. Please try again shortly.";
    default:
      return status >= 500 ? "Something went wrong." : "Request failed.";
  }
}

function sendError(res, req, status, error, extra = {}) {
  const code = Number(status) || 500;
  const message = error || statusMessage(code);
  if (wantsJson(req) || req.path.startsWith("/api/")) {
    return res.status(code).json({
      ok: false,
      status: code,
      error: message,
      ...extra,
    });
  }
  const title =
    code === 404
      ? "Not found"
      : code === 401
        ? "Sign in required"
        : code === 403
          ? "Forbidden"
          : code === 503
            ? "Unavailable"
            : "Error";
  return res
    .status(code)
    .type("html")
    .send(
      `<!doctype html><title>${title}</title><h1>${title}</h1><p>${String(message).replace(/</g, "&lt;")}</p>`
    );
}

function createHttpError(status, message) {
  const err = new Error(message || statusMessage(status));
  err.status = status;
  err.statusCode = status;
  err.expose = status < 500;
  return err;
}

module.exports = {
  wantsJson,
  statusMessage,
  sendError,
  createHttpError,
};
