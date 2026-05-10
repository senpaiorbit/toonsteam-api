import { Hono } from "hono";
import { getProvider, getProviderName } from "../core/providerManager.js";

const anime = new Hono();
const PROVIDER = getProviderName();

function ok(c, results, extra = {}) {
  return c.json({ success: true, provider: PROVIDER, ...extra, results });
}

function err(c, message, status = 500) {
  return c.json({ success: false, provider: PROVIDER, message }, status);
}

// ─── HOME ─────────────────────────────────────────────────────────────────────

anime.get("/home", async (c) => {
  try {
    const p = getProvider();
    const data = await p.getHome();
    return ok(c, data);
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── SERIES ───────────────────────────────────────────────────────────────────

anime.get("/series", async (c) => {
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

anime.get("/series/:slug", async (c) => {
  try {
    const { slug } = c.req.param();
    const p = getProvider();
    const data = await p.getSeriesInfo(slug);

    // Handle ?seasons= and ?src= params
    const seasonsParam = c.req.query("seasons");
    const includeSrc = c.req.query("src") === "true";
    const serverParam = c.req.query("server");

    // If seasons param provided, fetch those season episodes
    let seasons = [];
    if (seasonsParam && data.availableSeasons?.length) {
      const requestedSeasonNums = parseSeasonParam(seasonsParam, data.availableSeasons.map((s) => s.seasonNumber));

      seasons = await Promise.all(
        requestedSeasonNums.map(async (seasonNum) => {
          const seasonInfo = data.availableSeasons.find((s) => s.seasonNumber === seasonNum);
          let episodes = [];

          if (seasonInfo?.postId) {
            episodes = await p.getSeasonEpisodes(seasonInfo.postId, seasonNum);
          }

          // If src=true, also fetch server info per episode
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
      // Default: return series info with season 1 episodes only
      seasons = [
        {
          seasonNumber: 1,
          name: "Season 1",
          episodes: data.episodes || [],
        },
      ];
    }

    const result = { ...data, seasons };
    delete result.episodes; // move into seasons array

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

// ─── EPISODE ──────────────────────────────────────────────────────────────────

anime.get("/episode", async (c) => {
  try {
    const slug = c.req.query("slug");
    if (!slug) return err(c, "Missing ?slug= parameter", 400);
    const serverParam = c.req.query("server");
    const p = getProvider();
    const data = await p.getEpisodeInfo(slug);

    let servers = data.servers || [];
    if (serverParam && serverParam !== "all") {
      const serverNums = parseServerParam(serverParam, servers);
      if (serverNums !== null) {
        servers = servers.filter((s) => serverNums.includes(s.serverNumber));
      }
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

anime.get("/episode/:slug", async (c) => {
  try {
    const { slug } = c.req.param();
    const serverParam = c.req.query("server");
    const p = getProvider();
    const data = await p.getEpisodeInfo(slug);

    let servers = data.servers || [];
    if (serverParam && serverParam !== "all") {
      const serverNums = parseServerParam(serverParam, servers);
      if (serverNums !== null) {
        servers = servers.filter((s) => serverNums.includes(s.serverNumber));
      }
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

// ─── MOVIES ───────────────────────────────────────────────────────────────────

anime.get("/movies", async (c) => {
  try {
    const page = parseInt(c.req.query("page")) || 1;
    const p = getProvider();
    const data = await p.getMoviesList(page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

anime.get("/movies/page/:page", async (c) => {
  try {
    const page = parseInt(c.req.param("page")) || 1;
    const p = getProvider();
    const data = await p.getMoviesList(page);
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

anime.get("/movies/:slug", async (c) => {
  try {
    const { slug } = c.req.param();
    if (!isNaN(parseInt(slug))) {
      // /movies/2 → page 2
      const p = getProvider();
      const data = await p.getMoviesList(parseInt(slug));
      return ok(c, data, { pagination: data.pagination });
    }
    const p = getProvider();
    const data = await p.getMovieSingle(slug);
    return ok(c, data);
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── CATEGORY ─────────────────────────────────────────────────────────────────

anime.get("/category/:path{.+}", async (c) => {
  try {
    let path = c.req.param("path");
    let page = parseInt(c.req.query("page")) || 1;

    // Handle /category/action/page/2 → path=action, page=2
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

// ─── CAST ─────────────────────────────────────────────────────────────────────

anime.get("/cast/:name", async (c) => {
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

anime.get("/cast/:name/page/:page", async (c) => {
  try {
    const { name, page } = c.req.param();
    const p = getProvider();
    const data = await p.getCastPage(name, parseInt(page));
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── LETTER BROWSE ────────────────────────────────────────────────────────────

anime.get("/letter/:letter", async (c) => {
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

anime.get("/letter/:letter/page/:page", async (c) => {
  try {
    const { letter, page } = c.req.param();
    const p = getProvider();
    const data = await p.getLetterPage(letter, parseInt(page));
    return ok(c, data, { pagination: data.pagination });
  } catch (e) {
    return err(c, e.message, e.status || 500);
  }
});

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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
    // Could be numbers or names
    if (!isNaN(parts[0])) return parts.map(Number);
    if (servers) {
      return servers
        .filter((s) => parts.some((p) => s.name?.toLowerCase().includes(p.toLowerCase())))
        .map((s) => s.serverNumber);
    }
  }

  if (!isNaN(parseInt(param))) return [parseInt(param)];

  // Name based
  if (servers) {
    return servers
      .filter((s) => s.name?.toLowerCase().includes(param.toLowerCase()))
      .map((s) => s.serverNumber);
  }

  return null;
}

export default anime;
