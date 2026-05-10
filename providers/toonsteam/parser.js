/**
 * toonstream/parser.js
 * Pure HTML parsing — cheerio selectors only.
 * All selectors verified against real page HTML.
 *
 * FIXES applied (verified against uploaded real HTML files):
 *  - Home: added randomSeries (#widget_list_movies_series-4) and
 *    randomMovies (#widget_list_movies_series-5) sections
 *  - Episode nav: handle <span> (disabled prev/next) as well as <a>
 *  - Episode servers: multiple ul.aa-tbs-video exist (one per language
 *    group). Only read the FIRST / active group to avoid duplicate
 *    server numbers. Also deduplicate by serverNumber.
 *  - Server name parsing: trim internal whitespace/newlines from
 *    .server span text (real HTML has lots of padding whitespace)
 *  - Episode AJAX parser: selector aligned with real HTML class names
 */

import * as cheerio from "cheerio";
import { normalizeImageUrl, extractSlugFromUrl } from "../../utils/dom.js";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function load(html) {
  return cheerio.load(html);
}

function txt($, selector, context) {
  return $(selector, context).first().text().trim() || null;
}

// ─── HOME PAGE ────────────────────────────────────────────────────────────────
//
// Real HTML section IDs (verified):
//   widget_list_episodes-8      → Latest Episodes  (class: widget_list_episodes)
//   widget_list_movies_series-2 → Latest Series
//   widget_list_movies_series-3 → Latest Movies
//   widget_list_movies_series-4 → Random Series
//   widget_list_movies_series-5 → Random Movies
//   gs_logo_area_1              → Featured / Franchise logos
//   gs_logo_area_3              → Language logos
//
// Structure verified:
//   section#widget_list_episodes-8.widget_list_episodes
//     ul.post-lst > li > article.post.dfx.fcl.episodes
//       div.post-thumbnail > figure > img[src]
//       header.entry-header
//         span.num-epi
//         h2.entry-title
//         div.entry-meta > span.time
//       a.lnk-blk[href]
//
//   section#widget_list_movies_series-2
//     div.aa-cn > div#widget_list_movies_series-2-all.aa-tb
//       ul.post-lst > li > article.post.dfx.fcl.movies
//         span.vote > span (inner "TMDB" text) + bare text = rating

