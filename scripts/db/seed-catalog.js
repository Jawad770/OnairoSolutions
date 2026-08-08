/**
 * Seed Catalog Manager — categories, types, Track suite, website packages.
 * Idempotent upsert by slug.
 *
 * Usage: node scripts/db/seed-catalog.js
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Software", slug: "software", description: "Commercial software products", displayOrder: 0 },
  { name: "Website Services", slug: "website-services", description: "Website design & build packages", displayOrder: 1 },
  { name: "Hosting", slug: "hosting", displayOrder: 2 },
  { name: "Maintenance", slug: "maintenance", displayOrder: 3 },
  { name: "SEO", slug: "seo", displayOrder: 4 },
  { name: "Cloud", slug: "cloud", displayOrder: 5 },
  { name: "AI", slug: "ai", displayOrder: 6 },
  { name: "Domains", slug: "domains", displayOrder: 7 },
  { name: "Marketing", slug: "marketing", displayOrder: 8 },
  { name: "Consulting", slug: "consulting", displayOrder: 9 },
];

const TYPES = [
  { name: "Software", slug: "software", displayOrder: 0 },
  { name: "Service", slug: "service", displayOrder: 1 },
  { name: "Subscription", slug: "subscription", displayOrder: 2 },
  { name: "Hosting", slug: "hosting", displayOrder: 3 },
  { name: "Domain", slug: "domain", displayOrder: 4 },
  { name: "Digital Download", slug: "digital-download", displayOrder: 5 },
  { name: "Template", slug: "template", displayOrder: 6 },
  { name: "Consultation", slug: "consultation", displayOrder: 7 },
  { name: "Training", slug: "training", displayOrder: 8 },
];

const TRACKS = [
  {
    slug: "edutrack",
    name: "EduTrack",
    shortDescription: "School & academy management, simplified.",
    fullDescription:
      "A modern education management platform for admissions, attendance, fees, academics, and parent communication — built for schools that want clarity and control.",
    accentColor: "#2563EB",
    comingSoon: false,
    featured: true,
    displayOrder: 0,
    ctaText: "Explore EduTrack",
    ctaLink: "src/products/edutrack.html",
    notifyMeEnabled: false,
    visibleComingSoon: false,
    workflowStatus: "published",
    publishedAt: new Date(),
    features: ["Student & staff records", "Attendance & timetables", "Fee billing & receipts", "Parent portal messaging", "Exam & report cards"],
  },
  {
    slug: "storetrack",
    name: "StoreTrack",
    shortDescription: "Inventory and retail operations in one place.",
    fullDescription: "Track stock, sales, suppliers, and store performance with a clean dashboard built for growing retailers.",
    accentColor: "#0EA5E9",
    comingSoon: true,
    displayOrder: 1,
    features: ["Inventory control", "POS-ready workflows", "Supplier management", "Sales analytics"],
  },
  {
    slug: "fittrack",
    name: "FitTrack",
    shortDescription: "Memberships, classes, and member success.",
    fullDescription: "Manage memberships, class bookings, trainers, and renewals for modern fitness businesses.",
    accentColor: "#F97316",
    comingSoon: true,
    displayOrder: 2,
    features: ["Membership plans", "Class scheduling", "Trainer assignment", "Renewal reminders"],
  },
  {
    slug: "meditrack",
    name: "MediTrack",
    shortDescription: "Clinic operations without the paperwork chaos.",
    fullDescription: "Appointments, patient records, billing, and follow-ups designed for clinics and medical practices.",
    accentColor: "#10B981",
    comingSoon: true,
    displayOrder: 3,
    features: ["Appointment booking", "Patient records", "Prescription notes", "Billing & follow-ups"],
  },
  {
    slug: "hrtrack",
    name: "HRTrack",
    shortDescription: "People operations for growing teams.",
    fullDescription: "Attendance, leave, payroll-ready records, and employee profiles in a unified HR workspace.",
    accentColor: "#8B5CF6",
    comingSoon: true,
    displayOrder: 4,
    features: ["Employee directory", "Leave management", "Attendance logs", "HR documents"],
  },
  {
    slug: "hoteltrack",
    name: "HotelTrack",
    shortDescription: "Reservations and hospitality ops, streamlined.",
    fullDescription: "Room inventory, bookings, guest services, and front-desk workflows for hotels and guesthouses.",
    accentColor: "#EAB308",
    comingSoon: true,
    displayOrder: 5,
    features: ["Room inventory", "Booking calendar", "Guest profiles", "Housekeeping status"],
  },
];

const WEBSITE_PACKAGES = [
  {
    slug: "website-starter",
    name: "Starter",
    shortDescription: "Essential presence for new businesses",
    fullDescription: "Ideal for a polished single-business site with core pages.",
    displayOrder: 0,
    featured: false,
    accentColor: "#2563EB",
    ctaText: "Ask about Starter",
    plan: {
      name: "Starter",
      oneTimePrice: 150,
      currency: "USD",
      subtitle: "≈ PKR 15,000 · contact for exact",
      features: [
        "Up to 5 pages",
        "Mobile-responsive design",
        "WhatsApp & contact CTAs",
        "Basic SEO structure",
        "1 revision round",
      ],
    },
  },
  {
    slug: "website-business",
    name: "Business",
    shortDescription: "Conversion-ready multi-page sites",
    fullDescription: "Best for established brands that need depth and lead capture.",
    displayOrder: 1,
    featured: true,
    accentColor: "#0EA5E9",
    ctaText: "Ask about Business",
    plan: {
      name: "Business",
      oneTimePrice: 350,
      currency: "USD",
      subtitle: "≈ PKR 35,000 · contact for exact",
      popular: true,
      recommended: true,
      badge: "Popular",
      features: [
        "Up to 10 pages",
        "Custom UI direction",
        "Maps & WhatsApp integration",
        "SEO-ready structure",
        "Service / portfolio sections",
        "2 revision rounds",
      ],
    },
  },
  {
    slug: "website-premium",
    name: "Premium",
    shortDescription: "Full brand experience & advanced flows",
    fullDescription: "For businesses that want distinctive design and richer features.",
    displayOrder: 2,
    featured: false,
    accentColor: "#7C3AED",
    ctaText: "Ask about Premium",
    plan: {
      name: "Premium",
      oneTimePrice: 650,
      currency: "USD",
      subtitle: "≈ PKR 65,000 · contact for exact",
      features: [
        "Custom page count",
        "Premium visual design",
        "Advanced forms & filters",
        "Performance optimization",
        "Priority support window",
        "Content guidance included",
      ],
    },
  },
];

const EDUTRACK_PLANS = [
  {
    name: "Starter",
    subtitle: "For single campuses getting organized.",
    monthlyPrice: 12000,
    currency: "PKR",
    displayOrder: 0,
    ctaText: "Get Starter",
    ctaLink: null,
    features: [
      { title: "Complete school management system", included: true },
      { title: "Student & staff records", included: true },
      { title: "Attendance module", included: true },
      { title: "Fee billing basics", included: true },
      { title: "Parent notices", included: true },
      { title: "Email support", included: true },
      { title: "Approx students", included: true, valueText: "~300" },
      { title: "Admissions pipeline", included: false },
      { title: "Academics & report cards", included: false },
      { title: "Parent portal access", included: false },
      { title: "Advanced reports", included: false },
      { title: "Advanced template create / import / export", included: false },
      { title: "Priority WhatsApp support", included: false },
      { title: "Multi-campus controls", included: false },
      { title: "Staff HR-lite", included: false },
      { title: "Custom workflows", included: false },
      { title: "Training & rollout support", included: false },
      { title: "Named account manager", included: false },
    ],
  },
  {
    name: "Professional",
    subtitle: "For established schools that need full ops coverage and advanced templates.",
    monthlyPrice: 24000,
    currency: "PKR",
    displayOrder: 1,
    popular: true,
    recommended: true,
    badge: "Recommended · Professional",
    ctaText: "Get Professional",
    features: [
      { title: "Complete school management system", included: true },
      { title: "Student & staff records", included: true },
      { title: "Attendance module", included: true },
      { title: "Fee billing basics", included: true },
      { title: "Parent notices", included: true },
      { title: "Email support", included: true },
      { title: "Approx students", included: true, valueText: "~1,000" },
      { title: "Admissions pipeline", included: true },
      { title: "Academics & report cards", included: true },
      { title: "Parent portal access", included: true },
      { title: "Advanced reports", included: true },
      { title: "Advanced template create / import / export", included: true },
      { title: "Priority WhatsApp support", included: true },
      { title: "Multi-campus controls", included: false },
      { title: "Staff HR-lite", included: false },
      { title: "Custom workflows", included: false },
      { title: "Training & rollout support", included: false },
      { title: "Named account manager", included: false },
    ],
  },
  {
    name: "Campus",
    subtitle: "For multi-branch networks and larger institutions.",
    monthlyPrice: null,
    currency: "PKR",
    displayOrder: 2,
    ctaText: "Talk to Sales",
    features: [
      { title: "Complete school management system", included: true },
      { title: "Student & staff records", included: true },
      { title: "Attendance module", included: true },
      { title: "Fee billing basics", included: true },
      { title: "Parent notices", included: true },
      { title: "Email support", included: true },
      { title: "Approx students", included: true, valueText: "Unlimited" },
      { title: "Admissions pipeline", included: true },
      { title: "Academics & report cards", included: true },
      { title: "Parent portal access", included: true },
      { title: "Advanced reports", included: true },
      { title: "Advanced template create / import / export", included: true },
      { title: "Priority WhatsApp support", included: true },
      { title: "Multi-campus controls", included: true },
      { title: "Staff HR-lite", included: true },
      { title: "Custom workflows", included: true },
      { title: "Training & rollout support", included: true },
      { title: "Named account manager", included: true },
    ],
  },
];

async function upsertCategory(row) {
  const existing = await prisma.catalogCategory.findFirst({ where: { slug: row.slug } });
  if (existing) {
    return prisma.catalogCategory.update({
      where: { id: existing.id },
      data: { name: row.name, description: row.description || null, displayOrder: row.displayOrder, enabled: true, deletedAt: null },
    });
  }
  return prisma.catalogCategory.create({ data: row });
}

async function upsertType(row) {
  const existing = await prisma.productType.findFirst({ where: { slug: row.slug } });
  if (existing) {
    return prisma.productType.update({
      where: { id: existing.id },
      data: { name: row.name, displayOrder: row.displayOrder, enabled: true, deletedAt: null },
    });
  }
  return prisma.productType.create({ data: row });
}

async function upsertItem(data) {
  const existing = await prisma.catalogItem.findFirst({ where: { slug: data.slug } });
  if (existing) {
    return prisma.catalogItem.update({ where: { id: existing.id }, data: { ...data, deletedAt: null } });
  }
  return prisma.catalogItem.create({ data });
}

async function ensurePlan(itemId, planData) {
  const existing = await prisma.catalogPlan.findFirst({
    where: { itemId, name: planData.name, deletedAt: null },
  });
  const payload = {
    itemId,
    name: planData.name,
    subtitle: planData.subtitle || null,
    monthlyPrice: planData.monthlyPrice ?? null,
    yearlyPrice: planData.yearlyPrice ?? null,
    oneTimePrice: planData.oneTimePrice ?? null,
    currency: planData.currency || "USD",
    badge: planData.badge || null,
    popular: Boolean(planData.popular),
    recommended: Boolean(planData.recommended),
    displayOrder: planData.displayOrder ?? 0,
    ctaText: planData.ctaText || null,
    ctaLink: planData.ctaLink || null,
    workflowStatus: "published",
    publishedAt: new Date(),
    visibleWebsite: true,
    archivedAt: null,
    deletedAt: null,
  };
  let plan;
  if (existing) {
    plan = await prisma.catalogPlan.update({ where: { id: existing.id }, data: payload });
  } else {
    plan = await prisma.catalogPlan.create({ data: payload });
  }
  if (Array.isArray(planData.features)) {
    for (let i = 0; i < planData.features.length; i += 1) {
      const f = planData.features[i];
      const title = typeof f === "string" ? f : f.title;
      const included = typeof f === "string" ? true : f.included !== false;
      const valueText = typeof f === "string" ? null : f.valueText || null;
      const existingF = await prisma.planFeature.findFirst({
        where: { planId: plan.id, title, deletedAt: null },
      });
      if (existingF) {
        await prisma.planFeature.update({
          where: { id: existingF.id },
          data: { included, valueText, displayOrder: i, enabled: true, deletedAt: null },
        });
      } else {
        await prisma.planFeature.create({
          data: { planId: plan.id, title, included, valueText, displayOrder: i, enabled: true },
        });
      }
    }
  }
  return plan;
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("[seed-catalog] Seeding taxonomy…");
  const cats = {};
  for (const c of CATEGORIES) {
    cats[c.slug] = await upsertCategory(c);
  }
  const types = {};
  for (const t of TYPES) {
    types[t.slug] = await upsertType(t);
  }

  // eslint-disable-next-line no-console
  console.log("[seed-catalog] Seeding Track suite…");
  for (const track of TRACKS) {
    const { features, ...rest } = track;
    const isComing = Boolean(track.comingSoon);
    const item = await upsertItem({
      ...rest,
      categoryId: cats.software.id,
      productTypeId: types.software.id,
      workflowStatus: isComing ? "published" : track.workflowStatus || "published",
      publishedAt: track.publishedAt || new Date(),
      comingSoon: isComing,
      notifyMeEnabled: isComing,
      visibleComingSoon: isComing,
      visibleWebsite: true,
      visibleAi: true,
    });
    if (features?.length) {
      // Store card features on a draft "Highlights" plan only when no published plans yet (EduTrack has real plans)
      if (track.slug !== "edutrack") {
        await ensurePlan(item.id, {
          name: "Highlights",
          displayOrder: 0,
          currency: "PKR",
          features: features.map((title) => ({ title, included: true })),
        });
        // Hide highlights plan from public? Keep published for card feature hydration
      }
    }
  }

  const edutrack = await prisma.catalogItem.findFirst({ where: { slug: "edutrack" } });
  if (edutrack) {
    for (const plan of EDUTRACK_PLANS) {
      await ensurePlan(edutrack.id, plan);
    }
    const existingCl = await prisma.catalogChangelog.findFirst({
      where: { itemId: edutrack.id, version: "1.0", deletedAt: null },
    });
    if (!existingCl) {
      await prisma.catalogChangelog.create({
        data: {
          itemId: edutrack.id,
          version: "1.0",
          title: "EduTrack public launch",
          body: "Starter, Professional, and Campus plans are live with a 14-day free trial.",
          releasedAt: new Date(),
          visibleWebsite: true,
          displayOrder: 0,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log("[seed-catalog] Seeding website packages…");
  for (const pkg of WEBSITE_PACKAGES) {
    const { plan, ...rest } = pkg;
    const item = await upsertItem({
      ...rest,
      categoryId: cats["website-services"].id,
      productTypeId: types.service.id,
      workflowStatus: "published",
      publishedAt: new Date(),
      comingSoon: false,
      visibleWebsite: true,
      visibleAi: true,
    });
    await ensurePlan(item.id, {
      ...plan,
      displayOrder: 0,
    });
  }

  // eslint-disable-next-line no-console
  console.log("[seed-catalog] Backfilling version baselines…");
  const { backfillAllBaselines } = require("../../server/catalogVersioning");
  const baselines = await backfillAllBaselines();
  // eslint-disable-next-line no-console
  console.log(`[seed-catalog] Created ${baselines} baseline revision(s).`);

  // eslint-disable-next-line no-console
  console.log("[seed-catalog] Done.");
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
