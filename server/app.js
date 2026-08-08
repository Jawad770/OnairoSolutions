const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const csrf = require("csurf");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const nodemailer = require("nodemailer");
const XLSX = require("xlsx");
const PDFDocument = require("pdfkit");
const { db, initDb, seedAdminUser, now, hashIp, insertLead } = require("./db");
const config = require("./config");
const views = require("./portalViews");

initDb();
seedAdminUser();

const app = express();
if (config.trustProxy) app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(config.uploadDir));

app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: path.dirname(config.dbPath) }),
    name: "onairo.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.isProd,
      maxAge: config.sessionTimeoutMinutes * 60 * 1000,
    },
  })
);

const csrfProtection = csrf();
const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
});
const formLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
});

function audit(req, action, target = "") {
  db.prepare(
    "INSERT INTO audit_logs (user_id, action, target, ip_hash, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    req.session.user?.id || null,
    action,
    target,
    hashIp(req.ip),
    String(req.headers["user-agent"] || "").slice(0, 300),
    now()
  );
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect(`${config.portalRoute}/login`);
  next();
}

function ensureNoIndex(req, res, next) {
  if (req.path.startsWith(config.portalRoute)) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  next();
}

app.use(ensureNoIndex);

app.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(`User-agent: *\nDisallow: ${config.portalRoute}\n`);
});

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

function loginLocked(user) {
  if (!user || !user.locked_until) return false;
  return new Date(user.locked_until).getTime() > Date.now();
}

app.get(`${config.portalRoute}/login`, csrfProtection, (req, res) => {
  if (req.session.user) return res.redirect(config.portalRoute);
  res.send(views.login({ portalRoute: config.portalRoute, csrfToken: req.csrfToken() }));
});

app.post(`${config.portalRoute}/login`, loginLimiter, csrfProtection, (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const rememberMe = req.body.rememberMe === "on";
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user || loginLocked(user) || !bcrypt.compareSync(password, user.password_hash)) {
    if (user) {
      const failures = (user.failed_logins || 0) + 1;
      const lock =
        failures >= config.maxLoginFailures
          ? new Date(Date.now() + config.lockoutMinutes * 60000).toISOString()
          : null;
      db.prepare("UPDATE users SET failed_logins = ?, locked_until = ?, updated_at = ? WHERE id = ?").run(
        failures,
        lock,
        now(),
        user.id
      );
    }
    db.prepare("INSERT INTO login_attempts (email, success, ip_hash, created_at) VALUES (?, 0, ?, ?)").run(
      email,
      hashIp(req.ip),
      now()
    );
    return res.status(401).send(
      views.login({
        portalRoute: config.portalRoute,
        csrfToken: req.csrfToken(),
        error: "Invalid credentials or temporary lockout.",
      })
    );
  }

  db.prepare("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?").run(now(), now(), user.id);
  db.prepare("INSERT INTO login_attempts (email, success, ip_hash, created_at) VALUES (?, 1, ?, ?)").run(
    email,
    hashIp(req.ip),
    now()
  );
  req.session.user = { id: user.id, email: user.email, role: user.role };
  if (rememberMe) req.session.cookie.maxAge = config.rememberMeDays * 24 * 60 * 60 * 1000;
  audit(req, "AUTH_LOGIN", user.email);
  res.redirect(config.portalRoute);
});

app.post(`${config.portalRoute}/logout`, requireAuth, csrfProtection, (req, res) => {
  audit(req, "AUTH_LOGOUT", req.session.user.email);
  req.session.destroy(() => res.redirect(`${config.portalRoute}/login`));
});

function portalShell(title, inner, req, extra = "") {
  return views.layout({
    title,
    portalRoute: config.portalRoute,
    user: req.session.user,
    body: `<div class="top"><div><strong>${title}</strong><div class="muted">${req.session.user.email}</div></div>
      <form method="post" action="${config.portalRoute}/logout">
        <input type="hidden" name="_csrf" value="${req.csrfToken()}">
        <button class="btn" type="submit">Logout</button>
      </form>
    </div>${inner}${extra}`,
  });
}

