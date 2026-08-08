/**
 * Promotions / discount codes — catalog overlay pricing.
 */
const { prisma } = require("../prisma");
const { hashIp } = require("../../db");

const notDeleted = { deletedAt: null };
const SUPPORTED_TYPES = new Set(["percentage", "flat"]);

function normalizeCode(code) {
  return String(code || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function decimalToNumber(v) {
  if (v == null) return null;
  return Number(v);
}

function serializePromotion(row) {
  if (!row) return null;
  return {
    ...row,
    discountValue: decimalToNumber(row.discountValue),
    minPurchaseAmount: decimalToNumber(row.minPurchaseAmount),
    maxDiscountAmount: decimalToNumber(row.maxDiscountAmount),
    products: row.products || [],
    plans: row.plans || [],
    redemptions: row.redemptions || [],
  };
}

function planAmount(plan) {
  if (!plan) return null;
  if (plan.monthlyPrice != null) return Number(plan.monthlyPrice);
  if (plan.oneTimePrice != null) return Number(plan.oneTimePrice);
  if (plan.yearlyPrice != null) return Number(plan.yearlyPrice);
  return null;
}

function computeDiscount(promo, original) {
  const type = promo.discountType;
  const value = Number(promo.discountValue);
  let discount = 0;
  if (type === "percentage") {
    discount = (original * value) / 100;
  } else if (type === "flat") {
    discount = value;
  } else {
    return { error: "This promotion type is not available yet." };
  }
  if (promo.maxDiscountAmount != null) {
    discount = Math.min(discount, Number(promo.maxDiscountAmount));
  }
  discount = Math.max(0, Math.min(discount, original));
  const final = Math.max(0, original - discount);
  return { discount, final };
}

async function quoteFromPromo(promo, { productSlug, planId, planName, email, whatsapp } = {}) {
  if (promo.status === "paused") return { ok: false, error: "This code is currently inactive." };
  if (promo.status === "archived") return { ok: false, error: "This code is no longer available." };
  if (promo.status === "expired") return { ok: false, error: "This code has expired." };
  if (promo.status !== "active") return { ok: false, error: "This code is not active." };

  const now = new Date();
  if (promo.startsAt && new Date(promo.startsAt) > now) {
    return { ok: false, error: "This code is not active yet." };
  }
  if (promo.endsAt && new Date(promo.endsAt) < now) {
    return { ok: false, error: "This code has expired." };
  }
  if (promo.maxUses != null && promo.usedCount >= promo.maxUses) {
    return { ok: false, error: "This code has reached its usage limit." };
  }
  if (!SUPPORTED_TYPES.has(promo.discountType)) {
    return { ok: false, error: "This promotion type is not available yet." };
  }

  let item = null;
  if (productSlug) {
    item = await prisma.catalogItem.findFirst({
      where: { slug: productSlug, deletedAt: null },
      include: {
        plans: { where: { deletedAt: null, archivedAt: null }, orderBy: { displayOrder: "asc" } },
      },
    });
    if (!item) return { ok: false, error: "Product not found." };
    if (promo.products?.length && !promo.products.some((p) => p.itemId === item.id)) {
      return { ok: false, error: "This code does not apply to this product." };
    }
  }

  let plan = null;
  if (planId) {
    plan = await prisma.catalogPlan.findFirst({ where: { id: planId, deletedAt: null } });
  } else if (planName && item) {
    plan = (item.plans || []).find((p) => p.name.toLowerCase() === String(planName).toLowerCase()) || null;
  } else if (item?.plans?.length === 1) {
    plan = item.plans[0];
  }

  if (plan && promo.plans?.length && !promo.plans.some((p) => p.planId === plan.id)) {
    return { ok: false, error: "This code does not apply to this plan." };
  }
  if (plan && item && plan.itemId !== item.id) {
    return { ok: false, error: "Plan does not belong to this product." };
  }

  const original = planAmount(plan);
  if (original == null || !Number.isFinite(original) || original < 0) {
    return { ok: false, error: "Could not determine price for this plan." };
  }

  if (promo.minPurchaseAmount != null && original < Number(promo.minPurchaseAmount)) {
    return { ok: false, error: `Minimum purchase is ${promo.currency} ${promo.minPurchaseAmount}.` };
  }

  const emailNorm = email ? String(email).trim().toLowerCase() : null;
  const waNorm = whatsapp ? String(whatsapp).replace(/\s+/g, "") : null;
  if (promo.usesPerCustomer != null && promo.usesPerCustomer > 0 && (emailNorm || waNorm)) {
    const prior = await prisma.promotionRedemption.count({
      where: {
        promotionId: promo.id,
        OR: [
          emailNorm ? { customerEmail: emailNorm } : undefined,
          waNorm ? { customerWhatsapp: waNorm } : undefined,
        ].filter(Boolean),
      },
    });
    if (prior >= promo.usesPerCustomer) {
      return { ok: false, error: "You have already redeemed this code." };
    }
  }

  const calc = computeDiscount(promo, original);
  if (calc.error) return { ok: false, error: calc.error };

  const label =
    promo.discountType === "percentage"
      ? `${promo.discountValue}%`
      : `${promo.currency} ${Number(promo.discountValue).toLocaleString()}`;

  return {
    ok: true,
    code: promo.code,
    promotionId: promo.id,
    name: promo.name,
    discountType: promo.discountType,
    label,
    original,
    discount: Math.round(calc.discount * 100) / 100,
    final: Math.round(calc.final * 100) / 100,
    currency: plan?.currency || promo.currency || "PKR",
    savingsText: `You saved ${plan?.currency || promo.currency || "PKR"} ${Math.round(calc.discount).toLocaleString()}`,
    itemId: item?.id || null,
    planId: plan?.id || null,
    planName: plan?.name || null,
  };
}

const PromotionRepository = {
  prisma,
  normalizeCode,
  SUPPORTED_TYPES,

  list({ status, q } = {}) {
    const where = { ...notDeleted };
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { code: { contains: normalizeCode(q), mode: "insensitive" } },
      ];
    }
    return prisma.promotion
      .findMany({
        where,
        include: {
          products: { include: { item: true } },
          plans: { include: { plan: true } },
          _count: { select: { redemptions: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      .then((rows) => rows.map(serializePromotion));
  },

  get(id) {
    return prisma.promotion
      .findFirst({
        where: { id, ...notDeleted },
        include: {
          products: { include: { item: true } },
          plans: { include: { plan: true } },
          redemptions: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      })
      .then(serializePromotion);
  },

  getByCode(code) {
    const normalized = normalizeCode(code);
    if (!normalized) return Promise.resolve(null);
    return prisma.promotion
      .findFirst({
        where: { code: normalized, ...notDeleted },
        include: {
          products: true,
          plans: true,
        },
      })
      .then(serializePromotion);
  },

  async create(data, { productIds = [], planIds = [] } = {}) {
    const code = normalizeCode(data.code);
    const existing = await prisma.promotion.findFirst({ where: { code, deletedAt: null } });
    if (existing) throw new Error("Discount code already exists.");
    return prisma.promotion
      .create({
        data: {
          name: data.name,
          code,
          description: data.description || null,
          internalNotes: data.internalNotes || null,
          discountType: data.discountType,
          discountValue: data.discountValue,
          maxUses: data.maxUses ?? null,
          usesPerCustomer: data.usesPerCustomer ?? 1,
          startsAt: data.startsAt || null,
          endsAt: data.endsAt || null,
          autoExpire: data.autoExpire !== false,
          status: data.status || "active",
          minPurchaseAmount: data.minPurchaseAmount ?? null,
          maxDiscountAmount: data.maxDiscountAmount ?? null,
          currency: data.currency || "PKR",
          kind: data.kind || "coupon",
          stackingPolicy: data.stackingPolicy || { mode: "none" },
          products: productIds.length
            ? { create: productIds.map((itemId) => ({ itemId })) }
            : undefined,
          plans: planIds.length ? { create: planIds.map((planId) => ({ planId })) } : undefined,
        },
        include: { products: true, plans: true },
      })
      .then(serializePromotion);
  },

  async update(id, data, { productIds, planIds } = {}) {
    if (data.code) {
      const code = normalizeCode(data.code);
      const clash = await prisma.promotion.findFirst({
        where: { code, deletedAt: null, id: { not: id } },
      });
      if (clash) throw new Error("Discount code already exists.");
      data.code = code;
    }
    await prisma.$transaction(async (tx) => {
      await tx.promotion.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          internalNotes: data.internalNotes,
          discountType: data.discountType,
          discountValue: data.discountValue,
          maxUses: data.maxUses,
          usesPerCustomer: data.usesPerCustomer,
          startsAt: data.startsAt,
          endsAt: data.endsAt,
          autoExpire: data.autoExpire,
          status: data.status,
          minPurchaseAmount: data.minPurchaseAmount,
          maxDiscountAmount: data.maxDiscountAmount,
          currency: data.currency,
        },
      });
      if (Array.isArray(productIds)) {
        await tx.promotionProduct.deleteMany({ where: { promotionId: id } });
        if (productIds.length) {
          await tx.promotionProduct.createMany({
            data: productIds.map((itemId) => ({ promotionId: id, itemId })),
          });
        }
      }
      if (Array.isArray(planIds)) {
        await tx.promotionPlan.deleteMany({ where: { promotionId: id } });
        if (planIds.length) {
          await tx.promotionPlan.createMany({
            data: planIds.map((planId) => ({ promotionId: id, planId })),
          });
        }
      }
    });
    return this.get(id);
  },

  async duplicate(id) {
    const src = await this.get(id);
    if (!src) return null;
    let code = `${src.code}COPY`;
    let n = 1;
    while (await prisma.promotion.findFirst({ where: { code, deletedAt: null } })) {
      code = `${src.code}COPY${n}`;
      n += 1;
    }
    return this.create(
      {
        name: `${src.name} (Copy)`,
        code,
        description: src.description,
        internalNotes: src.internalNotes,
        discountType: src.discountType,
        discountValue: src.discountValue,
        maxUses: src.maxUses,
        usesPerCustomer: src.usesPerCustomer,
        startsAt: src.startsAt,
        endsAt: src.endsAt,
        autoExpire: src.autoExpire,
        status: "paused",
        minPurchaseAmount: src.minPurchaseAmount,
        maxDiscountAmount: src.maxDiscountAmount,
        currency: src.currency,
        kind: src.kind,
      },
      {
        productIds: (src.products || []).map((p) => p.itemId),
        planIds: (src.plans || []).map((p) => p.planId),
      }
    );
  },

  setStatus(id, status) {
    return prisma.promotion.update({ where: { id }, data: { status } }).then(serializePromotion);
  },

  softDelete(id) {
    return prisma.promotion.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });
  },

  async expireDue(now = new Date()) {
    const result = await prisma.promotion.updateMany({
      where: {
        ...notDeleted,
        status: "active",
        autoExpire: true,
        endsAt: { lt: now },
      },
      data: { status: "expired" },
    });
    return result.count;
  },

  /**
   * Validate + quote. Does not redeem.
   */
  async apply({
    code,
    promotionId,
    productSlug,
    planId,
    planName,
    email,
    whatsapp,
    trackAttempt = true,
  } = {}) {
    let promo = null;
    if (promotionId) {
      promo = await this.get(String(promotionId));
    } else {
      const normalized = normalizeCode(code);
      if (!normalized) return { ok: false, error: "Enter a discount code." };
      promo = await this.getByCode(normalized);
    }
    if (!promo) return { ok: false, error: "Invalid discount code." };

    if (trackAttempt) {
      await prisma.promotion.update({
        where: { id: promo.id },
        data: { applyAttemptCount: { increment: 1 } },
      });
    }

    return quoteFromPromo(promo, { productSlug, planId, planName, email, whatsapp });
  },

  async redeem({
    code,
    productSlug,
    planId,
    planName,
    email,
    whatsapp,
    sourcePage,
    req,
  } = {}) {
    const normalized = normalizeCode(code);
    if (!normalized) return { ok: false, error: "Enter a discount code." };

    try {
      const result = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw`
          SELECT * FROM products.promotions
          WHERE code = ${normalized} AND deleted_at IS NULL
          FOR UPDATE
        `;
        const promoRow = Array.isArray(locked) ? locked[0] : null;
        if (!promoRow) return { ok: false, error: "Invalid discount code." };

        const promo = await tx.promotion.findFirst({
          where: { id: promoRow.id },
          include: { products: true, plans: true },
        });
        const serialized = serializePromotion(promo);

        // Re-validate inside the lock
        if (serialized.status !== "active") {
          return { ok: false, error: "This code is not active." };
        }
        const now = new Date();
        if (serialized.startsAt && new Date(serialized.startsAt) > now) {
          return { ok: false, error: "This code is not active yet." };
        }
        if (serialized.endsAt && new Date(serialized.endsAt) < now) {
          return { ok: false, error: "This code has expired." };
        }
        if (serialized.maxUses != null && serialized.usedCount >= serialized.maxUses) {
          return { ok: false, error: "This code has reached its usage limit." };
        }

        let item = null;
        if (productSlug) {
          item = await tx.catalogItem.findFirst({
            where: { slug: productSlug, deletedAt: null },
            include: {
              plans: { where: { deletedAt: null, archivedAt: null }, orderBy: { displayOrder: "asc" } },
            },
          });
          if (!item) return { ok: false, error: "Product not found." };
          if (serialized.products?.length && !serialized.products.some((p) => p.itemId === item.id)) {
            return { ok: false, error: "This code does not apply to this product." };
          }
        }

        let plan = null;
        if (planId) {
          plan = await tx.catalogPlan.findFirst({ where: { id: planId, deletedAt: null } });
        } else if (planName && item) {
          plan = (item.plans || []).find((p) => p.name.toLowerCase() === String(planName).toLowerCase()) || null;
        } else if (item?.plans?.length === 1) {
          plan = item.plans[0];
        }
        if (plan && serialized.plans?.length && !serialized.plans.some((p) => p.planId === plan.id)) {
          return { ok: false, error: "This code does not apply to this plan." };
        }

        const original = planAmount(plan);
        if (original == null || !Number.isFinite(original) || original < 0) {
          return { ok: false, error: "Could not determine price for this plan." };
        }
        if (serialized.minPurchaseAmount != null && original < Number(serialized.minPurchaseAmount)) {
          return { ok: false, error: `Minimum purchase is ${serialized.currency} ${serialized.minPurchaseAmount}.` };
        }

        const emailNorm = email ? String(email).trim().toLowerCase() : null;
        const waNorm = whatsapp ? String(whatsapp).replace(/\s+/g, "") : null;
        if (serialized.usesPerCustomer != null && serialized.usesPerCustomer > 0 && (emailNorm || waNorm)) {
          const prior = await tx.promotionRedemption.count({
            where: {
              promotionId: serialized.id,
              OR: [
                emailNorm ? { customerEmail: emailNorm } : undefined,
                waNorm ? { customerWhatsapp: waNorm } : undefined,
              ].filter(Boolean),
            },
          });
          if (prior >= serialized.usesPerCustomer) {
            return { ok: false, error: "You have already redeemed this code." };
          }
        }

        const calc = computeDiscount(serialized, original);
        if (calc.error) return { ok: false, error: calc.error };

        const quote = {
          ok: true,
          code: serialized.code,
          promotionId: serialized.id,
          name: serialized.name,
          discountType: serialized.discountType,
          original,
          discount: Math.round(calc.discount * 100) / 100,
          final: Math.round(calc.final * 100) / 100,
          currency: plan?.currency || serialized.currency || "PKR",
          itemId: item?.id || null,
          planId: plan?.id || null,
          planName: plan?.name || null,
        };

        // Lead association is resolved server-side from email/whatsapp only
        let leadId = null;
        if (emailNorm || waNorm) {
          const lead = await tx.lead.findFirst({
            where: {
              OR: [
                emailNorm ? { email: emailNorm } : undefined,
                waNorm ? { whatsapp: waNorm } : undefined,
              ].filter(Boolean),
            },
            orderBy: { id: "desc" },
          });
          leadId = lead?.id ?? null;
        }

        const row = await tx.promotionRedemption.create({
          data: {
            promotionId: quote.promotionId,
            code: quote.code,
            itemId: quote.itemId,
            planId: quote.planId,
            leadId,
            customerEmail: emailNorm,
            customerWhatsapp: waNorm,
            originalAmount: quote.original,
            discountAmount: quote.discount,
            finalAmount: quote.final,
            currency: quote.currency,
            sourcePage: sourcePage || null,
            ipHash: req ? hashIp(req.ip) : null,
            userAgent: req?.headers?.["user-agent"] ? String(req.headers["user-agent"]).slice(0, 500) : null,
          },
        });
        await tx.promotion.update({
          where: { id: quote.promotionId },
          data: { usedCount: { increment: 1 } },
        });

        return {
          ok: true,
          redemptionId: row.id,
          quote,
          leadMetadata: {
            discountCode: quote.code,
            discountAmount: quote.discount,
            originalPrice: quote.original,
            finalPrice: quote.final,
            currency: quote.currency,
            planName: quote.planName,
          },
        };
      });
      return result;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[promo redeem]", err);
      return { ok: false, error: "Could not redeem code." };
    }
  },

  async analytics() {
    const [active, expired, paused, archived, redemptions, top] = await Promise.all([
      prisma.promotion.count({ where: { ...notDeleted, status: "active" } }),
      prisma.promotion.count({ where: { ...notDeleted, status: "expired" } }),
      prisma.promotion.count({ where: { ...notDeleted, status: "paused" } }),
      prisma.promotion.count({ where: { ...notDeleted, status: "archived" } }),
      prisma.promotionRedemption.findMany({
        select: { discountAmount: true, finalAmount: true, originalAmount: true, promotionId: true, code: true },
      }),
      prisma.promotion.findMany({
        where: notDeleted,
        orderBy: { usedCount: "desc" },
        take: 5,
        select: { code: true, name: true, usedCount: true, applyAttemptCount: true },
      }),
    ]);
    let totalDiscount = 0;
    let totalRevenue = 0;
    for (const r of redemptions) {
      totalDiscount += Number(r.discountAmount) || 0;
      totalRevenue += Number(r.finalAmount) || 0;
    }
    const attempts = top.reduce((s, p) => s + (p.applyAttemptCount || 0), 0);
    const allAttempts = await prisma.promotion.aggregate({
      where: notDeleted,
      _sum: { applyAttemptCount: true, usedCount: true },
    });
    const attemptSum = allAttempts._sum.applyAttemptCount || 0;
    const usedSum = allAttempts._sum.usedCount || 0;
    return {
      active,
      expired,
      paused,
      archived,
      redemptionCount: redemptions.length,
      totalDiscount,
      totalRevenue,
      mostUsed: top,
      conversionRate: attemptSum > 0 ? Math.round((usedSum / attemptSum) * 1000) / 10 : 0,
      attempts: attemptSum || attempts,
    };
  },
};

module.exports = { PromotionRepository, normalizeCode, computeDiscount, planAmount };
