import { Hono } from "hono";
import { cors } from "hono/cors";
import { getProvider, getProviderName } from "../core/providerManager.js";

const app = new Hono({ strict: false });

// ─── CORS ────────────────────────────────────────────────────────────────────

app.use("*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));

// ─── METHOD GUARD ────────────────────────────────────────────────────────────

app.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "OPTIONS") {
    return c.json(
      { success: false, provider: getProviderName(), message: "Method Not Allowed. Use GET." },
      405
    );
  }
  await next();
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function ok(c, results, extra = {}) {
  return c.json({ success: true, provider: getProviderName(), ...extra, results });
}

function err(c, message, status = 500) {
  return c.json({ success: false, provider: getProviderName(), message }, status);
}

function parseSeasonParam(param, available) {
  if (!param || param === "all") return available;
  if (param.includes("-")) {
    const [start, end] = param.split("-").map(Number);
    return available.filter((n) => n >= start && n <= end);
  }
  if (param.includes(",")) {
    const nums = param.split(",").map(Number);
    return available.filter((n) => nums.includes(n));
  }
  const num = parseInt(param);
  return isNaN(num) ? available : [num];
}

function parseServerParam(param, servers) {
  if (!param || param === "all") return null;
  if (param.includes("-") && !isNaN(param.split("-")[0])) {
    const [start, end] = param.split("-").map(Number);
    const range = [];
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }
  if (param.includes(",")) {
    const parts = param.split(",");
    if (!isNaN(parts[0])) return parts.map(Number);
    if (servers) {
      return servers
        .filter((s) => parts.some((p) => s.name?.toLowerCase().includes(p.toLowerCase())))
        .map((s) => s.serverNumber);
    }
  }
  if (!isNaN(parseInt(param))) return [parseInt(param)];
  if (servers) {
    return servers
      .filter((s) => s.name?.toLowerCase().includes(param.toLowerCase()))
      .map((s) => s.serverNumber);
  }
  return null;
}

// ─── ROOT ────────────────────────────────────────────────────────────────────

app.get("/", (c) => {
  return c.json({
    success: true,
    provider: getProviderName(),
    results: {
      name: "ToonStream API",
      version: "1.0.0",
      description: "Anime & cartoon scraping API for ToonStream",
      baseUrl: "https://toonstream.vip",
      endpoints: {
        home: "GET /home",
        health: "GET /health",
        series: "GET /series/:slug",
        seriesWithSeasons: "GET /series/:slug?seasons=1,2&src=true&server=all",
        episode: "GET /episode/:slug",
        episodeWithServers: "GET /episode/:slug?server=0,1,2",
        movies: "GET /movies",
        moviePage: "GET /movies/page/:page",
        movieSingle: "GET /movies/:slug",
        search: "GET /search/:query",
        searchQuery: "GET /search?q=naruto",
        category: "GET /category/:path",
        categoryPaged: "GET /category/:path/page/:page",
        cast: "GET /cast/:name",
        letter: "GET /letter/:letter",
      },
    },
  });
});