app.get(config.portalRoute, requireAuth, csrfProtection, (req, res) => {
  const stats = db.prepare(`
    SELECT
      SUM(CASE WHEN date(date_created)=date('now') THEN 1 ELSE 0 END) AS today,
      SUM(CASE WHEN date(date_created) >= date('now','-6 days') THEN 1 ELSE 0 END) AS week,
      SUM(CASE WHEN strftime('%Y-%m',date_created)=strftime('%Y-%m','now') THEN 1 ELSE 0 END) AS month,
      SUM(CASE WHEN status='New' THEN 1 ELSE 0 END) AS unread,
      SUM(CASE WHEN service_product LIKE '%Demo%' THEN 1 ELSE 0 END) AS demo,
      SUM(CASE WHEN service_product LIKE '%EduTrack%' THEN 1 ELSE 0 END) AS edutrack,
      SUM(CASE WHEN source_type='quote' THEN 1 ELSE 0 END) AS quotes
    FROM leads`).get();
  const rows = db.prepare("SELECT lead_code,name,business,service_product,status,date_created FROM leads ORDER BY id DESC LIMIT 8").all();
  const monthly = db.prepare(`SELECT strftime('%Y-%m',date_created) m,COUNT(*) c FROM leads GROUP BY m ORDER BY m DESC LIMIT 8`).all().reverse();
  const sources = db.prepare(`SELECT source_type label,COUNT(*) value FROM leads GROUP BY source_type ORDER BY value DESC`).all();

  const html = `
  <div class="grid cards">
    ${[
      ["Today's Leads", stats.today],
      ["This Week", stats.week],
      ["This Month", stats.month],
      ["Unread Messages", stats.unread],
      ["Demo Requests", stats.demo],
      ["EduTrack Enquiries", stats.edutrack],
      ["Quote Requests", stats.quotes],
    ].map(([k, v]) => `<div class="card"><div class="k">${k}</div><div class="v">${v || 0}</div></div>`).join("")}
  </div>
  <div class="grid" style="grid-template-columns:1.4fr 1fr;margin-top:14px">
    <div class="panel"><canvas id="monthly"></canvas></div>
    <div class="panel"><canvas id="sources"></canvas></div>
  </div>
  <div class="panel"><h3 style="margin-top:0">Recent activity</h3>
    <table><thead><tr><th>Lead</th><th>Name</th><th>Business</th><th>Service</th><th>Status</th><th>Date</th></tr></thead><tbody>
    ${rows.map((r)=>`<tr><td>${r.lead_code}</td><td>${r.name}</td><td>${r.business||"—"}</td><td>${r.service_product||"—"}</td><td><span class="badge">${r.status}</span></td><td>${r.date_created.slice(0,10)}</td></tr>`).join("")}
    </tbody></table>
  </div>`;
  const script = `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script><script>
    new Chart(document.getElementById('monthly'),{type:'line',data:{labels:${JSON.stringify(monthly.map((m)=>m.m))},datasets:[{label:'Monthly enquiries',data:${JSON.stringify(monthly.map((m)=>m.c))},borderColor:'#10b981',tension:.35}]},options:{plugins:{legend:{display:false}}}});
    new Chart(document.getElementById('sources'),{type:'doughnut',data:{labels:${JSON.stringify(sources.map((s)=>s.label))},datasets:[{data:${JSON.stringify(sources.map((s)=>s.value))},backgroundColor:['#10b981','#3b82f6','#8b5cf6','#f59e0b']}]},options:{plugins:{legend:{position:'bottom'}}}});
  </script>`;
  res.send(portalShell("Dashboard", html, req, script));
});

