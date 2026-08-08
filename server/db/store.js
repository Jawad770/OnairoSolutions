/**
 * PostgreSQL-backed state load/save for the Onairo portal.
 * Route handlers keep the existing in-memory `state` API; this module
 * is the sole persistence boundary to Prisma / onairo_core.
 *
 * IMPORTANT: saveState never wipe-and-rebuilds. It upserts rows and syncs
 * association tables per parent id only. Soft-deleted rows stay soft-deleted.
 */
const { prisma } = require("./prisma");
const m = require("./mappers");

async function upsertById(tx, delegate, data) {
  if (!data || data.id == null) return;
  const { id, ...rest } = data;
  await delegate.upsert({
    where: { id },
    create: { id, ...rest },
    update: rest,
  });
}

function emptyState() {
  return {
    users: [],
    leads: [],
    leadNotes: [],
    activities: [],
    clients: [],
    projects: [],
    contactMessages: [],
    quoteRequests: [],
    newsletterSubscribers: [],
    settings: [],
    auditLogs: [],
    loginAttempts: [],
    roles: [],
    permissions: [],
    rolePermissions: [],
    userRoles: [],
    invitations: [],
    sessions: [],
    tickets: [],
    ticketNotes: [],
    invoices: [],
    payments: [],
    blogPosts: [],
    portfolioItems: [],
    counters: {},
  };
}

function roleFromDb(row) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    level: row.level,
    is_system: row.isSystem,
    permissions_customized: row.permissionsCustomized,
    created_by: row.createdBy,
    created_at: m.iso(row.createdAt),
    updated_at: m.iso(row.updatedAt),
  };
}

function roleToDb(row) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description ?? null,
    level: row.level ?? 10,
    isSystem: row.is_system ? 1 : 0,
    permissionsCustomized: row.permissions_customized ? 1 : 0,
    createdBy: row.created_by ?? null,
    createdAt: m.asDateRequired(row.created_at),
    updatedAt: m.asDateRequired(row.updated_at),
  };
}

function permissionFromDb(row) {
  return {
    id: row.id,
    key: row.key,
    module: row.module,
    action: row.action,
    label: row.label,
  };
}

function permissionToDb(row) {
  return {
    id: row.id,
    key: row.key,
    module: row.module,
    action: row.action,
    label: row.label,
  };
}

function noteFromDb(row) {
  return {
    id: row.id,
    lead_id: row.leadId,
    user_id: row.userId,
    note: row.note,
    created_at: m.iso(row.createdAt),
  };
}

function activityFromDb(row) {
  return {
    id: row.id,
    lead_id: row.leadId,
    user_id: row.userId,
    action_type: row.actionType,
    description: row.description,
    created_at: m.iso(row.createdAt),
  };
}

function contactFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    business: row.business,
    topic: row.topic,
    email: row.email,
    whatsapp: row.whatsapp,
    phone: row.phone,
    city: row.city,
    country: row.country,
    country_code: row.countryCode,
    dial_code: row.dialCode,
    phone_number: row.phoneNumber,
    message: row.message,
    created_at: m.iso(row.createdAt),
  };
}

function quoteFromDb(row) {
  return {
    id: row.id,
    full_name: row.fullName,
    business_name: row.businessName,
    industry: row.industry,
    interested_in: row.interestedIn,
    email: row.email,
    whatsapp: row.whatsapp,
    phone: row.phone,
    city: row.city,
    country: row.country,
    country_code: row.countryCode,
    dial_code: row.dialCode,
    phone_number: row.phoneNumber,
    budget: row.budget,
    timeline: row.timeline,
    preferred_contact_method: row.preferredContactMethod,
    project_description: row.projectDescription,
    website_url: row.websiteUrl,
    attachments_json: row.attachmentsJson,
    created_at: m.iso(row.createdAt),
  };
}

function newsletterFromDb(row) {
  return {
    id: row.id,
    email: row.email,
    source: row.source,
    created_at: m.iso(row.createdAt),
  };
}

function clientFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    business: row.business,
    assigned_user_id: row.assignedUserId,
    metadata_json: row.metadataJson,
    created_at: m.iso(row.createdAt),
    updated_at: m.iso(row.updatedAt),
  };
}

function projectFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    client_id: row.clientId,
    status: row.status,
    metadata_json: row.metadataJson,
    created_at: m.iso(row.createdAt),
    updated_at: m.iso(row.updatedAt),
  };
}

function ticketFromDb(row) {
  return {
    id: row.id,
    ticket_code: row.ticketCode,
    subject: row.subject,
    customer: row.customer,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assigned_user_id: row.assignedUserId,
    assigned_at: m.iso(row.assignedAt),
    assigned_by: row.assignedBy,
    created_by: row.createdBy,
    created_at: m.iso(row.createdAt),
    updated_at: m.iso(row.updatedAt),
  };
}

function ticketNoteFromDb(row) {
  return {
    id: row.id,
    ticket_id: row.ticketId,
    user_id: row.userId,
    note: row.note,
    internal: row.internal,
    created_at: m.iso(row.createdAt),
  };
}

function invoiceFromDb(row) {
  return {
    id: row.id,
    invoice_no: row.invoiceNo,
    client_name: row.clientName,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    issued_at: m.iso(row.issuedAt),
    due_at: m.iso(row.dueAt),
    paid_at: m.iso(row.paidAt),
    created_by: row.createdBy,
    created_at: m.iso(row.createdAt),
    updated_at: m.iso(row.updatedAt),
  };
}

function paymentFromDb(row) {
  return {
    id: row.id,
    invoice_id: row.invoiceId,
    amount: Number(row.amount),
    currency: row.currency,
    recorded_by: row.recordedBy,
    created_at: m.iso(row.createdAt),
  };
}

function blogFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    status: row.status,
    created_by: row.createdBy,
    published_by: row.publishedBy,
    published_at: m.iso(row.publishedAt),
    created_at: m.iso(row.createdAt),
    updated_at: m.iso(row.updatedAt),
  };
}

function portfolioFromDb(row) {
  return blogFromDb(row);
}

function invitationFromDb(row) {
  return {
    id: row.id,
    user_id: row.userId,
    email: row.email,
    role_id: row.roleId,
    token_hash: row.tokenHash,
    status: row.status,
    expires_at: m.iso(row.expiresAt),
    used_at: m.iso(row.usedAt),
    created_by: row.createdBy,
    created_at: m.iso(row.createdAt),
  };
}

function sessionFromDb(row) {
  return {
    id: row.id,
    sid: row.sid,
    user_id: row.userId,
    created_at: m.iso(row.createdAt),
    last_seen_at: m.iso(row.lastSeenAt),
    ip_hash: row.ipHash,
    user_agent: row.userAgent,
    revoked_at: m.iso(row.revokedAt),
  };
}

function loginAttemptFromDb(row) {
  return {
    id: row.id,
    email: row.email,
    success: row.success,
    ip_hash: row.ipHash,
    created_at: m.iso(row.createdAt),
  };
}

