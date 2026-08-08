/**
 * Schema-oriented repositories. Route handlers should prefer these for
 * new work; the compatibility `state` layer still powers existing routes.
 */
const { prisma } = require("../prisma");
const m = require("../mappers");

const AuthRepository = {
  findUserByEmail(email) {
    return prisma.user.findFirst({
      where: { email: String(email).toLowerCase(), deletedAt: null },
    });
  },
  findUserById(id) {
    return prisma.user.findFirst({ where: { id: Number(id), deletedAt: null } });
  },
  listRoles() {
    return prisma.role.findMany({ where: { deletedAt: null }, orderBy: { level: "desc" } });
  },
  listPermissions() {
    return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { key: "asc" }] });
  },
};

const CRMRepository = {
  findLeadById(id) {
    return prisma.lead.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: { notes: true, activities: true, assignee: true },
    });
  },
  searchLeads({ q, status, assignedUserId, skip = 0, take = 50, orderBy = { dateCreated: "desc" } } = {}) {
    const where = { deletedAt: null };
    if (status) where.status = status;
    if (assignedUserId != null) where.assignedUserId = Number(assignedUserId);
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { whatsapp: { contains: q, mode: "insensitive" } },
        { business: { contains: q, mode: "insensitive" } },
        { leadCode: { contains: q, mode: "insensitive" } },
      ];
    }
    return prisma.lead.findMany({ where, orderBy, skip, take });
  },
  async createLeadWithActivity(leadData, activityData, auditData) {
    return prisma.$transaction(async (tx) => {
      const lead = await tx.lead.create({ data: leadData });
      if (activityData) await tx.leadActivity.create({ data: { ...activityData, leadId: lead.id } });
      if (auditData) await tx.auditLog.create({ data: auditData });
      return lead;
    });
  },
};

const WebsiteRepository = {
  listContactForms({ skip = 0, take = 100 } = {}) {
    return prisma.contactForm.findMany({ orderBy: { createdAt: "desc" }, skip, take });
  },
  findNewsletterByEmail(email) {
    return prisma.newsletterSubscriber.findFirst({
      where: { email: String(email).toLowerCase(), deletedAt: null },
    });
  },
};

const FinanceRepository = {
  listInvoices({ status, skip = 0, take = 50 } = {}) {
    const where = { deletedAt: null };
    if (status) where.status = status;
    return prisma.invoice.findMany({ where, orderBy: { issuedAt: "desc" }, skip, take });
  },
};

const SupportRepository = {
  findTicketById(id) {
    return prisma.supportTicket.findFirst({
      where: { id: Number(id), deletedAt: null },
      include: { notes: true, assignee: true },
    });
  },
  listTickets({ status, assignedUserId, skip = 0, take = 50 } = {}) {
    const where = { deletedAt: null };
    if (status) where.status = status;
    if (assignedUserId != null) where.assignedUserId = Number(assignedUserId);
    return prisma.supportTicket.findMany({ where, orderBy: { createdAt: "desc" }, skip, take });
  },
};

const SystemRepository = {
  listAuditLogs({ skip = 0, take = 100 } = {}) {
    return prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip, take });
  },
  writeAudit(data) {
    return prisma.auditLog.create({ data: m.auditToDb(data) });
  },
};

const LicensingRepository = {
  listProducts() {
    return prisma.product.findMany({ where: { deletedAt: null } });
  },
};

const ProductsRepository = {
  listVersions(productKey) {
    return prisma.productVersion.findMany({
      where: { productKey, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });
  },
};

const CloudRepository = {
  listBackups() {
    return prisma.cloudBackup.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" } });
  },
};

module.exports = {
  AuthRepository,
  CRMRepository,
  WebsiteRepository,
  FinanceRepository,
  SupportRepository,
  SystemRepository,
  LicensingRepository,
  ProductsRepository,
  CloudRepository,
  CatalogRepository: require("./catalog").CatalogRepository,
  PromotionRepository: require("./promotions").PromotionRepository,
  MarketingCampaignRepository: require("./marketingCampaigns").MarketingCampaignRepository,
  SandboxRepository: require("./sandbox").SandboxRepository,
};
