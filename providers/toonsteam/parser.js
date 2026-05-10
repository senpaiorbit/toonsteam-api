/**
 * toonstream/parser.js
 * Pure HTML parsing — cheerio selectors only.
 * No HTTP requests here.
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

export function parseHomePage(html) {
  const $ = load(html);

  // Latest episodes widget
  const latestEpisodes = [];
  $("section.widget_list_episodes li article.episodes").each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href");
    const title = txt($, ".entry-title", el);
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    const episodeNumber = txt($, ".num-epi", el);
    const time = txt($, ".time", el);
    if (title) latestEpisodes.push({ title, episodeNumber, image, time, url });
  });

  // Latest series
  const latestSeries = [];
  $("section.widget_list_movies_series.movies li article.movies").each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href");
    const title = txt($, ".entry-title", el);
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    const rating = txt($, ".vote", el)?.replace("TMDB", "").trim();
    if (title) latestSeries.push({ title, image, rating, url, slug: extractSlugFromUrl(url) });
  });

  // Language logos
  const languages = [];
  $("#gs_logo_area_3 .gs_logo_single").each((_, el) => {
    const link = $(el).find("a").attr("href");
    const name = $(el).find("img").attr("title");
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    if (name) languages.push({ name, image, url: link });
  });

  // Featured logos (character/franchise links)
  const featured = [];
  $("#gs_logo_area_1 .gs_logo_single").each((_, el) => {
    const link = $(el).find("a").attr("href");
    const name = $(el).find("img").attr("title");
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    if (name) featured.push({ name, image, searchUrl: link });
  });

  return {
    latestEpisodes,
    latestSeries,
    languages,
    featured,
  };
}

// ─── SERIES PAGE ──────────────────────────────────────────────────────────────

export function parseSeriesPage(html, slug) {
  const $ = load(html);
  const article = $("article.post.single");

  const title = txt($, ".entry-title", article);
  const image = normalizeImageUrl($("article.post.single .post-thumbnail img").attr("src"));
  const description = $(".description p").first().text().trim() || $(".description").text().trim().split("\n")[0];
  const rating = txt($, ".vote .num", article);
  const year = txt($, ".year", article)?.replace(/[^\d]/g, "") || null;
  const duration = txt($, ".duration", article)?.replace("min.", "").trim() || null;
  const views = txt($, ".views span", article);

  const totalSeasonsText = txt($, ".seasons span", article);
  const totalEpisodesText = txt($, ".episodes span", article);
  const totalSeasons = totalSeasonsText ? parseInt(totalSeasonsText) : null;
  const totalEpisodes = totalEpisodesText ? parseInt(totalEpisodesText) : null;

  const categories = [];
  $(".genres a", article).each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const tags = [];
  $(".tag a", article).each((_, el) => {
    tags.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const cast = [];
  $(".cast-lst .loadactor a, .cast-lst p a", article).each((_, el) => {
    cast.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  // Available seasons from dropdown
  const availableSeasons = [];
  $(".choose-season .aa-cnt li a").each((_, el) => {
    const seasonNum = parseInt($(el).attr("data-season"));
    const postId = $(el).attr("data-post");
    const name = $(el).text().trim();
    if (!isNaN(seasonNum)) availableSeasons.push({ seasonNumber: seasonNum, name, postId });
  });

  // Current season episodes (season 1 by default)
  const episodes = parseEpisodeList($, "#episode_by_temp");

  return {
    slug,
    title,
    image,
    description,
    rating,
    year,
    duration,
    views,
    totalSeasons,
    totalEpisodes,
    categories,
    tags,
    cast,
    availableSeasons,
    episodes,
  };
}

// ─── EPISODES LIST (reusable) ─────────────────────────────────────────────────

export function parseEpisodeList($, containerSelector) {
  const episodes = [];
  $(`${containerSelector} li article.episodes`).each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href");
    const title = txt($, ".entry-title", el);
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    const episodeNumber = txt($, ".num-epi", el);
    const time = txt($, ".time", el);
    episodes.push({ title, episodeNumber, image, time, url, slug: extractSlugFromUrl(url) });
  });
  return episodes;
}

// ─── EPISODE PAGE ─────────────────────────────────────────────────────────────

export function parseEpisodePage(html, slug) {
  const $ = load(html);
  const article = $("article.post.single");

  const title = txt($, ".entry-title", article);
  const image = normalizeImageUrl($("article.post.single .post-thumbnail img").attr("src"));
  const description = txt($, ".description", article);
  const rating = txt($, ".vote .num", article);
  const year = txt($, ".year", article)?.replace(/[^\d]/g, "") || null;
  const duration = txt($, ".duration", article)?.replace("min.", "").trim() || null;

  const categories = [];
  $(".genres a", article).each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const cast = [];
  $(".cast-lst p a, .cast-lst .loadactor a", article).each((_, el) => {
    cast.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  // Navigation
  const navEl = $(".epsdsnv");
  const prevUrl = navEl.find("a:has(.fa-step-backward)").attr("href") || null;
  const nextUrl = navEl.find("a:has(.fa-step-forward)").attr("href") || null;
  const seriesUrl = navEl.find("a:has(.fa-indent)").attr("href") || null;

  // Servers — iframes
  const iframes = [];
  $(".video-player .video[id^='options-']").each((_, el) => {
    const id = $(el).attr("id"); // options-0, options-1 ...
    const num = parseInt(id?.replace("options-", "") ?? "-1");
    const src = $(el).find("iframe").attr("src") || $(el).find("iframe").attr("data-src") || null;
    iframes.push({ serverNumber: num, src });
  });

  // Server buttons with names
  const serverButtons = [];
  $(".video-options .aa-tbs li a.btn, .video-options .aa-tbs-video li a.btn").each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = parseInt(href.replace("#options-", ""));
    const serverRaw = $(el).find(".server").text().trim();
    const [serverName, language] = serverRaw.split("-").map((s) => s.trim());
    const displayNum = parseInt($(el).find("span:not(.server)").text().trim()) || num + 1;
    serverButtons.push({ serverNumber: num, displayNumber: displayNum, name: serverName || null, language: language || null });
  });

  // Merge iframes + names
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

  // Available seasons dropdown
  const availableSeasons = [];
  $(".choose-season .aa-cnt li a").each((_, el) => {
    const seasonNum = parseInt($(el).attr("data-season"));
    const name = $(el).text().trim();
    if (!isNaN(seasonNum)) availableSeasons.push({ seasonNumber: seasonNum, name });
  });

  // Episode list on the page
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

  $("ul.post-lst li article.movies, ul.post-lst li article.post").each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href");
    if (!url) return;
    const title = txt($, ".entry-title", el);
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    const rating = txt($, ".vote", el)?.replace("TMDB", "").trim();
    const contentType = url.includes("/movies/") ? "movie" : url.includes("/series/") ? "series" : "post";
    items.push({ title, image, rating, url, slug: extractSlugFromUrl(url), contentType });
  });

  const pagination = parsePaginationFromHtml($);
  const sectionTitle = $(".section-title, h1.section-title").first().text().trim();

  return { sectionTitle, items, pagination };
}

// ─── MOVIE SINGLE PAGE ────────────────────────────────────────────────────────

export function parseMovieSinglePage(html, slug) {
  const $ = load(html);
  const article = $("article.post.single");

  const title = txt($, ".entry-title", article);
  const image = normalizeImageUrl($("article.post.single .post-thumbnail img").attr("src"));
  const description = txt($, ".description", article);
  const rating = txt($, ".vote .num", article);
  const year = txt($, ".year", article)?.replace(/[^\d]/g, "") || null;
  const duration = txt($, ".duration", article)?.replace("min.", "").trim() || null;

  const categories = [];
  $(".genres a", article).each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const cast = [];
  $(".cast-lst p a, .cast-lst .loadactor a", article).each((_, el) => {
    cast.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  // Servers
  const iframes = [];
  $(".video-player .video[id^='options-']").each((_, el) => {
    const id = $(el).attr("id");
    const num = parseInt(id?.replace("options-", "") ?? "-1");
    const src = $(el).find("iframe").attr("src") || $(el).find("iframe").attr("data-src") || null;
    iframes.push({ serverNumber: num, src });
  });

  const serverButtons = [];
  $(".video-options .aa-tbs-video li a.btn").each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = parseInt(href.replace("#options-", ""));
    const serverRaw = $(el).find(".server").text().trim();
    const [serverName, language] = serverRaw.split("-").map((s) => s.trim());
    const displayNum = parseInt($(el).find("span:not(.server)").text().trim()) || num + 1;
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

    const url = article.find("a.lnk-blk").attr("href");
    if (!url) return;

    const title = txt($, ".entry-title", article);
    const image = normalizeImageUrl(article.find("img").attr("src"));
    const rating = txt($, ".vote", article)?.replace("TMDB", "").trim();
    const id = $(li).attr("id");

    const liClass = $(li).attr("class") || "";
    const contentType = liClass.includes(" movies ") || url.includes("/movies/") ? "movie" : "series";

    const categories = (liClass.match(/category-([^\s]+)/g) || [])
      .map((c) => c.replace("category-", "").replace(/-/g, " "))
      .map((c) => c.charAt(0).toUpperCase() + c.slice(1));

    const tags = (liClass.match(/tag-([^\s]+)/g) || [])
      .map((t) => t.replace("tag-", "").replace(/-/g, " "));

    results.push({ id, title, image, url, slug: extractSlugFromUrl(url), rating, contentType, categories, tags });
  });

  const seriesCount = results.filter((r) => r.contentType === "series").length;
  const moviesCount = results.filter((r) => r.contentType === "movie").length;

  return {
    searchQuery: query,
    hasResults: results.length > 0,
    results,
    stats: {
      resultsCount: results.length,
      seriesCount,
      moviesCount,
    },
  };
}

// ─── CATEGORY PAGE ────────────────────────────────────────────────────────────

export function parseCategoryPage(html, path) {
  const $ = load(html);
  const items = [];

  $("ul.post-lst li").each((_, li) => {
    const article = $(li).find("article").first();
    if (!article.length) return;
    const url = article.find("a.lnk-blk").attr("href");
    if (!url) return;
    const title = txt($, ".entry-title", article);
    const image = normalizeImageUrl(article.find("img").attr("src"));
    const rating = txt($, ".vote", article)?.replace("TMDB", "").trim();
    const liClass = $(li).attr("class") || "";
    const contentType = liClass.includes(" movies ") || url.includes("/movies/") ? "movie" : "series";
    items.push({ title, image, rating, url, slug: extractSlugFromUrl(url), contentType });
  });

  const sectionTitle = $(".section-title, h1.section-title").first().text().trim();
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
    const url = article.find("a.lnk-blk").attr("href");
    if (!url) return;
    const title = txt($, ".entry-title", article);
    const image = normalizeImageUrl(article.find("img").attr("src"));
    const rating = txt($, ".vote", article)?.replace("TMDB", "").trim();
    const contentType = url.includes("/movies/") ? "movie" : "series";
    items.push({ title, image, rating, url, slug: extractSlugFromUrl(url), contentType });
  });

  const sectionTitle = $(".section-title, h1.section-title").first().text().trim();
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