export function parseHomePage(html) {
  const $ = load(html);

  // ── Latest Episodes ─────────────────────────────────────────────────────────
  const latestEpisodes = [];
  $(".widget_list_episodes .post-lst li article").each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href") || null;
    const title = txt($, ".entry-title", el);
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    const episodeNumber = txt($, ".num-epi", el);
    const time = txt($, ".time", el);
    if (title) {
      latestEpisodes.push({
        title,
        episodeNumber,
        image,
        time,
        url,
        slug: extractSlugFromUrl(url),
      });
    }
  });

  // ── Series / Movies widget helper ─────────────────────────────────────────
  //
  // FIX 1 — selector: use the section-level descendant selector which works
  //   for both wdgt-home AND wdgt-sidebar sections. Also add -all tab
  //   container as a precise fallback.
  //
  // FIX 2 — image: try data-src fallback for lazy-load <img> tags.
  //
  // FIX 3 — rating: `|| null` was silently dropping "0" scores (e.g.
  //   Karna the Guardian has TMDB 0). Use explicit empty-string check.
  function scrapeMoviesWidget(sectionId) {
    const items = [];

    // Try section-scoped selector first; if the section doesn't exist fall
    // back to the inner -all tab container (same data, more specific path)
    const baseSelector = $(`#${sectionId}`).length
      ? `#${sectionId} .post-lst li article`
      : `#${sectionId}-all .post-lst li article`;

    $(baseSelector).each((_, el) => {
      const url   = $(el).find("a.lnk-blk").attr("href") || null;
      const title = txt($, ".entry-title", el);
      const imgEl = $(el).find("img").first();
      // FIX: also check data-src for lazy-loaded images
      const image = normalizeImageUrl(
        imgEl.attr("src") || imgEl.attr("data-src") || null
      );

      // vote: <span class="vote"><span>TMDB</span> 7.25</span>
      // Clone + strip inner spans to get the bare score text node.
      const voteEl    = $(el).find(".vote");
      const ratingRaw = voteEl.clone().children().remove().end().text().trim();
      // FIX: "0" is a valid rating — only map empty string to null
      const rating = ratingRaw !== "" ? ratingRaw : null;

      if (title) {
        items.push({
          title,
          image,
          rating,
          url,
          slug: extractSlugFromUrl(url),
        });
      }
    });
    return items;
  }

  const latestSeries  = scrapeMoviesWidget("widget_list_movies_series-2");
  const latestMovies  = scrapeMoviesWidget("widget_list_movies_series-3");
  const randomSeries  = scrapeMoviesWidget("widget_list_movies_series-4");
  const randomMovies  = scrapeMoviesWidget("widget_list_movies_series-5");

  // ── Languages (gs_logo_area_3) ────────────────────────────────────────────
  const languages = [];
  $("#gs_logo_area_3 .gs_logo_single--wrapper").each((_, el) => {
    const a = $(el).find("a").first();
    const img = $(el).find("img").first();
    const link = a.attr("href") || null;
    const name = img.attr("title") || img.attr("alt") || null;
    const image = normalizeImageUrl(img.attr("src"));
    if (name) languages.push({ name, image, url: link });
  });

  // ── Featured / Franchise logos (gs_logo_area_1) ──────────────────────────
  const featured = [];
  $("#gs_logo_area_1 .gs_logo_single--wrapper").each((_, el) => {
    const a = $(el).find("a").first();
    const img = $(el).find("img").first();
    const link = a.attr("href") || null;
    const name = img.attr("title") || img.attr("alt") || null;
    const image = normalizeImageUrl(img.attr("src"));
    if (name) featured.push({ name, image, searchUrl: link });
  });

  return {
    latestEpisodes,
    latestSeries,
    latestMovies,
    randomSeries,
    randomMovies,
    languages,
    featured,
  };
}

// ─── SERIES PAGE ──────────────────────────────────────────────────────────────
//
// Real HTML layout verified from series__slug_.html:
//   .post-thumbnail > figure > img           (poster)
//   h1.entry-title                           (title)
//   span.genres > a                          (categories)
//   span.duration                            (duration)
//   span.year                                (year)
//   span.seasons > span                      (season count)
//   span.episodes > span                     (episode count)
//   div.description                          (description)
//   ul.cast-lst > li > a                     (cast)
//   span.vote.fa-star > span.num             (rating)
//   div.choose-season ul li.sel-temp > a[data-post][data-season]
//   ul#episode_by_temp li article            (current season episodes)

export function parseSeriesPage(html, slug) {
  const $ = load(html);

  const title = $("h1.entry-title").first().text().trim() || null;
  const image = normalizeImageUrl($(".post-thumbnail figure img").first().attr("src"));
  const description =
    $(".description p").first().text().trim() ||
    $(".description").first().text().trim().split("\n")[0].trim() ||
    null;
  const rating = $("span.vote .num").first().text().trim() || null;
  const year = $("span.year").first().text().replace(/\D/g, "").trim() || null;
  const duration = $("span.duration").first().text().replace("min.", "").trim() || null;
  const totalSeasons = parseInt($("span.seasons span").first().text()) || null;
  const totalEpisodes = parseInt($("span.episodes span").first().text()) || null;

  const categories = [];
  $("span.genres a").each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const cast = [];
  $("ul.cast-lst li a").each((_, el) => {
    const name = $(el).text().trim();
    if (name) cast.push({ name, url: $(el).attr("href") });
  });

  // Available seasons: .choose-season ul li.sel-temp > a[data-season][data-post]
  const availableSeasons = [];
  $(".choose-season ul li.sel-temp a").each((_, el) => {
    const seasonNum = parseInt($(el).attr("data-season"));
    const postId = $(el).attr("data-post");
    const name = $(el).text().trim();
    if (!isNaN(seasonNum)) {
      availableSeasons.push({ seasonNumber: seasonNum, name, postId });
    }
  });

  const episodes = parseEpisodeList($, "#episode_by_temp");

  return {
    slug,
    title,
    image,
    description,
    rating,
    year,
    duration,
    totalSeasons,
    totalEpisodes,
    categories,
    tags: [],
    cast,
    availableSeasons,
    episodes,
  };
}

