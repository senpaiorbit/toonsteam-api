// ============================================================
// providers/toonstream/index.js
// Public interface for the ToonStream provider.
// All API routes import from here — never from sub-files directly.
// ============================================================

export { search } from "./search.js";

export {
  getAnimeDetails,
  getMovieDetails,
  getEpisodeSources,
  getRecent,
  getTrending,
  getRecentMovies,
} from "./anime.js";

// Provider metadata used by the health endpoint
export const PROVIDER_INFO = {
  name: "toonstream",
  baseUrl: "https://toonstream.vip",
  description: "Anime, cartoon series & movies from ToonStream",
  supportedRoutes: [
    "GET /search?q=",
    "GET /anime/:id",
    "GET /movie/:id",
    "GET /episode/:id",
    "GET /recent",
    "GET /trending",
  ],
};
