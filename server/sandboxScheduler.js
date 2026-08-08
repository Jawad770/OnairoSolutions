/**
 * Auto-publish due sandbox publish jobs.
 */
const { SandboxRepository: sandbox } = require("./db/repositories/sandbox");

async function runSandboxScheduler(now = new Date()) {
  return sandbox.runDuePublishJobs(now);
}

function startSandboxScheduler(intervalMs = 60 * 1000) {
  const run = () => {
    runSandboxScheduler()
      .then((n) => {
        if (n > 0) {
          // eslint-disable-next-line no-console
          console.log(`[Sandbox] Auto-published ${n} scheduled sandbox job(s)`);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[Sandbox] Scheduler failed:", err?.message || err);
      });
  };
  const startup = setTimeout(run, 15_000);
  if (typeof startup.unref === "function") startup.unref();
  const timer = setInterval(run, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

module.exports = { startSandboxScheduler, runSandboxScheduler };
