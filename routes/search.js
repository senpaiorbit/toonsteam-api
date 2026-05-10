import { Hono } from "hono";
import { getProvider, getProviderName } from "../core/providerManager.js";

const search = new Hono();
const PROVIDER = getProviderName();

function ok(c, results, extra = {}) {
  return c.json({ success: true, provider: PROVIDER, ...extra, results });
}

function err(c, message, status = 500) {
  return c.json({ success: false, provider: PROVIDER, message }, status);
}

// GET /search/:query
search.get("/:query", async (c) => {
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

// GET /search?q=... or /search?s=...
search.get("/", async (c) => {
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

export default search;
