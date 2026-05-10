import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { getProviderName } from "../core/providerManager.js";
import animeRoutes from "../routes/anime.js";
import searchRoutes from "../routes/search.js";
import config from "../core/config.js";

const app = new Hono();

// CORS
app.use("*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));

// Method guard
app.use("*", async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "OPTIONS") {
    return c.json({ success: false, provider: getProviderName(), message: "Method Not Allowed. Use GET." }, 405);
  }
  await next();
});

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

// ─── MOUNT ROUTES ────────────────────────────────────────────────────────────

app.route("/", animeRoutes);
app.route("/search", searchRoutes);

// Alias: /home?s= → search
app.get("/home", async (c) => {
  const s = c.req.query("s");
  if (s) {
    const { getProvider } = await import("../core/providerManager.js");
    try {
      const p = getProvider();
      const data = await p.searchAnime(s);
      return c.json({ success: true, provider: getProviderName(), results: data, stats: data.stats });
    } catch (e) {
      return c.json({ success: false, provider: getProviderName(), message: e.message }, e.status || 500);
    }
  }

  // Otherwise return home page data
  try {
    const { getProvider } = await import("../core/providerManager.js");
    const p = getProvider();
    const data = await p.getHome();
    return c.json({ success: true, provider: getProviderName(), results: data });
  } catch (e) {
    return c.json({ success: false, provider: getProviderName(), message: e.message }, e.status || 500);
  }
});

// Cast alias: /home/cast_tv/:name
app.get("/home/cast_tv/:name", async (c) => {
  const { name } = c.req.param();
  const page = parseInt(c.req.query("page")) || 1;
  try {
    const { getProvider } = await import("../core/providerManager.js");
    const p = getProvider();
    const data = await p.getCastPage(name, page);
    return c.json({ success: true, provider: getProviderName(), results: data, pagination: data.pagination });
  } catch (e) {
    return c.json({ success: false, provider: getProviderName(), message: e.message }, e.status || 500);
  }
});

// Cast paged: /home/cast/:name/page/:page
app.get("/home/cast/:name/page/:page", async (c) => {
  const { name, page } = c.req.param();
  try {
    const { getProvider } = await import("../core/providerManager.js");
    const p = getProvider();
    const data = await p.getCastPage(name, parseInt(page));
    return c.json({ success: true, provider: getProviderName(), results: data, pagination: data.pagination });
  } catch (e) {
    return c.json({ success: false, provider: getProviderName(), message: e.message }, e.status || 500);
  }
});

// Letter: /home/letter/:letter
app.get("/home/letter/:letter", async (c) => {
  const { letter } = c.req.param();
  const page = parseInt(c.req.query("page")) || 1;
  try {
    const { getProvider } = await import("../core/providerManager.js");
    const p = getProvider();
    const data = await p.getLetterPage(letter, page);
    return c.json({ success: true, provider: getProviderName(), results: data, pagination: data.pagination });
  } catch (e) {
    return c.json({ success: false, provider: getProviderName(), message: e.message }, e.status || 500);
  }
});

// Letter paged: /home/letter/:letter/page/:page
app.get("/home/letter/:letter/page/:page", async (c) => {
  const { letter, page } = c.req.param();
  try {
    const { getProvider } = await import("../core/providerManager.js");
    const p = getProvider();
    const data = await p.getLetterPage(letter, parseInt(page));
    return c.json({ success: true, provider: getProviderName(), results: data, pagination: data.pagination });
  } catch (e) {
    return c.json({ success: false, provider: getProviderName(), message: e.message }, e.status || 500);
  }
});

// Search alias: /home/search/:query
app.get("/home/search/:query", async (c) => {
  const { query } = c.req.param();
  const page = parseInt(c.req.query("page")) || 1;
  try {
    const { getProvider } = await import("../core/providerManager.js");
    const p = getProvider();
    const data = await p.searchAnime(query, page);
    return c.json({ success: true, provider: getProviderName(), results: data, stats: data.stats });
  } catch (e) {
    return c.json({ success: false, provider: getProviderName(), message: e.message }, e.status || 500);
  }
});

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json({ success: false, provider: getProviderName(), message: "Endpoint not found", statusCode: 404 }, 404);
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────

app.onError((err, c) => {
  console.error("[ERROR]", err.message);
  return c.json({ success: false, provider: getProviderName(), message: err.message || "Internal Server Error" }, err.status || 500);
});

// ─── START ───────────────────────────────────────────────────────────────────

if (process.env.VERCEL !== "1") {
  serve({ fetch: app.fetch, port: config.port }, () => {
    console.log(`🚀 ToonStream API running on http://localhost:${config.port}`);
    console.log(`   Provider: ${getProviderName()}`);
  });
}

export default app;
