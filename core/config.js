// ============================================================
// core/config.js
// Central API configuration
// All tweakable settings live here
// ============================================================

const config = {
  // API identity
  name: "toonstream-api",
  version: "1.0.0",

  // Which provider to use by default
  defaultProvider: process.env.DEFAULT_PROVIDER || "toonstream",

  // Axios request timeout in milliseconds
  timeout: parseInt(process.env.REQUEST_TIMEOUT || "15000", 10),

  // In-memory cache settings
  cache: {
    // Time-to-live in seconds (default: 5 minutes)
    ttl: parseInt(process.env.CACHE_TTL || "300", 10),

    // Max number of cache entries before oldest are evicted
    maxSize: 200,
  },

  // List of all available providers
  // When you add a new provider, register it here
  providers: ["toonstream"],
  // Future:
  // providers: ["toonstream", "animesalt", "hianime", "animekai"],
};

export default config;
