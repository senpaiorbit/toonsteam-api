/**
 * toonstream/parser.js
 * Pure HTML parsing — cheerio selectors only.
 *
 * FIX: parseHomePage now uses resilient multi-strategy selectors.
 * The site's widget IDs (widget_list_episodes-8, widget_list_movies_series-2…)
 * are dynamic WordPress widget IDs that can change on theme updates.
 * New approach:
 *   1. Try the known widget IDs first (fast path).
 *   2. Fall back to class-based selectors (.widget_list_episodes, etc.)
 *   3. Final fallback: scrape ALL post-lst items and classify by URL/class.
 * This makes home parsing resilient to widget ID changes.
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
// Strategy: try multiple selectors so we don't break if WordPress
// reassigns widget IDs (the most common cause of empty arrays).
//
// Latest Episodes:
//   Primary:  .widget_list_episodes .post-lst li article
//   Fallback: section[id*="widget_list_episodes"] .post-lst li article
//   Final:    .post-lst li article[class*="episodes"]
//
// Series/Movies widgets:
//   Primary:  #widget_list_movies_series-N .post-lst li article
//   Fallback: section[id*="widget_list_movies_series"]:nth-of-type(N) ...
//   Final:    classify ALL .post-lst li article by URL pattern
//
// Languages (gs_logo_area_3):
//   Primary:  #gs_logo_area_3 .gs_logo_single--wrapper
//   Fallback: [id*="gs_logo_area"] .gs_logo_single--wrapper (last match = languages)
//
// Featured (gs_logo_area_1):
//   Primary:  #gs_logo_area_1 .gs_logo_single--wrapper
//   Fallback: [id*="gs_logo_area"] .gs_logo_single--wrapper (first match = featured)

export function parseHomePage(html) {
  const $ = load(html);

  // ── Latest Episodes ─────────────────────────────────────────────────────────
  const latestEpisodes = [];

  // Try progressively broader selectors until we get results
  const episodeSelectors = [
    ".widget_list_episodes .post-lst li article",
    "section[id*='widget_list_episodes'] .post-lst li article",
    "#widget_list_episodes-8 .post-lst li article",
    "#widget_list_episodes-7 .post-lst li article",
    "#widget_list_episodes-9 .post-lst li article",
    ".post-lst li article.episodes",
    ".post-lst li article[class*='episodes']",
  ];

  let episodeEls = $();
  for (const sel of episodeSelectors) {
    episodeEls = $(sel);
    if (episodeEls.length > 0) break;
  }

  episodeEls.each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href") || null;
    const title = txt($, ".entry-title", el);
    const imgEl = $(el).find("img").first();
    const image = normalizeImageUrl(imgEl.attr("src") || imgEl.attr("data-src"));
    const episodeNumber = txt($, ".num-epi", el);
    const time = txt($, ".time", el);
    if (title || url) {
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

  // ── Series/Movies widget scraper ───────────────────────────────────────────
  //
  // Tries a list of candidate selectors in order and returns on first hit.
  // candidateIds: array of widget IDs to try (e.g. ["widget_list_movies_series-2"])
  // classHints:   CSS class fragments to use in fallback attribute selectors

  function scrapeWidget(candidateIds, classHints = []) {
    const items = [];

    // Build ordered list of selectors to try
    const selectors = [];

    // 1. Exact IDs
    for (const id of candidateIds) {
      selectors.push(`#${id} .post-lst li article`);
      selectors.push(`#${id}-all .post-lst li article`);
    }

    // 2. Attribute-contains for IDs (handles numeric suffix changes)
    for (const id of candidateIds) {
      const base = id.replace(/-\d+$/, ""); // strip trailing -N
      selectors.push(`section[id^='${base}'] .post-lst li article`);
    }

    // 3. Class-based fallback
    for (const hint of classHints) {
      selectors.push(`${hint} .post-lst li article`);
      selectors.push(`section${hint} .post-lst li article`);
    }

    let found = $();
    for (const sel of selectors) {
      found = $(sel);
      if (found.length > 0) break;
    }

    found.each((_, el) => {
      const url   = $(el).find("a.lnk-blk").attr("href") || null;
      const title = txt($, ".entry-title", el);
      const imgEl = $(el).find("img").first();
      const image = normalizeImageUrl(imgEl.attr("src") || imgEl.attr("data-src") || null);

      const voteEl    = $(el).find(".vote");
      const ratingRaw = voteEl.clone().children().remove().end().text().trim();
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

  // Try known IDs for each section; add ±2 neighbours to handle ID drift
  const latestSeries = scrapeWidget(
    ["widget_list_movies_series-2", "widget_list_movies_series-1", "widget_list_movies_series-3"],
    [".widget_list_movies_series"]
  );

  const latestMovies = scrapeWidget(
    ["widget_list_movies_series-3", "widget_list_movies_series-2", "widget_list_movies_series-4"],
    []
  );

  const randomSeries = scrapeWidget(
    ["widget_list_movies_series-4", "widget_list_movies_series-5", "widget_list_movies_series-6"],
    []
  );

  const randomMovies = scrapeWidget(
    ["widget_list_movies_series-5", "widget_list_movies_series-6", "widget_list_movies_series-7"],
    []
  );

  // ── Languages ────────────────────────────────────────────────────────────
  const languages = [];
  const langSelectors = [
    "#gs_logo_area_3 .gs_logo_single--wrapper",
    "[id*='gs_logo_area_3'] .gs_logo_single--wrapper",
    "[id*='gs_logo_area']:last-of-type .gs_logo_single--wrapper",
  ];

  let langEls = $();
  for (const sel of langSelectors) {
    langEls = $(sel);
    if (langEls.length > 0) break;
  }

  langEls.each((_, el) => {
    const a = $(el).find("a").first();
    const img = $(el).find("img").first();
    const link = a.attr("href") || null;
    const name = img.attr("title") || img.attr("alt") || null;
    const image = normalizeImageUrl(img.attr("src"));
    if (name) languages.push({ name, image, url: link });
  });

  // ── Featured / Franchise logos ────────────────────────────────────────────
  const featured = [];
  const featSelectors = [
    "#gs_logo_area_1 .gs_logo_single--wrapper",
    "[id*='gs_logo_area_1'] .gs_logo_single--wrapper",
    "[id*='gs_logo_area']:first-of-type .gs_logo_single--wrapper",
  ];

  let featEls = $();
  for (const sel of featSelectors) {
    featEls = $(sel);
    if (featEls.length > 0) break;
  }

  featEls.each((_, el) => {
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

export function parseEpisodeList($, containerSelector) {
  const episodes = [];
  $(`${containerSelector} li article`).each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href") || null;
    const title = txt($, ".entry-title", el);
    const imgEl = $(el).find("img").first();
    const image = normalizeImageUrl(imgEl.attr("src") || imgEl.attr("data-src"));
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

  const availableSeasons = [];
  $(".choose-season ul li.sel-temp a").each((_, el) => {
    const seasonNum = parseInt($(el).attr("data-season"));
    const name = $(el).text().trim();
    if (!isNaN(seasonNum)) availableSeasons.push({ seasonNumber: seasonNum, name });
  });

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
    const imgEl = article.find("img").first();
    const image = normalizeImageUrl(imgEl.attr("src") || imgEl.attr("data-src"));
    const voteEl = article.find(".vote");
    const ratingRaw = voteEl.clone().children().remove().end().text().trim();
    const rating = ratingRaw !== "" ? ratingRaw : null;
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
    const imgEl = article.find("img").first();
    const image = normalizeImageUrl(imgEl.attr("src") || imgEl.attr("data-src"));
    const voteEl = article.find(".vote");
    const ratingRaw = voteEl.clone().children().remove().end().text().trim();
    const rating = ratingRaw !== "" ? ratingRaw : null;
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
    const imgEl = article.find("img").first();
    const image = normalizeImageUrl(imgEl.attr("src") || imgEl.attr("data-src"));
    const voteEl = article.find(".vote");
    const ratingRaw = voteEl.clone().children().remove().end().text().trim();
    const rating = ratingRaw !== "" ? ratingRaw : null;
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
    const imgEl = article.find("img").first();
    const image = normalizeImageUrl(imgEl.attr("src") || imgEl.attr("data-src"));
    const voteEl = article.find(".vote");
    const ratingRaw = voteEl.clone().children().remove().end().text().trim();
    const rating = ratingRaw !== "" ? ratingRaw : null;
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
