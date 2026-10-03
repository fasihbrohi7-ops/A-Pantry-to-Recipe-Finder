# PantryCraft — Smart Pantry-to-Recipe Finder 🍳

[![License: MIT](https://img.shields.io/badge/License-MIT-amber.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11+-3776AB.svg?logo=python&logoColor=white)](https://www.python.org/)
[![Flask 3.x](https://img.shields.io/badge/Flask-3.x-000000.svg?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![Vercel Deployment](https://img.shields.io/badge/Deploy-Vercel-black.svg?logo=vercel&logoColor=white)](https://vercel.com/)
[![Upstash Redis](https://img.shields.io/badge/Storage-Upstash%20Redis-00e9a3.svg?logo=redis&logoColor=white)](https://upstash.com/)
[![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20HTML%2FCSS%2FJS-F7DF1E.svg?logo=javascript&logoColor=black)](public/)

> **Transform ingredients you already have into chef-crafted meals in seconds.**  
> Zero sign-up, zero food waste, and instant culinary inspiration.

---

## 🌟 Highlights & Features

- 🥕 **Interactive Pantry Tag Builder**: Add ingredients via text input (`Enter` or `Add` button) or tap quick staples (Chicken, Rice, Garlic, Tomatoes, Eggs, Cheese, etc.).
- 🎯 **Smart Overlap Ranking**: Queries recipe database in parallel and sorts recipes with the highest ingredient overlap first (`match_count` descending).
- 🔥 **Match Badges & Overlap Tags**: View exactly which of your pantry ingredients matched each recipe.
- 📖 **Interactive Recipe Modal**: Full recipe details with interactive ingredient checkboxes (check off items as you prep!) and clean step-by-step cooking instructions.
- ❤️ **Persistent Favorites**: Save recipes to your personal favorites collection backed by **Upstash Redis REST API** (with zero-configuration local fallback).
- 🎲 **Surprise Me**: One-click serendipitous recipe discovery when you can't decide what to cook.
- 🎨 **Luxury Culinary Dark UI**: Glassmorphic frosted cards, responsive CSS Grid layout, Google Fonts (`Outfit` & `Plus Jakarta Sans`), and subtle micro-animations.
- ⚡ **Zero Build Step**: Native ES6+ JavaScript and Vanilla CSS. Deployable instantly to Vercel.

---

## 📐 Architecture Overview

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

For in-depth technical details, see the [Architecture Documentation](ARCHITECTURE.md).

---

## 📁 Repository Structure

```
A-Pantry-to-Recipe-Finder/
├── api/
│   └── index.py            # Flask backend entry point & Vercel serverless function
├── public/
│   ├── index.html          # Semantic HTML5 SPA layout
│   ├── style.css           # Vanilla CSS design system & dark culinary theme
│   └── app.js              # Vanilla ES6+ application logic & state management
├── .data/                  # Local storage fallback directory (ignored in git)
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore configuration
├── ARCHITECTURE.md         # Detailed technical design document
├── CONTRIBUTING.md         # Contribution guidelines
├── LICENSE                 # MIT License
├── README.md               # Main project documentation
├── requirements.txt        # Python backend dependencies
└── vercel.json             # Vercel deployment configuration
```

---

## 🚀 Quickstart & Local Setup

### 1. Clone Repository
```bash
git clone https://github.com/fasihbrohi7-ops/A-Pantry-to-Recipe-Finder.git
cd A-Pantry-to-Recipe-Finder
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Configuration (Optional)
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

> **Note:** If Upstash Redis credentials are not provided, the app will automatically use a local file storage fallback (`.data/favorites.json`), so you can develop and test immediately with zero external accounts required!

### 4. Run Development Server
```bash
python api/index.py
```
Open **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## 📡 API Specification

### `GET /api/search?ingredients=chicken,rice,garlic`
Searches recipes matching 1 to 10 comma-separated ingredients.
- Parallelized calls across TheMealDB ingredient endpoints.
- Returns top 30 recipes ranked by `match_count` descending.

**Response `200 OK`:**
```json
{
  "count": 12,
  "query_ingredients": ["chicken", "rice", "garlic"],
  "recipes": [
    {
      "id": "53161",
      "name": "Chicken & chorizo rice pot",
      "thumbnail": "https://www.themealdb.com/images/media/meals/fk80jp1763280767.jpg",
      "match_count": 2,
      "matched_ingredients": ["rice", "chicken"]
    }
  ]
}
```

### `GET /api/recipe/<id>`
Returns complete recipe details including parsed ingredients with measures, instructions, and video links.

### `GET /api/random`
Returns a random surprise recipe for quick inspiration.

### `GET /api/favorites`
Returns all saved favorite recipes.

### `POST /api/favorites`
Saves a recipe to favorites (idempotent).
```json
{
  "id": "53161",
  "name": "Chicken & chorizo rice pot",
  "thumbnail": "https://www.themealdb.com/images/media/meals/fk80jp1763280767.jpg",
  "category": "Chicken",
  "area": "Spanish"
}
```

### `DELETE /api/favorites/<id>`
Removes a recipe from favorites.

### `GET /api/health`
Health check endpoint reporting backend status and storage provider (`upstash-redis` or `local-fallback`).

---

## ☁️ Deployment on Vercel

1. Push your code to GitHub:
   ```bash
   git push origin main
   ```
2. Go to [Vercel Dashboard](https://vercel.com) and click **"Add New Project"**.
3. Import `fasihbrohi7-ops/A-Pantry-to-Recipe-Finder`.
4. In **Project Settings → Environment Variables**, add your Upstash Redis credentials:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
5. Click **Deploy**. Vercel will build the Python serverless function and host the static assets globally.

---

## 🧪 Testing

Run backend tests verifying health, search, recipe lookup, and favorites lifecycle:
```bash
python -c "
from api.index import app
client = app.test_client()

# Health test
r = client.get('/api/health')
assert r.status_code == 200, 'Health check failed'

# Search test
r = client.get('/api/search?ingredients=chicken,rice')
assert r.status_code == 200 and len(r.json.get('recipes', [])) > 0, 'Search failed'

print('All API tests passed successfully!')
"
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!  
Please see [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

---

## 📄 License

This project is open source and licensed under the [MIT License](LICENSE).