// ─── EPISODES LIST (reusable) ─────────────────────────────────────────────────
//
// Real HTML: ul#episode_by_temp > li > article.post.dfx.fcl.episodes.fa-play-circle.lg
//   div.post-thumbnail > figure > img[src]
//   header.entry-header
//     span.num-epi
//     h2.entry-title
//     div.entry-meta > span.time
//   a.lnk-blk[href]

export function parseEpisodeList($, containerSelector) {
  const episodes = [];
  $(`${containerSelector} li article`).each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href") || null;
    const title = txt($, ".entry-title", el);
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    const episodeNumber = txt($, ".num-epi", el);
    const time = txt($, ".time", el);
    if (title || url) {
      episodes.push({
        title,
        episodeNumber,
        image,
        time,
        url,
        slug: extractSlugFromUrl(url),
      });
    }
  });
  return episodes;
}

// ─── EPISODE PAGE ─────────────────────────────────────────────────────────────
//
// FIX 1 – Navigation: Real HTML uses <span> for disabled nav buttons and <a>
//   for active ones. Old code only looked at <a> inside .epsdsnv, so "Previous"
//   was always null even when present as a span placeholder.
//   We now read ALL children of .epsdsnv and only extract href from <a> tags,
//   detecting direction by icon class or text content.
//
// FIX 2 – Server buttons: Real HTML has MULTIPLE ul.aa-tbs-video elements —
//   one per language group (Multi Audio, Hindi-Jap, etc.), each inside its own
//   div.lrt. The selector ".video-options .aa-tbs-video li a.btn" matches ALL
//   groups, producing duplicated server numbers (e.g. two "#options-1" entries).
//   Fix: only read the FIRST div.lrt (the active/default language group).
//   Then deduplicate by serverNumber just in case.
//
// FIX 3 – Server name trimming: The .server span in real HTML contains lots of
//   internal whitespace/newlines. Use .replace(/\s+/g, " ").trim() to clean up.

