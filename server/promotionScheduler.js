/**
 * Auto-expire promotions when endsAt is past and autoExpire is enabled.
 */
const { PromotionRepository: promotions } = require("./db/repositories/promotions");

async function expireDuePromotions(now = new Date()) {
  return promotions.expireDue(now);
}

function startPromotionScheduler(intervalMs = 60 * 1000) {
  const run = () => {
    expireDuePromotions()
      .then((n) => {
        if (n > 0) {
          // eslint-disable-next-line no-console
          console.log(`[Promotions] Auto-expired ${n} promotion(s)`);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[Promotions] Scheduler failed:", err?.message || err);
      });
  };
  const startup = setTimeout(run, 15_000);
  if (typeof startup.unref === "function") startup.unref();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

module.exports = { startPromotionScheduler, expireDuePromotions };
