# ToonStream API

<p align="center">
  <img src="https://toonstream.vip/wp-content/uploads/2024/01/TOONSTREAM.png" alt="ToonStream" width="300" />
</p>

<p align="center">
  A fast, provider-based anime & cartoon scraping REST API built with Node.js + Hono, optimized for Vercel serverless deployment.
</p>

---

## ✨ Features

- **Provider-based architecture** — easy to add new sources
- **Full homepage scraping** — latest episodes, series, languages
- **Series details** — metadata, seasons, cast, categories
- **Season episode fetching** — via WordPress AJAX, flexible season selection
- **Episode details** — streaming servers with iframe sources
- **Movie support** — listings and individual movie detail pages
- **Search** — full-text search across all content
- **Categories** — browse by genre, network, language
- **Cast pages** — content filtered by actor/voice actor
- **Alphabetical browsing** — A–Z letter navigation
- **In-memory cache** — tiered TTL per content type
- **CORS enabled** — ready for frontend integration
- **Cloudflare-friendly headers** — browser-like request fingerprinting

---

## 📁 Project Structure

```
toonstream-api/
├── api/
│   └── index.js              # Hono app entry + all route mounting
├── core/
│   ├── config.js             # Env config
│   └── providerManager.js    # Provider loader & switcher
├── constants/
│   └── baseurl.js            # Base URLs per provider
├── providers/
│   └── toonstream/
│       ├── index.js          # Clean export of all provider functions
│       ├── parser.js         # Cheerio selectors only — no HTTP
│       ├── anime.js          # Series, episode, movie, category logic
│       └── search.js         # Search & letter browse logic
├── routes/
│   ├── anime.js              # Series / episode / movie / category routes
│   └── search.js             # Search routes
├── utils/
│   ├── http.js               # Axios wrapper with retry + timeout
│   ├── request.js            # Browser-like headers + user agents
│   ├── dom.js                # Reusable cheerio DOM helpers
│   └── cache.js              # In-memory Map-based cache
├── .env
├── package.json
├── vercel.json
├── jsconfig.json
└── README.md
```

---

## 🛠 Installation

```bash
git clone https://github.com/yourusername/toonstream-api.git
cd toonstream-api
npm install
```

Create a `.env` file:
```env
PORT=3000
PROVIDER=toonstream
```

---

## 🚀 Local Development

```bash
npm run dev
```

API will be available at `http://localhost:3000`

---

## ☁️ Vercel Deployment

```bash
npm install -g vercel
vercel login
vercel --prod
```

Your API will be live at: `https://your-project.vercel.app`

---

## 📡 API Endpoints

### Root & Health

| Method | Endpoint  | Description            |
|--------|-----------|------------------------|
| GET    | `/`       | API info & endpoint list |
| GET    | `/health` | Health check           |

---

### Homepage

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/home` | Latest episodes, series, languages |
| GET | `/home?s=naruto` | Search via homepage shortcut |

**Response:**
```json
{
  "success": true,
  "provider": "toonstream",
  "results": {
    "latestEpisodes": [...],
    "latestSeries": [...],
    "languages": [...],
    "featured": [...]
  }
}
```

---

### Series

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/series/:slug` | Series info + season 1 episodes |
| GET | `/series/:slug?seasons=all` | All seasons |
| GET | `/series/:slug?seasons=1,2,3` | Specific seasons |
| GET | `/series/:slug?seasons=2-4` | Season range |
| GET | `/series/:slug?seasons=1&src=true&server=all` | With server sources |
| GET | `/series?slug=jujutsu-kaisen` | Query param version |

**Query Parameters:**
- `seasons` — `1`, `1,2,3`, `2-4`, `all`
- `src` — `true` to include iframe server sources per episode
- `server` — `0,1,2`, `0-4`, `all`, or server names like `x,ruby`

**Response:**
```json
{
  "success": true,
  "provider": "toonstream",
  "stats": {
    "totalSeasons": 3,
    "requestedSeasons": 2,
    "fetchedEpisodes": 47,
    "includesServerSources": true
  },
  "results": {
    "slug": "jujutsu-kaisen",
    "title": "Jujutsu Kaisen",
    "image": "https://image.tmdb.org/t/p/w185/...",
    "rating": "8.552",
    "year": "2020",
    "duration": "2",
    "totalSeasons": 3,
    "totalEpisodes": 59,
    "categories": [{"name": "Action & Adventure", "url": "..."}],
    "cast": [{"name": "Junya Enoki", "url": "..."}],
    "availableSeasons": [{"seasonNumber": 1, "name": "Season 1"}],
    "seasons": [
      {
        "seasonNumber": 1,
        "name": "Season 1",
        "episodes": [
          {
            "title": "Jujutsu Kaisen 1x1",
            "episodeNumber": "1x1",
            "image": "https://...",
            "time": "6 years ago",
            "url": "https://toonstream.vip/episode/jujutsu-kaisen-1x1/",
            "slug": "jujutsu-kaisen-1x1",
            "servers": [...]
          }
        ]
      }
    ]
  }
}
```

