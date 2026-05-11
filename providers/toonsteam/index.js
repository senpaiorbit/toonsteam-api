// ============================================================
// providers/toonstream/index.js
// ============================================================
export { search } from "./search.js";

export {
  getAnimeDetails,
  getMovieDetails,
  getEpisodeSources,
  getRecent,
  getTrending,
  getRecentMovies,
  getHomePage, // NEW
} from "./anime.js";

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
    "GET /recent/movies",
    "GET /trending",
    "GET /home",
  ],
};