async function loadState() {
  const state = emptyState();
  const [
    users,
    roles,
    permissions,
    rolePermissions,
    userRoles,
    invitations,
    sessions,
    loginAttempts,
    leads,
    leadNotes,
    activities,
    clients,
    projects,
    contacts,
    quotes,
    newsletters,
    blogs,
    portfolios,
    invoices,
    payments,
    tickets,
    ticketNotes,
    audits,
    settings,
    counters,
  ] = await Promise.all([
    prisma.user.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.role.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.permission.findMany({ orderBy: { id: "asc" } }),
    prisma.rolePermission.findMany({ orderBy: { id: "asc" } }),
    prisma.userRole.findMany({ orderBy: { id: "asc" } }),
    prisma.invitation.findMany({ orderBy: { id: "asc" } }),
    prisma.appSession.findMany({ orderBy: { id: "asc" } }),
    prisma.loginAttempt.findMany({ orderBy: { id: "asc" } }),
    prisma.lead.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.leadNote.findMany({ orderBy: { id: "asc" } }),
    prisma.leadActivity.findMany({ orderBy: { id: "asc" } }),
    prisma.client.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.project.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.contactForm.findMany({ orderBy: { id: "asc" } }),
    prisma.quoteRequest.findMany({ orderBy: { id: "asc" } }),
    prisma.newsletterSubscriber.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.blogPost.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.portfolioItem.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.invoice.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.payment.findMany({ orderBy: { id: "asc" } }),
    prisma.supportTicket.findMany({ where: { deletedAt: null }, orderBy: { id: "asc" } }),
    prisma.supportTicketNote.findMany({ orderBy: { id: "asc" } }),
    prisma.auditLog.findMany({ orderBy: { id: "asc" } }),
    prisma.systemSetting.findMany({ orderBy: { id: "asc" } }),
    prisma.idCounter.findMany(),
  ]);

  state.users = users.map(m.userFromDb);
  state.roles = roles.map(roleFromDb);
  state.permissions = permissions.map(permissionFromDb);
  state.rolePermissions = rolePermissions.map((r) => ({
    id: r.id,
    role_id: r.roleId,
    permission_id: r.permissionId,
  }));
  state.userRoles = userRoles.map((r) => ({
    id: r.id,
    user_id: r.userId,
    role_id: r.roleId,
    assigned_at: m.iso(r.assignedAt),
    assigned_by: r.assignedBy,
  }));
  state.invitations = invitations.map(invitationFromDb);
  state.sessions = sessions.map(sessionFromDb);
  state.loginAttempts = loginAttempts.map(loginAttemptFromDb);
  state.leads = leads.map(m.leadFromDb);
  state.leadNotes = leadNotes.map(noteFromDb);
  state.activities = activities.map(activityFromDb);
  state.clients = clients.map(clientFromDb);
  state.projects = projects.map(projectFromDb);
  state.contactMessages = contacts.map(contactFromDb);
  state.quoteRequests = quotes.map(quoteFromDb);
  state.newsletterSubscribers = newsletters.map(newsletterFromDb);
  state.blogPosts = blogs.map(blogFromDb);
  state.portfolioItems = portfolios.map(portfolioFromDb);
  state.invoices = invoices.map(invoiceFromDb);
  state.payments = payments.map(paymentFromDb);
  state.tickets = tickets.map(ticketFromDb);
  state.ticketNotes = ticketNotes.map(ticketNoteFromDb);
  state.auditLogs = audits.map(m.auditFromDb);
  state.settings = settings.map((s) => ({
    id: s.id,
    key: s.key,
    value: s.value,
    created_at: m.iso(s.createdAt),
    updated_at: m.iso(s.updatedAt),
  }));
  counters.forEach((c) => {
    state.counters[c.key] = c.value;
  });
  return state;
}

/**
 * TEST-ONLY destructive wipe. Never call from production persist paths.
 * Clears portal + catalog/promo/marketing/sandbox tables for isolated tests.
 */
