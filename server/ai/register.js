/**
 * Load compiled AI platform when available; otherwise load TypeScript via tsx.
 */
try {
  module.exports = require("./dist/index.js");
} catch {
  require("tsx/cjs/api").register();
  module.exports = require("./src/index.ts");
}
