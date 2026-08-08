/**
 * Auto-publish scheduled marketing campaigns and expire ended ones.
 */
const { MarketingCampaignRepository: campaigns } = require("./db/repositories/marketingCampaigns");

async function runMarketingCampaignScheduler(now = new Date()) {
  const [published, expired] = await Promise.all([campaigns.promoteDue(now), campaigns.expireDue(now)]);
  return { published, expired };
}

function startMarketingCampaignScheduler(intervalMs = 60 * 1000) {
  const run = () => {
    runMarketingCampaignScheduler()
      .then(({ published, expired }) => {
        if (published || expired) {
          // eslint-disable-next-line no-console
          console.log(`[Marketing] published=${published} expired=${expired}`);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[Marketing] Scheduler failed:", err?.message || err);
      });
  };
  const startup = setTimeout(run, 12_000);
  if (typeof startup.unref === "function") startup.unref();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

module.exports = { startMarketingCampaignScheduler, runMarketingCampaignScheduler };
