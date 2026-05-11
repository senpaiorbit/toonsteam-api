// ============================================================
// api/index.js
// Added /home and /test routes
// ============================================================
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import config from "../core/config.js";
import { getProvider, getProviderList } from "../core/providerManager.js";
import { cacheSize } from "../utils/cache.js";

const app = new Hono();
const startedAt = Date.now();

// ─── CORS ───────────────────────────────────────────────────
app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type");
});
app.options("*", (c) => c.text("OK", 200));

// ─── Helpers ─────────────────────────────────────────────────
function ok(c, data, provider = config.defaultProvider) {
  return c.json({ success: true, provider, results: data });
}

function err(c, message, status = 500) {
  return c.json({ success: false, message }, status);
}

async function runProvider(c, fn, providerName) {
  try {
    const result = await fn();
    return ok(c, result, providerName);
  } catch (e) {
    console.error(`[API] Provider error:`, e.message);
    return err(c, e.message || "Provider error");
  }
}

// ─── Health ─────────────────────────────────────────────────
app.get("/", (c) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  return c.json({
    success: true,
    name: config.name,
    version: config.version,
    status: "ok",
    uptime: `${uptimeSeconds}s`,
    defaultProvider: config.defaultProvider,
    providers: getProviderList(),
    cacheEntries: cacheSize(),
    endpoints: [
      "GET /",
      "GET /search?q=<query>",
      "GET /anime/:id",
      "GET /movie/:id",
      "GET /episode/:id",
      "GET /recent",
      "GET /recent/movies",
      "GET /trending",
      "GET /home",
      "GET /test",
    ],
  });
});

// ─── Search ─────────────────────────────────────────────────
app.get("/search", async (c) => {
  const query = c.req.query("q");
  if (!query || !query.trim()) return err(c, "Query parameter 'q' is required", 400);
  const provider = await getProvider();
  return runProvider(c, () => provider.search(query), config.defaultProvider);
});

// ─── Anime / Movie / Episode ─────────────────────────────────
app.get("/anime/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return err(c, "Anime ID is required", 400);
  const provider = await getProvider();
  return runProvider(c, () => provider.getAnimeDetails(id), config.defaultProvider);
});

app.get("/movie/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return err(c, "Movie ID is required", 400);
  const provider = await getProvider();
  return runProvider(c, () => provider.getMovieDetails(id), config.defaultProvider);
});

app.get("/episode/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return err(c, "Episode ID is required", 400);
  const provider = await getProvider();
  return runProvider(c, () => provider.getEpisodeSources(id), config.defaultProvider);
});

// ─── Lists ───────────────────────────────────────────────────
app.get("/recent", async (c) => {
  const provider = await getProvider();
  return runProvider(c, () => provider.getRecent(), config.defaultProvider);
});

app.get("/recent/movies", async (c) => {
  const provider = await getProvider();
  return runProvider(c, () => provider.getRecentMovies(), config.defaultProvider);
});

app.get("/trending", async (c) => {
  const provider = await getProvider();
  return runProvider(c, () => provider.getTrending(), config.defaultProvider);
});

// ─── NEW: Aggregated Homepage ────────────────────────────────
app.get("/home", async (c) => {
  const provider = await getProvider();
  return runProvider(c, () => provider.getHomePage(), config.defaultProvider);
});

