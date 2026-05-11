// ============================================================
// providers/toonstream/search.js
// Search scraping logic for ToonStream.
//
// ToonStream search URL pattern: https://toonstream.vip/?s=naruto
// Results page is the same WordPress list layout as all other pages.
// ============================================================

import { fetchHtml } from "../../utils/http.js";
import { loadHtml, extractSlug } from "../../utils/dom.js";
import { parseCardList } from "./parser.js";
import { cacheGet, cacheSet } from "../../utils/cache.js";
import { TOONSTREAM_BASE } from "../../constants/baseurl.js";

/**
 * Search ToonStream for anime/series/movies by title.
 *
 * @param {string} query - Search term (e.g. "naruto", "jujutsu kaisen")
 * @returns {Promise<object[]>} Array of result cards
 */
export async function search(query) {
  if (!query || !query.trim()) return [];

  const q = query.trim();
  const cacheKey = `search:${q.toLowerCase()}`;

  // Return cached result if available
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // ToonStream uses WordPress's ?s= parameter for search
  const url = `${TOONSTREAM_BASE}/?s=${encodeURIComponent(q)}`;

  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  const results = parseCardList($);

  // Enrich results with type-aware URLs
  const enriched = results.map((card) => ({
    ...card,
    id: extractSlug(card.url),
  }));

  // Cache for 2 minutes (search results change less often)
  cacheSet(cacheKey, enriched, 120);

  return enriched;
}
