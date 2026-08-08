/**
 * PM2 process file — limits restart loops on fatal startup errors.
 * Start: pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: "onairo-solutions",
      script: "server/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      min_uptime: "10s",
      max_restarts: 8,
      restart_delay: 4000,
      exp_backoff_restart_delay: 1000,
      kill_timeout: 16000,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
