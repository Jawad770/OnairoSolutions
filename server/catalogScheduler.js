/**
 * Auto-publish catalog items and plans when publishAt is due.
 */
const { CatalogRepository: catalog } = require("./db/repositories/catalog");

async function promoteDue(now = new Date()) {
  const [items, plans] = await Promise.all([
    catalog.listDueScheduledItems(now),
    catalog.listDueScheduledPlans(now),
  ]);
  let count = 0;
  for (const item of items) {
    const payload = item.scheduledPayloadJson && typeof item.scheduledPayloadJson === "object"
      ? item.scheduledPayloadJson
      : {};
    await catalog.updateItem(item.id, {
      ...payload,
      workflowStatus: "published",
      publishedAt: now,
      publishAt: null,
      scheduledPayloadJson: null,
    });
    count += 1;
  }
  for (const plan of plans) {
    const payload = plan.scheduledPayloadJson && typeof plan.scheduledPayloadJson === "object"
      ? plan.scheduledPayloadJson
      : {};
    await catalog.updatePlan(plan.id, {
      ...payload,
      workflowStatus: "published",
      publishedAt: now,
      publishAt: null,
      scheduledPayloadJson: null,
    });
    count += 1;
  }
  return count;
}

function startCatalogScheduler(intervalMs = 60 * 1000) {
  const run = () => {
    promoteDue()
      .then((n) => {
        if (n > 0) {
          // eslint-disable-next-line no-console
          console.log(`[Catalog] Auto-published ${n} scheduled change(s)`);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[Catalog] Scheduler failed:", err?.message || err);
      });
  };
  const startup = setTimeout(run, 10_000);
  if (typeof startup.unref === "function") startup.unref();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

module.exports = { startCatalogScheduler, promoteDue };
