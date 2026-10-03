# Architecture & Technical Design Document 📐

## System Overview

**PantryCraft** is a lightweight, serverless-ready web application designed for fast, zero-configuration pantry-based recipe matching.

```
┌─────────────────────────────────────────┐
│           Client Browser (SPA)          │
│   • Semantic HTML5 & Vanilla CSS3       │
│   • Vanilla ES6+ State & UI Manager     │
│   • LocalStorage optimistic cache       │
└────────────────────┬────────────────────┘
                     │ HTTPS / JSON
                     ▼
┌─────────────────────────────────────────┐
│     Flask Serverless Function (Vercel)  │
│   • api/index.py                        │
│   • ThreadPoolExecutor concurrency      │
│   • CORS & Input Sanitization           │
└────────────┬────────────────────────────┘
             │
     ┌───────┴────────────────────────────┐
     ▼                                    ▼
┌───────────────────────────┐  ┌───────────────────────────────────┐
│   TheMealDB Public API    │  │    Upstash Redis REST Store       │
│   • filter.php?i={tag}    │  │    • Hash: "favorites"            │
│   • lookup.php?i={id}     │  │    • Key: recipe_id               │
│   • random.php            │  │    • Value: JSON metadata         │
└───────────────────────────┘  └───────────────────────────────────┘
```

---

## 1. Multi-Ingredient Ranking Strategy

TheMealDB free public API filters by **one** ingredient term per request (`filter.php?i=<term>`). To provide multi-ingredient matching:

1. The client sends a comma-separated list of 1 to 10 ingredient tags (e.g. `chicken,rice,garlic`).
2. The backend sanitizes each tag (lowercased, spaces converted to underscores).
3. The backend executes concurrent queries using Python's `ThreadPoolExecutor(max_workers=min(N, 8))`.
4. Individual results are merged into a map indexed by meal ID (`idMeal`):
   - `match_count` increments each time a recipe appears in an ingredient's query result.
   - `matched_ingredients` collects the specific user ingredients matched by this recipe.
5. The combined list is ranked with primary sort on `-match_count` (highest overlap first) and secondary sort on `strMeal.lower()` alphabetically.
6. The top 30 most relevant recipes are returned to the client in under 2 seconds.

---

## 2. Statelessness & Persistence Model

- **Search**: Fully stateless. Every search runs live against TheMealDB with no required database writes.
- **Favorites Storage**:
  - In Production (Vercel): Uses **Upstash Redis** REST API (`upstash-redis`). Because requests in Vercel serverless functions are ephemeral, HTTP REST-based Redis client guarantees zero persistent connection leaks or cold-start timeouts.
  - In Local Development: If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not provided in environment variables, the backend automatically switches to a local file store (`.data/favorites.json`), enabling instant development out-of-the-box.
- **Client Cache**: The frontend maintains an optimistic `localStorage` cache for instant UI rendering and syncs with `/api/favorites`.

---

## 3. Data Schema

### Redis Hash Key: `favorites`
- **Field**: Recipe ID (e.g. `"53161"`)
- **Value**: Serialized JSON string:
```json
{
  "id": "53161",
  "name": "Chicken & chorizo rice pot",
  "thumbnail": "https://www.themealdb.com/images/media/meals/fk80jp1763280767.jpg",
  "category": "Chicken",
  "area": "Spanish",
  "saved_at": "2026-10-03T11:20:00.000Z"
}
```

---

## 4. Frontend Architecture

The frontend uses standard web platform APIs without any build tooling, bundlers, or heavy frameworks:
- **`index.html`**: Accessible semantic markup, ARIA attributes, SVG iconography.
- **`style.css`**: CSS variables design system, CSS Grid auto-fill, responsive media queries, keyframe animations (`popIn`, `modalEnter`, `shimmer`).
- **`app.js`**: Modular IIFE with an isolated state object managing tags, results, filters, sort order, and favorites map.
