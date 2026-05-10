import http from "../../utils/http.js";
import cache from "../../utils/cache.js";
import { BASE_URLS } from "../../constants/baseurl.js";
import { parseSearchPage, parseLetterPage } from "./parser.js";

const BASE = BASE_URLS.toonstream;

export async function searchAnime(query, page = 1) {
  if (!query || query.trim().length < 1) {
    throw Object.assign(new Error("Search query is required"), { status: 400 });
  }

  const q = query.trim();
  const cacheKey = `search:${q}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const encodedQ = encodeURIComponent(q);
  const url =
    page > 1
      ? `${BASE}/search/${encodedQ}/page/${page}/`
      : `${BASE}/search/${encodedQ}/`;

  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseSearchPage(html, q);
  cache.set(cacheKey, data, "search");
  return data;
}

export async function browseByLetter(letter, page = 1) {
  const cacheKey = `letter:${letter}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url =
    page > 1
      ? `${BASE}/home/letter/${letter}/page/${page}/`
      : `${BASE}/home/letter/${letter}/`;

  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseLetterPage(html, letter);
  cache.set(cacheKey, data, "letter");
  return data;
}

export default { searchAnime, browseByLetter };
