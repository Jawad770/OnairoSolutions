/**
 * Modules unlocked by the role system: support tickets (with assignment and
 * ownership scoping), invoices/payments, and the blog + portfolio publishing
 * workflow. Each route is permission-guarded on the server.
 */

const config = require("./config");
const views = require("./portalViews");
const { audit } = require("./audit");
const { state, persist, nextId, now } = require("./db");
const authz = require("./authz");

const { esc } = views;
const R = config.portalRoute;

const TICKET_STATUSES = ["Open", "In Progress", "Waiting on Customer", "Resolved", "Closed"];
const TICKET_PRIORITIES = ["Low", "Normal", "High", "Urgent"];
const INVOICE_STATUSES = ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"];
const CONTENT_STATUSES = ["Draft", "In Review", "Approved", "Published", "Archived"];
/** Approved/Published are gated on the module's `publish` permission. */
const PUBLISH_STATUSES = ["Approved", "Published"];

function pad(id) {
  return String(id).padStart(6, "0");
}

function flash(req) {
  const notice = req.query.notice ? `<div class="notice">${esc(req.query.notice)}</div>` : "";
  const error = req.query.error ? `<div class="error">${esc(req.query.error)}</div>` : "";
  return notice + error;
}

function redirectWith(res, path, params) {
  const qs = new URLSearchParams(params).toString();
  res.redirect(`${path}${qs ? `?${qs}` : ""}`);
}

function userLabel(id) {
  const user = authz.userById(id);
  return user ? user.full_name || user.email : "Unassigned";
}

function assignableUsers(permission) {
  return state.users.filter((u) => authz.isActive(u) && authz.permissionsOf(u.id).has(permission));
}

function selectOptions(values, current) {
  return values.map((v) => `<option value="${esc(v)}" ${v === current ? "selected" : ""}>${esc(v)}</option>`).join("");
}

