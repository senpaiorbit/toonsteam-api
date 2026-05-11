// ============================================================
// providers/toonstream/anime.js
// Patched: better selectors, added getHomePage()
// ============================================================
import { fetchHtml } from "../../utils/http.js";
import { loadHtml, normaliseImageUrl, safeHtml } from "../../utils/dom.js";
import {
  parseCardList,
  parseGenres,
  parseEpisodeList,
  parseSources,
  parseSeasons,
  parseEpisodeNav,
} from "./parser.js";
import { cacheGet, cacheSet } from "../../utils/cache.js";
import { TOONSTREAM_BASE } from "../../constants/baseurl.js";
import config from "../../core/config.js"; // [NEW] for homePageTTL

// ─── URL builders ───────────────────────────────────────────
const seriesUrl = (id) => `${TOONSTREAM_BASE}/series/${id}/`;
const movieUrl = (id) => `${TOONSTREAM_BASE}/movies/${id}/`;
const episodeUrl = (id) => `${TOONSTREAM_BASE}/episode/${id}/`;

// ─── Series Details ─────────────────────────────────────────
export async function getAnimeDetails(id) {
  const cacheKey = `series:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = seriesUrl(id);
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  const title = $("h1.entry-title, h1.title").first().text().trim();
  const image = normaliseImageUrl(
    $(".post-thumbnail figure img, .poster img").first().attr("src") || ""
  );
  const description = $(".description p, .entry-content p").first().text().trim();
  const year = $("span.year, .release-year").first().text().trim();
  const rating = $("span.vote span.num, .rating-value").first().text().trim();
  const duration = $("span.duration, .runtime").first().text().trim();
  const views = $("span.views span, .view-count").first().text().trim();
  const totalSeasons = $("span.seasons span, .season-count").first().text().trim();
  const totalEpisodes = $("span.episodes span, .episode-count").first().text().trim();

  const genres = parseGenres($);
  const seasons = parseSeasons($);
  const episodes = parseEpisodeList($);

  // Cast
  const cast = [];
  $("ul.cast-lst li").each((_, el) => {
    const label = $(el).find("span").first().text().trim();
    const names = [];
    $(el).find("a").each((__, a) => names.push($(a).text().trim()));
    if (label && names.length) cast.push({ label, names });
  });

  const result = {
    id,
    title,
    url,
    image,
    description,
    year: year || null,
    rating: rating || null,
    duration: duration || null,
    views: views || null,
    totalSeasons: totalSeasons ? parseInt(totalSeasons, 10) : null,
    totalEpisodes: totalEpisodes ? parseInt(totalEpisodes, 10) : null,
    genres,
    seasons,
    cast,
    episodes,
  };

  cacheSet(cacheKey, result);
  return result;
}

// ─── Movie Details ──────────────────────────────────────────
export async function getMovieDetails(id) {
  const cacheKey = `movie:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = movieUrl(id);
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  const title = $("h1.entry-title, h1.title").first().text().trim();
  const image = normaliseImageUrl(
    $(".post-thumbnail figure img, .poster img").first().attr("src") || ""
  );
  const description = $(".description p, .entry-content p").first().text().trim();
  const year = $("span.year, .release-year").first().text().trim();
  const rating = $("span.vote span.num, .rating-value").first().text().trim();
  const duration = $("span.duration, .runtime").first().text().trim();
  const genres = parseGenres($);
  const sources = parseSources($);

  // Cast
  const cast = [];
  $("ul.cast-lst li").each((_, el) => {
    const label = $(el).find("span").first().text().trim();
    const names = [];
    $(el).find("a").each((__, a) => names.push($(a).text().trim()));
    if (label && names.length) cast.push({ label, names });
  });

  // Related
  const related = parseCardList($, ".related-posts .post, .owl-carousel .post");

  const result = {
    id,
    title,
    url,
    image,
    description,
    year: year || null,
    rating: rating || null,
    duration: duration || null,
    genres,
    cast,
    sources,
    related,
  };

  cacheSet(cacheKey, result);
  return result;
}