app.get(`${config.portalRoute}/crm`, requireAuth, csrfProtection, (req, res) => {
  const q = String(req.query.q || "").trim();
  const status = String(req.query.status || "").trim();
  const where = [];
  const values = [];
  if (q) {
    where.push("(name LIKE ? OR email LIKE ? OR phone LIKE ? OR business LIKE ? OR industry LIKE ? OR city LIKE ?)");
    values.push(...Array(6).fill(`%${q}%`));
  }
  if (status) {
    where.push("status = ?");
    values.push(status);
  }
  const sql = `SELECT * FROM leads ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC LIMIT 200`;
  const leads = db.prepare(sql).all(...values);
  const html = `<form class="panel" method="get"><div style="display:flex;gap:8px;flex-wrap:wrap">
      <input name="q" value="${views.esc(q)}" placeholder="Search name, email, phone, business, industry, city">
      <select name="status"><option value="">All statuses</option>${["New","Contacted","Meeting Scheduled","Proposal Sent","Negotiation","Won","Lost"].map((s)=>`<option ${s===status?"selected":""}>${s}</option>`).join("")}</select>
      <button class="btn">Filter</button><a class="btn" href="${config.portalRoute}/crm/export/csv">CSV</a><a class="btn" href="${config.portalRoute}/crm/export/xlsx">Excel</a><a class="btn" href="${config.portalRoute}/crm/export/pdf">PDF</a>
    </div></form>
    <div class="panel"><table><thead><tr><th>Lead ID</th><th>Date</th><th>Name</th><th>Business</th><th>Industry</th><th>Service</th><th>Email</th><th>WhatsApp</th><th>Phone</th><th>City</th><th>Budget</th><th>Timeline</th><th>Contact</th><th>Status</th></tr></thead><tbody>
    ${leads.map((l)=>`<tr><td><a href="${config.portalRoute}/crm/${l.id}">${l.lead_code}</a></td><td>${l.date_created.slice(0,10)}</td><td>${views.esc(l.name)}</td><td>${views.esc(l.business||"")}</td><td>${views.esc(l.industry||"")}</td><td>${views.esc(l.service_product||"")}</td><td>${views.esc(l.email)}</td><td>${views.esc(l.whatsapp||"")}</td><td>${views.esc(l.phone||"")}</td><td>${views.esc(l.city||"")}</td><td>${views.esc(l.budget||"")}</td><td>${views.esc(l.timeline||"")}</td><td>${views.esc(l.preferred_contact_method||"")}</td><td><span class="badge">${views.esc(l.status)}</span></td></tr>`).join("")}
    </tbody></table></div>`;
  res.send(portalShell("CRM", html, req));
});

app.get(`${config.portalRoute}/crm/pipeline`, requireAuth, csrfProtection, (req, res) => {
  const leads = db.prepare("SELECT id,lead_code,name,status,service_product FROM leads ORDER BY id DESC LIMIT 400").all();
  const columns = ["New", "Contacted", "Meeting Scheduled", "Proposal Sent", "Negotiation", "Won", "Lost"];
  const html = `<div class="panel"><h3 style="margin-top:0">Lead Pipeline</h3><div class="kanban">
  ${columns
    .map(
      (s) => `<div class="col" data-status="${s}"><div style="display:flex;justify-content:space-between"><strong>${s}</strong><span class="badge">${leads.filter((l) => l.status === s).length}</span></div>
      <div class="drop">${leads
        .filter((l) => l.status === s)
        .map(
          (l) =>
            `<div class="lead" draggable="true" data-id="${l.id}"><div>${l.lead_code}</div><div class="muted">${views.esc(
              l.name
            )}</div><div class="muted">${views.esc(l.service_product || "")}</div></div>`
        )
        .join("")}</div></div>`
    )
    .join("")}</div></div>`;
  const script = `<script>
    let dragId=null;document.querySelectorAll('.lead').forEach((el)=>{el.addEventListener('dragstart',()=>dragId=el.dataset.id)});
    document.querySelectorAll('.col').forEach((c)=>{c.addEventListener('dragover',(e)=>e.preventDefault());c.addEventListener('drop',async(e)=>{e.preventDefault();if(!dragId)return;const status=c.dataset.status;await fetch('${config.portalRoute}/api/leads/'+dragId+'/status',{method:'POST',headers:{'Content-Type':'application/json','CSRF-Token':'${req.csrfToken()}'},body:JSON.stringify({status})});location.reload();});});
  </script>`;
  res.send(portalShell("CRM Pipeline", html, req, script));
});

app.post(`${config.portalRoute}/api/leads/:id/status`, requireAuth, csrfProtection, (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "");
  db.prepare("UPDATE leads SET status = ? WHERE id = ?").run(status, id);
  db.prepare("INSERT INTO activities (lead_id,user_id,action_type,description,created_at) VALUES (?,?,?,?,?)").run(
    id,
    req.session.user.id,
    "STATUS_CHANGE",
    `Moved to ${status}`,
    now()
  );
  audit(req, "LEAD_STATUS_CHANGE", `${id}:${status}`);
  res.json({ ok: true });
});