export function parseEpisodePage(html, slug) {
  const $ = load(html);

  const title = $("h1.entry-title, h2.entry-title").first().text().trim() || null;
  const image = normalizeImageUrl($(".post-thumbnail figure img").first().attr("src"));
  const description = $(".description p").first().text().trim() || null;
  const rating = $("span.vote .num").first().text().trim() || null;
  const year = $("span.year").first().text().replace(/\D/g, "").trim() || null;
  const duration = $("span.duration").first().text().replace("min.", "").trim() || null;

  const categories = [];
  $("span.genres a").each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const cast = [];
  $("ul.cast-lst li a").each((_, el) => {
    const name = $(el).text().trim();
    if (name) cast.push({ name, url: $(el).attr("href") });
  });

  // ── Navigation (FIX 1) ───────────────────────────────────────────────────
  // Real HTML: .epsdsnv contains a mix of <a> and <span> elements.
  // <span> = disabled button (no prev/next episode exists)
  // <a>    = active link
  // Detect by icon class: fa-step-backward=prev, fa-step-forward=next, fa-indent=series
  let prevUrl = null;
  let nextUrl = null;
  let seriesUrl = null;

  $(".epsdsnv").find("a, span").each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const href = tag === "a" ? ($(el).attr("href") || "") : "";
    const icons = $(el).find("i, [class*='fa-']").map((_, i) => $(i).attr("class") || "").get().join(" ");
    const text = $(el).text().toLowerCase();

    const isPrev =
      icons.includes("fa-step-backward") ||
      icons.includes("fa-backward") ||
      icons.includes("fa-chevron-left") ||
      text.includes("previous");
    const isNext =
      icons.includes("fa-step-forward") ||
      icons.includes("fa-forward") ||
      icons.includes("fa-chevron-right") ||
      text.includes("next");
    const isSeries =
      icons.includes("fa-indent") ||
      icons.includes("fa-list") ||
      href.includes("/series/") ||
      text.includes("season");

    if (isPrev && !prevUrl && href) prevUrl = href;
    else if (isNext && !nextUrl && href) nextUrl = href;
    else if (isSeries && !seriesUrl && href) seriesUrl = href;
  });

  // ── Iframes (video player) ───────────────────────────────────────────────
  const iframes = [];
  $(".video-player div[id^='options-']").each((_, el) => {
    const id = $(el).attr("id"); // "options-0", "options-1" …
    const num = parseInt(id.replace("options-", ""), 10);
    const src =
      $(el).find("iframe").attr("src") ||
      $(el).find("iframe").attr("data-src") ||
      null;
    iframes.push({ serverNumber: num, src });
  });

  // ── Server buttons (FIX 2 & 3) ──────────────────────────────────────────
  // Only read the FIRST div.lrt inside .video-options to avoid duplicate
  // server entries from multiple language group tabs.
  const firstLrt = $(".video-options .lrt").first();
  const serverButtons = [];
  const seenNums = new Set();

  (firstLrt.length ? firstLrt : $(".video-options")).find(".aa-tbs-video li a.btn").each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = parseInt(href.replace("#options-", ""), 10);
    if (isNaN(num) || seenNums.has(num)) return;
    seenNums.add(num);

    const displayNum =
      parseInt($(el).find("span:not(.server)").first().text().trim()) || num + 1;

    // Clean up whitespace from .server span (real HTML has lots of newlines)
    const serverRaw = $(el).find(".server").text().replace(/\s+/g, " ").trim();
    const dashIdx = serverRaw.lastIndexOf("-");
    const serverName =
      dashIdx > 0 ? serverRaw.slice(0, dashIdx).trim() : serverRaw || null;
    const language = dashIdx > 0 ? serverRaw.slice(dashIdx + 1).trim() : null;

    serverButtons.push({
      serverNumber: num,
      displayNumber: displayNum,
      name: serverName || null,
      language: language || null,
    });
  });

  // ── Merge iframes + buttons ──────────────────────────────────────────────
  const servers = iframes.map((iframe) => {
    const btn = serverButtons.find((b) => b.serverNumber === iframe.serverNumber);
    return {
      serverNumber: iframe.serverNumber,
      displayNumber: btn?.displayNumber ?? iframe.serverNumber + 1,
      name: btn?.name || `Server ${iframe.serverNumber + 1}`,
      language: btn?.language || null,
      src: iframe.src,
      isActive: iframe.serverNumber === 0,
    };
  });

  // ── Available seasons (sidebar dropdown) ─────────────────────────────────
  const availableSeasons = [];
  $(".choose-season ul li.sel-temp a").each((_, el) => {
    const seasonNum = parseInt($(el).attr("data-season"));
    const name = $(el).text().trim();
    if (!isNaN(seasonNum)) availableSeasons.push({ seasonNumber: seasonNum, name });
  });

  // ── Episode list sidebar ──────────────────────────────────────────────────
  const episodeList = parseEpisodeList($, "#episode_by_temp");

  return {
    slug,
    title,
    image,
    description,
    rating,
    year,
    duration,
    categories,
    cast,
    navigation: {
      previousEpisode: prevUrl,
      nextEpisode: nextUrl,
      seriesPage: seriesUrl,
    },
    servers,
    availableSeasons,
    episodeList,
  };
}

// ─── MOVIES PAGE (listing) ────────────────────────────────────────────────────

