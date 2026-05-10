/**
 * utils/raw.js
 *
 * Hono route: GET /utils/raw?url={url}
 *
 * Fetches the page at `url` using the same axios + header stack as the
 * rest of the API and returns the raw HTML as plain text (Content-Type:
 * text/plain; charset=utf-8).
 *
 * Usage:
 *   GET /utils/raw?url=https://toonstream.vip/series/naruto/
 *
 * Errors:
 *   400  – ?url param missing or not a valid http/https URL
 *   404  – upstream page returned 404
 *   502  – upstream fetch failed (timeout, network error, etc.)
 *
 * Registration (add to api/index.js):
 *   import rawRoute from "../utils/raw.js";
 *   app.route("/utils", rawRoute);
 */

import { Hono } from "hono";
import axios from "axios";
import { buildHeaders } from "./request.js";
import { BASE_URLS } from "../constants/baseurl.js";

const app  = new Hono();
const BASE = BASE_URLS.toonstream;

const TIMEOUT     = 15_000;
const MAX_RETRIES = 2;

// ─── helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Validate that `str` is an absolute http/https URL.
 * Returns the URL string on success, null on failure.
 */
function parseUrl(str) {
  try {
    const u = new URL(str);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

/**
 * Fetch raw HTML from `url` with retries.
 * Uses the same headers (User-Agent rotation, Referer, etc.) as http.js.
 */
async function fetchRaw(url, retries = MAX_RETRIES) {
  const headers = buildHeaders(BASE, BASE + "/");

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.get(url, {
        headers,
        timeout: TIMEOUT,
        maxRedirects: 5,
        // Accept any non-5xx status so we can surface 404 properly
        validateStatus: (status) => status < 500,
        // Force string response regardless of Content-Type
        responseType: "text",
        // Disable automatic JSON parsing
        transformResponse: [(data) => data],
      });

      if (response.status === 404) {
        const err = new Error("Remote page not found");
        err.status = 404;
        throw err;
      }

      return response.data; // raw HTML string
    } catch (error) {
      if (error.status === 404) throw error;
      if (attempt === retries) throw error;
      await sleep(500 * (attempt + 1));
    }
  }
}

// ─── route: GET /raw ──────────────────────────────────────────────────────────

app.get("/raw", async (c) => {
  // 1. Validate ?url= param
  const rawParam = c.req.query("url");

  if (!rawParam) {
    return c.text(
      "Missing required query parameter: ?url={url}\n\n" +
      "Example: /utils/raw?url=https://toonstream.vip/series/naruto/",
      400
    );
  }

  const targetUrl = parseUrl(rawParam);
  if (!targetUrl) {
    return c.text(
      `Invalid URL: "${rawParam}"\n` +
      "URL must be absolute and start with http:// or https://",
      400
    );
  }

  // 2. Fetch
  let html;
  try {
    html = await fetchRaw(targetUrl);
  } catch (error) {
    if (error.status === 404) {
      return c.text(`404 – Page not found: ${targetUrl}`, 404);
    }
    return c.text(
      `502 – Failed to fetch ${targetUrl}\n` +
      (error.message || "Unknown network error"),
      502
    );
  }

  // 3. Return raw HTML as plain text
  c.header("Content-Type", "text/plain; charset=utf-8");
  // Helpful headers so callers know what they got
  c.header("X-Fetched-Url", targetUrl);
  c.header("X-Content-Length", String(html.length));
  return c.body(html, 200);
});

export default app;