// ─── Episode Sources ────────────────────────────────────────
export async function getEpisodeSources(id) {
  const cacheKey = `episode:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = episodeUrl(id);
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  const title = $("h1.entry-title, h1.title").first().text().trim();
  const image = normaliseImageUrl(
    $(".post-thumbnail figure img, .poster img").first().attr("src") || ""
  );
  const year = $("span.year, .release-year").first().text().trim();
  const duration = $("span.duration, .runtime").first().text().trim();
  const rating = $("span.vote span.num, .rating-value").first().text().trim();
  const genres = parseGenres($);
  const sources = parseSources($);
  const nav = parseEpisodeNav($);
  const episodes = parseEpisodeList($);

  const result = {
    id,
    title,
    url,
    image,
    year: year || null,
    duration: duration || null,
    rating: rating || null,
    genres,
    sources,
    navigation: nav,
    episodes,
  };

  cacheSet(cacheKey, result);
  return result;
}

// ─── Recent / Trending / Movies ─────────────────────────────
export async function getRecent() {
  const cacheKey = "recent";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `${TOONSTREAM_BASE}/series/`;
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);
  const results = parseCardList($);
  cacheSet(cacheKey, results, 180);
  return results;
}

export async function getTrending() {
  const cacheKey = "trending";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `${TOONSTREAM_BASE}/home/`;
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  let results = parseCardList($, ".owl-carousel li, .owl-carousel article, .featured-slider .item");
  if (!results.length) results = parseCardList($);
  if (!results.length) return getRecent();

  const seen = new Set();
  const unique = results.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  cacheSet(cacheKey, unique, 600);
  return unique;
}

export async function getRecentMovies() {
  const cacheKey = "recent-movies";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `${TOONSTREAM_BASE}/movies/`;
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);
  const results = parseCardList($);
  cacheSet(cacheKey, results, 180);
  return results;
}

// ─── NEW: Aggregated Homepage ───────────────────────────────
/**
 * Scrapes the homepage and returns a rich structured object
 * containing latest episodes, series, movies, random picks, languages, featured.
 * This is what you expected the API to return.
 */
export async function getHomePage() {
  const cacheKey = "homepage";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = TOONSTREAM_BASE + "/home/";
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  // Container widgets – usually .widget or .sidebar .widget
  const widgets = $(".widget, .home-widget");

  const latestEpisodes = [];
  const latestSeries = [];
  const latestMovies = [];
  const randomSeries = [];
  const randomMovies = [];
  const languages = [];
  const featured = [];

  widgets.each((_, widget) => {
    const $w = $(widget);
    const title = $w.find("h2.widget-title, .widget-title, h3").first().text().trim().toLowerCase();

    const cards = parseCardList($, $w.find("li, .post, article").toString());

    if (title.includes("latest episode")) {
      latestEpisodes.push(...cards);
    } else if (title.includes("latest series")) {
      latestSeries.push(...cards);
    } else if (title.includes("latest movie")) {
      latestMovies.push(...cards);
    } else if (title.includes("random series")) {
      randomSeries.push(...cards);
    } else if (title.includes("random movie")) {
      randomMovies.push(...cards);
    } else if (title.includes("language")) {
      // Language items are usually a list of links without images
      $w.find("li a").each((__, a) => {
        const lang = $(a).text().trim();
        if (lang) languages.push(lang);
      });
    } else if (title.includes("featured") || title.includes("trending")) {
      featured.push(...cards);
    }
  });

  // Fallback: if no widget titles, grab everything from carousels and default post lists
  if (!latestEpisodes.length && !latestSeries.length) {
    const allCards = parseCardList($);
    featured.push(...allCards);
  }

  const result = {
    latestEpisodes: dedupeCards(latestEpisodes),
    latestSeries: dedupeCards(latestSeries),
    latestMovies: dedupeCards(latestMovies),
    randomSeries: dedupeCards(randomSeries),
    randomMovies: dedupeCards(randomMovies),
    languages: [...new Set(languages)],
    featured: dedupeCards(featured),
  };

  cacheSet(cacheKey, result, config.cache.homePageTTL);
  return result;
}

/** Deduplicate cards by URL */
function dedupeCards(cards) {
  const seen = new Set();
  return cards.filter((card) => {
    if (seen.has(card.url)) return false;
    seen.add(card.url);
    return true;
  });
}