async function wipePortalTables(tx) {
  // Catalog / marketing / sandbox (children first)
  await tx.sandboxValidationReport.deleteMany().catch(() => {});
  await tx.sandboxPublishJob.deleteMany().catch(() => {});
  await tx.sandboxPreviewToken.deleteMany().catch(() => {});
  await tx.sandboxChange.deleteMany().catch(() => {});
  await tx.sandboxSession.deleteMany().catch(() => {});
  await tx.marketingCampaignEvent.deleteMany().catch(() => {});
  await tx.marketingCampaignProduct.deleteMany().catch(() => {});
  await tx.marketingCampaignPlan.deleteMany().catch(() => {});
  await tx.marketingCampaignCategory.deleteMany().catch(() => {});
  await tx.marketingCampaign.deleteMany().catch(() => {});
  await tx.promotionRedemption.deleteMany().catch(() => {});
  await tx.promotionProduct.deleteMany().catch(() => {});
  await tx.promotionPlan.deleteMany().catch(() => {});
  await tx.promotion.deleteMany().catch(() => {});
  await tx.catalogRevisionChange.deleteMany().catch(() => {});
  await tx.catalogRevision.deleteMany().catch(() => {});
  await tx.catalogNotifyInterest.deleteMany().catch(() => {});
  await tx.planFeature.deleteMany().catch(() => {});
  await tx.catalogMedia.deleteMany().catch(() => {});
  await tx.catalogChangelog.deleteMany().catch(() => {});
  await tx.catalogPlan.deleteMany().catch(() => {});
  await tx.catalogItem.deleteMany().catch(() => {});
  await tx.catalogCategory.deleteMany().catch(() => {});
  await tx.productType.deleteMany().catch(() => {});

  // Portal tables (children first)
  await tx.supportTicketNote.deleteMany();
  await tx.payment.deleteMany();
  await tx.leadNote.deleteMany();
  await tx.leadActivity.deleteMany();
  await tx.rolePermission.deleteMany();
  await tx.userRole.deleteMany();
  await tx.invitation.deleteMany();
  await tx.appSession.deleteMany();
  await tx.loginAttempt.deleteMany();
  await tx.auditLog.deleteMany();
  await tx.testimonialReview.deleteMany();
  await tx.newsletterSubscriber.deleteMany();
  await tx.contactForm.deleteMany();
  await tx.quoteRequest.deleteMany();
  await tx.blogPost.deleteMany();
  await tx.portfolioItem.deleteMany();
  await tx.project.deleteMany();
  await tx.client.deleteMany();
  await tx.lead.deleteMany();
  await tx.supportTicket.deleteMany();
  await tx.invoice.deleteMany();
  await tx.permission.deleteMany();
  await tx.role.deleteMany();
  await tx.user.deleteMany();
  await tx.systemSetting.deleteMany();
  await tx.idCounter.deleteMany();
}

/**
 * Upsert portal state into PostgreSQL.
 * Never deletes unrelated rows. Association tables are replaced per-parent only.
 */