module.exports = function registerModuleRoutes({ app, csrf, token, portalShell }) {
  const guard = [authz.requireAuth, authz.requireActiveUser];

  /* ---------------------------------------------------------------- *
   * Support tickets
   * ---------------------------------------------------------------- */

  /** Tickets the caller may read: all of them, or only their assignments. */
  function visibleTickets(req) {
    if (authz.can(req, "support.view_all")) return state.tickets.slice();
    const uid = Number(req.session.user.id);
    return state.tickets.filter((t) => Number(t.assigned_user_id) === uid);
  }

  app.get(`${R}/support`, ...guard, authz.requirePermission("support.view"), (req, res) => {
    const scoped = !authz.can(req, "support.view_all");
    const statusFilter = String(req.query.status || "");
    let rows = visibleTickets(req).reverse();
    if (statusFilter) rows = rows.filter((t) => t.status === statusFilter);
    const canCreate = authz.can(req, "support.create");
    const canAssign = authz.can(req, "support.assign");
    const unassigned = authz.can(req, "support.view_all") ? state.tickets.filter((t) => !t.assigned_user_id).length : 0;

    const inner = `${flash(req)}
    <div class="grid cards">
      <div class="card"><div class="k">${scoped ? "My open tickets" : "Open tickets"}</div><div class="v">${rows.filter((t) => t.status === "Open" || t.status === "In Progress").length}</div></div>
      <div class="card"><div class="k">Awaiting response</div><div class="v">${rows.filter((t) => t.status === "Waiting on Customer").length}</div></div>
      ${canAssign ? `<div class="card"><div class="k">Unassigned</div><div class="v">${unassigned}</div></div>` : ""}
      <div class="card"><div class="k">Resolved</div><div class="v">${rows.filter((t) => t.status === "Resolved" || t.status === "Closed").length}</div></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <div><strong>${scoped ? "My Tickets" : "Support Tickets"}</strong><div class="muted">${scoped ? "You only see tickets assigned to you." : "All customer tickets"}</div></div>
        <form class="toolbar" method="get"><select name="status"><option value="">All statuses</option>${selectOptions(TICKET_STATUSES, statusFilter)}</select><button class="btn sm">Filter</button></form>
      </div>
      <table class="stack">
        <thead><tr><th>Ticket</th><th>Subject</th><th>Priority</th><th>Status</th><th>Assigned to</th><th>Created</th><th></th></tr></thead>
        <tbody>${rows
          .map((t) => `<tr>
            <td data-label="Ticket">${esc(t.ticket_code)}</td>
            <td data-label="Subject">${esc(t.subject)}</td>
            <td data-label="Priority"><span class="badge">${esc(t.priority)}</span></td>
            <td data-label="Status"><span class="badge ${t.status === "Resolved" || t.status === "Closed" ? "ok" : "warn"}">${esc(t.status)}</span></td>
            <td data-label="Assigned to">${esc(userLabel(t.assigned_user_id))}</td>
            <td data-label="Created">${esc(String(t.created_at).slice(0, 10))}</td>
            <td data-label=""><a class="btn sm" href="${R}/support/${t.id}">Open</a></td>
          </tr>`)
          .join("") || `<tr><td colspan="7" class="muted">No tickets to show.</td></tr>`}
        </tbody>
      </table>
    </div>
    ${canCreate ? `<div class="panel" style="max-width:640px">
      <strong>New ticket</strong>
      <form method="post" action="${R}/support" style="margin-top:10px">
        <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
        <div class="row"><label>Subject *</label><input name="subject" required></div>
        <div class="row"><label>Customer / client</label><input name="customer"></div>
        <div class="row2">
          <div class="row"><label>Priority</label><select name="priority">${selectOptions(TICKET_PRIORITIES, "Normal")}</select></div>
          ${canAssign ? `<div class="row"><label>Assign to</label><select name="assignedUserId"><option value="">Unassigned</option>${assignableUsers("support.view")
            .map((u) => `<option value="${u.id}">${esc(u.full_name || u.email)}</option>`)
            .join("")}</select></div>` : ""}
        </div>
        <div class="row"><label>Description</label><textarea name="description"></textarea></div>
        <button class="btn primary" type="submit">Create ticket</button>
      </form>
    </div>` : ""}`;
    res.send(portalShell(scoped ? "My Tickets" : "Support", inner, req));
  });

  app.post(`${R}/support`, ...guard, csrf, authz.requirePermission("support.create"), (req, res) => {
    const b = req.body || {};
    if (!String(b.subject || "").trim()) return redirectWith(res, `${R}/support`, { error: "Subject is required." });
    const id = nextId("tickets");
    // Agents without assign rights can only file tickets onto themselves.
    const assignedUserId = authz.can(req, "support.assign")
      ? Number(b.assignedUserId) || null
      : Number(req.session.user.id);
    const ticket = {
      id,
      ticket_code: `TK-${pad(id)}`,
      subject: String(b.subject).trim(),
      customer: String(b.customer || "").trim() || null,
      description: String(b.description || "").trim() || null,
      priority: TICKET_PRIORITIES.includes(b.priority) ? b.priority : "Normal",
      status: "Open",
      assigned_user_id: assignedUserId,
      assigned_at: assignedUserId ? now() : null,
      assigned_by: assignedUserId ? Number(req.session.user.id) : null,
      created_by: Number(req.session.user.id),
      created_at: now(),
      updated_at: now(),
    };
    state.tickets.push(ticket);
    persist();
    audit(req, "TICKET_CREATED", { targetType: "ticket", targetId: ticket.id, next: { subject: ticket.subject, assigned_user_id: assignedUserId } });
    redirectWith(res, `${R}/support/${ticket.id}`, { notice: `${ticket.ticket_code} created.` });
  });

  const loadTicket = (req) => state.tickets.find((t) => t.id === Number(req.params.id)) || null;

  app.get(
    `${R}/support/:id`,
    ...guard,
    authz.requirePermission("support.view"),
    authz.requireOwnershipOrPermission("assigned_user_id", "support.view_all", loadTicket),
    (req, res) => {
      const ticket = req.record;
      const notes = state.ticketNotes.filter((n) => n.ticket_id === ticket.id).slice().reverse();
      const canUpdate = authz.can(req, "support.update");
      const canAssign = authz.can(req, "support.assign");
      const csrfField = `<input type="hidden" name="CSRFToken" value="${esc(token(req))}">`;
      const inner = `${flash(req)}
      <div class="panel">
        <div class="panel-head">
          <div><strong>${esc(ticket.ticket_code)} • ${esc(ticket.subject)}</strong>
          <div class="muted">${esc(ticket.customer || "No customer")} • ${esc(ticket.status)} • ${esc(ticket.priority)} • ${esc(userLabel(ticket.assigned_user_id))}</div></div>
          <a class="btn sm" href="${R}/support">Back</a>
        </div>
        ${ticket.description ? `<p style="color:var(--muted);line-height:1.6">${esc(ticket.description)}</p>` : ""}
        ${canUpdate ? `<form method="post" action="${R}/support/${ticket.id}/update">
          ${csrfField}
          <div class="row2">
            <div class="row"><label>Status</label><select name="status">${selectOptions(TICKET_STATUSES, ticket.status)}</select></div>
            <div class="row"><label>Priority</label><select name="priority">${selectOptions(TICKET_PRIORITIES, ticket.priority)}</select></div>
          </div>
          ${canAssign ? `<div class="row"><label>Assign to</label><select name="assignedUserId"><option value="">Unassigned</option>${assignableUsers("support.view")
            .map((u) => `<option value="${u.id}" ${Number(ticket.assigned_user_id) === u.id ? "selected" : ""}>${esc(u.full_name || u.email)}</option>`)
            .join("")}</select></div>` : ""}
          <button class="btn primary" type="submit">Save ticket</button>
        </form>` : `<p class="muted">Read-only access.</p>`}
      </div>
      ${canUpdate ? `<div class="panel">
        <strong>Add internal note / reply</strong>
        <form method="post" action="${R}/support/${ticket.id}/note" style="margin-top:10px">
          ${csrfField}
          <div class="row"><textarea name="note" required placeholder="Reply or internal note"></textarea></div>
          <div class="row" style="display:flex;gap:8px;align-items:center"><input style="width:auto" type="checkbox" id="int" name="internal" checked><label for="int" style="margin:0">Internal note (not shared with customer)</label></div>
          <button class="btn" type="submit">Add note</button>
        </form>
      </div>` : ""}
      <div class="panel">
        <strong>History</strong>
        ${notes
          .map((n) => `<div class="card" style="margin-top:10px"><div class="muted">${esc(String(n.created_at).slice(0, 19).replace("T", " "))} • ${esc(userLabel(n.user_id))} • ${n.internal ? "internal" : "reply"}</div>${esc(n.note)}</div>`)
          .join("") || '<p class="muted">No notes yet.</p>'}
      </div>`;
      res.send(portalShell("Support", inner, req));
    }
  );

  app.post(
    `${R}/support/:id/update`,
    ...guard,
    csrf,
    authz.requirePermission("support.update"),
    authz.requireOwnershipOrPermission("assigned_user_id", "support.view_all", loadTicket),
    (req, res) => {
      const ticket = req.record;
      const previous = { status: ticket.status, priority: ticket.priority, assigned_user_id: ticket.assigned_user_id };
      if (TICKET_STATUSES.includes(req.body.status)) ticket.status = req.body.status;
      if (TICKET_PRIORITIES.includes(req.body.priority)) ticket.priority = req.body.priority;
      if (authz.can(req, "support.assign") && req.body.assignedUserId !== undefined) {
        const target = Number(req.body.assignedUserId) || null;
        if (target !== Number(ticket.assigned_user_id)) {
          ticket.assigned_user_id = target;
          ticket.assigned_at = target ? now() : null;
          ticket.assigned_by = target ? Number(req.session.user.id) : null;
        }
      }
      ticket.updated_at = now();
      persist();
      audit(req, "TICKET_UPDATED", {
        targetType: "ticket",
        targetId: ticket.id,
        previous,
        next: { status: ticket.status, priority: ticket.priority, assigned_user_id: ticket.assigned_user_id },
      });
      redirectWith(res, `${R}/support/${ticket.id}`, { notice: "Ticket updated." });
    }
  );

  app.post(
    `${R}/support/:id/note`,
    ...guard,
    csrf,
    authz.requirePermission("support.update"),
    authz.requireOwnershipOrPermission("assigned_user_id", "support.view_all", loadTicket),
    (req, res) => {
      const ticket = req.record;
      const note = String(req.body.note || "").trim();
      if (!note) return redirectWith(res, `${R}/support/${ticket.id}`, { error: "Note cannot be empty." });
      state.ticketNotes.push({
        id: nextId("ticketNotes"),
        ticket_id: ticket.id,
        user_id: Number(req.session.user.id),
        note,
        internal: req.body.internal === "on" ? 1 : 0,
        created_at: now(),
      });
      ticket.updated_at = now();
      persist();
      audit(req, "TICKET_NOTE_ADDED", { targetType: "ticket", targetId: ticket.id });
      redirectWith(res, `${R}/support/${ticket.id}`, { notice: "Note added." });
    }
  );

  /* ---------------------------------------------------------------- *
   * Invoices & payments
   * ---------------------------------------------------------------- */

  app.get(`${R}/invoices`, ...guard, authz.requirePermission("invoices.view"), (req, res) => {
    const rows = state.invoices.slice().reverse();
    const canCreate = authz.can(req, "invoices.create");
    const canUpdate = authz.can(req, "invoices.update");
    const paid = rows.filter((i) => i.status === "Paid");
    const outstanding = rows.filter((i) => !["Paid", "Cancelled"].includes(i.status));
    const sum = (list) => list.reduce((total, i) => total + Number(i.amount || 0), 0);
    const month = new Date().toISOString().slice(0, 7);

    const inner = `${flash(req)}
    <div class="grid cards">
      <div class="card"><div class="k">Outstanding invoices</div><div class="v">${outstanding.length}</div></div>
      <div class="card"><div class="k">Outstanding value</div><div class="v">${sum(outstanding).toLocaleString()}</div></div>
      <div class="card"><div class="k">Paid this month</div><div class="v">${sum(paid.filter((i) => String(i.paid_at || "").slice(0, 7) === month)).toLocaleString()}</div></div>
      <div class="card"><div class="k">Recent payments</div><div class="v">${state.payments.length}</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><strong>Invoices</strong></div>
      <table class="stack">
        <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Status</th><th>Issued</th><th>Due</th>${canUpdate ? "<th>Update</th>" : ""}</tr></thead>
        <tbody>${rows
          .map((i) => `<tr>
            <td data-label="Invoice">${esc(i.invoice_no)}</td>
            <td data-label="Client">${esc(i.client_name)}</td>
            <td data-label="Amount">${esc(i.currency)} ${Number(i.amount).toLocaleString()}</td>
            <td data-label="Status"><span class="badge ${i.status === "Paid" ? "ok" : i.status === "Overdue" ? "off" : "warn"}">${esc(i.status)}</span></td>
            <td data-label="Issued">${esc(String(i.issued_at).slice(0, 10))}</td>
            <td data-label="Due">${esc(i.due_at ? String(i.due_at).slice(0, 10) : "—")}</td>
            ${canUpdate ? `<td data-label="Update"><form method="post" action="${R}/invoices/${i.id}/status" class="actions">
              <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
              <select name="status" style="width:auto">${selectOptions(INVOICE_STATUSES, i.status)}</select>
              <button class="btn sm" type="submit">Save</button>
            </form></td>` : ""}
          </tr>`)
          .join("") || `<tr><td colspan="7" class="muted">No invoices yet.</td></tr>`}
        </tbody>
      </table>
    </div>
    ${canCreate ? `<div class="panel" style="max-width:640px">
      <strong>New invoice</strong>
      <form method="post" action="${R}/invoices" style="margin-top:10px">
        <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
        <div class="row"><label>Client name *</label><input name="clientName" required></div>
        <div class="row2">
          <div class="row"><label>Amount *</label><input type="number" step="0.01" min="0" name="amount" required></div>
          <div class="row"><label>Currency</label><input name="currency" value="PKR"></div>
        </div>
        <div class="row2">
          <div class="row"><label>Due date</label><input type="date" name="dueAt"></div>
          <div class="row"><label>Status</label><select name="status">${selectOptions(INVOICE_STATUSES, "Draft")}</select></div>
        </div>
        <button class="btn primary" type="submit">Create invoice</button>
      </form>
    </div>` : ""}`;
    res.send(portalShell("Invoices", inner, req));
  });

  app.post(`${R}/invoices`, ...guard, csrf, authz.requirePermission("invoices.create"), (req, res) => {
    const b = req.body || {};
    const amount = Number(b.amount);
    if (!String(b.clientName || "").trim() || !Number.isFinite(amount)) {
      return redirectWith(res, `${R}/invoices`, { error: "Client name and a valid amount are required." });
    }
    const id = nextId("invoices");
    const invoice = {
      id,
      invoice_no: `INV-${pad(id)}`,
      client_name: String(b.clientName).trim(),
      amount,
      currency: String(b.currency || "PKR").trim().slice(0, 6),
      status: INVOICE_STATUSES.includes(b.status) ? b.status : "Draft",
      issued_at: now(),
      due_at: b.dueAt || null,
      paid_at: null,
      created_by: Number(req.session.user.id),
      created_at: now(),
      updated_at: now(),
    };
    state.invoices.push(invoice);
    persist();
    audit(req, "INVOICE_CREATED", { targetType: "invoice", targetId: invoice.id, next: { amount, status: invoice.status } });
    redirectWith(res, `${R}/invoices`, { notice: `${invoice.invoice_no} created.` });
  });

  app.post(`${R}/invoices/:id/status`, ...guard, csrf, authz.requirePermission("invoices.update"), (req, res) => {
    const invoice = state.invoices.find((i) => i.id === Number(req.params.id));
    if (!invoice) return res.status(404).send("Not found");
    const status = String(req.body.status || "");
    if (!INVOICE_STATUSES.includes(status)) return redirectWith(res, `${R}/invoices`, { error: "Invalid status." });
    const previous = invoice.status;
    invoice.status = status;
    invoice.updated_at = now();
    if (status === "Paid" && !invoice.paid_at) {
      invoice.paid_at = now();
      state.payments.push({
        id: nextId("payments"),
        invoice_id: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        recorded_by: Number(req.session.user.id),
        created_at: now(),
      });
    }
    persist();
    audit(req, "INVOICE_UPDATED", { targetType: "invoice", targetId: invoice.id, previous: { status: previous }, next: { status } });
    redirectWith(res, `${R}/invoices`, { notice: `${invoice.invoice_no} marked ${status}.` });
  });

  /* ---------------------------------------------------------------- *
   * Content workflow: blog + portfolio
   * ---------------------------------------------------------------- */

  function contentModule(moduleKey, collection, label) {
    app.get(`${R}/${moduleKey}`, ...guard, authz.requirePermission(`${moduleKey}.view`), (req, res) => {
      const rows = state[collection].slice().reverse();
      const canCreate = authz.can(req, `${moduleKey}.create`);
      const canUpdate = authz.can(req, `${moduleKey}.update`);
      const canPublish = authz.can(req, `${moduleKey}.publish`);
      const count = (status) => rows.filter((r) => r.status === status).length;

      const inner = `${flash(req)}
      <div class="grid cards">
        <div class="card"><div class="k">Drafts</div><div class="v">${count("Draft")}</div></div>
        <div class="card"><div class="k">Awaiting approval</div><div class="v">${count("In Review")}</div></div>
        <div class="card"><div class="k">Approved</div><div class="v">${count("Approved")}</div></div>
        <div class="card"><div class="k">Published</div><div class="v">${count("Published")}</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><strong>${esc(label)}</strong><div class="muted">${canPublish ? "You can approve and publish content." : "Publishing requires Super Admin approval."}</div></div></div>
        <table class="stack">
          <thead><tr><th>Title</th><th>Status</th><th>Updated</th>${canUpdate ? "<th>Workflow</th>" : ""}</tr></thead>
          <tbody>${rows
            .map((item) => {
              const options = CONTENT_STATUSES.filter((s) => canPublish || !PUBLISH_STATUSES.includes(s) || s === item.status);
              return `<tr>
              <td data-label="Title"><strong>${esc(item.title)}</strong><div class="muted">${esc(item.slug)}</div></td>
              <td data-label="Status"><span class="badge ${item.status === "Published" ? "ok" : item.status === "Archived" ? "off" : "warn"}">${esc(item.status)}</span></td>
              <td data-label="Updated">${esc(String(item.updated_at).slice(0, 10))}</td>
              ${canUpdate ? `<td data-label="Workflow"><form method="post" action="${R}/${moduleKey}/${item.id}/status" class="actions">
                <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
                <select name="status" style="width:auto">${selectOptions(options, item.status)}</select>
                <button class="btn sm" type="submit">Save</button>
              </form></td>` : ""}
            </tr>`;
            })
            .join("") || `<tr><td colspan="4" class="muted">No ${esc(label.toLowerCase())} yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${canCreate ? `<div class="panel" style="max-width:640px">
        <strong>New entry</strong>
        <form method="post" action="${R}/${moduleKey}" style="margin-top:10px">
          <input type="hidden" name="CSRFToken" value="${esc(token(req))}">
          <div class="row"><label>Title *</label><input name="title" required></div>
          <div class="row"><label>Summary</label><textarea name="summary"></textarea></div>
          <button class="btn primary" type="submit">Save as draft</button>
        </form>
      </div>` : ""}`;
      res.send(portalShell(label, inner, req));
    });

    app.post(`${R}/${moduleKey}`, ...guard, csrf, authz.requirePermission(`${moduleKey}.create`), (req, res) => {
      const title = String(req.body.title || "").trim();
      if (!title) return redirectWith(res, `${R}/${moduleKey}`, { error: "Title is required." });
      const item = {
        id: nextId(collection),
        title,
        slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        summary: String(req.body.summary || "").trim() || null,
        status: "Draft",
        created_by: Number(req.session.user.id),
        published_by: null,
        published_at: null,
        created_at: now(),
        updated_at: now(),
      };
      state[collection].push(item);
      persist();
      audit(req, `${moduleKey.toUpperCase()}_CREATED`, { targetType: moduleKey, targetId: item.id, next: { title, status: "Draft" } });
      redirectWith(res, `${R}/${moduleKey}`, { notice: "Saved as draft." });
    });

    app.post(`${R}/${moduleKey}/:id/status`, ...guard, csrf, authz.requirePermission(`${moduleKey}.update`), (req, res) => {
      const item = state[collection].find((i) => i.id === Number(req.params.id));
      if (!item) return res.status(404).send("Not found");
      const status = String(req.body.status || "");
      if (!CONTENT_STATUSES.includes(status)) return redirectWith(res, `${R}/${moduleKey}`, { error: "Invalid status." });
      // Approval/publishing is a separate permission from editing.
      if (PUBLISH_STATUSES.includes(status) && !authz.can(req, `${moduleKey}.publish`)) {
        audit(req, `${moduleKey.toUpperCase()}_PUBLISH`, { targetType: moduleKey, targetId: item.id, result: "failure", detail: `Blocked transition to ${status}` });
        return authz.forbidden(req, res, `Publishing requires the ${moduleKey}.publish permission.`);
      }
      const previous = item.status;
      item.status = status;
      item.updated_at = now();
      if (status === "Published") {
        item.published_at = now();
        item.published_by = Number(req.session.user.id);
      }
      persist();
      audit(req, `${moduleKey.toUpperCase()}_STATUS_CHANGED`, {
        targetType: moduleKey,
        targetId: item.id,
        previous: { status: previous },
        next: { status },
      });
      redirectWith(res, `${R}/${moduleKey}`, { notice: `Moved to ${status}.` });
    });
  }

  contentModule("blog", "blogPosts", "Blog");
  contentModule("portfolio", "portfolioItems", "Portfolio");
};