// ─── HEALTH ──────────────────────────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({
    success: true,
    provider: getProviderName(),
    results: {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── HOME ────────────────────────────────────────────────────────────────────

app.get("/home", async (c) => {
  const s = c.req.query("s");
  if (s) {
    try {
      const p = getProvider();
      const data = await p.searchAnime(s);
      return ok(c, data, { stats: data.stats });
    } catch (e) {
      return err(c, e.message, e.status || 500);
    }
  }
  try {
    const p = getProvider();
    const data = await p.getHome();
    return ok(c, data);
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── SERIES ──────────────────────────────────────────────────────────────────

app.get("/series", async (c) => {
  try {
    const slug = c.req.query("slug");
    if (!slug) return err(c, "Missing ?slug= parameter", 400);
    const p = getProvider();
    const data = await p.getSeriesInfo(slug);
    const stats = {
      totalSeasons: data.totalSeasons,
      totalEpisodes: data.totalEpisodes,
      availableSeasons: data.availableSeasons?.length,
    };
    return ok(c, data, { stats });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/series/:slug", async (c) => {
  try {
    const { slug } = c.req.param();
    const p = getProvider();
    const data = await p.getSeriesInfo(slug);

    const seasonsParam = c.req.query("seasons");
    const includeSrc = c.req.query("src") === "true";
    const serverParam = c.req.query("server");

    let seasons = [];
    if (seasonsParam && data.availableSeasons?.length) {
      const requestedSeasonNums = parseSeasonParam(
        seasonsParam,
        data.availableSeasons.map((s) => s.seasonNumber)
      );
      seasons = await Promise.all(
        requestedSeasonNums.map(async (seasonNum) => {
          const seasonInfo = data.availableSeasons.find((s) => s.seasonNumber === seasonNum);
          let episodes = [];
          if (seasonInfo?.postId) {
            episodes = await p.getSeasonEpisodes(seasonInfo.postId, seasonNum);
          }
          if (includeSrc && episodes.length > 0) {
            const serverNums = parseServerParam(serverParam, null);
            episodes = await Promise.all(
              episodes.map(async (ep) => {
                if (!ep.slug) return ep;
                try {
                  const epData = await p.getEpisodeInfo(ep.slug);
                  let servers = epData.servers || [];
                  if (serverNums !== null) {
                    servers = servers.filter((s) => serverNums.includes(s.serverNumber));
                  }
                  return { ...ep, servers };
                } catch {
                  return ep;
                }
              })
            );
          }
          return {
            seasonNumber: seasonNum,
            name: seasonInfo?.name || `Season ${seasonNum}`,
            episodes,
          };
        })
      );
    } else {
      seasons = [{ seasonNumber: 1, name: "Season 1", episodes: data.episodes || [] }];
    }

    const result = { ...data, seasons };
    delete result.episodes;

    const stats = {
      totalSeasons: data.totalSeasons,
      requestedSeasons: seasons.length,
      fetchedEpisodes: seasons.reduce((acc, s) => acc + (s.episodes?.length || 0), 0),
      includesServerSources: includeSrc,
    };

    return ok(c, result, { stats });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── EPISODE ─────────────────────────────────────────────────────────────────

app.get("/episode", async (c) => {
  try {
    const slug = c.req.query("slug");
    if (!slug) return err(c, "Missing ?slug= parameter", 400);
    const serverParam = c.req.query("server");
    const p = getProvider();
    const data = await p.getEpisodeInfo(slug);
    let servers = data.servers || [];
    if (serverParam && serverParam !== "all") {
      const serverNums = parseServerParam(serverParam, servers);
      if (serverNums !== null) servers = servers.filter((s) => serverNums.includes(s.serverNumber));
    }
    const result = { ...data, servers };
    const stats = {
      totalServersAvailable: data.servers?.length || 0,
      serversReturned: servers.length,
    };
    return ok(c, result, { stats });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/episode/:slug", async (c) => {
  try {
    const { slug } = c.req.param();
    const serverParam = c.req.query("server");
    const p = getProvider();
    const data = await p.getEpisodeInfo(slug);
    let servers = data.servers || [];
    if (serverParam && serverParam !== "all") {
      const serverNums = parseServerParam(serverParam, servers);
      if (serverNums !== null) servers = servers.filter((s) => serverNums.includes(s.serverNumber));
    }
    const result = { ...data, servers };
    const stats = {
      totalServersAvailable: data.servers?.length || 0,
      serversReturned: servers.length,
    };
    return ok(c, result, { stats });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── MOVIES ──────────────────────────────────────────────────────────────────

app.get("/movies", async (c) => {
  try {
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.getMoviesList(page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/movies/page/:page", async (c) => {
  try {
    const page = parseInt(c.req.param("page")) || 1;
    const p = getProvider();
    const data = await p.getMoviesList(page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/movies/:slug", async (c) => {
  try {
    const { slug } = c.req.param();
    const p = getProvider();
    if (!isNaN(parseInt(slug))) {
      const data = await p.getMoviesList(parseInt(slug));
      return ok(c, data, { pagination: data.pagination });
    }
    const data = await p.getMovieSingle(slug);
    return ok(c, data);
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── SEARCH ──────────────────────────────────────────────────────────────────

app.get("/search", async (c) => {
  try {
    const query = c.req.query("q") || c.req.query("s") || c.req.query("query") || "";
    if (!query) return err(c, "Missing query parameter (q or s)", 400);
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.searchAnime(query, page);
    return ok(c, data, { stats: data.stats });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/search/:query", async (c) => {
  try {
    const query = c.req.param("query");
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.searchAnime(query, page);
    return ok(c, data, { stats: data.stats });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── CATEGORY ────────────────────────────────────────────────────────────────

app.get("/category/:path{.+}", async (c) => {
  try {
    let path = c.req.param("path");
    let page = parseInt(c.req.query("page")) || 1;
    const pageMatch = path.match(/^(.+)\/page\/(\d+)\/?$/);
    if (pageMatch) {
      path = pageMatch[1];
      page = parseInt(pageMatch[2]);
    }
    const p = getProvider();
    const data = await p.getCategoryPage(path, page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── CAST ────────────────────────────────────────────────────────────────────

app.get("/cast/:name/page/:page", async (c) => {
  try {
    const { name, page } = c.req.param();
    const p = getProvider();
    const data = await p.getCastPage(name, parseInt(page));
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/cast/:name", async (c) => {
  try {
    const { name } = c.req.param();
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.getCastPage(name, page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── HOME ALIASES ────────────────────────────────────────────────────────────

app.get("/home/cast_tv/:name", async (c) => {
  try {
    const { name } = c.req.param();
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.getCastPage(name, page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/home/cast/:name/page/:page", async (c) => {
  try {
    const { name, page } = c.req.param();
    const p = getProvider();
    const data = await p.getCastPage(name, parseInt(page));
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/home/letter/:letter/page/:page", async (c) => {
  try {
    const { letter, page } = c.req.param();
    const p = getProvider();
    const data = await p.getLetterPage(letter, parseInt(page));
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/home/letter/:letter", async (c) => {
  try {
    const { letter } = c.req.param();
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.getLetterPage(letter, page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/home/search/:query", async (c) => {
  try {
    const { query } = c.req.param();
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.searchAnime(query, page);
    return ok(c, data, { stats: data.stats });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── LETTER ──────────────────────────────────────────────────────────────────

app.get("/letter/:letter/page/:page", async (c) => {
  try {
    const { letter, page } = c.req.param();
    const p = getProvider();
    const data = await p.getLetterPage(letter, parseInt(page));
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

app.get("/letter/:letter", async (c) => {
  try {
    const { letter } = c.req.param();
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.getLetterPage(letter, page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── 404 & ERROR ─────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json(
    { success: false, provider: getProviderName(), message: "Endpoint not found", statusCode: 404 },
    404
  );
});

app.onError((error, c) => {
  console.error("[ERROR]", error.message, error.stack);
  return c.json(
    { success: false, provider: getProviderName(), message: error.message || "Internal Server Error" },
    error.status || 500
  );
});

// ─── EXPORT FOR VERCEL ───────────────────────────────────────────────────────
// Vercel Node.js serverless functions use (req, res) — not Web Fetch API.
// We use @hono/node-server's handle() to bridge Hono → Node.js http.
import { handle } from "@hono/node-server/vercel";

export default handle(app);
