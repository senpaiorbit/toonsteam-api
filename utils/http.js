/**
 * utils/http.js
 *
 * HTTP layer: axios fetching + cheerio parsing helpers.
 *
 * FIXES / ADDITIONS:
 *  - fetchAndParse(url, baseUrl, options)
 *    Fetches a page with axios and returns a ready-to-use cheerio `$`
 *    instance instead of raw HTML.  All scraping code can call this
 *    instead of `fetchPage` + manual `cheerio.load()`.
 *
 *  - fetchPage() is kept for back-compat; parser.js still calls it.
 *
 *  - normalizeProtocol(html): rewrites every `//image.tmdb.org/…` src
 *    to `https://image.tmdb.org/…` so callers never receive bare
 *    protocol-relative URLs when the page source uses `//`.
 *    (The parser's normalizeImageUrl already handles `//` but doing it
 *    once on the raw HTML is cheaper than per-element.)
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { buildHeaders } from "./request.js";

const TIMEOUT     = 15_000;
const MAX_RETRIES = 2;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Rewrite protocol-relative URLs like `//image.tmdb.org/…`
 * to `https://image.tmdb.org/…` across the entire HTML string.
 * This is the root cause of scraped `image` fields returning
 * `"//image.tmdb.org/…"` instead of a proper HTTPS URL.
 */
function normalizeProtocol(html) {
  if (typeof html !== "string") return html;
  return html.replace(/src="\/\//g, 'src="https://');
}

// ─── fetchPage ────────────────────────────────────────────────────────────────

/**
 * Fetches a URL and returns the raw HTML string.
 * Retries up to MAX_RETRIES times on transient errors.
 */
async function fetchPage(url, baseUrl, options = {}) {
  const { retries = MAX_RETRIES, referer = null } = options;
  const headers = buildHeaders(baseUrl, referer);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers,
        timeout: TIMEOUT,
        maxRedirects: 5,
        validateStatus: (status) => status < 500,
      });

      if (response.status === 404) {
        const error = new Error("Page not found");
        error.status = 404;
        throw error;
      }

      // FIX: normalise protocol-relative image URLs before returning
      return normalizeProtocol(response.data);
    } catch (error) {
      if (error.status === 404) throw error;
      if (attempt === retries)  throw error;
      await sleep(500 * (attempt + 1));
    }
  }
}

// ─── fetchAndParse ────────────────────────────────────────────────────────────

/**
 * Fetches a URL with axios and returns a cheerio `$` instance.
 *
 * Use this when you want to skip the raw-HTML step and go straight
 * to DOM queries, e.g. in utility files under /utils/:
 *
 *   import http from "../utils/http.js";
 *   const $ = await http.fetchAndParse("https://toonstream.vip/series/naruto/", BASE);
 *   const title = $("h1.entry-title").text().trim();
 *
 * @param {string} url      - Target URL
 * @param {string} baseUrl  - Origin (for headers)
 * @param {object} options  - Same as fetchPage (retries, referer)
 * @returns {CheerioAPI}    - Cheerio $ loaded with the page HTML
 */
async function fetchAndParse(url, baseUrl, options = {}) {
  const html = await fetchPage(url, baseUrl, options);
  return cheerio.load(html);
}

// ─── postAndParse (AJAX helper) ───────────────────────────────────────────────

/**
 * POSTs form data (URLSearchParams) and returns a cheerio `$` instance.
 * Used for the WordPress admin-ajax.php season-switch endpoint.
 *
 * @param {string}           url      - POST target
 * @param {URLSearchParams}  body     - Form body
 * @param {string}           baseUrl  - Origin (for headers / Referer)
 * @returns {CheerioAPI}
 */
async function postAndParse(url, body, baseUrl) {
  const headers = {
    ...buildHeaders(baseUrl, `${baseUrl}/`),
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "X-Requested-With": "XMLHttpRequest",
  };

  const response = await axios.post(url, body, {
    headers,
    timeout: TIMEOUT,
    validateStatus: (status) => status < 500,
  });

  const html = normalizeProtocol(
    typeof response.data === "string" ? response.data : JSON.stringify(response.data)
  );
  return cheerio.load(html);
}

export default { fetchPage, fetchAndParse, postAndParse };
