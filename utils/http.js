// ============================================================
// utils/http.js
// Thin Axios wrapper with timeout, browser headers, and
// safe error handling. All provider scrapers use this.
// ============================================================

import axios from "axios";
import config from "../core/config.js";
import { buildHeaders } from "./request.js";

/**
 * Fetch a URL and return the raw HTML string.
 * Throws on network errors so callers can handle gracefully.
 *
 * @param {string} url           - Full URL to fetch
 * @param {object} [options]
 * @param {string} [options.referer]  - Optional Referer header
 * @param {string} [options.cookie]   - Optional Cookie header
 * @param {number} [options.timeout]  - Override default timeout (ms)
 * @returns {Promise<string>} HTML body
 */
export async function fetchHtml(url, options = {}) {
  const { referer = "", cookie = "", timeout = config.timeout } = options;

  const response = await axios.get(url, {
    headers: buildHeaders(referer, cookie),
    timeout,
    // Follow redirects (Vercel sometimes redirects)
    maxRedirects: 5,
    // Return raw text, not parsed JSON
    responseType: "text",
    // Don't throw on 4xx/5xx — let cheerio parse what we get
    validateStatus: (status) => status < 500,
  });

  return response.data;
}
