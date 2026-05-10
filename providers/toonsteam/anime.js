/**
 * toonstream/anime.js
 * Provider methods — fetch + parse for each page type.
 *
 * FIX in getSeasonEpisodes:
 *   The admin-ajax.php endpoint returns a FULL WordPress page HTML (not a
 *   fragment). The episode list is inside ul#episode_by_temp.
 *   Old selector: "li article.episodes"  ← works but misses articles without
 *   the class in some responses. Use the same robust selector as parseEpisodeList:
 *   "#episode_by_temp li article"
 *
 *   Also: the old code used a dynamic import of cheerio/axios inside the function.
 *   Moved to top-level static imports for reliability on Vercel.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import http from "../../utils/http.js";
import cache from "../../utils/cache.js";
import { buildHeaders } from "../../utils/request.js";
import { BASE_URLS } from "../../constants/baseurl.js";
import { normalizeImageUrl, extractSlugFromUrl } from "../../utils/dom.js";
import {
  parseHomePage,
  parseSeriesPage,
  parseEpisodePage,
  parseMoviesListPage,
  parseMovieSinglePage,
  parseCategoryPage,
  parseCastPage,
  parseLetterPage,
} from "./parser.js";

const BASE = BASE_URLS.toonstream;

// ─── HOME ─────────────────────────────────────────────────────────────────────

export async function getHome() {
  const cacheKey = "home";
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const html = await http.fetchPage(`${BASE}/home/`, BASE);
  const data = parseHomePage(html);
  cache.set(cacheKey, data, "home");
  return data;
}

// ─── SERIES ───────────────────────────────────────────────────────────────────

export async function getSeriesInfo(slug) {
  const cacheKey = `series:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/series/${slug}/`;
  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseSeriesPage(html, slug);
  cache.set(cacheKey, data, "series");
  return data;
}

// ─── SEASON EPISODES (AJAX) ───────────────────────────────────────────────────
//
// FIX: The wp-admin/admin-ajax.php endpoint returns a full WordPress page.
// The episode list is in ul#episode_by_temp inside that page.
// Use "#episode_by_temp li article" — same selector as parseEpisodeList().
//
// Also guard: if the response has no #episode_by_temp, fall back to
// "li article.episodes" for safety.

export async function getSeasonEpisodes(postId, seasonNumber) {
  const cacheKey = `episodes:${postId}:${seasonNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const ajaxUrl = `${BASE}/wp-admin/admin-ajax.php`;
  let episodes = [];

  try {
    const response = await axios.post(
      ajaxUrl,
      new URLSearchParams({
        action: "action_select_season",
        season: seasonNumber,
        post: postId,
      }),
      {
        headers: {
          ...buildHeaders(BASE, `${BASE}/`),
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: 15000,
      }
    );

    if (response.data) {
      const $ = cheerio.load(response.data);

      // Primary: use #episode_by_temp (full-page response structure)
      const container = $("#episode_by_temp");
      const selector = container.length
        ? "#episode_by_temp li article"
        : "li article";

      $(selector).each((_, el) => {
        const href = $(el).find("a.lnk-blk").attr("href") || null;
        const title = $(el).find(".entry-title").text().trim() || null;
        const imgSrc = $(el).find("img").attr("src") || null;
        const epNum = $(el).find(".num-epi").text().trim() || null;
        const time = $(el).find(".time").text().trim() || null;
        const image = normalizeImageUrl(imgSrc);

        if (title || href) {
          episodes.push({
            title,
            episodeNumber: epNum,
            image,
            time,
            url: href,
            slug: extractSlugFromUrl(href),
          });
        }
      });
    }
  } catch {
    // AJAX failed — return empty, caller handles gracefully
  }

  cache.set(cacheKey, episodes, "series");
  return episodes;
}

// ─── EPISODE ──────────────────────────────────────────────────────────────────

export async function getEpisodeInfo(slug) {
  const cacheKey = `episode:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/episode/${slug}/`;
  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseEpisodePage(html, slug);
  cache.set(cacheKey, data, "episode");
  return data;
}

// ─── MOVIES ───────────────────────────────────────────────────────────────────

export async function getMoviesList(page = 1) {
  const cacheKey = `movies:page:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = page > 1 ? `${BASE}/movies/page/${page}/` : `${BASE}/movies/`;
  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseMoviesListPage(html);
  cache.set(cacheKey, data, "movies");
  return data;
}

export async function getMovieSingle(slug) {
  const cacheKey = `movie:${slug}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url = `${BASE}/movies/${slug}/`;
  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/movies/` });
  const data = parseMovieSinglePage(html, slug);
  cache.set(cacheKey, data, "episode");
  return data;
}

// ─── CATEGORY ─────────────────────────────────────────────────────────────────

export async function getCategoryPage(path, page = 1) {
  const cacheKey = `category:${path}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url =
    page > 1 ? `${BASE}/category/${path}/page/${page}/` : `${BASE}/category/${path}/`;
  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseCategoryPage(html, path);
  cache.set(cacheKey, data, "category");
  return data;
}

// ─── CAST ─────────────────────────────────────────────────────────────────────

export async function getCastPage(name, page = 1) {
  const cacheKey = `cast:${name}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url =
    page > 1 ? `${BASE}/cast_tv/${name}/page/${page}/` : `${BASE}/cast_tv/${name}/`;
  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseCastPage(html, name);
  cache.set(cacheKey, data, "cast");
  return data;
}

// ─── LETTER ───────────────────────────────────────────────────────────────────

export async function getLetterPage(letter, page = 1) {
  const cacheKey = `letter:${letter}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const url =
    page > 1
      ? `${BASE}/home/letter/${letter}/page/${page}/`
      : `${BASE}/home/letter/${letter}/`;
  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseLetterPage(html, letter);
  cache.set(cacheKey, data, "letter");
  return data;
}

export default {
  getHome,
  getSeriesInfo,
  getSeasonEpisodes,
  getEpisodeInfo,
  getMoviesList,
  getMovieSingle,
  getCategoryPage,
  getCastPage,
  getLetterPage,
};