app.get(`${config.portalRoute}/crm/:id`, requireAuth, csrfProtection, (req, res) => {
  const id = Number(req.params.id);
  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  if (!lead) return res.status(404).send("Lead not found");
  const notes = db.prepare("SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY id DESC").all(id);
  const acts = db.prepare("SELECT * FROM activities WHERE lead_id = ? ORDER BY id DESC LIMIT 30").all(id);
  const html = `<div class="panel"><h3 style="margin-top:0">${lead.lead_code} • ${views.esc(lead.name)}</h3>
    <p class="muted">${views.esc(lead.service_product || "")} • ${views.esc(lead.status)}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
      <a class="btn" href="tel:${views.esc(lead.phone || "")}">Call</a>
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/${String(lead.whatsapp||"").replace(/\\D/g,'')}">Open WhatsApp</a>
      <a class="btn" href="mailto:${views.esc(lead.email)}">Send Email</a>
      <button class="btn" onclick="navigator.clipboard.writeText('${views.esc(lead.email)}')">Copy Email</button>
      <button class="btn" onclick="navigator.clipboard.writeText('${views.esc(lead.phone||"")}')">Copy Phone</button>
    </div>
    <p>${views.esc(lead.project_description || "")}</p>
    <form method="post" action="${config.portalRoute}/crm/${id}/note">
      <input type="hidden" name="_csrf" value="${req.csrfToken()}">
      <div class="row"><label>Add Note</label><textarea name="note" required></textarea></div>
      <button class="btn primary">Add Note</button>
    </form>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr">
    <div class="panel"><h4>Notes</h4>${notes.map((n)=>`<div class="card"><div class="muted">${n.created_at}</div>${views.esc(n.note)}</div>`).join("") || "<p class='muted'>No notes yet</p>"}</div>
    <div class="panel"><h4>Activity Timeline</h4>${acts.map((a)=>`<div class="card"><div class="muted">${a.created_at}</div>${views.esc(a.description)}</div>`).join("") || "<p class='muted'>No activity yet</p>"}</div>
  </div>`;
  res.send(portalShell("CRM Lead Details", html, req));
});

app.post(`${config.portalRoute}/crm/:id/note`, requireAuth, csrfProtection, (req, res) => {
  const id = Number(req.params.id);
  db.prepare("INSERT INTO lead_notes (lead_id,user_id,note,created_at) VALUES (?,?,?,?)").run(
    id,
    req.session.user.id,
    String(req.body.note || "").trim(),
    now()
  );
  db.prepare("INSERT INTO activities (lead_id,user_id,action_type,description,created_at) VALUES (?,?,?,?,?)").run(
    id,
    req.session.user.id,
    "NOTE",
    "Note added",
    now()
  );
  res.redirect(`${config.portalRoute}/crm/${id}`);
});

app.get(`${config.portalRoute}/crm/export/csv`, requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM leads ORDER BY id DESC").all();
  const headers = Object.keys(rows[0] || { lead_code: "", name: "", email: "" });
  const csv = [headers.join(",")]
    .concat(rows.map((r) => headers.map((h) => `"${String(r[h] ?? "").replaceAll('"', '""')}"`).join(",")))
    .join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
  res.send(csv);
});

app.get(`${config.portalRoute}/crm/export/xlsx`, requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM leads ORDER BY id DESC").all();
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Leads");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=leads.xlsx");
  res.send(buf);
});