export function parseMoviesListPage(html) {
  const $ = load(html);
  const items = [];

  $("ul.post-lst li").each((_, li) => {
    const article = $(li).find("article").first();
    if (!article.length) return;
    const url = article.find("a.lnk-blk").attr("href") || null;
    if (!url) return;

    const title = txt($, ".entry-title", article);
    const image = normalizeImageUrl(article.find("img").attr("src"));
    const voteEl = article.find(".vote");
    const ratingRaw = voteEl.clone().children().remove().end().text().trim(); const rating = ratingRaw !== "" ? ratingRaw : null;
    const liClass = $(li).attr("class") || "";
    const contentType =
      url.includes("/movies/") || liClass.includes(" movies ") ? "movie" : "series";

    items.push({
      title,
      image,
      rating,
      url,
      slug: extractSlugFromUrl(url),
      contentType,
    });
  });

  const pagination = parsePaginationFromHtml($);
  const sectionTitle =
    $("h1.section-title, h2.section-title, h3.section-title").first().text().trim() || null;

  return { sectionTitle, items, pagination };
}

// ─── MOVIE SINGLE PAGE ────────────────────────────────────────────────────────
// Same FIX 2 & 3 for server buttons applied here too.

export function parseMovieSinglePage(html, slug) {
  const $ = load(html);

  const title = $("h1.entry-title, h2.entry-title").first().text().trim() || null;
  const image = normalizeImageUrl($(".post-thumbnail figure img").first().attr("src"));
  const description = $(".description p").first().text().trim() || null;
  const rating = $("span.vote .num").first().text().trim() || null;
  const year = $("span.year").first().text().replace(/\D/g, "").trim() || null;
  const duration = $("span.duration").first().text().replace("min.", "").trim() || null;

  const categories = [];
  $("span.genres a").each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const cast = [];
  $("ul.cast-lst li a").each((_, el) => {
    const name = $(el).text().trim();
    if (name) cast.push({ name, url: $(el).attr("href") });
  });

  const iframes = [];
  $(".video-player div[id^='options-']").each((_, el) => {
    const id = $(el).attr("id");
    const num = parseInt(id.replace("options-", ""), 10);
    const src =
      $(el).find("iframe").attr("src") ||
      $(el).find("iframe").attr("data-src") ||
      null;
    iframes.push({ serverNumber: num, src });
  });

  const firstLrt = $(".video-options .lrt").first();
  const serverButtons = [];
  const seenNums = new Set();

  (firstLrt.length ? firstLrt : $(".video-options")).find(".aa-tbs-video li a.btn").each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = parseInt(href.replace("#options-", ""), 10);
    if (isNaN(num) || seenNums.has(num)) return;
    seenNums.add(num);
    const displayNum =
      parseInt($(el).find("span:not(.server)").first().text().trim()) || num + 1;
    const serverRaw = $(el).find(".server").text().replace(/\s+/g, " ").trim();
    const dashIdx = serverRaw.lastIndexOf("-");
    const serverName = dashIdx > 0 ? serverRaw.slice(0, dashIdx).trim() : serverRaw || null;
    const language = dashIdx > 0 ? serverRaw.slice(dashIdx + 1).trim() : null;
    serverButtons.push({ serverNumber: num, displayNumber: displayNum, name: serverName || null, language: language || null });
  });

  const servers = iframes.map((iframe) => {
    const btn = serverButtons.find((b) => b.serverNumber === iframe.serverNumber);
    return {
      serverNumber: iframe.serverNumber,
      displayNumber: btn?.displayNumber ?? iframe.serverNumber + 1,
      name: btn?.name || `Server ${iframe.serverNumber + 1}`,
      language: btn?.language || null,
      src: iframe.src,
      isActive: iframe.serverNumber === 0,
    };
  });

  return { slug, title, image, description, rating, year, duration, categories, cast, servers };
}

// ─── SEARCH RESULTS ───────────────────────────────────────────────────────────

