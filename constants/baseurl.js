// ============================================================
// constants/baseurl.js
// Base URLs for all providers
// Add new provider URLs here as the project grows
// ============================================================

export const BASE_URLS = {
  // Current active provider
  toonstream: process.env.TOONSTREAM_BASE_URL || "https://toonstream.vip",

  // Future providers (add their URLs here when implemented)
  animesalt: "https://animesalt.cc",
  hianime: "https://hianime.to",
  animekai: "https://animekai.to",
};

// Convenience export for the default toonstream base URL
export const TOONSTREAM_BASE = BASE_URLS.toonstream;
