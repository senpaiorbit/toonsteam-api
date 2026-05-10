import http from "../../utils/http.js";
import cache from "../../utils/cache.js";
import { BASE_URLS } from "../../constants/baseurl.js";
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

// ─── SERIES INFO ──────────────────────────────────────────────────────────────

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

// ─── SERIES EPISODES (season via AJAX) ───────────────────────────────────────

export async function getSeasonEpisodes(postId, seasonNumber) {
  const cacheKey = `episodes:${postId}:${seasonNumber}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // ToonStream loads episodes via this AJAX URL pattern
  const url = `${BASE}/?trembed=0&trid=${postId}&trtype=3&season=${seasonNumber}`;
  // The actual episodes are loaded client-side with JS, so we fall back to
  // parsing the series page with the season selector — we replicate the AJAX call
  // using the WordPress admin-ajax pattern used by the theme.
  const ajaxUrl = `${BASE}/wp-admin/admin-ajax.php`;

  let episodes = [];
  try {
    const axios = (await import("axios")).default;
    const { buildHeaders } = await import("../../utils/request.js");
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
      const { load } = await import("cheerio");
      const $ = load(response.data);
      $("li article.episodes").each((_, el) => {
        const href = $(el).find("a.lnk-blk").attr("href");
        const title = $(el).find(".entry-title").text().trim();
        const image = $(el).find("img").attr("src");
        const epNum = $(el).find(".num-epi").text().trim();
        const time = $(el).find(".time").text().trim();
        const normalizedImg = image?.startsWith("//") ? "https:" + image : image;
        episodes.push({
          title,
          episodeNumber: epNum,
          image: normalizedImg || null,
          time,
          url: href,
          slug: href ? href.replace(/\/$/, "").split("/").pop() : null,
        });
      });
    }
  } catch {
    // AJAX failed — return empty, caller handles fallback
  }

  cache.set(cacheKey, episodes, "series");
  return episodes;
}

// ─── EPISODE ─────────────────────────────────────────────────────────────────

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

// ─── MOVIES LIST ──────────────────────────────────────────────────────────────

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

// ─── MOVIE SINGLE ─────────────────────────────────────────────────────────────

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

  let url;
  if (page > 1) {
    url = `${BASE}/category/${path}/page/${page}/`;
  } else {
    url = `${BASE}/category/${path}/`;
  }

  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseCategoryPage(html, path);

  cache.set(cacheKey, data, "category");
  return data;
}

// ─── CAST PAGE ────────────────────────────────────────────────────────────────

export async function getCastPage(name, page = 1) {
  const cacheKey = `cast:${name}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let url;
  if (page > 1) {
    url = `${BASE}/cast_tv/${name}/page/${page}/`;
  } else {
    url = `${BASE}/cast_tv/${name}/`;
  }

  const html = await http.fetchPage(url, BASE, { referer: `${BASE}/home/` });
  const data = parseCastPage(html, name);

  cache.set(cacheKey, data, "cast");
  return data;
}

// ─── LETTER PAGE ─────────────────────────────────────────────────────────────

export async function getLetterPage(letter, page = 1) {
  const cacheKey = `letter:${letter}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let url;
  if (page > 1) {
    url = `${BASE}/home/letter/${letter}/page/${page}/`;
  } else {
    url = `${BASE}/home/letter/${letter}/`;
  }

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