export function parseSearchPage(html, query) {
  const $ = load(html);
  const results = [];

  $("ul.post-lst li").each((_, li) => {
    const article = $(li).find("article").first();
    if (!article.length) return;
    const url = article.find("a.lnk-blk").attr("href") || null;
    if (!url) return;

    const title = txt($, ".entry-title", article);
    const image = normalizeImageUrl(article.find("img").attr("src"));
    const voteEl = article.find(".vote");
    const ratingRaw = voteEl.clone().children().remove().end().text().trim(); const rating = ratingRaw !== "" ? ratingRaw : null;
    const id = $(li).attr("id") || null;
    const liClass = $(li).attr("class") || "";
    const contentType =
      liClass.includes(" movies ") || url.includes("/movies/") ? "movie" : "series";

    const categories = (liClass.match(/category-([^\s]+)/g) || [])
      .map((c) => c.replace("category-", "").replace(/-/g, " "))
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1));
    const tags = (liClass.match(/tag-([^\s]+)/g) || []).map((t) =>
      t.replace("tag-", "").replace(/-/g, " ")
    );

    results.push({ id, title, image, url, slug: extractSlugFromUrl(url), rating, contentType, categories, tags });
  });

  const seriesCount = results.filter((r) => r.contentType === "series").length;
  const moviesCount = results.filter((r) => r.contentType === "movie").length;

  return {
    searchQuery: query,
    hasResults: results.length > 0,
    results,
    stats: { resultsCount: results.length, seriesCount, moviesCount },
  };
}

// ─── CATEGORY PAGE ────────────────────────────────────────────────────────────

export function parseCategoryPage(html, path) {
  const $ = load(html);
  const items = [];

  $("ul.post-lst li").each((_, li) => {
    const article = $(li).find("article").first();
    if (!article.length) return;
    const url = article.find("a.lnk-blk").attr("href") || null;
    if (!url) return;
    const title = txt($, ".entry-title", article);
    const image = normalizeImageUrl(article.find("img").attr("src"));
    const voteEl = article.find(".vote");
    const ratingRaw = voteEl.clone().children().remove().end().text().trim(); const rating = ratingRaw !== "" ? ratingRaw : null;
    const liClass = $(li).attr("class") || "";
    const contentType =
      liClass.includes(" movies ") || url.includes("/movies/") ? "movie" : "series";
    items.push({ title, image, rating, url, slug: extractSlugFromUrl(url), contentType });
  });

  const sectionTitle =
    $("h1.section-title, h2.section-title, h3.section-title").first().text().trim() || null;
  const pagination = parsePaginationFromHtml($);

  return { categoryPath: path, sectionTitle, items, pagination };
}

// ─── CAST PAGE ────────────────────────────────────────────────────────────────

export function parseCastPage(html, name) {
  const $ = load(html);
  const items = [];

  $("ul.post-lst li").each((_, li) => {
    const article = $(li).find("article").first();
    if (!article.length) return;
    const url = article.find("a.lnk-blk").attr("href") || null;
    if (!url) return;
    const title = txt($, ".entry-title", article);
    const image = normalizeImageUrl(article.find("img").attr("src"));
    const voteEl = article.find(".vote");
    const ratingRaw = voteEl.clone().children().remove().end().text().trim(); const rating = ratingRaw !== "" ? ratingRaw : null;
    const contentType = url.includes("/movies/") ? "movie" : "series";
    items.push({ title, image, rating, url, slug: extractSlugFromUrl(url), contentType });
  });

  const sectionTitle =
    $("h1.section-title, h2.section-title, h3.section-title").first().text().trim() || null;
  const pagination = parsePaginationFromHtml($);

  return { castName: name, sectionTitle, items, pagination };
}

// ─── LETTER PAGE ─────────────────────────────────────────────────────────────

export function parseLetterPage(html, letter) {
  return parseCategoryPage(html, `letter/${letter}`);
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

function parsePaginationFromHtml($) {
  const currentText = $(".pagination .current, .page-numbers.current").first().text().trim();
  const current = parseInt(currentText) || 1;

  const nums = [];
  $(".pagination .page-numbers, .page-numbers").each((_, el) => {
    const n = parseInt($(el).text().trim());
    if (!isNaN(n)) nums.push(n);
  });

  const totalPages = nums.length ? Math.max(...nums, current) : current;
  const hasNext = !!$(".pagination .next, .page-numbers.next").length;
  const hasPrev = !!$(".pagination .prev, .page-numbers.prev").length;

  return { currentPage: current, totalPages, hasNext, hasPrev };
}
