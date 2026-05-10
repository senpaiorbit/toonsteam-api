/**
 * toonstream/parser.js
 * Pure HTML parsing — cheerio selectors only.
 * All selectors verified against real HTML pages.
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
// FIXES vs old parser:
//  1. latestEpisodes: old selector was "section.widget_list_episodes li article.episodes"
//     Real HTML: section.widget_list_episodes > ul.post-lst > li > article.post.episodes
//     article class is "post dfx fcl episodes", NOT just "episodes" — use "article.episodes"
//     but the containing section has class "widget_list_episodes" ✓, list items have no class.
//     Correct: ".widget_list_episodes .post-lst li article"
//
//  2. latestSeries: old selector "section.widget_list_movies_series.movies li article.movies"
//     Real HTML: section.widget_list_movies_series > div.aa-cn > div.aa-tb > ul.post-lst > li > article.post.movies
//     Correct: ".widget_list_movies_series .post-lst li article"
//     But home page has BOTH Latest Series AND Latest Movies sections both with class
//     "widget_list_movies_series movies" — we only want the first one (series).
//     Use the section id "widget_list_movies_series-2" for series.
//
//  3. languages: old selector "#gs_logo_area_3 .gs_logo_single"
//     Real HTML: div#gs_logo_area_3 > div.gs_logo_area--inner > div.gs_logo_container > div.gs_logo_single--wrapper > div.gs_logo_single > a > img
//     The .gs_logo_single div does NOT have an <a> child directly — the <a> wraps the img inside .gs_logo_single.
//     Correct: "#gs_logo_area_3 .gs_logo_single--wrapper"
//
//  4. featured: same structure as languages but #gs_logo_area_1
//     Correct: "#gs_logo_area_1 .gs_logo_single--wrapper"

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

  // ── Latest Series ────────────────────────────────────────────────────────────
  // The home page has two widget_list_movies_series sections:
  //   #widget_list_movies_series-2 → Latest Series
  //   #widget_list_movies_series-3 → Latest Movies
  const latestSeries = [];
  $("#widget_list_movies_series-2 .post-lst li article").each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href") || null;
    const title = txt($, ".entry-title", el);
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    // vote span: <span class="vote"><span>TMDB</span> 7.25</span>
    // We want just the number — strip the inner "TMDB" span text
    const voteEl = $(el).find(".vote");
    const voteText = voteEl.clone().children().remove().end().text().trim();
    const rating = voteText || null;
    if (title) {
      latestSeries.push({
        title,
        image,
        rating,
        url,
        slug: extractSlugFromUrl(url),
      });
    }
  });

  // ── Latest Movies (bonus — included for completeness) ─────────────────────
  const latestMovies = [];
  $("#widget_list_movies_series-3 .post-lst li article").each((_, el) => {
    const url = $(el).find("a.lnk-blk").attr("href") || null;
    const title = txt($, ".entry-title", el);
    const image = normalizeImageUrl($(el).find("img").attr("src"));
    const voteEl = $(el).find(".vote");
    const voteText = voteEl.clone().children().remove().end().text().trim();
    const rating = voteText || null;
    if (title) {
      latestMovies.push({
        title,
        image,
        rating,
        url,
        slug: extractSlugFromUrl(url),
      });
    }
  });

  // ── Languages (gs_logo_area_3) ────────────────────────────────────────────
  // Real structure:  div.gs_logo_single--wrapper > div.gs_logo_single > a[href] > img[title, src]
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
    languages,
    featured,
  };
}

// ─── SERIES PAGE ──────────────────────────────────────────────────────────────
//
// FIXES vs old parser:
//  1. The page uses a custom minimal template — there is NO "article.post.single" wrapper.
//     Real HTML layout (from series__slug_.html):
//       .post-thumbnail > figure > img   (poster)
//       h1.entry-title                   (title)
//       span.genres > a                  (categories)
//       span.duration                    (duration)
//       span.year                        (year)
//       span.seasons > span              (season count)
//       span.episodes > span             (episode count)
//       div.description                  (description)
//       ul.cast-lst > li > a             (cast)
//       span.vote.fa-star > span.num     (rating)
//       div.aa-drp.choose-season ul li.sel-temp > a[data-post][data-season] (season selector)
//       ul#episode_by_temp li article    (current season episodes)
//
//  2. The old code used "article.post.single" as context — nothing matched. Remove it.

export function parseSeriesPage(html, slug) {
  const $ = load(html);

  const title = $("h1.entry-title").first().text().trim() || null;

  // Poster image is in .post-thumbnail figure img
  const image = normalizeImageUrl($(".post-thumbnail figure img").first().attr("src"));

  // Description
  const description =
    $(".description p").first().text().trim() ||
    $(".description").first().text().trim().split("\n")[0].trim() ||
    null;

  // Rating: <span class="vote fa-star"><span class="num">8.552</span><span>TMDB</span></span>
  const rating = $("span.vote .num").first().text().trim() || null;

  // Year: <span class="year fa-calendar far">2020</span>
  const year = $("span.year").first().text().replace(/\D/g, "").trim() || null;

  // Duration: <span class="duration fa-clock far">2 min.</span>
  const duration =
    $("span.duration").first().text().replace("min.", "").trim() || null;

  // Seasons count: <span class="seasons"><span>3</span> Seasons</span>
  const totalSeasons = parseInt($("span.seasons span").first().text()) || null;

  // Episodes count: <span class="episodes"><span>59</span> Episodes</span>
  const totalEpisodes = parseInt($("span.episodes span").first().text()) || null;

  // Categories: <span class="genres"><a href="...">Action</a>, ...</span>
  const categories = [];
  $("span.genres a").each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  // Tags (not shown on series page — skip or use li class data)
  const tags = [];

  // Cast: <ul class="cast-lst dfx fwp"><li>...<a href="...">Name</a>...</li>
  const cast = [];
  $("ul.cast-lst li a").each((_, el) => {
    const name = $(el).text().trim();
    if (name) cast.push({ name, url: $(el).attr("href") });
  });

  // Available seasons: div.aa-drp.choose-season ul li.sel-temp > a[data-season][data-post]
  const availableSeasons = [];
  $(".choose-season ul li.sel-temp a").each((_, el) => {
    const seasonNum = parseInt($(el).attr("data-season"));
    const postId = $(el).attr("data-post");
    const name = $(el).text().trim();
    if (!isNaN(seasonNum)) {
      availableSeasons.push({ seasonNumber: seasonNum, name, postId });
    }
  });

  // Current season episodes (inside ul#episode_by_temp)
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
    tags,
    cast,
    availableSeasons,
    episodes,
  };
}

// ─── EPISODES LIST (reusable) ─────────────────────────────────────────────────
//
// FIXES vs old parser:
//  Real HTML: ul#episode_by_temp > li > article.post.episodes
//  article structure:
//    div.post-thumbnail > figure > img[src]
//    h2.entry-title
//    span.num-epi  (NOT present in some — it's in the header region but no outer li)
//    span.time
//    a.lnk-blk[href]
//
//  Old selector "li article.episodes" was OK structurally but the old
//  containerSelector usage ${containerSelector} li article.episodes is correct.
//  However articles in some list contexts have class "post dfx fcl episodes lg"
//  — the "episodes" class is present, so "article.episodes" does match.
//  The actual bug is the MISSING num-epi on some ep pages. We guard with || null.

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
// FIXES vs old parser:
//  1. No "article.post.single" wrapper on episode pages either — same template.
//  2. Video player: iframes are in aside#aa-options > div[id^="options-"].video
//     Old selector ".video-player .video[id^='options-']" was looking for .video-player
//     which does NOT exist. Real container is "aside#aa-options" or ".player aside.video-player".
//     Real HTML: <aside class="video-player aa-cn" id="aa-options">
//       <div id="options-0" class="video aa-tb hdd on"><iframe src="..."></iframe></div>
//       ...
//     So aside has BOTH class "video-player" AND id "aa-options". The old selector
//     ".video-player .video[id^='options-']" should match — BUT the div class is
//     "video aa-tb hdd" not ".video-player .video". Check:
//     parent: aside.video-player > child: div.video → ".video-player .video" ✓ should work.
//     ACTUAL BUG: old code checked id^="options-" which is on the div.video — correct.
//     The real problem is the server buttons selector. Old:
//     ".video-options .aa-tbs li a.btn, .video-options .aa-tbs-video li a.btn"
//     Real HTML: aside.video-options > div.d-flex-ch > div.lrt > ul.aa-tbs.aa-tbs-video > li > a.btn
//     The button text is: "Sever <span>1</span> <span class="server">X -Multi Audio</span>"
//     There's no wrapper .aa-tbs inside .video-options directly — it's nested deeper.
//     Correct selector: ".video-options .aa-tbs-video li a.btn"
//
//  3. Server name parsing: button text is "Sever <span>N</span> <span class="server">Name -Lang</span>"
//     The display number is in the bare span (not .server), server+lang in .server.
//
//  4. Navigation buttons: old code used "a:has(.fa-step-backward)" etc.
//     Real HTML uses <div class="epsdsnv"> with <a class="btn ..."> links.
//     Look for prev/next by rel or data attributes or position.

export function parseEpisodePage(html, slug) {
  const $ = load(html);

  const title = $("h1.entry-title, h2.entry-title").first().text().trim() || null;
  const image = normalizeImageUrl($(".post-thumbnail figure img").first().attr("src"));
  const description = $(".description p").first().text().trim() || null;
  const rating = $("span.vote .num").first().text().trim() || null;
  const year = $("span.year").first().text().replace(/\D/g, "").trim() || null;
  const duration =
    $("span.duration").first().text().replace("min.", "").trim() || null;

  const categories = [];
  $("span.genres a").each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const cast = [];
  $("ul.cast-lst li a").each((_, el) => {
    const name = $(el).text().trim();
    if (name) cast.push({ name, url: $(el).attr("href") });
  });

  // Navigation buttons are in div.epsdsnv
  // Buttons have icons: fa-step-backward (prev), fa-step-forward (next), fa-indent (series)
  // They may also use classes "prev"/"next" or rel="prev"/"next"
  const navEl = $(".epsdsnv");
  let prevUrl = null;
  let nextUrl = null;
  let seriesUrl = null;

  navEl.find("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    const cls = $(el).attr("class") || "";
    const hasPrev =
      $(el).find(".fa-step-backward, .fa-backward, .fa-chevron-left").length > 0 ||
      cls.includes("prev");
    const hasNext =
      $(el).find(".fa-step-forward, .fa-forward, .fa-chevron-right").length > 0 ||
      cls.includes("next");
    const hasSeries =
      $(el).find(".fa-indent, .fa-list, .fa-th-list").length > 0 ||
      cls.includes("series") ||
      href.includes("/series/");

    if (hasPrev && !prevUrl) prevUrl = href;
    else if (hasNext && !nextUrl) nextUrl = href;
    else if (hasSeries && !seriesUrl) seriesUrl = href;
  });

  // Servers — iframes inside aside.video-player (id="aa-options")
  const iframes = [];
  $(".video-player div[id^='options-']").each((_, el) => {
    const id = $(el).attr("id"); // "options-0", "options-1" …
    const num = parseInt(id.replace("options-", ""), 10);
    // active iframe has src; lazy ones have data-src
    const src =
      $(el).find("iframe").attr("src") ||
      $(el).find("iframe").attr("data-src") ||
      null;
    iframes.push({ serverNumber: num, src });
  });

  // Server buttons: ul.aa-tbs-video li > a.btn
  // Button HTML: "Sever <span>1</span> <span class="server">Name -Lang</span>"
  const serverButtons = [];
  $(".video-options .aa-tbs-video li a.btn").each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = parseInt(href.replace("#options-", ""), 10);
    if (isNaN(num)) return;

    // Display number is in the plain <span> (not .server)
    const displayNum =
      parseInt(
        $(el)
          .find("span:not(.server)")
          .first()
          .text()
          .trim()
      ) || num + 1;

    // Server name & language from .server span: "Vidstream -Hindi-Jap"
    const serverRaw = $(el).find(".server").text().trim();
    const dashIdx = serverRaw.lastIndexOf("-");
    const serverName =
      dashIdx > 0 ? serverRaw.slice(0, dashIdx).trim() : serverRaw.trim() || null;
    const language =
      dashIdx > 0 ? serverRaw.slice(dashIdx + 1).trim() : null;

    serverButtons.push({
      serverNumber: num,
      displayNumber: displayNum,
      name: serverName || null,
      language: language || null,
    });
  });

  // Merge iframes + button metadata
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

  // Available seasons dropdown (if present on episode page)
  const availableSeasons = [];
  $(".choose-season ul li.sel-temp a").each((_, el) => {
    const seasonNum = parseInt($(el).attr("data-season"));
    const name = $(el).text().trim();
    if (!isNaN(seasonNum)) availableSeasons.push({ seasonNumber: seasonNum, name });
  });

  // Episode list sidebar (if present)
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
//
// FIXES vs old parser:
//  Real HTML: ul.post-lst > li[class with "movies" or "series"] > article.post.movies
//  Vote: <span class="vote"><span>TMDB</span> 8.765</span>
//  Need to extract only the number part of vote (strip inner "TMDB" span).

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

    // Extract numeric rating (strip TMDB label)
    const voteEl = article.find(".vote");
    const rating = voteEl.clone().children().remove().end().text().trim() || null;

    const liClass = $(li).attr("class") || "";
    const contentType =
      url.includes("/movies/") || liClass.includes(" movies ")
        ? "movie"
        : "series";

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
    $("h1.section-title, h2.section-title, h3.section-title")
      .first()
      .text()
      .trim() || null;

  return { sectionTitle, items, pagination };
}

// ─── MOVIE SINGLE PAGE ────────────────────────────────────────────────────────
//
// FIXES: same as episode page — no "article.post.single" wrapper.
// Server selector same fix as episode page.

export function parseMovieSinglePage(html, slug) {
  const $ = load(html);

  const title = $("h1.entry-title, h2.entry-title").first().text().trim() || null;
  const image = normalizeImageUrl($(".post-thumbnail figure img").first().attr("src"));
  const description = $(".description p").first().text().trim() || null;
  const rating = $("span.vote .num").first().text().trim() || null;
  const year = $("span.year").first().text().replace(/\D/g, "").trim() || null;
  const duration =
    $("span.duration").first().text().replace("min.", "").trim() || null;

  const categories = [];
  $("span.genres a").each((_, el) => {
    categories.push({ name: $(el).text().trim(), url: $(el).attr("href") });
  });

  const cast = [];
  $("ul.cast-lst li a").each((_, el) => {
    const name = $(el).text().trim();
    if (name) cast.push({ name, url: $(el).attr("href") });
  });

  // Servers (same structure as episode page)
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

  const serverButtons = [];
  $(".video-options .aa-tbs-video li a.btn").each((_, el) => {
    const href = $(el).attr("href") || "";
    const num = parseInt(href.replace("#options-", ""), 10);
    if (isNaN(num)) return;
    const displayNum =
      parseInt($(el).find("span:not(.server)").first().text().trim()) || num + 1;
    const serverRaw = $(el).find(".server").text().trim();
    const dashIdx = serverRaw.lastIndexOf("-");
    const serverName =
      dashIdx > 0 ? serverRaw.slice(0, dashIdx).trim() : serverRaw.trim() || null;
    const language = dashIdx > 0 ? serverRaw.slice(dashIdx + 1).trim() : null;
    serverButtons.push({
      serverNumber: num,
      displayNumber: displayNum,
      name: serverName || null,
      language: language || null,
    });
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
//
// FIXES: The vote rating extraction needs to strip the inner "TMDB" span.

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
    const rating = voteEl.clone().children().remove().end().text().trim() || null;

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

    results.push({
      id,
      title,
      image,
      url,
      slug: extractSlugFromUrl(url),
      rating,
      contentType,
      categories,
      tags,
    });
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
    const url = article.find("a.lnk-blk").attr("href") || null;
    if (!url) return;
    const title = txt($, ".entry-title", article);
    const image = normalizeImageUrl(article.find("img").attr("src"));
    const voteEl = article.find(".vote");
    const rating = voteEl.clone().children().remove().end().text().trim() || null;
    const liClass = $(li).attr("class") || "";
    const contentType =
      liClass.includes(" movies ") || url.includes("/movies/") ? "movie" : "series";
    items.push({ title, image, rating, url, slug: extractSlugFromUrl(url), contentType });
  });

  const sectionTitle =
    $("h1.section-title, h2.section-title, h3.section-title")
      .first()
      .text()
      .trim() || null;
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
    const rating = voteEl.clone().children().remove().end().text().trim() || null;
    const contentType = url.includes("/movies/") ? "movie" : "series";
    items.push({ title, image, rating, url, slug: extractSlugFromUrl(url), contentType });
  });

  const sectionTitle =
    $("h1.section-title, h2.section-title, h3.section-title")
      .first()
      .text()
      .trim() || null;
  const pagination = parsePaginationFromHtml($);

  return { castName: name, sectionTitle, items, pagination };
}

// ─── LETTER PAGE ─────────────────────────────────────────────────────────────

export function parseLetterPage(html, letter) {
  return parseCategoryPage(html, `letter/${letter}`);
}

// ─── PAGINATION ───────────────────────────────────────────────────────────────

function parsePaginationFromHtml($) {
  const currentText = $(".pagination .current, .page-numbers.current")
    .first()
    .text()
    .trim();
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