async function saveState(state) {
  const snapshot = JSON.parse(JSON.stringify(state));
  await prisma.$transaction(
    async (tx) => {
      for (const row of snapshot.users) {
        await upsertById(tx, tx.user, m.userToDb(row));
      }
      for (const row of snapshot.roles) {
        await upsertById(tx, tx.role, roleToDb(row));
      }
      for (const row of snapshot.permissions) {
        await upsertById(tx, tx.permission, permissionToDb(row));
      }

      // Sync rolePermissions per role present in snapshot
      for (const role of snapshot.roles) {
        const rows = snapshot.rolePermissions.filter((r) => Number(r.role_id) === Number(role.id));
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        if (rows.length) {
          await tx.rolePermission.createMany({
            data: rows.map((r) => ({
              id: r.id,
              roleId: r.role_id,
              permissionId: r.permission_id,
            })),
          });
        }
      }

      // Sync userRoles per user present in snapshot
      for (const user of snapshot.users) {
        const rows = snapshot.userRoles.filter((r) => Number(r.user_id) === Number(user.id));
        await tx.userRole.deleteMany({ where: { userId: user.id } });
        if (rows.length) {
          await tx.userRole.createMany({
            data: rows.map((r) => ({
              id: r.id,
              userId: r.user_id,
              roleId: r.role_id,
              assignedAt: m.asDateRequired(r.assigned_at),
              assignedBy: r.assigned_by ?? null,
            })),
          });
        }
      }

      for (const r of snapshot.invitations) {
        await upsertById(tx, tx.invitation, {
          id: r.id,
          userId: r.user_id,
          email: r.email,
          roleId: r.role_id,
          tokenHash: r.token_hash ?? null,
          status: r.status || "pending",
          expiresAt: m.asDateRequired(r.expires_at),
          usedAt: m.asDate(r.used_at),
          createdBy: r.created_by ?? null,
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const r of snapshot.sessions) {
        await upsertById(tx, tx.appSession, {
          id: r.id,
          sid: r.sid,
          userId: r.user_id,
          createdAt: m.asDateRequired(r.created_at),
          lastSeenAt: m.asDateRequired(r.last_seen_at),
          ipHash: r.ip_hash ?? null,
          userAgent: r.user_agent ?? null,
          revokedAt: m.asDate(r.revoked_at),
        });
      }
      for (const r of snapshot.loginAttempts) {
        await upsertById(tx, tx.loginAttempt, {
          id: r.id,
          email: r.email,
          success: r.success ? 1 : 0,
          ipHash: r.ip_hash ?? null,
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const r of snapshot.clients) {
        await upsertById(tx, tx.client, {
          id: r.id,
          name: r.name,
          email: r.email ?? null,
          phone: r.phone ?? null,
          business: r.business ?? null,
          assignedUserId: r.assigned_user_id ?? null,
          metadataJson: r.metadata_json ?? null,
          createdAt: m.asDateRequired(r.created_at),
          updatedAt: m.asDateRequired(r.updated_at),
        });
      }
      for (const r of snapshot.projects) {
        await upsertById(tx, tx.project, {
          id: r.id,
          name: r.name,
          clientId: r.client_id ?? null,
          status: r.status || "Planning",
          metadataJson: r.metadata_json ?? null,
          createdAt: m.asDateRequired(r.created_at),
          updatedAt: m.asDateRequired(r.updated_at),
        });
      }
      for (const row of snapshot.leads) {
        await upsertById(tx, tx.lead, m.leadToDb(row));
      }
      for (const r of snapshot.leadNotes) {
        await upsertById(tx, tx.leadNote, {
          id: r.id,
          leadId: r.lead_id,
          userId: r.user_id ?? null,
          note: r.note,
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const r of snapshot.activities) {
        await upsertById(tx, tx.leadActivity, {
          id: r.id,
          leadId: r.lead_id,
          userId: r.user_id ?? null,
          actionType: r.action_type,
          description: r.description,
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const r of snapshot.contactMessages) {
        await upsertById(tx, tx.contactForm, {
          id: r.id,
          name: r.name,
          business: r.business ?? null,
          topic: r.topic ?? null,
          email: r.email ?? null,
          whatsapp: r.whatsapp ?? null,
          phone: r.phone ?? null,
          city: r.city ?? null,
          country: r.country ?? null,
          countryCode: r.country_code ?? null,
          dialCode: r.dial_code ?? null,
          phoneNumber: r.phone_number ?? null,
          message: r.message || "",
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const r of snapshot.quoteRequests) {
        await upsertById(tx, tx.quoteRequest, {
          id: r.id,
          fullName: r.full_name,
          businessName: r.business_name ?? null,
          industry: r.industry ?? null,
          interestedIn: r.interested_in ?? null,
          email: r.email ?? null,
          whatsapp: r.whatsapp ?? null,
          phone: r.phone ?? null,
          city: r.city ?? null,
          country: r.country ?? null,
          countryCode: r.country_code ?? null,
          dialCode: r.dial_code ?? null,
          phoneNumber: r.phone_number ?? null,
          budget: r.budget ?? null,
          timeline: r.timeline ?? null,
          preferredContactMethod: r.preferred_contact_method ?? null,
          projectDescription: r.project_description ?? null,
          websiteUrl: r.website_url ?? null,
          attachmentsJson: r.attachments_json ?? null,
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const r of snapshot.newsletterSubscribers) {
        await upsertById(tx, tx.newsletterSubscriber, {
          id: r.id,
          email: r.email,
          source: r.source ?? null,
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const r of snapshot.blogPosts) {
        await upsertById(tx, tx.blogPost, {
          id: r.id,
          title: r.title,
          slug: r.slug,
          summary: r.summary ?? null,
          status: r.status || "Draft",
          createdBy: r.created_by ?? null,
          publishedBy: r.published_by ?? null,
          publishedAt: m.asDate(r.published_at),
          createdAt: m.asDateRequired(r.created_at),
          updatedAt: m.asDateRequired(r.updated_at),
        });
      }
      for (const r of snapshot.portfolioItems) {
        await upsertById(tx, tx.portfolioItem, {
          id: r.id,
          title: r.title,
          slug: r.slug,
          summary: r.summary ?? null,
          status: r.status || "Draft",
          createdBy: r.created_by ?? null,
          publishedBy: r.published_by ?? null,
          publishedAt: m.asDate(r.published_at),
          createdAt: m.asDateRequired(r.created_at),
          updatedAt: m.asDateRequired(r.updated_at),
        });
      }
      for (const r of snapshot.invoices) {
        await upsertById(tx, tx.invoice, {
          id: r.id,
          invoiceNo: r.invoice_no,
          clientName: r.client_name,
          amount: r.amount,
          currency: r.currency || "PKR",
          status: r.status || "Draft",
          issuedAt: m.asDateRequired(r.issued_at),
          dueAt: m.asDate(r.due_at),
          paidAt: m.asDate(r.paid_at),
          createdBy: r.created_by ?? null,
          createdAt: m.asDateRequired(r.created_at),
          updatedAt: m.asDateRequired(r.updated_at),
        });
      }
      for (const r of snapshot.payments) {
        await upsertById(tx, tx.payment, {
          id: r.id,
          invoiceId: r.invoice_id,
          amount: r.amount,
          currency: r.currency || "PKR",
          recordedBy: r.recorded_by ?? null,
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const r of snapshot.tickets) {
        await upsertById(tx, tx.supportTicket, {
          id: r.id,
          ticketCode: r.ticket_code,
          subject: r.subject,
          customer: r.customer ?? null,
          description: r.description ?? null,
          priority: r.priority || "Normal",
          status: r.status || "Open",
          assignedUserId: r.assigned_user_id ?? null,
          assignedAt: m.asDate(r.assigned_at),
          assignedBy: r.assigned_by ?? null,
          createdBy: r.created_by ?? null,
          createdAt: m.asDateRequired(r.created_at),
          updatedAt: m.asDateRequired(r.updated_at),
        });
      }
      for (const r of snapshot.ticketNotes) {
        await upsertById(tx, tx.supportTicketNote, {
          id: r.id,
          ticketId: r.ticket_id,
          userId: r.user_id ?? null,
          note: r.note,
          internal: r.internal ?? 1,
          createdAt: m.asDateRequired(r.created_at),
        });
      }
      for (const row of snapshot.auditLogs) {
        await upsertById(tx, tx.auditLog, m.auditToDb(row));
      }
      for (const r of snapshot.settings) {
        await upsertById(tx, tx.systemSetting, {
          id: r.id,
          key: r.key,
          value: r.value ?? null,
          createdAt: m.asDateRequired(r.created_at),
          updatedAt: m.asDateRequired(r.updated_at),
        });
      }

      // Counters: never decrease a concurrent writer's higher value
      for (const [key, value] of Object.entries(snapshot.counters || {})) {
        const next = Number(value) || 0;
        await tx.$executeRaw`
          INSERT INTO auth.id_counters (key, value)
          VALUES (${key}, ${next})
          ON CONFLICT (key) DO UPDATE
          SET value = GREATEST(auth.id_counters.value, EXCLUDED.value)
        `;
      }
    },
    { timeout: 120000, maxWait: 30000 }
  );
}

async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}

module.exports = {
  emptyState,
  loadState,
  saveState,
  wipePortalTables,
  pingDatabase,
  prisma,
};
