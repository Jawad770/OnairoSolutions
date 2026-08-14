/**
 * Central permission catalogue and system role definitions.
 *
 * Authorization is permission-based: routes ask for permission keys such as
 * "leads.update" and never for role names. Roles are only containers that map
 * to permission sets, so new roles can be added without touching route code.
 *
 * Scope permissions (`*.view_all`) widen a module's read scope from
 * "records assigned to me" to "every record", which is how manager roles are
 * separated from executive/agent roles.
 */

const MODULES = [
  {
    key: "dashboard",
    label: "Dashboard",
    actions: [["view", "View dashboard"]],
  },
  {
    key: "leads",
    label: "CRM / Leads",
    actions: [
      ["view", "View leads"],
      ["view_all", "View all leads (not just assigned)"],
      ["create", "Create leads"],
      ["update", "Update leads"],
      ["delete", "Delete leads"],
      ["export", "Export leads"],
      ["assign", "Assign leads"],
      ["change_status", "Change lead status"],
    ],
  },
  {
    key: "lead_notes",
    label: "Lead Notes",
    actions: [
      ["view", "View lead notes"],
      ["create", "Add lead notes"],
      ["update", "Edit lead notes"],
      ["delete", "Delete lead notes"],
    ],
  },
  {
    key: "clients",
    label: "Clients",
    actions: [
      ["view", "View clients"],
      ["view_all", "View all clients (not just assigned)"],
      ["create", "Create clients"],
      ["update", "Update clients"],
      ["delete", "Delete clients"],
    ],
  },
  {
    key: "projects",
    label: "Projects",
    actions: [
      ["view", "View projects"],
      ["create", "Create projects"],
      ["update", "Update projects"],
      ["delete", "Delete projects"],
    ],
  },
  {
    key: "website_forms",
    label: "Website Forms",
    actions: [
      ["view", "View website form submissions"],
      ["export", "Export website form submissions"],
    ],
  },
  {
    key: "reviews",
    label: "Client Reviews",
    actions: [
      ["view", "View submitted client reviews"],
      ["moderate", "Approve and hide client reviews"],
    ],
  },
  {
    key: "edutrack",
    label: "EduTrack",
    actions: [
      ["view", "View EduTrack module"],
      ["manage", "Manage EduTrack module"],
    ],
  },
  {
    key: "ai",
    label: "Onairo AI",
    actions: [["view", "View AI conversation transcripts"]],
  },
  {
    key: "catalog",
    label: "Catalog Manager",
    actions: [
      ["view", "View catalog"],
      ["create", "Create catalog items"],
      ["update", "Update catalog items"],
      ["delete", "Delete catalog items"],
      ["manage_plans", "Manage plans and pricing"],
      ["manage_features", "Manage plan features"],
      ["manage_media", "Manage catalog media"],
      ["publish", "Publish and schedule catalog changes"],
      ["reorder", "Reorder catalog entities"],
      ["upload", "Upload catalog media files"],
      ["manage_campaigns", "Manage marketing campaigns"],
      ["manage_promotions", "Manage promotions and discount codes"],
      ["view_promotion_analytics", "View promotion analytics"],
      ["manage_sandbox", "Manage catalog sandbox sessions"],
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    actions: [
      ["popups.view", "View promotional popups"],
      ["popups.create", "Create promotional popups"],
      ["popups.update", "Update promotional popups"],
      ["popups.delete", "Delete promotional popups"],
    ],
  },
  {
    key: "products",
    label: "Products (legacy)",
    actions: [
      ["view", "View products (legacy)"],
      ["manage", "Manage products (legacy)"],
    ],
  },
  {
    key: "support",
    label: "Support",
    actions: [
      ["view", "View support tickets"],
      ["view_all", "View all tickets (not just assigned)"],
      ["create", "Create support tickets"],
      ["update", "Update support tickets"],
      ["assign", "Assign support tickets"],
      ["delete", "Delete support tickets"],
    ],
  },
  {
    key: "newsletter",
    label: "Newsletter",
    actions: [
      ["view", "View newsletter subscribers"],
      ["manage", "Manage newsletter"],
    ],
  },
  {
    key: "blog",
    label: "Blog",
    actions: [
      ["view", "View blog posts"],
      ["create", "Create blog posts"],
      ["update", "Edit blog posts"],
      ["publish", "Publish blog posts"],
      ["delete", "Delete blog posts"],
    ],
  },
  {
    key: "portfolio",
    label: "Portfolio",
    actions: [
      ["view", "View portfolio entries"],
      ["create", "Create portfolio entries"],
      ["update", "Edit portfolio entries"],
      ["publish", "Publish portfolio entries"],
      ["delete", "Delete portfolio entries"],
    ],
  },
  {
    key: "invoices",
    label: "Invoices",
    actions: [
      ["view", "View invoices"],
      ["create", "Create invoices"],
      ["update", "Update invoices and record payments"],
      ["delete", "Delete invoices"],
    ],
  },
  {
    key: "analytics",
    label: "Analytics",
    actions: [["view", "View analytics"]],
  },
  {
    key: "users",
    label: "Users",
    actions: [
      ["view", "View users"],
      ["create", "Create and invite users"],
      ["update", "Update users"],
      ["disable", "Disable and enable users"],
      ["reset_password", "Reset user passwords"],
      ["delete", "Delete user accounts"],
    ],
  },
  {
    key: "roles",
    label: "Roles",
    actions: [
      ["view", "View roles"],
      ["create", "Create roles"],
      ["update", "Update role permissions"],
      ["delete", "Delete roles"],
      ["assign", "Assign roles to users"],
    ],
  },
  {
    key: "settings",
    label: "Settings",
    actions: [
      ["view", "View settings"],
      ["update", "Update settings"],
    ],
  },
  {
    key: "audit_logs",
    label: "Audit Logs",
    actions: [["view", "View audit logs"]],
  },
];

const ALL_PERMISSIONS = MODULES.flatMap((m) => m.actions.map(([action]) => `${m.key}.${action}`));

const PERMISSION_LABELS = {};
MODULES.forEach((m) => {
  m.actions.forEach(([action, label]) => {
    PERMISSION_LABELS[`${m.key}.${action}`] = label;
  });
});

/**
 * Role levels guard against privilege escalation: a user may never assign a
 * role at or above their own level, and SUPER_ADMIN_LEVEL is reserved.
 */
const SUPER_ADMIN_LEVEL = 100;

const SYSTEM_ROLES = [
  {
    key: "super_admin",
    name: "Super Admin",
    description: "Unrestricted access to every module, user, role and setting.",
    level: SUPER_ADMIN_LEVEL,
    permissions: "*",
  },
  {
    key: "sales_manager",
    name: "Sales Manager",
    description: "Owns the sales pipeline: all leads, quotations, clients and sales projects.",
    level: 60,
    permissions: [
      "dashboard.view",
      "leads.view",
      "leads.view_all",
      "leads.create",
      "leads.update",
      "leads.export",
      "leads.assign",
      "leads.change_status",
      "lead_notes.view",
      "lead_notes.create",
      "lead_notes.update",
      "clients.view",
      "clients.view_all",
      "clients.create",
      "clients.update",
      "projects.view",
      "projects.create",
      "projects.update",
      "website_forms.view",
      "website_forms.export",
      "analytics.view",
      "ai.view",
    ],
  },
  {
    key: "sales_executive",
    name: "Sales Executive",
    description: "Works only the leads assigned to them, with follow-up notes and status changes.",
    level: 30,
    permissions: [
      "dashboard.view",
      "leads.view",
      "leads.update",
      "leads.change_status",
      "lead_notes.view",
      "lead_notes.create",
      "clients.view",
      "ai.view",
    ],
  },
  {
    key: "support_manager",
    name: "Support Manager",
    description: "Runs customer support: all tickets, assignment and support analytics.",
    level: 60,
    permissions: [
      "dashboard.view",
      "support.view",
      "support.view_all",
      "support.create",
      "support.update",
      "support.assign",
      "clients.view",
      "clients.view_all",
      "clients.update",
      "analytics.view",
    ],
  },
  {
    key: "support_agent",
    name: "Support Agent",
    description: "Handles only the support tickets assigned to them.",
    level: 30,
    permissions: [
      "dashboard.view",
      "support.view",
      "support.create",
      "support.update",
      "clients.view",
    ],
  },
  {
    key: "content_manager",
    name: "Content Manager",
    description: "Manages public website content. Publishing requires Super Admin approval.",
    level: 50,
    permissions: [
      "dashboard.view",
      "blog.view",
      "blog.create",
      "blog.update",
      "portfolio.view",
      "portfolio.create",
      "portfolio.update",
    ],
  },
  {
    key: "finance_manager",
    name: "Finance Manager",
    description: "Manages invoices, payments and financial reporting.",
    level: 60,
    permissions: [
      "dashboard.view",
      "invoices.view",
      "invoices.create",
      "invoices.update",
      "clients.view",
      "clients.view_all",
      "analytics.view",
    ],
  },
  {
    key: "viewer",
    name: "Viewer / Reporting",
    description: "Read-only access to approved dashboards, analytics and reports.",
    level: 10,
    permissions: [
      "dashboard.view",
      "analytics.view",
      "leads.view",
      "leads.view_all",
      "website_forms.view",
    ],
  },
];

const SYSTEM_ROLE_KEYS = SYSTEM_ROLES.map((r) => r.key);

/** Sidebar/module map. `permission` uses ANY-of semantics. */
const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", path: "", permission: ["dashboard.view"] },
  { key: "crm", label: "CRM", path: "crm", permission: ["leads.view_all"] },
  { key: "crm-mine", label: "My Leads", path: "crm?scope=mine", permission: ["leads.view"], hideIf: ["leads.view_all"] },
  { key: "clients", label: "Clients", path: "clients", permission: ["clients.view"], disabled: true, badge: "Coming Soon" },
  { key: "projects", label: "Projects", path: "projects", permission: ["projects.view"], disabled: true, badge: "Coming Soon" },
  { key: "forms", label: "Website Forms", path: "forms", permission: ["website_forms.view"] },
  { key: "reviews", label: "Reviews", path: "reviews", permission: ["reviews.view"] },
  { key: "support", label: "Support", path: "support", permission: ["support.view_all"] },
  { key: "support-mine", label: "My Tickets", path: "support?scope=mine", permission: ["support.view"], hideIf: ["support.view_all"] },
  { key: "invoices", label: "Invoices", path: "invoices", permission: ["invoices.view"] },
  { key: "blog", label: "Blog", path: "blog", permission: ["blog.view"] },
  { key: "portfolio", label: "Portfolio", path: "portfolio", permission: ["portfolio.view"] },
  { key: "edutrack", label: "EduTrack", path: "edutrack", permission: ["edutrack.view"], disabled: true, badge: "Coming Soon" },
  { key: "catalog-products", label: "Products", path: "catalog", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-sandbox", label: "Sandbox", path: "catalog/sandbox", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-categories", label: "Categories", path: "catalog/categories", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-types", label: "Product Types", path: "catalog/types", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-plans", label: "Plans", path: "catalog/plans", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-pricing", label: "Pricing", path: "catalog/pricing", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-features", label: "Features", path: "catalog/features", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-promotions", label: "Promotions", path: "catalog/promotions", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-marketing", label: "Marketing Campaigns", path: "catalog/marketing", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "marketing-popups", label: "Popups", path: "marketing/popups", permission: ["marketing.popups.view"], section: "Marketing" },
  { key: "catalog-notify", label: "Notify Me Leads", path: "catalog/notify", permission: ["catalog.view"], section: "Catalog Manager" },
  { key: "catalog-downloads", label: "Downloads", path: "catalog/downloads", permission: ["catalog.view"], section: "Catalog Manager", disabled: true, badge: "Coming Soon" },
  { key: "catalog-licenses", label: "Licenses", path: "catalog/licenses", permission: ["catalog.view"], section: "Catalog Manager", disabled: true, badge: "Coming Soon" },
  { key: "newsletter", label: "Newsletter", path: "newsletter", permission: ["newsletter.view"], disabled: true, badge: "Coming Soon" },
  { key: "analytics", label: "Analytics", path: "analytics", permission: ["analytics.view"], disabled: true, badge: "Coming Soon" },
  { key: "users", label: "Users & Roles", path: "settings/users", permission: ["users.view", "roles.view"] },
  { key: "settings", label: "Settings", path: "settings", permission: ["settings.view"] },
  { key: "audit", label: "Audit Logs", path: "audit-logs", permission: ["audit_logs.view"] },
];

/** Permission required by the generic `/portal/:module` placeholder routes. */
const MODULE_ROUTE_PERMISSIONS = {
  clients: "clients.view",
  projects: "projects.view",
  forms: "website_forms.view",
  edutrack: "edutrack.view",
  catalog: "catalog.view",
  products: "catalog.view",
  newsletter: "newsletter.view",
  analytics: "analytics.view",
  settings: "settings.view",
};

function permissionsForRoleDefinition(role) {
  return role.permissions === "*" ? ALL_PERMISSIONS.slice() : role.permissions.slice();
}

module.exports = {
  MODULES,
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  SYSTEM_ROLES,
  SYSTEM_ROLE_KEYS,
  SUPER_ADMIN_LEVEL,
  NAV_ITEMS,
  MODULE_ROUTE_PERMISSIONS,
  permissionsForRoleDefinition,
};
