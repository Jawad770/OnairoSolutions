require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const nodemailer = require("nodemailer");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const { csrfSync } = require("csrf-sync");
const { state, persist, nextId, initDb, seedAdminUser, migrate, now, hashIp, insertLead, rolesForUser, prisma } = require("./db");
const config = require("./config");
const views = require("./portalViews");
const authz = require("./authz");
const { audit } = require("./audit");
const { MODULE_ROUTE_PERMISSIONS } = require("./permissions");
const { registerAi } = require("./ai/register");
const { sendError } = require("./httpErrors");
const { requestLoggingMiddleware } = require("./requestLog");

const app = express();
if (config.trustProxy) {
  // Needed behind nginx / Cloudflare so rate limits and IPs are correct.
  app.set("trust proxy", 1);
}

app.use(
  requestLoggingMiddleware({
    isProd: config.isProd,
  })
);

const { csrfSynchronisedProtection, generateToken } = csrfSync({
  // Form posts use CSRFToken; AJAX uses x-csrf-token
  getTokenFromRequest: (req) =>
    (req.body && (req.body.CSRFToken || req.body._csrf)) ||
    req.headers["x-csrf-token"] ||
    req.headers["csrf-token"],
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // portal inline scripts; prefer nonces in a later phase
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://ipwho.is",
          "https://ipapi.co",
        ],
        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://youtube.com",
          "https://maps.google.com",
          "https://www.google.com",
        ],
        mediaSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests: config.isProd ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "2mb" }));
app.use(
  session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      schemaName: "auth",
      tableName: "express_sessions",
      createTableIfMissing: false,
    }),
    secret: config.sessionSecret,
    resave: false,
    // Must be true so CSRF tokens generated on GET /login persist before auth
    saveUninitialized: true,
    rolling: true,
    proxy: config.trustProxy,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // "auto" marks Secure only on HTTPS (works behind nginx with TRUST_PROXY)
      secure: config.isProd ? "auto" : false,
      maxAge: config.sessionTimeoutMinutes * 60 * 1000,
    },
  })
);

app.use((req, res, next) => {
  if (req.path.startsWith(config.portalRoute)) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  next();
});
app.get("/robots.txt", (_, res) => {
  res.type("text/plain").send(
    [
      "User-agent: *",
      "Allow: /",
      `Disallow: ${config.portalRoute}`,
      `Disallow: ${config.portalRoute}/`,
      "Disallow: /api/",
      "Disallow: /data/",
      "Disallow: /server/",
      "Disallow: /node_modules/",
      "Disallow: /uploads/",
      "",
      "Sitemap: https://onairosolutions.com/sitemap.xml",
      "",
    ].join("\n")
  );
});
app.get("/sitemap.xml", (_, res) => {
  res.sendFile(path.join(config.rootDir, "sitemap.xml"));
});

const formLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: config.formRateLimitMax });
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: config.loginRateLimitMax });
const upload = multer({ dest: config.uploadDir, limits: { fileSize: 8 * 1024 * 1024, files: 5 } });

const smtpReady = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);
const transporter = smtpReady
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

async function sendConfirmationEmail(to, name) {
  if (!transporter || !to) return;
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: "We received your enquiry - Onairo Solutions",
    text: `Hello ${name || "there"},\n\nThank you for contacting Onairo Solutions.\n\nWe have successfully received your enquiry.\n\nOur team will review your request and contact you shortly.\n\nRegards,\nOnairo Solutions`,
  });
}

const requireAuth = authz.requireAuth;
const requireActiveUser = authz.requireActiveUser;
const requirePermission = authz.requirePermission;
/** Standard guard for authenticated portal pages. */
const portalGuard = [requireAuth, requireActiveUser];

function statusList() {
  return ["New", "Contacted", "Meeting Scheduled", "Proposal Sent", "Negotiation", "Won", "Lost"];
}

function token(req) {
  return generateToken(req);
}

function portalShell(title, inner, req, extra = "") {
  const account = authz.currentUser(req) || req.session.user;
  const roles = account?.id ? rolesForUser(account.id) : [];
  return views.layout({
    title,
    portalRoute: config.portalRoute,
    nav: authz.navFor(req),
    user: { ...account, roleName: roles.map((r) => r.name).join(", ") },
    body: `<div class="top">
      <div style="display:flex;align-items:center;gap:10px;min-width:0">
        <button class="btn sm drawer-btn" id="drawerBtn" type="button" aria-label="Open menu" aria-controls="side" aria-expanded="false">☰</button>
        <div style="min-width:0"><strong>${views.esc(title)}</strong><div class="muted">${views.esc(account?.email || "")}</div></div>
      </div>
      <form method="post" action="${config.portalRoute}/logout">
        <input type="hidden" name="CSRFToken" value="${token(req)}">
        <button class="btn" type="submit">Logout</button>
      </form></div>${inner}${extra}`,
  });
}

/** Leads the caller may read: everything, or only their own assignments. */
function visibleLeads(req) {
  if (authz.can(req, "leads.view_all")) return state.leads.slice();
  const uid = Number(req.session.user.id);
  return state.leads.filter((l) => Number(l.assigned_user_id) === uid);
}

const loadLead = (req) => state.leads.find((l) => l.id === Number(req.params.id)) || null;

app.get(`${config.portalRoute}/login`, (req, res) => {
  if (req.session.user) return res.redirect(config.portalRoute);
  const csrfToken = token(req);
  // Ensure session (with csrfToken) is written before the form can be submitted
  req.session.save((err) => {
    if (err) return res.status(500).send("Could not start login session.");
    res.send(
      views.login({
        portalRoute: config.portalRoute,
        csrfToken,
        error: req.query.error,
        notice: req.query.notice,
        next: req.query.next,
      })
    );
  });
});

app.post(`${config.portalRoute}/login`, loginLimiter, csrfSynchronisedProtection, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = state.users.find((u) => u.email === email);
  const locked = user?.locked_until && new Date(user.locked_until).getTime() > Date.now();
  const nextUrl = String(req.body.next || "");
  const safeNext = nextUrl.startsWith(config.portalRoute) ? nextUrl : config.portalRoute;

  const reject = (message) => {
    state.loginAttempts.push({ id: nextId("loginAttempts"), email, success: 0, ip_hash: hashIp(req.ip), created_at: now() });
    persist();
    return res
      .status(401)
      .send(views.login({ portalRoute: config.portalRoute, csrfToken: token(req), error: message, next: nextUrl }));
  };

  if (!user || locked || !bcrypt.compareSync(password, user.password_hash)) {
    if (user) {
      user.failed_logins = (user.failed_logins || 0) + 1;
      if (user.failed_logins >= config.maxLoginFailures) {
        user.locked_until = new Date(Date.now() + config.lockoutMinutes * 60000).toISOString();
      }
      user.updated_at = now();
      persist();
    }
    return reject("Invalid credentials or temporary lockout.");
  }

  // Suspended, inactive, pending and disabled accounts can never sign in.
  if (!authz.isActive(user)) {
    audit(req, "AUTH_LOGIN_BLOCKED", {
      targetType: "user",
      targetId: user.id,
      result: "failure",
      detail: `status=${user.status}`,
      actorName: user.email,
    });
    if (String(user.status || "") === "pending") {
      return reject("This account is pending invitation acceptance. Open the invite link to set a password, or ask an admin to create/reset with a temporary password.");
    }
    return reject("This account is not active. Contact a portal administrator.");
  }

  user.failed_logins = 0;
  user.locked_until = null;
  user.last_login_at = now();
  user.updated_at = now();
  req.session.user = { id: user.id, email: user.email, role: user.role };
  req.session.issued_at = now();
  if (req.body.rememberMe === "on") req.session.cookie.maxAge = config.rememberMeDays * 24 * 60 * 60 * 1000;
  state.loginAttempts.push({ id: nextId("loginAttempts"), email, success: 1, ip_hash: hashIp(req.ip), created_at: now() });
  persist();
  authz.trackSession(req, user);
  audit(req, "AUTH_LOGIN", { targetType: "user", targetId: user.id });

  const afterLogin = () => {
    if (user.must_change_password) return res.redirect(`${config.portalRoute}/change-password`);
    return res.redirect(safeNext);
  };

  // PgSession is async — wait for persist before redirect or the cookie is lost.
  req.session.save((err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("[auth] session save failed:", err.message || err);
      return reject("Could not create login session. Please try again.");
    }
    return afterLogin();
  });
});

