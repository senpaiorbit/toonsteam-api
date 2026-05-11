// ============================================================
// providers/toonstream/anime.js
// Scraping logic for:
//   - Anime / series details
//   - Movie details
//   - Episode streaming sources
//   - Recent (latest updated) anime
//   - Trending anime
// ============================================================

import { fetchHtml } from "../../utils/http.js";
import { loadHtml, normaliseImageUrl, extractSlug } from "../../utils/dom.js";
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

// ─── Helpers ────────────────────────────────────────────────

/**
 * Build the full URL for a series by its slug.
 * @param {string} id - slug, e.g. "jujutsu-kaisen"
 */
function seriesUrl(id) {
  return `${TOONSTREAM_BASE}/series/${id}/`;
}

/**
 * Build the full URL for a movie by its slug.
 */
function movieUrl(id) {
  return `${TOONSTREAM_BASE}/movies/${id}/`;
}

/**
 * Build the full URL for an episode by its slug.
 */
function episodeUrl(id) {
  return `${TOONSTREAM_BASE}/episode/${id}/`;
}

// ─── Series / Anime Details ─────────────────────────────────

/**
 * Fetch full details for a series (anime) by its slug.
 * Scrapes: title, description, genres, year, seasons, episodes.
 *
 * @param {string} id - Series slug (e.g. "jujutsu-kaisen")
 * @returns {Promise<object>}
 */
export async function getAnimeDetails(id) {
  const cacheKey = `series:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = seriesUrl(id);
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  // Basic metadata
  const title = $("h1.entry-title").first().text().trim();
  const image = normaliseImageUrl(
    $(".post-thumbnail figure img").first().attr("src") || ""
  );
  const description = $(".description p").first().text().trim();
  const year = $("span.year").first().text().trim();
  const rating = $("span.vote span.num").first().text().trim();
  const duration = $("span.duration").first().text().trim();
  const views = $("span.views span").first().text().trim();

  // Season + episode counts from the meta spans
  const totalSeasons = $("span.seasons span").first().text().trim();
  const totalEpisodes = $("span.episodes span").first().text().trim();

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

/**
 * Fetch full details for a movie by its slug.
 *
 * @param {string} id - Movie slug (e.g. "jujutsu-kaisen-0")
 * @returns {Promise<object>}
 */
export async function getMovieDetails(id) {
  const cacheKey = `movie:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = movieUrl(id);
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  const title = $("h1.entry-title").first().text().trim();
  const image = normaliseImageUrl(
    $(".post-thumbnail figure img").first().attr("src") || ""
  );
  const description = $(".description p").first().text().trim();
  const year = $("span.year").first().text().trim();
  const rating = $("span.vote span.num").first().text().trim();
  const duration = $("span.duration").first().text().trim();

  const genres = parseGenres($);
  const sources = parseSources($);

  // Cast & Director
  const cast = [];
  $("ul.cast-lst li").each((_, el) => {
    const label = $(el).find("span").first().text().trim();
    const names = [];
    $(el).find("a").each((__, a) => names.push($(a).text().trim()));
    if (label && names.length) cast.push({ label, names });
  });

  // Related movies
  const related = parseCardList($, ".owl-carousel .post");

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

// ─── Episode Streaming Sources ──────────────────────────────

/**
 * Fetch streaming server sources for an episode.
 * ToonStream episode URLs: /episode/jujutsu-kaisen-1x1/
 *
 * @param {string} id - Episode slug (e.g. "jujutsu-kaisen-1x1")
 * @returns {Promise<object>}
 */
export async function getEpisodeSources(id) {
  const cacheKey = `episode:${id}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = episodeUrl(id);
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  const title = $("h1.entry-title").first().text().trim();
  const image = normaliseImageUrl(
    $(".post-thumbnail figure img").first().attr("src") || ""
  );
  const description = $(".description").first().text().trim();
  const year = $("span.year").first().text().trim();
  const duration = $("span.duration").first().text().trim();
  const rating = $("span.vote span.num").first().text().trim();
  const genres = parseGenres($);

  const sources = parseSources($);
  const nav = parseEpisodeNav($);

  // Season episode list shown below the player
  const episodes = parseEpisodeList($);

  const result = {
    id,
    title,
    url,
    image,
    description: description || null,
    year: year || null,
    duration: duration || null,
    rating: rating || null,
    genres,
    sources,
    navigation: nav,
    episodes,
  };

  // Cache episodes for 5 minutes (sources don't change often)
  cacheSet(cacheKey, result, 300);
  return result;
}

// ─── Recent (Latest Updated) ────────────────────────────────

/**
 * Scrape recently updated anime from the main series archive.
 * URL: /series/ — newest additions are at the top.
 *
 * @returns {Promise<object[]>}
 */
export async function getRecent() {
  const cacheKey = "recent";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const url = `${TOONSTREAM_BASE}/series/`;
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  const results = parseCardList($);

  // Cache for 3 minutes (updates frequently)
  cacheSet(cacheKey, results, 180);
  return results;
}

// ─── Trending ───────────────────────────────────────────────

/**
 * Scrape trending anime from the homepage.
 * ToonStream's homepage shows featured/trending content in carousels.
 * We fall back to the series archive if the home page structure differs.
 *
 * @returns {Promise<object[]>}
 */
export async function getTrending() {
  const cacheKey = "trending";
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  // The /home/ page has a hero slider and trending sections
  const url = `${TOONSTREAM_BASE}/home/`;
  const html = await fetchHtml(url, { referer: TOONSTREAM_BASE });
  const $ = loadHtml(html);

  // Try carousel first (owl-carousel typically shows featured/trending)
  let results = parseCardList($, ".owl-carousel li, .owl-carousel article");

  // If carousel is empty, fall back to the first post list on the page
  if (!results.length) {
    results = parseCardList($);
  }

  // If still empty, fall back to series archive
  if (!results.length) {
    return getRecent();
  }

  // Deduplicate by URL
  const seen = new Set();
  const unique = results.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  // Cache for 10 minutes
  cacheSet(cacheKey, unique, 600);
  return unique;
}

// ─── Recent Movies ──────────────────────────────────────────

/**
 * Scrape recently added movies from the movies archive.
 *
 * @returns {Promise<object[]>}
 */
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