// ─── NEW: Test HTML Page ─────────────────────────────────────
app.get("/test", async (c) => {
  const provider = await getProvider();
  let homeData;
  try {
    homeData = await provider.getHomePage();
  } catch (e) {
    homeData = { error: e.message };
  }

  // Simple HTML that displays the JSON inside a <pre> tag
  const jsonDisplay = JSON.stringify(homeData, null, 2);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ToonStream API Test</title>
  <style>
    body { font-family: monospace; background: #111; color: #0f0; padding: 2rem; }
    pre { background: #222; padding: 1rem; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>🔥 ToonStream API – Homepage Data</h1>
  <p>Route: <code>GET /home</code></p>
  <pre>${jsonDisplay.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body>
</html>`;

  return c.html(html);
});

// ─── 404 & Error ─────────────────────────────────────────────
app.notFound((c) => err(c, "Route not found", 404));
app.onError((e, c) => {
  console.error("[API] Unhandled error:", e.message);
  return err(c, "Internal server error", 500);
});

// ─── Server Start ────────────────────────────────────────────
if (process.env.VERCEL !== "1") {
  const port = parseInt(process.env.PORT || "3000", 10);
  serve({ fetch: app.fetch, port });
  console.log(`[ToonStream API] Running on http://localhost:${port}`);
}

export default app.fetch;/** Standard error response */
function err(c, message, status = 500) {
  return c.json({ success: false, message }, status);
}

/** Safely execute a provider function and handle errors */
async function runProvider(c, fn, providerName) {
  try {
    const result = await fn();
    return ok(c, result, providerName);
  } catch (e) {
    console.error(`[API] Provider error:`, e.message);
    return err(c, e.message || "Provider error");
  }
}

// ─── Routes ──────────────────────────────────────────────────

/**
 * GET /
 * Health check — returns API status, version, providers, uptime
 */
app.get("/", (c) => {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);

  return c.json({
    success: true,
    name: config.name,
    version: config.version,
    status: "ok",
    uptime: `${uptimeSeconds}s`,
    defaultProvider: config.defaultProvider,
    providers: getProviderList(),
    cacheEntries: cacheSize(),
    endpoints: [
      "GET /",
      "GET /search?q=<query>",
      "GET /anime/:id",
      "GET /movie/:id",
      "GET /episode/:id",
      "GET /recent",
      "GET /recent/movies",
      "GET /trending",
    ],
  });
});

/**
 * GET /search?q=naruto
 * Search anime & series by title
 */
app.get("/search", async (c) => {
  const query = c.req.query("q");

  if (!query || !query.trim()) {
    return err(c, "Query parameter 'q' is required", 400);
  }

  const provider = await getProvider();
  return runProvider(c, () => provider.search(query), config.defaultProvider);
});

/**
 * GET /anime/:id
 * Full series/anime details by slug.
 * e.g. /anime/jujutsu-kaisen
 */
app.get("/anime/:id", async (c) => {
  const id = c.req.param("id");

  if (!id) return err(c, "Anime ID (slug) is required", 400);

  const provider = await getProvider();
  return runProvider(
    c,
    () => provider.getAnimeDetails(id),
    config.defaultProvider
  );
});

/**
 * GET /movie/:id
 * Movie details by slug.
 * e.g. /movie/jujutsu-kaisen-0
 */
app.get("/movie/:id", async (c) => {
  const id = c.req.param("id");

  if (!id) return err(c, "Movie ID (slug) is required", 400);

  const provider = await getProvider();
  return runProvider(
    c,
    () => provider.getMovieDetails(id),
    config.defaultProvider
  );
});

/**
 * GET /episode/:id
 * Episode streaming sources by slug.
 * e.g. /episode/jujutsu-kaisen-1x1
 */
app.get("/episode/:id", async (c) => {
  const id = c.req.param("id");

  if (!id) return err(c, "Episode ID (slug) is required", 400);

  const provider = await getProvider();
  return runProvider(
    c,
    () => provider.getEpisodeSources(id),
    config.defaultProvider
  );
});

/**
 * GET /recent
 * Latest updated series
 */
app.get("/recent", async (c) => {
  const provider = await getProvider();
  return runProvider(c, () => provider.getRecent(), config.defaultProvider);
});

/**
 * GET /recent/movies
 * Latest updated movies
 */
app.get("/recent/movies", async (c) => {
  const provider = await getProvider();
  return runProvider(
    c,
    () => provider.getRecentMovies(),
    config.defaultProvider
  );
});

/**
 * GET /trending
 * Trending anime from ToonStream's featured sections
 */
app.get("/trending", async (c) => {
  const provider = await getProvider();
  return runProvider(c, () => provider.getTrending(), config.defaultProvider);
});

// ─── 404 Catch-All ───────────────────────────────────────────
app.notFound((c) => err(c, "Route not found", 404));

// ─── Global Error Handler ────────────────────────────────────
app.onError((e, c) => {
  console.error("[API] Unhandled error:", e.message);
  return err(c, "Internal server error", 500);
});

// ─── Server Start (local dev) ─────────────────────────────────
// On Vercel, the export below is used instead.
// Locally, we start a plain Node.js HTTP server.
if (process.env.VERCEL !== "1") {
  const port = parseInt(process.env.PORT || "3000", 10);
  serve({ fetch: app.fetch, port });
  console.log(`[ToonStream API] Running on http://localhost:${port}`);
}

// ─── Vercel Serverless Export ─────────────────────────────────
export default app.fetch;
