// ============================================================
// core/config.js
// ============================================================

const config = {
  name: "toonstream-api",
  version: "1.0.0",
  defaultProvider: process.env.DEFAULT_PROVIDER || "toonstream",
  timeout: parseInt(process.env.REQUEST_TIMEOUT || "15000", 10),

  cache: {
    ttl: parseInt(process.env.CACHE_TTL || "300", 10),
    maxSize: 200,
    // Separate TTL for the heavy homepage aggregation
    homePageTTL: 600, // 10 minutes
  },

  providers: ["toonstream"],
};

export default config;