app.get(`${config.portalRoute}/crm/export/pdf`, requireAuth, (req, res) => {
  const rows = db.prepare("SELECT lead_code,name,business,email,status FROM leads ORDER BY id DESC LIMIT 200").all();
  const doc = new PDFDocument({ margin: 30, size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=leads.pdf");
  doc.pipe(res);
  doc.fontSize(16).text("Onairo Leads Export");
  doc.moveDown();
  rows.forEach((r) => {
    doc.fontSize(10).text(`${r.lead_code} | ${r.name} | ${r.business || "-"} | ${r.email} | ${r.status}`);
  });
  doc.end();
});

app.get(`${config.portalRoute}/:module`, requireAuth, csrfProtection, (req, res) => {
  const moduleName = req.params.module;
  if (moduleName === "crm") return res.redirect(`${config.portalRoute}/crm`);
  if (moduleName === "dashboard") return res.redirect(config.portalRoute);
  const text = `<div class="panel"><h2 style="margin-top:0">${moduleName[0].toUpperCase() + moduleName.slice(1)}</h2>
    <p class="muted">Placeholder module ready for future expansion.</p>
    <ul><li>Role-based permissions ready</li><li>Future two-factor auth ready</li><li>API and UI layers separated in server routes/data layer</li></ul></div>`;
  res.send(portalShell(moduleName, text, req));
});

app.post("/api/enquiries/contact", formLimiter, upload.none(), async (req, res) => {
  const payload = req.body || {};
  if (!payload.name || !payload.message || !payload.email) {
    return res.status(400).json({ ok: false, error: "Missing required fields." });
  }
  const cm = db
    .prepare(
      `INSERT INTO contact_messages (name,business,topic,email,whatsapp,phone,city,message,created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(
      payload.name,
      payload.business || null,
      payload.topic || null,
      payload.email,
      payload.whatsapp || null,
      payload.phone || null,
      payload.city || null,
      payload.message,
      now()
    );
  const lead = insertLead({
    sourceType: "contact",
    sourceRefId: cm.lastInsertRowid,
    name: payload.name,
    business: payload.business,
    industry: payload.industry,
    serviceProduct: payload.topic || "General inquiry",
    email: payload.email,
    whatsapp: payload.whatsapp,
    phone: payload.phone,
    city: payload.city,
    preferredContactMethod: payload.preferredContactMethod,
    projectDescription: payload.message,
    websiteUrl: payload.website || null,
  });
  db.prepare("INSERT INTO activities (lead_id,action_type,description,created_at) VALUES (?,?,?,?)").run(
    lead.id,
    "LEAD_CREATED",
    "Lead created from contact form",
    now()
  );
  await sendConfirmationEmail(payload.email, payload.name).catch(() => {});
  res.json({ ok: true, leadCode: lead.lead_code });
});

app.post("/api/enquiries/quote", formLimiter, upload.array("attachments", 5), async (req, res) => {
  const p = req.body || {};
  if (!p.fullName || !p.businessName || !p.email || !p.projectDescription) {
    return res.status(400).json({ ok: false, error: "Missing required fields." });
  }
  const files = (req.files || []).map((f) => ({ name: f.originalname, path: f.filename, size: f.size }));
  const qr = db
    .prepare(
      `INSERT INTO quote_requests (full_name,business_name,industry,interested_in,email,whatsapp,phone,city,budget,timeline,preferred_contact_method,project_description,website_url,attachments_json,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      p.fullName,
      p.businessName,
      p.industry || null,
      p.interestedIn || null,
      p.email,
      p.whatsapp || null,
      p.phone || null,
      p.city || null,
      p.budget || null,
      p.timeline || null,
      p.preferredContactMethod || null,
      p.projectDescription,
      p.website || null,
      JSON.stringify(files),
      now()
    );
  const lead = insertLead({
    sourceType: "quote",
    sourceRefId: qr.lastInsertRowid,
    name: p.fullName,
    business: p.businessName,
    industry: p.industry,
    serviceProduct: p.interestedIn,
    email: p.email,
    whatsapp: p.whatsapp,
    phone: p.phone,
    city: p.city,
    budget: p.budget,
    timeline: p.timeline,
    preferredContactMethod: p.preferredContactMethod,
    projectDescription: p.projectDescription,
    websiteUrl: p.website || null,
    metadataJson: { attachments: files },
  });
  db.prepare("INSERT INTO activities (lead_id,action_type,description,created_at) VALUES (?,?,?,?)").run(
    lead.id,
    "LEAD_CREATED",
    "Lead created from quote form",
    now()
  );
  await sendConfirmationEmail(p.email, p.fullName).catch(() => {});
  res.json({ ok: true, leadCode: lead.lead_code });
});

app.use(express.static(config.rootDir, { index: "index.html" }));

module.exports = app;