---

### Episode

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/episode/:slug` | Episode info + all servers |
| GET | `/episode/:slug?server=0,1,2` | Specific servers by number |
| GET | `/episode/:slug?server=0-4` | Server range |
| GET | `/episode/:slug?server=x,ruby` | By server name |
| GET | `/episode?slug=jujutsu-kaisen-1x1` | Query param version |

**Response:**
```json
{
  "success": true,
  "provider": "toonstream",
  "stats": {
    "totalServersAvailable": 7,
    "serversReturned": 3
  },
  "results": {
    "slug": "jujutsu-kaisen-1x1",
    "title": "Jujutsu Kaisen 1x1",
    "image": "https://...",
    "description": "...",
    "rating": "8.552",
    "year": "2020",
    "categories": [...],
    "cast": [...],
    "navigation": {
      "previousEpisode": null,
      "nextEpisode": "https://toonstream.vip/episode/jujutsu-kaisen-1x2/",
      "seriesPage": "https://toonstream.vip/series/jujutsu-kaisen/"
    },
    "servers": [
      {
        "serverNumber": 0,
        "displayNumber": 1,
        "name": "X",
        "language": "Multi Audio",
        "src": "https://toonstream.vip/?trembed=0&trid=17486&trtype=2",
        "isActive": true
      }
    ]
  }
}
```

---

### Movies

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/movies` | Movies listing (page 1) |
| GET | `/movies/page/:page` | Movies listing paginated |
| GET | `/movies/:slug` | Individual movie details |

---

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search/:query` | Search by path |
| GET | `/search?q=naruto` | Search by query param |
| GET | `/search?s=naruto` | Search (alternate param) |
| GET | `/search/:query?page=2` | Paginated search |
| GET | `/home/search/:query` | Alternate search URL |

**Response:**
```json
{
  "success": true,
  "provider": "toonstream",
  "stats": {
    "resultsCount": 8,
    "seriesCount": 5,
    "moviesCount": 3
  },
  "results": {
    "searchQuery": "naruto",
    "hasResults": true,
    "results": [
      {
        "id": "post-1234",
        "title": "Naruto Shippuden",
        "image": "https://...",
        "url": "https://...",
        "slug": "naruto-shippuden",
        "rating": "8.5",
        "contentType": "series",
        "categories": [...],
        "tags": [...]
      }
    ]
  }
}
```

---

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/category/:path` | Browse category |
| GET | `/category/:path/page/:page` | Paginated category |
| GET | `/category/action` | Action genre |
| GET | `/category/crunchyroll` | Crunchyroll network |
| GET | `/category/language/hindi-language` | Hindi dubbed |
| GET | `/category/anime/anime-series` | Anime series |

**Common paths:**
- Networks: `crunchyroll`, `netflix`, `disney`, `cartoon-network`, `jiohostar`
- Genres: `action`, `comedy`, `drama`, `sci-fi-fantasy`, `romance`, `superhero`
- Languages: `language/hindi-language`, `language/tamil-language`, `language/japaneses`, `language/english`

---

### Cast

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cast/:name` | Browse by cast member |
| GET | `/cast/:name/page/:page` | Paginated cast page |
| GET | `/home/cast_tv/:name` | Alternate cast URL |

**Example:** `GET /cast/junya-enoki`

---

### Alphabetical Browse

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/letter/:letter` | Browse by first letter |
| GET | `/letter/:letter/page/:page` | Paginated |
| GET | `/home/letter/:letter` | Alternate letter URL |

**Examples:** `/letter/A`, `/letter/N/page/2`, `/letter/0-9`

---

## 📦 Response Format

All responses follow this consistent structure:

**Success:**
```json
{
  "success": true,
  "provider": "toonstream",
  "results": { ... },
  "stats": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "provider": "toonstream",
  "message": "Error description",
  "statusCode": 404
}
```

---

## ⚡ Cache TTL

| Content Type | Cache Duration |
|---|---|
| Home / Search | 5 minutes |
| Series / Episode | 30 minutes |
| Stream servers | 1 hour |
| Category / Cast | 10 minutes |

---

## 🔌 Adding a New Provider

1. Create `providers/yourprovider/` with `index.js`, `parser.js`, `anime.js`, `search.js`
2. Add base URL to `constants/baseurl.js`
3. Register in `core/providerManager.js`
4. Set `PROVIDER=yourprovider` in `.env`

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `hono` | Fast web framework |
| `@hono/node-server` | Node.js adapter for Hono |
| `axios` | HTTP requests |
| `cheerio` | HTML parsing |
| `dotenv` | Environment variables |

---

## ⚠️ Disclaimer

This API is for educational purposes only. Please respect copyright laws and the terms of service of the source website.

---

Made with ❤️ — [ToonStream](https://toonstream.vip)
