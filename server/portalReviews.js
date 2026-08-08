const config = require("./config");
const views = require("./portalViews");
const authz = require("./authz");
const { audit } = require("./audit");
const { prisma, hashIp } = require("./db");

const R = config.portalRoute;
const PUBLIC_MESSAGE = "Thanks for your review!";
const VALID_STATUSES = new Set(["pending", "approved", "rejected"]);

function clean(value, maxLength) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function redirectWith(res, params) {
  res.redirect(`${R}/reviews?${new URLSearchParams(params).toString()}`);
}

function statusBadge(status) {
  const cls = status === "approved" ? "ok" : status === "rejected" ? "off" : "warn";
  return `<span class="badge ${cls}">${views.esc(status)}</span>`;
}

module.exports = function registerReviewRoutes({ app, csrf, token, portalShell, formLimiter }) {
  app.get("/api/reviews", async (_req, res) => {
    const reviews = await prisma.testimonialReview.findMany({
      where: { status: "approved" },
      orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
      take: 12,
      select: { id: true, name: true, review: true, createdAt: true },
    });
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({
      ok: true,
      reviews: reviews.map((review) => ({
        id: review.id,
        name: review.name,
        review: review.review,
        createdAt: review.createdAt,
      })),
    });
  });

  app.post("/api/reviews", formLimiter, async (req, res) => {
    const body = req.body || {};
    const name = clean(body.name, 80);
    const review = clean(body.review, 1500);

    // Quietly accept bot submissions without storing them.
    if (clean(body.website, 200)) {
      return res.status(201).json({ ok: true, message: PUBLIC_MESSAGE });
    }
    if (name.length < 2) {
      return res.status(400).json({ ok: false, error: "Please enter your name." });
    }
    if (review.length < 10) {
      return res.status(400).json({ ok: false, error: "Please write a review of at least 10 characters." });
    }

    await prisma.testimonialReview.create({
      data: {
        name,
        review,
        status: "pending",
        ipHash: hashIp(req.ip),
        userAgent: clean(req.headers["user-agent"], 250) || null,
      },
    });
    return res.status(201).json({ ok: true, message: PUBLIC_MESSAGE });
  });

  app.get(
    `${R}/reviews`,
    authz.requireAuth,
    authz.requireActiveUser,
    authz.requireSuperAdmin,
    async (req, res) => {
      const status = VALID_STATUSES.has(String(req.query.status || ""))
        ? String(req.query.status)
        : "";
      const [reviews, counts] = await Promise.all([
        prisma.testimonialReview.findMany({
          where: status ? { status } : undefined,
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        prisma.testimonialReview.groupBy({ by: ["status"], _count: { _all: true } }),
      ]);
      const countOf = (key) => counts.find((row) => row.status === key)?._count?._all || 0;
      const notice = req.query.notice
        ? `<div class="notice">${views.esc(req.query.notice)}</div>`
        : "";
      const error = req.query.error
        ? `<div class="error">${views.esc(req.query.error)}</div>`
        : "";
      const csrfField = `<input type="hidden" name="CSRFToken" value="${views.esc(token(req))}">`;
      const html = `${notice}${error}
      <div class="grid cards">
        <div class="card"><div class="k">Pending</div><div class="v">${countOf("pending")}</div></div>
        <div class="card"><div class="k">Approved</div><div class="v">${countOf("approved")}</div></div>
        <div class="card"><div class="k">Rejected / hidden</div><div class="v">${countOf("rejected")}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div><strong>Client review moderation</strong><div class="muted">Only approved reviews appear on the public website.</div></div>
          <form class="toolbar" method="get">
            <select name="status">
              <option value="">All reviews</option>
              ${["pending", "approved", "rejected"].map((value) => `<option value="${value}" ${status === value ? "selected" : ""}>${value[0].toUpperCase() + value.slice(1)}</option>`).join("")}
            </select>
            <button class="btn sm" type="submit">Filter</button>
          </form>
        </div>
        <table class="stack">
          <thead><tr><th>Submitted</th><th>Name</th><th>Review</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${reviews.map((review) => `<tr>
            <td data-label="Submitted">${views.esc(review.createdAt.toISOString().slice(0, 16).replace("T", " "))}</td>
            <td data-label="Name"><strong>${views.esc(review.name)}</strong></td>
            <td data-label="Review" style="max-width:560px;white-space:pre-wrap;line-height:1.55">${views.esc(review.review)}</td>
            <td data-label="Status">${statusBadge(review.status)}</td>
            <td data-label="Actions">
              <div class="actions">
                ${review.status !== "approved" ? `<form method="post" action="${R}/reviews/${review.id}/status">${csrfField}<input type="hidden" name="status" value="approved"><button class="btn sm primary" type="submit">Approve</button></form>` : ""}
                ${review.status !== "rejected" ? `<form method="post" action="${R}/reviews/${review.id}/status">${csrfField}<input type="hidden" name="status" value="rejected"><button class="btn sm danger" type="submit">${review.status === "approved" ? "Hide" : "Reject"}</button></form>` : ""}
              </div>
            </td>
          </tr>`).join("") || `<tr><td colspan="5" class="muted">No reviews in this view.</td></tr>`}</tbody>
        </table>
      </div>`;
      res.send(portalShell("Reviews", html, req));
    }
  );

  app.post(
    `${R}/reviews/:id/status`,
    authz.requireAuth,
    authz.requireActiveUser,
    csrf,
    authz.requireSuperAdmin,
    async (req, res) => {
      const status = clean(req.body.status, 20);
      if (status !== "approved" && status !== "rejected") {
        return redirectWith(res, { error: "Invalid review status." });
      }
      const existing = await prisma.testimonialReview.findUnique({ where: { id: req.params.id } });
      if (!existing) return redirectWith(res, { error: "Review not found." });

      const approved = status === "approved";
      const updated = await prisma.testimonialReview.update({
        where: { id: existing.id },
        data: {
          status,
          approvedAt: approved ? new Date() : null,
          approvedByUserId: approved ? Number(req.session.user.id) : null,
          rejectedAt: approved ? null : new Date(),
        },
      });
      audit(req, approved ? "REVIEW_APPROVED" : "REVIEW_HIDDEN", {
        targetType: "testimonial_review",
        targetId: updated.id,
        previous: { status: existing.status },
        next: { status: updated.status },
      });
      return redirectWith(res, {
        notice: approved
          ? `${updated.name}'s review is now visible on the website.`
          : `${updated.name}'s review is hidden from the website.`,
      });
    }
  );
};
