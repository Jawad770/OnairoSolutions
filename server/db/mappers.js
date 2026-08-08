/**
 * Map between Prisma models and the portal's existing snake_case JSON shapes
 * so route handlers stay unchanged.
 */

function iso(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function asDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asDateRequired(value) {
  return asDate(value) || new Date();
}

function userFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    password_hash: row.passwordHash,
    role: row.role,
    is_active: row.isActive,
    failed_logins: row.failedLogins,
    locked_until: iso(row.lockedUntil),
    last_login_at: iso(row.lastLoginAt),
    full_name: row.fullName,
    job_title: row.jobTitle,
    phone: row.phone,
    avatar_url: row.avatarUrl,
    status: row.status,
    must_change_password: row.mustChangePassword,
    password_changed_at: iso(row.passwordChangedAt),
    sessions_revoked_at: iso(row.sessionsRevokedAt),
    created_by: row.createdBy,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}

function userToDb(row) {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role || "viewer",
    isActive: row.is_active ?? (row.status === "active" ? 1 : 0),
    failedLogins: row.failed_logins || 0,
    lockedUntil: asDate(row.locked_until),
    lastLoginAt: asDate(row.last_login_at),
    fullName: row.full_name ?? null,
    jobTitle: row.job_title ?? null,
    phone: row.phone ?? null,
    avatarUrl: row.avatar_url ?? null,
    status: row.status || "active",
    mustChangePassword: row.must_change_password || 0,
    passwordChangedAt: asDate(row.password_changed_at),
    sessionsRevokedAt: asDate(row.sessions_revoked_at),
    createdBy: row.created_by ?? null,
    createdAt: asDateRequired(row.created_at),
    updatedAt: asDateRequired(row.updated_at),
  };
}

function leadFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    lead_code: row.leadCode,
    source_type: row.sourceType,
    source_ref_id: row.sourceRefId,
    date_created: iso(row.dateCreated),
    name: row.name,
    business: row.business,
    industry: row.industry,
    service_product: row.serviceProduct,
    email: row.email,
    whatsapp: row.whatsapp,
    phone: row.phone,
    city: row.city,
    budget: row.budget,
    timeline: row.timeline,
    preferred_contact_method: row.preferredContactMethod,
    project_description: row.projectDescription,
    status: row.status,
    assigned_to_user_id: row.assignedToUserId,
    assigned_user_id: row.assignedUserId,
    assigned_at: iso(row.assignedAt),
    assigned_by: row.assignedBy,
    website_url: row.websiteUrl,
    country: row.country,
    country_code: row.countryCode,
    dial_code: row.dialCode,
    phone_number: row.phoneNumber,
    metadata_json: row.metadataJson,
  };
}

function leadToDb(row) {
  return {
    id: row.id,
    leadCode: row.lead_code,
    sourceType: row.source_type,
    sourceRefId: row.source_ref_id ?? null,
    dateCreated: asDateRequired(row.date_created),
    name: row.name,
    business: row.business ?? null,
    industry: row.industry ?? null,
    serviceProduct: row.service_product ?? null,
    email: row.email ?? null,
    whatsapp: row.whatsapp ?? null,
    phone: row.phone ?? null,
    city: row.city ?? null,
    budget: row.budget ?? null,
    timeline: row.timeline ?? null,
    preferredContactMethod: row.preferred_contact_method ?? null,
    projectDescription: row.project_description ?? null,
    status: row.status || "New",
    assignedToUserId: row.assigned_to_user_id ?? null,
    assignedUserId: row.assigned_user_id ?? null,
    assignedAt: asDate(row.assigned_at),
    assignedBy: row.assigned_by ?? null,
    websiteUrl: row.website_url ?? null,
    country: row.country ?? null,
    countryCode: row.country_code ?? null,
    dialCode: row.dial_code ?? null,
    phoneNumber: row.phone_number ?? null,
    metadataJson: row.metadata_json ?? null,
  };
}

function auditFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.userId,
    actor_name: row.actorName,
    action: row.action,
    target: row.target || "",
    target_type: row.targetType,
    target_id: row.targetId,
    previous_value: row.previousValue,
    new_value: row.newValue,
    detail: row.detail,
    result: row.result || "success",
    ip_hash: row.ipHash,
    user_agent: row.userAgent,
    created_at: iso(row.createdAt),
  };
}

function auditToDb(row) {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    actorName: row.actor_name ?? null,
    action: row.action,
    target: row.target || null,
    targetType: row.target_type ?? null,
    targetId: row.target_id != null ? String(row.target_id) : null,
    previousValue: row.previous_value ?? null,
    newValue: row.new_value ?? null,
    detail: row.detail ?? null,
    result: row.result || "success",
    ipHash: row.ip_hash ?? null,
    userAgent: row.user_agent ?? null,
    createdAt: asDateRequired(row.created_at),
  };
}

module.exports = {
  iso,
  asDate,
  asDateRequired,
  userFromDb,
  userToDb,
  leadFromDb,
  leadToDb,
  auditFromDb,
  auditToDb,
};