app.post(`${config.portalRoute}/logout`, requireAuth, csrfSynchronisedProtection, (req, res) => {
  audit(req, "AUTH_LOGOUT", { targetType: "user", targetId: req.session.user.id });
  const sid = req.sessionID;
  const tracked = state.sessions.find((s) => s.sid === sid);
  if (tracked) {
    tracked.revoked_at = now();
    persist();
  }
  req.session.destroy(() => res.redirect(`${config.portalRoute}/login`));
});

app.get(config.portalRoute, ...portalGuard, requirePermission("dashboard.view"), (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const scopedLeads = visibleLeads(req);
  const myId = Number(req.session.user.id);
  const seesAllLeads = authz.can(req, "leads.view_all");
  const cards = [];

  // Cards are assembled from permissions, so each role gets its own dashboard.
  if (authz.can(req, "leads.view")) {
    const label = seesAllLeads ? "" : "My ";
    cards.push([`${label}Leads Today`, scopedLeads.filter((l) => l.date_created.slice(0, 10) === today).length]);
    cards.push([`${label}This Week`, scopedLeads.filter((l) => new Date(l.date_created).getTime() >= Date.now() - 6 * 86400000).length]);
    cards.push([`${label}This Month`, scopedLeads.filter((l) => l.date_created.slice(0, 7) === month).length]);
    cards.push([`${label}New / Follow-ups`, scopedLeads.filter((l) => l.status === "New" || l.status === "Contacted").length]);
    cards.push([`${label}Pipeline (open)`, scopedLeads.filter((l) => !["Won", "Lost"].includes(l.status)).length]);
    if (seesAllLeads) {
      cards.push(["Won Leads", scopedLeads.filter((l) => l.status === "Won").length]);
      cards.push(["Lost Leads", scopedLeads.filter((l) => l.status === "Lost").length]);
    }
  }
  if (authz.can(req, "website_forms.view")) {
    cards.push(["Website Enquiries", state.contactMessages.length]);
    cards.push(["Quote Requests", state.quoteRequests.length]);
  }
  if (authz.can(req, "edutrack.view")) {
    cards.push([
      "EduTrack Enquiries",
      state.leads.filter((l) => String(l.service_product || "").toLowerCase().includes("edutrack")).length,
    ]);
  }
  if (authz.can(req, "support.view")) {
    const tickets = authz.can(req, "support.view_all")
      ? state.tickets
      : state.tickets.filter((t) => Number(t.assigned_user_id) === myId);
    cards.push([authz.can(req, "support.view_all") ? "Open Tickets" : "My Open Tickets", tickets.filter((t) => t.status === "Open" || t.status === "In Progress").length]);
    cards.push(["Awaiting Response", tickets.filter((t) => t.status === "Waiting on Customer").length]);
    if (authz.can(req, "support.assign")) {
      cards.push(["Unassigned Tickets", state.tickets.filter((t) => !t.assigned_user_id).length]);
    }
  }
  if (authz.can(req, "invoices.view")) {
    const outstanding = state.invoices.filter((i) => !["Paid", "Cancelled"].includes(i.status));
    cards.push(["Outstanding Invoices", outstanding.length]);
    cards.push(["Outstanding Value", outstanding.reduce((t, i) => t + Number(i.amount || 0), 0).toLocaleString()]);
    cards.push(["Recent Payments", state.payments.length]);
    cards.push([
      "Revenue This Month",
      state.invoices
        .filter((i) => i.status === "Paid" && String(i.paid_at || "").slice(0, 7) === month)
        .reduce((t, i) => t + Number(i.amount || 0), 0)
        .toLocaleString(),
    ]);
  }
  if (authz.can(req, "blog.view")) {
    cards.push(["Draft Articles", state.blogPosts.filter((p) => p.status === "Draft").length]);
    cards.push(["Awaiting Approval", state.blogPosts.filter((p) => p.status === "In Review").length]);
    cards.push(["Published Articles", state.blogPosts.filter((p) => p.status === "Published").length]);
  }
  if (authz.can(req, "portfolio.view")) {
    cards.push(["Portfolio Entries", state.portfolioItems.length]);
  }
  if (authz.can(req, "users.view")) {
    cards.push(["Team Accounts", state.users.filter((u) => authz.isActive(u)).length]);
  }
  if (authz.can(req, "audit_logs.view")) {
    cards.push(["System Events", state.auditLogs.length]);
  }
  if (!cards.length) cards.push(["Reports available", 0]);

  // Lead trend charts need both analytics access and lead visibility.
  const chartsAllowed = authz.can(req, "analytics.view") && authz.can(req, "leads.view");
  const monthlyMap = {};
  scopedLeads.forEach((l) => {
    const m = l.date_created.slice(0, 7);
    monthlyMap[m] = (monthlyMap[m] || 0) + 1;
  });
  const monthly = Object.entries(monthlyMap).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  const sourceMap = {};
  scopedLeads.forEach((l) => {
    sourceMap[l.source_type] = (sourceMap[l.source_type] || 0) + 1;
  });
  const sources = Object.entries(sourceMap);
  const rows = [...scopedLeads].reverse().slice(0, 8);

  const html = `${req.query.notice ? `<div class="notice">${views.esc(req.query.notice)}</div>` : ""}
  <div class="grid cards">${cards
    .map(([k, v]) => `<div class="card"><div class="k">${views.esc(k)}</div><div class="v">${views.esc(v)}</div></div>`)
    .join("")}</div>
  ${chartsAllowed ? `<div class="grid" style="grid-template-columns:1.4fr 1fr;margin-top:14px"><div class="panel"><canvas id="monthly"></canvas></div><div class="panel"><canvas id="sources"></canvas></div></div>` : ""}
  ${authz.can(req, "leads.view") ? `<div class="panel"><h3 style="margin-top:0">${seesAllLeads ? "Recent activity" : "My recent leads"}</h3><table class="stack"><thead><tr><th>Lead</th><th>Name</th><th>Business</th><th>Status</th><th>Date</th></tr></thead><tbody>
  ${rows.map((l)=>`<tr><td data-label="Lead"><a href="${config.portalRoute}/crm/${l.id}">${l.lead_code}</a></td><td data-label="Name">${views.esc(l.name)}</td><td data-label="Business">${views.esc(l.business||"—")}</td><td data-label="Status"><span class="badge">${l.status}</span></td><td data-label="Date">${l.date_created.slice(0,10)}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">No leads assigned to you yet.</td></tr>`}
  </tbody></table></div>` : ""}`;
  const script = chartsAllowed
    ? `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script>
  new Chart(document.getElementById('monthly'),{type:'line',data:{labels:${JSON.stringify(monthly.map((m)=>m[0]))},datasets:[{data:${JSON.stringify(monthly.map((m)=>m[1]))},borderColor:'#10b981',tension:.35}]},options:{plugins:{legend:{display:false}}}});
  new Chart(document.getElementById('sources'),{type:'pie',data:{labels:${JSON.stringify(sources.map((s)=>s[0]))},datasets:[{data:${JSON.stringify(sources.map((s)=>s[1]))},backgroundColor:['#10b981','#3b82f6','#8b5cf6','#f59e0b']}]},options:{plugins:{legend:{position:'bottom'}}}});
  </script>`
    : "";
  res.send(portalShell("Dashboard", html, req, script));
});

app.get(`${config.portalRoute}/crm`, ...portalGuard, requirePermission("leads.view"), (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const status = String(req.query.status || "");
  const seesAll = authz.can(req, "leads.view_all");
  const leads = visibleLeads(req)
    .filter((l) => (status ? l.status === status : true))
    .filter((l) =>
      q
        ? [l.name, l.email, l.phone, l.business, l.industry, l.city, l.service_product, l.website_url]
            .join(" ")
            .toLowerCase()
            .includes(q)
        : true
    )
    .slice()
    .reverse();
  const canExport = authz.can(req, "leads.export");
  const html = `${req.query.notice ? `<div class="notice">${views.esc(req.query.notice)}</div>` : ""}
  <form class="panel" method="get"><div class="toolbar">
    <input name="q" value="${views.esc(q)}" placeholder="Search everything">
    <select name="status"><option value="">All Status</option>${statusList().map((s)=>`<option ${s===status?"selected":""}>${s}</option>`).join("")}</select>
    <button class="btn">Filter</button><a class="btn" href="${config.portalRoute}/crm/pipeline">Kanban Pipeline</a>
    ${canExport ? `<a class="btn" href="${config.portalRoute}/crm/export/csv">CSV</a><a class="btn" href="${config.portalRoute}/crm/export/xlsx">Excel</a><a class="btn" href="${config.portalRoute}/crm/export/pdf">PDF</a>` : ""}
  </div>${seesAll ? "" : `<p class="muted" style="margin:10px 0 0">You are viewing only the leads assigned to you.</p>`}</form>
  <div class="panel"><table class="stack"><thead><tr><th>Lead ID</th><th>Date</th><th>Name</th><th>Business</th><th>Industry</th><th>Service/Product</th><th>Email</th><th>WhatsApp</th><th>Phone</th><th>City</th><th>Budget</th><th>Timeline</th><th>Contact</th><th>Status</th></tr></thead><tbody>
  ${leads.map((l)=>`<tr><td data-label="Lead ID"><a href="${config.portalRoute}/crm/${l.id}">${l.lead_code}</a></td><td data-label="Date">${l.date_created.slice(0,10)}</td><td data-label="Name">${views.esc(l.name)}</td><td data-label="Business">${views.esc(l.business||"")}</td><td data-label="Industry">${views.esc(l.industry||"")}</td><td data-label="Service">${views.esc(l.service_product||"")}</td><td data-label="Email">${views.esc(l.email)}</td><td data-label="WhatsApp">${views.esc(l.whatsapp||"")}</td><td data-label="Phone">${views.esc(l.phone||"")}</td><td data-label="City">${views.esc(l.city||"")}</td><td data-label="Budget">${views.esc(l.budget||"")}</td><td data-label="Timeline">${views.esc(l.timeline||"")}</td><td data-label="Contact">${views.esc(l.preferred_contact_method||"")}</td><td data-label="Status"><span class="badge">${views.esc(l.status)}</span></td></tr>`).join("") || `<tr><td colspan="14" class="muted">No leads to show.</td></tr>`}
  </tbody></table></div>`;
  res.send(portalShell(seesAll ? "CRM" : "My Leads", html, req));
});

app.get(`${config.portalRoute}/crm/pipeline`, ...portalGuard, requirePermission("leads.view"), (req, res) => {
  const scoped = visibleLeads(req);
  const draggable = authz.can(req, "leads.change_status");
  const html = `<div class="panel"><h3 style="margin-top:0">Lead Pipeline</h3><div class="kanban">
  ${statusList()
    .map((s) => `<div class="col" data-status="${s}"><div style="display:flex;justify-content:space-between"><strong>${s}</strong><span class="badge">${scoped.filter((l)=>l.status===s).length}</span></div>${
      scoped.filter((l) => l.status === s).map((l)=>`<div class="lead" ${draggable ? 'draggable="true"' : ""} data-id="${l.id}"><div>${l.lead_code}</div><div class="muted">${views.esc(l.name)}</div></div>`).join("")
    }</div>`).join("")}
  </div></div>`;
  const script = draggable
    ? `<script>let dragId=null;document.querySelectorAll('.lead').forEach((el)=>el.addEventListener('dragstart',()=>dragId=el.dataset.id));
  document.querySelectorAll('.col').forEach((el)=>{el.addEventListener('dragover',(e)=>e.preventDefault());el.addEventListener('drop',async(e)=>{e.preventDefault();if(!dragId)return;const r=await fetch('${config.portalRoute}/api/leads/'+dragId+'/status',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':'${token(req)}'},body:JSON.stringify({status:el.dataset.status})});if(!r.ok){const d=await r.json().catch(()=>({}));alert(d.error||'Not permitted');}location.reload();});});</script>`
    : "";
  res.send(portalShell("CRM Pipeline", html, req, script));
});

app.post(
  `${config.portalRoute}/api/leads/:id/status`,
  ...portalGuard,
  csrfSynchronisedProtection,
  requirePermission("leads.change_status"),
  authz.requireOwnershipOrPermission("assigned_user_id", "leads.view_all", loadLead),
  (req, res) => {
    const lead = req.record;
    if (!statusList().includes(String(req.body.status))) {
      return res.status(400).json({ ok: false, error: "Invalid status." });
    }
    const previous = lead.status;
    lead.status = String(req.body.status);
    state.activities.push({ id: nextId("activities"), lead_id: lead.id, user_id: req.session.user.id, action_type: "STATUS_CHANGE", description: `Moved to ${lead.status}`, created_at: now() });
    persist();
    audit(req, "LEAD_STATUS_CHANGED", {
      targetType: "lead",
      targetId: lead.id,
      previous: { status: previous },
      next: { status: lead.status },
    });
    res.json({ ok: true });
  }
);

app.post(
  `${config.portalRoute}/api/leads/:id/assign`,
  ...portalGuard,
  csrfSynchronisedProtection,
  requirePermission("leads.assign"),
  (req, res) => {
    const lead = loadLead(req);
    if (!lead) return res.status(404).json({ ok: false, error: "Not found" });
    const targetId = Number(req.body.assignedUserId) || null;
    if (targetId) {
      const target = authz.userById(targetId);
      // Only active users who can actually work leads may receive them.
      if (!target || !authz.isActive(target) || !authz.permissionsOf(target.id).has("leads.view")) {
        return res.status(400).json({ ok: false, error: "That user cannot be assigned leads." });
      }
    }
    const previous = lead.assigned_user_id;
    lead.assigned_user_id = targetId;
    lead.assigned_to_user_id = targetId;
    lead.assigned_at = targetId ? now() : null;
    lead.assigned_by = targetId ? Number(req.session.user.id) : null;
    state.activities.push({
      id: nextId("activities"),
      lead_id: lead.id,
      user_id: req.session.user.id,
      action_type: "LEAD_ASSIGNED",
      description: targetId ? `Assigned to user #${targetId}` : "Assignment cleared",
      created_at: now(),
    });
    persist();
    audit(req, "LEAD_ASSIGNED", {
      targetType: "lead",
      targetId: lead.id,
      previous: { assigned_user_id: previous },
      next: { assigned_user_id: targetId },
    });
    res.json({ ok: true });
  }
);

/* Export routes are declared before /crm/:id so "export" is never read as an id. */
function exportRows(req) {
  return visibleLeads(req).map((l) => ({ ...l, metadata_json: l.metadata_json ? JSON.stringify(l.metadata_json) : "" }));
}
app.get(`${config.portalRoute}/crm/export/csv`, ...portalGuard, requirePermission("leads.export"), (req, res) => {
  const rows = exportRows(req);
  const keys = Object.keys(rows[0] || { lead_code: "", name: "", email: "" });
  const csv = [keys.join(",")].concat(rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replaceAll('"', '""')}"`).join(","))).join("\n");
  audit(req, "LEADS_EXPORTED", { targetType: "leads", targetId: "csv", detail: `${rows.length} rows` });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
  res.send(csv);
});
app.get(`${config.portalRoute}/crm/export/xlsx`, ...portalGuard, requirePermission("leads.export"), (req, res) => {
  const wb = XLSX.utils.book_new();
  const rows = exportRows(req);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Leads");
  const out = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  audit(req, "LEADS_EXPORTED", { targetType: "leads", targetId: "xlsx", detail: `${rows.length} rows` });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=leads.xlsx");
  res.send(out);
});
app.get(`${config.portalRoute}/crm/export/pdf`, ...portalGuard, requirePermission("leads.export"), (req, res) => {
  const doc = new PDFDocument({ margin: 24 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=leads.pdf");
  doc.pipe(res);
  doc.fontSize(16).text("Onairo Leads Export");
  doc.moveDown();
  const rows = exportRows(req);
  audit(req, "LEADS_EXPORTED", { targetType: "leads", targetId: "pdf", detail: `${rows.length} rows` });
  rows.forEach((l) => doc.fontSize(10).text(`${l.lead_code} | ${l.name} | ${l.email} | ${l.status}`));
  doc.end();
});

app.get(
  `${config.portalRoute}/crm/:id`,
  ...portalGuard,
  requirePermission("leads.view"),
  authz.requireOwnershipOrPermission("assigned_user_id", "leads.view_all", loadLead),
  async (req, res) => {
    const lead = req.record;
    const notes = authz.can(req, "lead_notes.view")
      ? state.leadNotes.filter((n) => n.lead_id === lead.id).slice().reverse()
      : [];
    const acts = state.activities.filter((a) => a.lead_id === lead.id).slice().reverse();
    const canNote = authz.can(req, "lead_notes.create");
    const canAssign = authz.can(req, "leads.assign");
    const assignees = canAssign
      ? state.users.filter((u) => authz.isActive(u) && authz.permissionsOf(u.id).has("leads.view"))
      : [];
    const callTarget = lead.phone || lead.whatsapp || "";
    const waDigits = String(lead.whatsapp || "").replace(/\D/g, "");
    const contactMeta = [
      lead.email ? `Email: ${lead.email}` : null,
      lead.whatsapp ? `WhatsApp: ${lead.whatsapp}` : null,
      lead.phone && lead.phone !== lead.whatsapp ? `Phone: ${lead.phone}` : null,
      lead.country ? `Country: ${lead.country}${lead.dial_code ? ` (${lead.dial_code})` : ""}` : null,
      lead.phone_number ? `Number: ${lead.phone_number}` : null,
      lead.city ? `City: ${lead.city}` : null,
    ]
      .filter(Boolean)
      .map((line) => views.esc(line))
      .join(" · ");

    let meta = {};
    try {
      meta =
        typeof lead.metadata_json === "string"
          ? JSON.parse(lead.metadata_json || "{}")
          : lead.metadata_json || {};
    } catch {
      meta = {};
    }
    const isAiLead = lead.source_type === "onairo_ai" || meta.source === "Onairo AI";
    let aiConversation = null;
    let aiMessages = [];
    if (isAiLead) {
      try {
        aiConversation = await prisma.aiConversation.findFirst({
          where: { leadId: lead.id },
          orderBy: { updatedAt: "desc" },
        });
        if (!aiConversation && meta.conversationId) {
          aiConversation = await prisma.aiConversation.findUnique({
            where: { id: String(meta.conversationId) },
          });
        }
        if (aiConversation) {
          aiMessages = await prisma.aiMessage.findMany({
            where: {
              conversationId: aiConversation.id,
              role: { in: ["user", "assistant"] },
            },
            orderBy: { createdAt: "asc" },
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[Onairo AI] CRM transcript load failed:", err?.message || err);
      }
    }

    const sourceBadge = isAiLead
      ? `<span class="badge" style="background:#1d4ed8;color:#fff;padding:2px 8px;border-radius:999px;font-size:12px">Onairo AI</span>`
      : `<span class="muted">${views.esc(lead.source_type || "")}</span>`;

    const aiScores =
      isAiLead && (meta.intentScore != null || meta.confidenceScore != null || aiConversation)
        ? `<p class="muted" style="margin-top:8px">Intent: ${views.esc(
            String(meta.intentScore ?? aiConversation?.intentScore ?? "—")
          )} / 100 · Confidence: ${views.esc(
            String(meta.confidenceScore ?? aiConversation?.confidenceScore ?? "—")
          )} / 100</p>`
        : "";

    const aiSummaryBlock =
      isAiLead && (lead.project_description || aiConversation?.summary)
        ? `<div class="panel" style="margin-top:12px"><h4 style="margin-top:0">AI Summary for Sales</h4>
        <p style="white-space:pre-wrap;line-height:1.55">${views.esc(
          aiConversation?.summary || lead.project_description || ""
        )}</p>
        ${
          meta.recommendedSolution
            ? `<p class="muted">Recommended: ${views.esc(String(meta.recommendedSolution))}</p>`
            : ""
        }
        ${aiScores}
      </div>`
        : "";

    const discountBlock = meta.discountCode
      ? `<div class="panel" style="margin-top:12px"><h4 style="margin-top:0">Promotion applied</h4>
        <p><strong>Code:</strong> ${views.esc(String(meta.discountCode))}</p>
        <p class="muted">Original: ${views.esc(String(meta.originalPrice ?? "—"))} ${views.esc(String(meta.currency || ""))}
        · Discount: ${views.esc(String(meta.discountAmount ?? "—"))}
        · Final: ${views.esc(String(meta.finalPrice ?? "—"))}</p>
      </div>`
      : "";

    const transcriptHtml =
      isAiLead && aiMessages.length
        ? `<div class="panel" style="margin-top:12px"><h4 style="margin-top:0">AI Conversation Transcript</h4>
        <div style="max-height:420px;overflow:auto;display:flex;flex-direction:column;gap:8px">
          ${aiMessages
            .map(
              (m) => `<div class="card" style="padding:10px 12px">
              <div class="muted" style="font-size:12px;margin-bottom:4px">${views.esc(
                m.role
              )} · ${views.esc(String(m.createdAt || m.created_at || ""))}</div>
              <div style="white-space:pre-wrap;line-height:1.5">${views.esc(m.content)}</div>
            </div>`
            )
            .join("")}
        </div></div>`
        : isAiLead
          ? `<div class="panel" style="margin-top:12px"><h4 style="margin-top:0">AI Conversation Transcript</h4><p class="muted">No transcript linked yet.</p></div>`
          : "";

    const html = `${req.query.notice ? `<div class="notice">${views.esc(req.query.notice)}</div>` : ""}
    <div class="panel"><h3 style="margin-top:0">${lead.lead_code} • ${views.esc(lead.name)} ${sourceBadge}</h3>
    <p class="muted">${views.esc(lead.service_product || "")} • ${views.esc(lead.status)} • ${views.esc(lead.assigned_user_id ? `Assigned to ${authz.userById(lead.assigned_user_id)?.full_name || `user #${lead.assigned_user_id}`}` : "Unassigned")}</p>
    ${contactMeta ? `<p class="muted" style="margin-top:6px">${contactMeta}</p>` : ""}
    <div class="actions" style="margin-bottom:10px">
      ${callTarget ? `<a class="btn" href="tel:${views.esc(callTarget)}">Call</a>` : ""}
      ${waDigits ? `<a class="btn" target="_blank" rel="noopener" href="https://wa.me/${waDigits}">Open WhatsApp</a>` : ""}
      ${lead.email ? `<a class="btn" href="mailto:${views.esc(lead.email)}">Send Email</a>
      <button class="btn" type="button" data-copy="${views.esc(lead.email)}">Copy Email</button>` : ""}
      ${callTarget ? `<button class="btn" type="button" data-copy="${views.esc(callTarget)}">Copy Phone</button>` : ""}
    </div>
    ${canAssign ? `<form id="assignForm" class="toolbar" style="margin-bottom:12px">
      <select name="assignedUserId" id="assignSelect"><option value="">Unassigned</option>${assignees
        .map((u) => `<option value="${u.id}" ${Number(lead.assigned_user_id) === u.id ? "selected" : ""}>${views.esc(u.full_name || u.email)}</option>`)
        .join("")}</select>
      <button class="btn" type="submit">Assign lead</button>
    </form>` : ""}
    ${canNote ? `<form method="post" action="${config.portalRoute}/crm/${lead.id}/note">
      <input type="hidden" name="CSRFToken" value="${token(req)}">
      <div class="row"><label>Add Note</label><textarea name="note" required></textarea></div>
      <button class="btn primary">Add Note</button>
    </form>` : ""}
  </div>
  ${aiSummaryBlock}
  ${discountBlock}
  ${transcriptHtml}
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div class="panel"><h4>Conversation Notes</h4>${notes.map((n)=>`<div class="card"><div class="muted">${n.created_at}</div>${views.esc(n.note)}</div>`).join("") || "<p class='muted'>No notes</p>"}</div>
    <div class="panel"><h4>Activity Timeline</h4>${acts.map((a)=>`<div class="card"><div class="muted">${a.created_at}</div>${views.esc(a.description)}</div>`).join("") || "<p class='muted'>No activity</p>"}</div>
  </div>`;
    const script = `<script>
      document.querySelectorAll('[data-copy]').forEach(function(btn){
        btn.addEventListener('click', function(){
          var value = btn.getAttribute('data-copy') || '';
          if (!value) return;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).catch(function(){});
          }
        });
      });
      ${canAssign ? `document.getElementById('assignForm').addEventListener('submit',async function(e){e.preventDefault();
      const r=await fetch('${config.portalRoute}/api/leads/${lead.id}/assign',{method:'POST',headers:{'Content-Type':'application/json','x-csrf-token':'${token(req)}'},body:JSON.stringify({assignedUserId:document.getElementById('assignSelect').value})});
      const d=await r.json().catch(()=>({}));if(!r.ok){alert(d.error||'Not permitted');}else{location.reload();}});` : ""}
    </script>`;
    res.send(portalShell("CRM Lead Details", html, req, script));
  }
);

app.post(
  `${config.portalRoute}/crm/:id/note`,
  ...portalGuard,
  csrfSynchronisedProtection,
  requirePermission("lead_notes.create"),
  authz.requireOwnershipOrPermission("assigned_user_id", "leads.view_all", loadLead),
  (req, res) => {
    const lead = req.record;
    const note = String(req.body.note || "").trim();
    if (!note) return res.redirect(`${config.portalRoute}/crm/${lead.id}`);
    state.leadNotes.push({ id: nextId("leadNotes"), lead_id: lead.id, user_id: req.session.user.id, note, created_at: now() });
    state.activities.push({ id: nextId("activities"), lead_id: lead.id, user_id: req.session.user.id, action_type: "NOTE_ADDED", description: "Note added", created_at: now() });
    persist();
    audit(req, "LEAD_NOTE_ADDED", { targetType: "lead", targetId: lead.id });
    res.redirect(`${config.portalRoute}/crm/${lead.id}`);
  }
);

/* Users/roles, invitations, audit logs, support, invoices and content modules
   are registered before the generic /:module placeholder below. */
require("./portalAdmin")({ app, csrf: csrfSynchronisedProtection, token, portalShell });
require("./portalModules")({ app, csrf: csrfSynchronisedProtection, token, portalShell });
require("./portalPromotions")({ app, csrf: csrfSynchronisedProtection, token, portalShell });
require("./portalMarketing")({ app, csrf: csrfSynchronisedProtection, token, portalShell });
require("./portalPopups")({ app, csrf: csrfSynchronisedProtection, token, portalShell });
require("./portalSandbox")({ app, csrf: csrfSynchronisedProtection, token, portalShell });
require("./portalCatalog")({ app, csrf: csrfSynchronisedProtection, token, portalShell });
require("./portalReviews")({
  app,
  csrf: csrfSynchronisedProtection,
  token,
  portalShell,
  formLimiter,
});

app.get(`${config.portalRoute}/forms`, ...portalGuard, requirePermission("website_forms.view"), (req, res) => {
  const contacts = state.contactMessages.slice().reverse();
  const quotes = state.quoteRequests.slice().reverse();
  const canExport = authz.can(req, "website_forms.export");
  const html = `<div class="grid cards">
    <div class="card"><div class="k">Contact messages</div><div class="v">${contacts.length}</div></div>
    <div class="card"><div class="k">Quote requests</div><div class="v">${quotes.length}</div></div>
  </div>
  ${canExport ? `<div class="actions" style="margin-top:12px"><a class="btn" href="${config.portalRoute}/forms/export/csv">Export CSV</a></div>` : ""}
  <div class="panel"><strong>Contact form submissions</strong>
    <table class="stack" style="margin-top:10px"><thead><tr><th>Date</th><th>Name</th><th>Email</th><th>WhatsApp</th><th>Topic</th><th>Message</th><th>Lead</th></tr></thead>
    <tbody>${contacts
      .map((c) => {
        const lead = state.leads.find((l) => l.source_type === "contact" && Number(l.source_ref_id) === c.id);
        return `<tr>
          <td data-label="Date">${views.esc(String(c.created_at).slice(0, 16).replace("T", " "))}</td>
          <td data-label="Name">${views.esc(c.name)}</td>
          <td data-label="Email">${views.esc(c.email || "—")}</td>
          <td data-label="WhatsApp">${views.esc(c.whatsapp || "—")}</td>
          <td data-label="Topic">${views.esc(c.topic || "—")}</td>
          <td data-label="Message">${views.esc(String(c.message || "").slice(0, 80))}</td>
          <td data-label="Lead">${lead ? `<a href="${config.portalRoute}/crm/${lead.id}">${lead.lead_code}</a>` : "—"}</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="7" class="muted">No contact submissions yet.</td></tr>`}
    </tbody></table>
  </div>
  <div class="panel"><strong>Quote requests</strong>
    <table class="stack" style="margin-top:10px"><thead><tr><th>Date</th><th>Name</th><th>Business</th><th>Email</th><th>WhatsApp</th><th>Interest</th><th>Lead</th></tr></thead>
    <tbody>${quotes
      .map((q) => {
        const lead = state.leads.find((l) => l.source_type === "quote" && Number(l.source_ref_id) === q.id);
        return `<tr>
          <td data-label="Date">${views.esc(String(q.created_at).slice(0, 16).replace("T", " "))}</td>
          <td data-label="Name">${views.esc(q.full_name)}</td>
          <td data-label="Business">${views.esc(q.business_name || "—")}</td>
          <td data-label="Email">${views.esc(q.email || "—")}</td>
          <td data-label="WhatsApp">${views.esc(q.whatsapp || "—")}</td>
          <td data-label="Interest">${views.esc(q.interested_in || "—")}</td>
          <td data-label="Lead">${lead ? `<a href="${config.portalRoute}/crm/${lead.id}">${lead.lead_code}</a>` : "—"}</td>
        </tr>`;
      })
      .join("") || `<tr><td colspan="7" class="muted">No quote requests yet.</td></tr>`}
    </tbody></table>
  </div>`;
  res.send(portalShell("Website Forms", html, req));
});

app.get(`${config.portalRoute}/forms/export/csv`, ...portalGuard, requirePermission("website_forms.export"), (req, res) => {
  const rows = [
    ...state.contactMessages.map((c) => ({
      type: "contact",
      created_at: c.created_at,
      name: c.name,
      business: c.business || "",
      email: c.email || "",
      whatsapp: c.whatsapp || "",
      phone: c.phone || "",
      topic: c.topic || "",
      message: c.message || "",
    })),
    ...state.quoteRequests.map((q) => ({
      type: "quote",
      created_at: q.created_at,
      name: q.full_name,
      business: q.business_name || "",
      email: q.email || "",
      whatsapp: q.whatsapp || "",
      phone: q.phone || "",
      topic: q.interested_in || "",
      message: q.project_description || "",
    })),
  ];
  const keys = ["type", "created_at", "name", "business", "email", "whatsapp", "phone", "topic", "message"];
  const csv = [keys.join(",")]
    .concat(rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replaceAll('"', '""')}"`).join(",")))
    .join("\n");
  audit(req, "WEBSITE_FORMS_EXPORTED", { targetType: "website_forms", targetId: "csv", detail: `${rows.length} rows` });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=website-forms.csv");
  res.send(csv);
});

app.get(`${config.portalRoute}/:module`, ...portalGuard, (req, res) => {
  const moduleName = String(req.params.module);
  if (moduleName === "crm") return res.redirect(`${config.portalRoute}/crm`);
  const permission = MODULE_ROUTE_PERMISSIONS[moduleName];
  // Deny by default: unknown modules are not browsable.
  if (!permission) return res.status(404).send("Not found");
  if (!authz.can(req, permission)) {
    return authz.forbidden(req, res, `Missing permission: ${permission}`);
  }
  const disabledKeys = new Set(
    (require("./permissions").NAV_ITEMS || []).filter((n) => n.disabled && n.path === moduleName).map((n) => n.key)
  );
  if (disabledKeys.size || ["clients", "projects", "newsletter", "analytics", "edutrack"].includes(moduleName)) {
    const label = moduleName[0].toUpperCase() + moduleName.slice(1);
    const html = `<div class="panel"><h2 style="margin-top:0">${views.esc(label)} <span class="badge warn">Coming Soon</span></h2>
    <p class="muted">This module is not enabled in production yet. It appears here as a disabled placeholder only.</p>
    <p class="muted">No data can be created or modified from this screen.</p></div>`;
    return res.send(portalShell(label, html, req));
  }
  const label = moduleName[0].toUpperCase() + moduleName.slice(1);
  const html = `<div class="panel"><h2 style="margin-top:0">${views.esc(label)}</h2>
  <p class="muted">Module ready.</p>
  ${moduleName === "settings" ? `<div class="actions" style="margin-top:10px">
    ${authz.can(req, "users.view") ? `<a class="btn" href="${config.portalRoute}/settings/users">Users</a>` : ""}
    ${authz.can(req, "roles.view") ? `<a class="btn" href="${config.portalRoute}/settings/roles">Roles &amp; Permissions</a>` : ""}
    <a class="btn" href="${config.portalRoute}/change-password">Change my password</a>
  </div>` : ""}</div>`;
  res.send(portalShell(label, html, req));
});

function trimBody(value) {
  return String(value == null ? "" : value).trim();
}

/** Shared public-form rule: email and WhatsApp are optional, but one is required. */
function emailOrWhatsappError(body) {
  const email = trimBody(body.email);
  const whatsapp = trimBody(body.whatsapp);
  if (!email && !whatsapp) {
    return "Please provide either your Email address or WhatsApp number.";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address.";
  }
  return null;
}

function contactFieldsFromBody(b) {
  const whatsappRaw = trimBody(b.whatsapp);
  const phoneRaw = trimBody(b.phone);
  const country = trimBody(b.country) || trimBody(b.phoneCountry) || null;
  const countryCode = trimBody(b.countryCode) || trimBody(b.phoneCountryCode) || null;
  const dialCode = trimBody(b.dialCode) || trimBody(b.phoneDialCode) || null;
  const phoneNumber = trimBody(b.phoneNumber) || trimBody(b.phoneLocal) || null;
  return {
    email: trimBody(b.email) || null,
    whatsapp: normalizePhone(whatsappRaw, dialCode),
    phone: normalizePhone(phoneRaw, dialCode),
    country: whatsappRaw || phoneRaw ? country : null,
    countryCode: whatsappRaw || phoneRaw ? countryCode : null,
    dialCode: whatsappRaw || phoneRaw ? dialCode : null,
    phoneNumber: whatsappRaw || phoneRaw ? phoneNumber : null,
  };
}

/** Prefer E.164. Local Pakistani 03… numbers become +923… */
function normalizePhone(value, dialCode) {
  const raw = trimBody(value);
  if (!raw) return null;
  let digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && (dialCode === "+92" || !dialCode)) {
    return `+92${digits.slice(1)}`;
  }
  if (dialCode) {
    const dialDigits = String(dialCode).replace(/\D+/g, "");
    if (digits.startsWith(dialDigits)) return `+${digits}`;
    return `${dialCode}${digits}`;
  }
  return digits.length >= 10 ? `+${digits}` : raw;
}

async function attachDiscountToLead(req, lead, extras = {}) {
  const code = trimBody(req.body?.discountCode || req.body?.code);
  if (!code || !lead) return null;
  try {
    const { PromotionRepository } = require("./db/repositories/promotions");
    const { audit: auditFn } = require("./audit");
    const redeemed = await PromotionRepository.redeem({
      code,
      productSlug: trimBody(req.body?.productSlug) || extras.productSlug || null,
      planId: trimBody(req.body?.planId) || null,
      planName: trimBody(req.body?.planName) || null,
      amount: req.body?.amount,
      email: lead.email,
      whatsapp: lead.whatsapp,
      leadId: lead.id,
      sourcePage: trimBody(req.body?.sourcePage) || extras.sourcePage || null,
      req,
    });
    if (!redeemed.ok) return null;
    lead.metadata_json = {
      ...(lead.metadata_json && typeof lead.metadata_json === "object" ? lead.metadata_json : {}),
      ...redeemed.leadMetadata,
    };
    persist();
    auditFn(req, "PROMOTION_APPLIED", {
      targetType: "promotion",
      targetId: redeemed.quote.promotionId,
      next: redeemed.leadMetadata,
    });
    return redeemed;
  } catch (_err) {
    return null;
  }
}

app.post("/api/enquiries/contact", formLimiter, upload.none(), async (req, res) => {
  const b = req.body || {};
  const name = trimBody(b.name);
  const message = trimBody(b.message);
  if (!name || !message) return res.status(400).json({ ok: false, error: "Missing required fields." });
  const channelError = emailOrWhatsappError(b);
  if (channelError) return res.status(400).json({ ok: false, error: channelError });

  const contact = contactFieldsFromBody(b);
  const contactId = nextId("contactMessages");
  state.contactMessages.push({
    id: contactId,
    name,
    business: trimBody(b.business) || null,
    topic: trimBody(b.topic) || null,
    email: contact.email,
    whatsapp: contact.whatsapp,
    phone: contact.phone,
    country: contact.country,
    country_code: contact.countryCode,
    dial_code: contact.dialCode,
    phone_number: contact.phoneNumber,
    city: trimBody(b.city) || null,
    message,
    created_at: now(),
  });
  const lead = insertLead({
    sourceType: "contact",
    sourceRefId: contactId,
    name,
    business: b.business,
    industry: b.industry,
    serviceProduct: b.topic || "General inquiry",
    email: contact.email,
    whatsapp: contact.whatsapp,
    phone: contact.phone,
    country: contact.country,
    countryCode: contact.countryCode,
    dialCode: contact.dialCode,
    phoneNumber: contact.phoneNumber,
    city: b.city,
    preferredContactMethod: b.preferredContactMethod || (contact.whatsapp ? "WhatsApp" : "Email"),
    projectDescription: message,
    websiteUrl: b.website,
  });
  state.activities.push({ id: nextId("activities"), lead_id: lead.id, user_id: null, action_type: "LEAD_CREATED", description: "Lead created from contact form", created_at: now() });
  persist();
  await attachDiscountToLead(req, lead, { sourcePage: "contact" });
  await sendConfirmationEmail(contact.email, name).catch(() => {});
  res.json({ ok: true, leadCode: lead.lead_code });
});

app.post("/api/enquiries/quote", formLimiter, upload.array("attachments", 5), async (req, res) => {
  const b = req.body || {};
  const fullName = trimBody(b.fullName);
  const businessName = trimBody(b.businessName);
  const projectDescription = trimBody(b.projectDescription);
  if (!fullName || !businessName || !projectDescription) {
    return res.status(400).json({ ok: false, error: "Missing required fields." });
  }
  const channelError = emailOrWhatsappError(b);
  if (channelError) return res.status(400).json({ ok: false, error: channelError });

  const contact = contactFieldsFromBody(b);
  const attachments = (req.files || []).map((f) => ({ original: f.originalname, file: f.filename, size: f.size }));
  const quoteId = nextId("quoteRequests");
  state.quoteRequests.push({
    id: quoteId,
    full_name: fullName,
    business_name: businessName,
    industry: trimBody(b.industry) || null,
    interested_in: trimBody(b.interestedIn) || null,
    email: contact.email,
    whatsapp: contact.whatsapp,
    phone: contact.phone,
    country: contact.country,
    country_code: contact.countryCode,
    dial_code: contact.dialCode,
    phone_number: contact.phoneNumber,
    city: trimBody(b.city) || null,
    budget: trimBody(b.budget) || null,
    timeline: trimBody(b.timeline) || null,
    preferred_contact_method: trimBody(b.preferredContactMethod) || null,
    project_description: projectDescription,
    website_url: trimBody(b.website) || null,
    attachments_json: attachments,
    created_at: now(),
  });
  const lead = insertLead({
    sourceType: "quote",
    sourceRefId: quoteId,
    name: fullName,
    business: businessName,
    industry: b.industry,
    serviceProduct: b.interestedIn,
    email: contact.email,
    whatsapp: contact.whatsapp,
    phone: contact.phone,
    country: contact.country,
    countryCode: contact.countryCode,
    dialCode: contact.dialCode,
    phoneNumber: contact.phoneNumber,
    city: b.city,
    budget: b.budget,
    timeline: b.timeline,
    preferredContactMethod: b.preferredContactMethod || (contact.whatsapp ? "WhatsApp" : "Email"),
    projectDescription,
    websiteUrl: b.website,
    metadataJson: { attachments },
  });
  state.activities.push({ id: nextId("activities"), lead_id: lead.id, user_id: null, action_type: "LEAD_CREATED", description: "Lead created from quote form", created_at: now() });
  persist();
  await attachDiscountToLead(req, lead, { sourcePage: "quote", productSlug: trimBody(b.interestedIn) || null });
  await sendConfirmationEmail(contact.email, fullName).catch(() => {});
  res.json({ ok: true, leadCode: lead.lead_code });
});

app.post("/api/newsletter/subscribe", formLimiter, express.json(), (req, res) => {
  const email = trimBody(req.body?.email || "").toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: "Please enter a valid email address." });
  }
  let subscriber = state.newsletterSubscribers.find((s) => s.email === email);
  if (!subscriber) {
    subscriber = {
      id: nextId("newsletterSubscribers"),
      email,
      source: trimBody(req.body?.source) || "footer",
      created_at: now(),
    };
    state.newsletterSubscribers.push(subscriber);
  }

  // Keep newsletter signups visible and actionable in the CRM without
  // creating duplicate leads when the same address subscribes again.
  let lead = state.leads.find(
    (l) => l.source_type === "newsletter" && String(l.email || "").toLowerCase() === email
  );
  if (!lead) {
    lead = insertLead({
      sourceType: "newsletter",
      sourceRefId: subscriber.id,
      name: email.split("@")[0],
      email,
      preferredContactMethod: "Email",
      projectDescription: "Subscribed through the website footer newsletter form.",
      metadataJson: {
        source: "Website Newsletter",
        subscriptionSource: subscriber.source,
      },
    });
    state.activities.push({
      id: nextId("activities"),
      lead_id: lead.id,
      user_id: null,
      action_type: "LEAD_CREATED",
      description: "Lead created from newsletter subscription",
      created_at: now(),
    });
  }
  persist();
  res.json({ ok: true });
});

/* Onairo AI consultant — streaming chat, knowledge tools, CRM lead capture */
registerAi(app, {
  config,
  insertLead,
  persist,
  state,
  nextId,
  now,
  prisma,
});

const { registerCatalogPublicApi } = require("./catalogPublic");
registerCatalogPublicApi(app);
const { registerMarketingPublicApi } = require("./marketingPublic");
registerMarketingPublicApi(app);
const { registerPopupPublicApi } = require("./popupPublic");
registerPopupPublicApi(app);

app.get(["/_legacy-agency-home.html", "/src/pages/_legacy-agency-home.html", "/pages/_legacy-agency-home.html"], (_req, res) => {
  res.redirect(301, "/pages/pricing.html");
});

/* Showcase assets (demo-globals.js, assets/*) resolve under /showcase/*
 * because demo HTML is served at /showcase/:name with relative script paths.
 * Canonical files live only in public/demos (config.showcaseDirectory). */
app.use(
  "/showcase",
  express.static(config.showcaseDirectory, {
    index: false,
    fallthrough: true,
    redirect: false,
  })
);

/**
 * /showcase/<name> → public/demos/<name>.html
 * /showcase/<file.ext> → public/demos/<file.ext> (fallback if static missed it)
 */
function sendShowcase(req, res) {
  const raw = String(req.params.name || "");
  const showcaseRoot = path.resolve(config.showcaseDirectory);

  // Asset request (has an extension) — never map to <name>.html
  if (/\.[a-z0-9]+$/i.test(raw)) {
    const safe = path.basename(raw);
    if (safe !== raw || safe.includes("..")) {
      return sendError(res, req, 404, "Not found.");
    }
    const assetPath = path.resolve(showcaseRoot, safe);
    if (!assetPath.startsWith(showcaseRoot + path.sep) || !fs.existsSync(assetPath)) {
      return sendError(res, req, 404, "Not found.");
    }
    return res.sendFile(assetPath);
  }

  const name = raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (!name || name !== raw.toLowerCase()) {
    return sendError(res, req, 404, "Showcase not found.");
  }
  const filePath = path.resolve(showcaseRoot, `${name}.html`);
  if (!filePath.startsWith(showcaseRoot + path.sep) || !fs.existsSync(filePath)) {
    return sendError(res, req, 404, "Showcase not found.");
  }
  res.setHeader("Cache-Control", "no-cache");
  return res.sendFile(filePath);
}

app.get("/showcase/:name", sendShowcase);

/* Legacy /demo/... bookmarks → /showcase/... */
app.get("/demo/:name", (req, res) => {
  const name = String(req.params.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  if (!name) return sendError(res, req, 404, "Showcase not found.");
  return res.redirect(301, `/showcase/${name}`);
});

/* Legacy /src/... bookmarks → clean public URLs */
app.get("/src/portfolio/demos/:file", (req, res) => {
  const match = /^([a-z0-9-]+)\.html$/i.exec(String(req.params.file || ""));
  if (!match) return sendError(res, req, 404, "Showcase not found.");
  return res.redirect(301, `/showcase/${match[1].toLowerCase()}`);
});
/* Only redirect HTML demos — never intercept /demos/*.js or /demos/assets/* */
app.get("/demos/:file", (req, res, next) => {
  const match = /^([a-z0-9-]+)\.html$/i.exec(String(req.params.file || ""));
  if (!match) return next();
  return res.redirect(301, `/showcase/${match[1].toLowerCase()}`);
});
app.use((req, res, next) => {
  if (!req.path.startsWith("/src/") && req.path !== "/src") return next();
  const rest = req.path.replace(/^\/src\/?/, "");
  return res.redirect(301, rest ? `/${rest}` : "/");
});

/* Public health check — no auth */
app.get("/health", async (_req, res) => {
  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }
  const payload = {
    status: database ? "ok" : "degraded",
    uptime: Math.round(process.uptime()),
    database,
    version: config.version,
    timestamp: new Date().toISOString(),
  };
  return res.status(database ? 200 : 503).json(payload);
});

app.use("/uploads", express.static(config.uploadDir));

/* EduTrack installer — fixed URL, force download, clean 404 if missing */
app.get(config.edutrackInstallerUrl, (req, res) => {
  const filePath = config.edutrackInstallerPath;
  if (!fs.existsSync(filePath)) {
    return sendError(res, req, 404, "EduTrack installer is not available yet.");
  }
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", 'attachment; filename="EduTrack-Setup.exe"');
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.sendFile(filePath);
});

/* Production static surface: only the public document root. */
app.use(
  express.static(config.publicDirectory, {
    index: "index.html",
    dotfiles: "deny",
    fallthrough: true,
  })
);

app.use((err, req, res, next) => {
  if (err && (err.code === "EBADCSRFTOKEN" || /csrf/i.test(String(err.message || "")))) {
    if (req.path.startsWith(config.portalRoute)) {
      const csrfToken = token(req);
      return req.session.save(() => {
        res.status(403).send(
          views.login({
            portalRoute: config.portalRoute,
            csrfToken,
            error: "Session expired. Please sign in again.",
          })
        );
      });
    }
    return sendError(res, req, 403, "Invalid CSRF token.");
  }
  next(err);
});

/* Centralized error handler — consistent JSON for APIs */
app.use((err, req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error("[portal]", err?.status || err?.statusCode || 500, err?.message || err);
  const dbDown =
    err?.code === "P1001" ||
    err?.code === "ECONNREFUSED" ||
    /database|prisma|postgres/i.test(String(err?.message || ""));
  const status = dbDown
    ? 503
    : Number(err?.status || err?.statusCode) || 500;
  const message =
    err?.expose && err?.message
      ? err.message
      : undefined;
  return sendError(res, req, status, message);
});

/* 404 — after all routes and static */
app.use((req, res) => {
  if (req.path.startsWith("/api/") || req.path.startsWith(config.portalRoute + "/api")) {
    return sendError(res, req, 404, "Not found.");
  }
  return sendError(res, req, 404, "Not found.");
});

let bootPromise = null;
app.ready = function ready() {
  if (!bootPromise) {
    bootPromise = (async () => {
      await initDb();
      await seedAdminUser();
      await migrate();
    })();
  }
  return bootPromise;
};

module.exports = app;
