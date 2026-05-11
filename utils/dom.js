// ============================================================
// utils/dom.js
// ============================================================
import * as cheerio from "cheerio";

export function loadHtml(html) {
  return cheerio.load(html);
}

export function safeText($, selector) {
  try {
    return $(selector).first().text().trim();
  } catch {
    return "";
  }
}

export function safeAttr($, selector, attr) {
  try {
    return $(selector).first().attr(attr)?.trim() || "";
  } catch {
    return "";
  }
}

export function normaliseImageUrl(src) {
  if (!src) return "";
  if (src.startsWith("//")) return `https:${src}`;
  return src;
}

export function extractSlug(url) {
  if (!url) return "";
  const parts = url.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || "";
}

export function extractPostId(classStr) {
  if (!classStr) return "";
  const match = classStr.match(/\bpost-(\d+)\b/);
  return match ? match[1] : "";
}

export function extractType(classStr) {
  if (!classStr) return "";
  if (classStr.includes("type-movies")) return "movies";
  if (classStr.includes("type-series")) return "series";
  return "";
}

/**
 * Safely get inner HTML (for description fields).
 */
export function safeHtml($, selector) {
  try {
    return $(selector).first().html()?.trim() || "";
  } catch {
    return "";
  }
}
