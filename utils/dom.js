// ============================================================
// utils/dom.js
// Cheerio helper functions for safe DOM parsing.
// All selectors return empty fallbacks instead of crashing.
// ============================================================

import * as cheerio from "cheerio";

/**
 * Load an HTML string into a Cheerio instance.
 *
 * @param {string} html
 * @returns {cheerio.CheerioAPI}
 */
export function loadHtml(html) {
  return cheerio.load(html);
}

/**
 * Safely get trimmed text from a selector.
 * Returns empty string if element doesn't exist.
 *
 * @param {cheerio.CheerioAPI} $ - Loaded cheerio instance
 * @param {string} selector
 * @returns {string}
 */
export function safeText($, selector) {
  try {
    return $(selector).first().text().trim();
  } catch {
    return "";
  }
}

/**
 * Safely get an attribute value from a selector.
 * Returns empty string if element or attribute doesn't exist.
 *
 * @param {cheerio.CheerioAPI} $ - Loaded cheerio instance
 * @param {string} selector
 * @param {string} attr - Attribute name (e.g. "href", "src")
 * @returns {string}
 */
export function safeAttr($, selector, attr) {
  try {
    return $(selector).first().attr(attr)?.trim() || "";
  } catch {
    return "";
  }
}

/**
 * Normalise an image URL.
 * ToonStream uses protocol-relative URLs like "//image.tmdb.org/..."
 * This adds "https:" to make them absolute.
 *
 * @param {string} src
 * @returns {string}
 */
export function normaliseImageUrl(src) {
  if (!src) return "";
  if (src.startsWith("//")) return `https:${src}`;
  return src;
}

/**
 * Extract the slug from a ToonStream URL.
 * E.g. "https://toonstream.vip/series/jujutsu-kaisen/" → "jujutsu-kaisen"
 *
 * @param {string} url
 * @returns {string}
 */
export function extractSlug(url) {
  if (!url) return "";
  // Remove trailing slash and split — last segment is the slug
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || "";
}

/**
 * Extract post ID from a WordPress list-item class string.
 * E.g. "post-1914 series type-series ..." → "1914"
 *
 * @param {string} classStr
 * @returns {string}
 */
export function extractPostId(classStr) {
  if (!classStr) return "";
  const match = classStr.match(/\bpost-(\d+)\b/);
  return match ? match[1] : "";
}

/**
 * Extract type ("movies" or "series") from a list-item class string.
 *
 * @param {string} classStr
 * @returns {"movies"|"series"|""}
 */
export function extractType(classStr) {
  if (!classStr) return "";
  if (classStr.includes("type-movies")) return "movies";
  if (classStr.includes("type-series")) return "series";
  return "";
}
