// ============================================================
// utils/request.js
// Builds browser-like request headers to avoid bot detection.
// Used by http.js when making requests to ToonStream.
// ============================================================

/**
 * Returns a headers object that looks like a real browser request.
 *
 * @param {string} [referer] - Referer URL to include (optional)
 * @param {string} [cookie]  - Cookie string to include (optional)
 * @returns {object}
 */
export function buildHeaders(referer = "", cookie = "") {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Cache-Control": "max-age=0",
  };

  if (referer) {
    headers["Referer"] = referer;
    headers["Sec-Fetch-Site"] = "same-origin";
  }

  if (cookie) {
    headers["Cookie"] = cookie;
  }

  return headers;
}
