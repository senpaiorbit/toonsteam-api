// ============================================================
// providers/toonstream/parser.js
// Reusable parsing helpers – updated selectors
// ============================================================
import {
  normaliseImageUrl,
  extractSlug,
  extractPostId,
  extractType,
} from "../../utils/dom.js";
import { TOONSTREAM_BASE } from "../../constants/baseurl.js";

/**
 * Parse a single card from a list-item.
 * Supports both <li> and <article> containers.
 */
export function parseCard($, el) {
  const li = $(el);
  const classStr = li.attr("class") || "";
  const article = li.find("article").first();
  const title = article.find("h2.entry-title, .title").first().text().trim();
  const url = article.find("a.lnk-blk, a").first().attr("href") || "";
  const imgSrc = article.find("img").attr("src") || article.find("img").attr("data-src") || "";
  const rating =
    article.find(".vote .num, .rating").first().text().trim() ||
    article.find(".vote").text().replace("TMDB", "").trim();

  const type = extractType(classStr);
  const id = extractPostId(classStr) || extractSlug(url);

  return {
    id,
    title,
    url,
    image: normaliseImageUrl(imgSrc),
    rating: rating || null,
    type, // "movies" | "series" | ""
  };
}

/**
 * Parse all cards from any container.
 * Default selector catches both ul.post-lst and section widgets.
 */
export function parseCardList($, containerSelector = "ul.post-lst li, .widget li, .movies-list .item, .series-list .item") {
  const results = [];
  $(containerSelector).each((_, el) => {
    try {
      const card = parseCard($, el);
      if (card.title && card.url) results.push(card);
    } catch {
      // skip malformed
    }
  });
  return results;
}

// Genre parser – unchanged
export function parseGenres($) {
  const genres = [];
  $("span.genres a, .genres a").each((_, el) => {
    const text = $(el).text().trim();
    if (text) genres.push(text);
  });
  return genres;
}

// Episode list parser – updated selector
export function parseEpisodeList($) {
  const episodes = [];
  $("ul#episode_by_temp li, ul.episodes-list li, .episode-li").each((_, el) => {
    try {
      const article = $(el).find("article");
      const epNum = article.find("span.num-epi, .ep-number").first().text().trim();
      const title = article.find("h2.entry-title, .title").first().text().trim();
      const url = article.find("a.lnk-blk, a").first().attr("href") || "";
      const imgSrc = article.find("img").attr("src") || article.find("img").attr("data-src") || "";
      const time = article.find("span.time, .release-date").first().text().trim();

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
      // skip
    }
  });
  return episodes;
}

// Server sources – updated selector for newer layout
export function parseSources($, baseUrl = TOONSTREAM_BASE) {
  const sources = [];

  // The sidebar / tabs
  $(".video-options ul.aa-tbs-video li, .server-list li").each((_, el) => {
    try {
      const btn = $(el).find("a.btn, .server-btn");
      const href = btn.attr("href") || "";
      const serverSpan = btn.find("span.server, .server-name").first().text().trim();

      // Parse "ServerName-Language"
      const parts = serverSpan.split("-");
      const serverName = parts[0]?.trim() || "Server";
      const language = parts[1]?.trim() || "Sub";

      const optionMatch = href.match(/#options-(\d+)|data-option="(\d+)"/);
      const optionIndex = optionMatch ? (optionMatch[1] || optionMatch[2]) : null;

      let iframeSrc = "";
      if (optionIndex !== null) {
        const iframeDiv = $(`#options-${optionIndex}`);
        iframeSrc =
          iframeDiv.find("iframe").attr("src") ||
          iframeDiv.find("iframe").attr("data-src") ||
          "";
      }

      sources.push({
        server: serverName,
        language,
        embedUrl: iframeSrc || null,
        index: optionIndex ? parseInt(optionIndex, 10) : null,
      });
    } catch {
      // skip
    }
  });

  return sources;
}

// Season parser – unchanged (works)
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

// Episode navigation – unchanged
export function parseEpisodeNav($) {
  const navWrapper = $(".epsdsnv");
  const prevLink = navWrapper.find("a:has(.fa-step-backward)").attr("href") || null;
  const nextLink = navWrapper.find("a:has(.fa-step-forward)").attr("href") || null;
  const seriesLink = navWrapper.find("a:has(.fa-indent)").attr("href") || null;
  return { prev: prevLink, next: nextLink, seriesUrl: seriesLink };
}

// ─── NEW: Homepage Section Parsers ──────────────────────────

/**
 * Parse a widget title (e.g. "Latest Episodes", "Random Movies")
 * from a WordPress widget header.
 */
export function parseWidgetTitle($, widgetEl) {
  return $(widgetEl).find("h2.widget-title, .widget-title, h3").first().text().trim();
}

/**
 * Extract a list of card items from a WordPress widget or custom section.
 * Returns an array of card objects.
 */
export function parseWidgetCards($, widgetEl) {
  return parseCardList($, widgetEl.find("li, .post, article").toString());
}
