# ToonStream API

A lightweight, modular **anime scraping REST API** built with **Node.js + Hono**, deployed on **Vercel serverless**. Scrapes [ToonStream](https://toonstream.vip) — a WordPress-based anime streaming site — and returns clean, structured JSON.

---

## ✨ Features

- **Search** — full-text search across all anime, series, and movies
- **Series/Anime Details** — title, description, genres, cast, seasons, episode list
- **Movie Details** — metadata, genres, streaming server sources
- **Episode Sources** — all streaming servers with embed URLs and language labels
- **Recent** — latest updated series and movies
- **Trending** — featured content from ToonStream's homepage
- **Zero-dependency cache** — fast in-memory TTL cache (no Redis needed)
- **Modular provider system** — drop in `animesalt`, `hianime`, etc. with zero refactoring
- **Vercel-optimised** — cold starts under 500ms, memory-efficient

---

## 🗂 Project Structure

```
toonstream-api/
│
├── api/
│   └── index.js              # Hono app — all routes live here
│
├── core/
│   ├── config.js             # Central config (timeout, cache TTL, providers)
│   └── providerManager.js    # Dynamic provider loader with fallback
│
├── constants/
│   └── baseurl.js            # Base URLs for all providers
│
├── providers/
│   └── toonstream/
│       ├── index.js          # Public exports (what routes call)
│       ├── parser.js         # Cheerio parsing helpers
│       ├── anime.js          # Details, episodes, trending, recent
│       └── search.js         # Search scraping
│
├── utils/
│   ├── http.js               # Axios wrapper (timeout + browser headers)
│   ├── dom.js                # Cheerio helper functions
│   ├── request.js            # Browser-like header builder
│   └── cache.js              # In-memory TTL cache
│
├── .env                      # Environment variables
├── package.json
├── vercel.json
├── jsconfig.json
└── README.md
```

---

## 🛠 Installation

```bash
# 1. Clone the repo
git clone https://github.com/yourname/toonstream-api.git
cd toonstream-api

# 2. Install dependencies
npm install

# 3. Copy and configure env
cp .env .env.local
```

---

## 💻 Local Development

```bash
npm run dev
```

The API will start at `http://localhost:3000`.

---

## 🚀 Vercel Deployment

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (first time — follow the prompts)
vercel

# Deploy to production
vercel --prod
```

Vercel will automatically route all requests to `api/index.js` via `vercel.json`.

---

## ⚙️ Environment Variables

| Variable               | Default                     | Description                             |
|------------------------|-----------------------------|-----------------------------------------|
| `TOONSTREAM_BASE_URL`  | `https://toonstream.vip`    | ToonStream domain (update if it moves)  |
| `DEFAULT_PROVIDER`     | `toonstream`                | Active provider                         |
| `REQUEST_TIMEOUT`      | `15000`                     | Axios timeout in milliseconds           |
| `CACHE_TTL`            | `300`                       | Cache TTL in seconds                    |

Set these in Vercel's dashboard under **Project → Settings → Environment Variables**.

---

## 📡 API Endpoints

### `GET /`
Health check and API info.

**Response:**
```json
{
  "success": true,
  "name": "toonstream-api",
  "version": "1.0.0",
  "status": "ok",
  "uptime": "42s",
  "defaultProvider": "toonstream",
  "providers": ["toonstream"],
  "cacheEntries": 5,
  "endpoints": [
    "GET /",
    "GET /search?q=<query>",
    "GET /anime/:id",
    "GET /movie/:id",
    "GET /episode/:id",
    "GET /recent",
    "GET /recent/movies",
    "GET /trending"
  ]
}
```

---

### `GET /search?q=naruto`
Search for anime, series, or movies.

**Query params:**
- `q` (required) — search term

**Example:** `GET /search?q=jujutsu`

**Response:**
```json
{
  "success": true,
  "provider": "toonstream",
  "results": [
    {
      "id": "jujutsu-kaisen",
      "title": "Jujutsu Kaisen",
      "url": "https://toonstream.vip/series/jujutsu-kaisen/",
      "image": "https://image.tmdb.org/t/p/w500/dGvJUOS01OrgDntHXGF04tW6oJ5.jpg",
      "rating": "8.552",
      "type": "series"
    }
  ]
}
```

---

### `GET /anime/:id`
Full details for a series/anime.

**Example:** `GET /anime/jujutsu-kaisen`

**Response:**
```json
{
  "success": true,
  "provider": "toonstream",
  "results": {
    "id": "jujutsu-kaisen",
    "title": "Jujutsu Kaisen",
    "url": "https://toonstream.vip/series/jujutsu-kaisen/",
    "image": "https://image.tmdb.org/t/p/w185/dGvJUOS01OrgDntHXGF04tW6oJ5.jpg",
    "description": "Yuji Itadori is a boy with tremendous physical strength...",
    "year": "2020",
    "rating": "8.552",
    "duration": "2 min.",
    "views": "290",
    "totalSeasons": 3,
    "totalEpisodes": 59,
    "genres": ["Action & Adventure", "Animation", "Anime Series"],
    "seasons": [
      { "season": 1, "label": "Season 1", "postId": "1914" },
      { "season": 2, "label": "Season 2", "postId": "1914" }
    ],
    "cast": [
      { "label": "Cast", "names": ["Junya Enoki", "Asami Seto"] }
    ],
    "episodes": [
      {
        "id": "jujutsu-kaisen-1x1",
        "episode": "1x1",
        "title": "Jujutsu Kaisen 1x1",
        "url": "https://toonstream.vip/episode/jujutsu-kaisen-1x1/",
        "thumbnail": "https://image.tmdb.org/t/p/w185/veG3J8KaBudM8omuGi58fYOMDTz.jpg",
        "aired": "6 years ago"
      }
    ]
  }
}
```

---

### `GET /movie/:id`
Full details for a movie.

**Example:** `GET /movie/jujutsu-kaisen-0`

**Response:**
```json
{
  "success": true,
  "provider": "toonstream",
  "results": {
    "id": "jujutsu-kaisen-0",
    "title": "Jujutsu Kaisen 0",
    "url": "https://toonstream.vip/movies/jujutsu-kaisen-0/",
    "image": "https://image.tmdb.org/t/p/w185/23oJaeBh0FDk2mQ2P240PU9Xxfh.jpg",
    "description": "...",
    "year": "2021",
    "rating": "8.18",
    "duration": "1h 45m",
    "genres": ["Action", "Animation", "Anime Movies"],
    "cast": [],
    "sources": [
      {
        "server": "Play",
        "language": "Hindi-Eng",
        "embedUrl": "https://toonstream.vip/?trembed=0&trid=6994&trtype=1",
        "index": 0
      }
    ],
    "related": []
  }
}
```

---

### `GET /episode/:id`
Streaming sources for an episode.

**Example:** `GET /episode/jujutsu-kaisen-1x1`

**Response:**
```json
{
  "success": true,
  "provider": "toonstream",
  "results": {
    "id": "jujutsu-kaisen-1x1",
    "title": "Jujutsu Kaisen 1x1",
    "url": "https://toonstream.vip/episode/jujutsu-kaisen-1x1/",
    "image": "https://image.tmdb.org/t/p/w185/dGvJUOS01OrgDntHXGF04tW6oJ5.jpg",
    "year": "2020",
    "duration": "24min",
    "rating": "8.552",
    "genres": ["Action & Adventure", "Animation"],
    "sources": [
      {
        "server": "X",
        "language": "Multi Audio",
        "embedUrl": "https://toonstream.vip/?trembed=0&trid=9005&trtype=2",
        "index": 0
      },
      {
        "server": "Short",
        "language": "Multi Audio",
        "embedUrl": "https://toonstream.vip/?trembed=1&trid=9005&trtype=2",
        "index": 1
      }
    ],
    "navigation": {
      "prev": null,
      "next": "https://toonstream.vip/episode/jujutsu-kaisen-1x2/",
      "seriesUrl": "https://toonstream.vip/series/jujutsu-kaisen/"
    },
    "episodes": []
  }
}
```

---

### `GET /recent`
Latest updated series.

### `GET /recent/movies`
Latest updated movies.

### `GET /trending`
Featured/trending anime from ToonStream's homepage.

All three return:
```json
{
  "success": true,
  "provider": "toonstream",
  "results": [
    {
      "id": "jujutsu-kaisen",
      "title": "Jujutsu Kaisen",
      "url": "https://toonstream.vip/series/jujutsu-kaisen/",
      "image": "https://image.tmdb.org/t/p/w500/dGvJUOS01OrgDntHXGF04tW6oJ5.jpg",
      "rating": "8.552",
      "type": "series"
    }
  ]
}
```

---

### Error Response Format

All errors return:
```json
{
  "success": false,
  "message": "Description of the error"
}
```

---

## 🏗 Provider Architecture

Each provider is a self-contained folder under `providers/`:

```
providers/
└── toonstream/
    ├── index.js    ← Public exports (getAnimeDetails, search, etc.)
    ├── parser.js   ← Cheerio DOM parsers (reusable across scrapers)
    ├── anime.js    ← Details + episode + trending + recent logic
    └── search.js   ← Search scraping
```

The `providerManager.js` dynamically imports whichever provider is active and returns it. Routes never import providers directly — they always go through `getProvider()`.

---

## 🔌 Adding a New Provider

1. **Create the folder:**
   ```
   providers/hianime/
   ├── index.js
   ├── parser.js
   ├── anime.js
   └── search.js
   ```

2. **Implement the same exports** as `toonstream/index.js`:
   ```js
   export { search } from "./search.js";
   export { getAnimeDetails, getMovieDetails, getEpisodeSources, getRecent, getTrending, getRecentMovies } from "./anime.js";
   ```

3. **Register the provider** in `core/config.js`:
   ```js
   providers: ["toonstream", "hianime"],
   ```

4. **Add the base URL** in `constants/baseurl.js`:
   ```js
   hianime: "https://hianime.to",
   ```

5. **Set the active provider** in `.env`:
   ```
   DEFAULT_PROVIDER=hianime
   ```

That's it. No route changes needed.

---

## 📝 License

MIT — use freely, contribute back if you improve it.
