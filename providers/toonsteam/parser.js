// ============================================================
// providers/toonstream/parser.js
// Reusable parsing helpers for ToonStream HTML pages.
// All functions receive a Cheerio instance ($) and extract data.
// ============================================================

import {
  normaliseImageUrl,
  extractSlug,
  extractPostId,
  extractType,
} from "../../utils/dom.js";
import { TOONSTREAM_BASE } from "../../constants/baseurl.js";

/**
 * Parse a single card <article> element (used in lists).
 * Returns a normalised card object.
 *
 * @param {cheerio.Cheerio} el - The <li> or <article> element
 * @param {cheerio.CheerioAPI} $ - Cheerio instance
 * @returns {object}
 */
export function parseCard($, el) {
  const li = $(el);
  const classStr = li.attr("class") || "";

  const article = li.find("article").first();
  const title = article.find("h2.entry-title").text().trim();
  const url = article.find("a.lnk-blk").attr("href") || "";
  const imgSrc = article.find("img").attr("src") || "";
  const rating = article.find(".vote .num").text().trim() ||
                 article.find(".vote").text().replace("TMDB", "").trim();

  const type = extractType(classStr);
  const id = extractPostId(classStr) || extractSlug(url);

  return {
    id,
    title,
    url,
    image: normaliseImageUrl(imgSrc),
    rating: rating || null,
    type, // "movies" | "series"
  };
}

/**
 * Parse all cards from a post list.
 * Works on search results, category pages, series/movies archives.
 *
 * @param {cheerio.CheerioAPI} $
 * @param {string} [containerSelector] - Defaults to "ul.post-lst li"
 * @returns {object[]}
 */
export function parseCardList($, containerSelector = "ul.post-lst li") {
  const results = [];

  $(containerSelector).each((_, el) => {
    try {
      const card = parseCard($, el);
      if (card.title) results.push(card);
    } catch {
      // Skip malformed entries silently
    }
  });

  return results;
}

/**
 * Parse genres from a series/movie detail page.
 * Reads the <span class="genres"> element.
 *
 * @param {cheerio.CheerioAPI} $
 * @returns {string[]}
 */
export function parseGenres($) {
  const genres = [];
  $("span.genres a").each((_, el) => {
    const text = $(el).text().trim();
    if (text) genres.push(text);
  });
  return genres;
}

/**
 * Parse episode list items from a series detail page.
 * These are the thumbnail+title rows under #episode_by_temp.
 *
 * @param {cheerio.CheerioAPI} $
 * @returns {object[]}
 */
export function parseEpisodeList($) {
  const episodes = [];

  $("#episode_by_temp li, section.episodes li").each((_, el) => {
    try {
      const article = $(el).find("article");
      const epNum = article.find("span.num-epi").text().trim();
      const title = article.find("h2.entry-title").text().trim();
      const url = article.find("a.lnk-blk").attr("href") || "";
      const imgSrc = article.find("img").attr("src") || "";
      const time = article.find("span.time").text().trim();

      if (url) {
        episodes.push({
          id: extractSlug(url),
          episode: epNum,
          title,
          url,
          thumbnail: normaliseImageUrl(imgSrc),
          aired: time || null,
        });
      }
    } catch {
      // Skip bad entries
    }
  });

  return episodes;
}

/**
 * Parse streaming server sources from a movie or episode page.
 * Reads the iframe #aa-options divs and the .video-options sidebar.
 *
 * @param {cheerio.CheerioAPI} $
 * @param {string} baseUrl - ToonStream base URL for building iframe embed URLs
 * @returns {object[]}
 */
export function parseSources($, baseUrl = TOONSTREAM_BASE) {
  const sources = [];

  // The sidebar shows language tabs + server buttons
  // Each server button links to #options-N
  // The actual iframe src is in div#options-N
  $(".video-options ul.aa-tbs-video li").each((_, el) => {
    try {
      const btn = $(el).find("a.btn");
      const href = btn.attr("href") || ""; // e.g. "#options-0"
      const serverSpan = btn.find("span.server").text().trim();

      // Parse server name and language from "ServerName-Language" format
      const [rawServer, rawLang] = serverSpan.split("-");
      const serverName = rawServer?.trim() || "Unknown";
      const language = rawLang?.trim() || "Unknown";

      // Derive the option index from href ("#options-0" → "0")
      const optionMatch = href.match(/#options-(\d+)/);
      const optionIndex = optionMatch ? optionMatch[1] : null;

      // Get the iframe src for this server
      let iframeSrc = "";
      if (optionIndex !== null) {
        const iframeDiv = $(`#options-${optionIndex}`);
        // Active (first) iframe has src; lazy ones have data-src
        iframeSrc =
          iframeDiv.find("iframe").attr("src") ||
          iframeDiv.find("iframe").attr("data-src") ||
          "";
      }

      if (serverName) {
        sources.push({
          server: serverName,
          language,
          embedUrl: iframeSrc || null,
          index: optionIndex ? parseInt(optionIndex, 10) : null,
        });
      }
    } catch {
      // Skip
    }
  });

  return sources;
}

/**
 * Parse seasons from a series detail page.
 *
 * @param {cheerio.CheerioAPI} $
 * @returns {object[]}
 */
export function parseSeasons($) {
  const seasons = [];

  $("ul.aa-cnt.sub-menu li.sel-temp a").each((_, el) => {
    const text = $(el).text().trim();
    const season = $(el).attr("data-season");
    const postId = $(el).attr("data-post");

    if (season) {
      seasons.push({
        season: parseInt(season, 10),
        label: text,
        postId: postId || null,
      });
    }
  });

  return seasons;
}

/**
 * Parse next / previous episode navigation links.
 *
 * @param {cheerio.CheerioAPI} $
 * @returns {{ prev: string|null, next: string|null, seriesUrl: string|null }}
 */
export function parseEpisodeNav($) {
  const navWrapper = $(".epsdsnv");

  const prevLink = navWrapper.find("a:has(.fa-step-backward)").attr("href") || null;
  const nextLink = navWrapper.find("a:has(.fa-step-forward)").attr("href") || null;
  const seriesLink =
    navWrapper.find("a:has(.fa-indent)").attr("href") || null;

  return {
    prev: prevLink,
    next: nextLink,
    seriesUrl: seriesLink,
  };
}
