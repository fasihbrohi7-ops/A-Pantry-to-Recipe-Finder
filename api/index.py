import os
import json
import logging
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load local environment variables from .env.local or .env if present
env_local_path = Path(__file__).resolve().parent.parent / ".env.local"
if env_local_path.exists():
    load_dotenv(dotenv_path=env_local_path)
else:
    load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Determine static folder path (../public)
BASE_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = BASE_DIR / "public"

# Safe storage directory for local development & serverless read-only environments (e.g. Vercel)
if os.environ.get("VERCEL"):
    DATA_DIR = Path("/tmp") / ".data"
else:
    try:
        DATA_DIR = BASE_DIR / ".data"
        DATA_DIR.mkdir(parents=True, exist_ok=True)
    except OSError:
        DATA_DIR = Path("/tmp") / ".data"

try:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
except Exception as e:
    logger.warning("Could not create DATA_DIR %s: %s", DATA_DIR, e)

LOCAL_FAVORITES_FILE = DATA_DIR / "favorites.json"

app = Flask(__name__, static_folder=str(PUBLIC_DIR), static_url_path="")
CORS(app)

# WSGI Middleware to normalize PATH_INFO from Vercel rewrites
class NormalizePathMiddleware:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        path = environ.get('PATH_INFO', '')
        raw_uri = environ.get('HTTP_X_MATCHED_PATH') or environ.get('HTTP_X_FORWARDED_URI') or environ.get('RAW_URI') or environ.get('REQUEST_URI')
        
        if path.startswith('/api/index.py'):
            rem = path[len('/api/index.py'):]
            environ['PATH_INFO'] = rem if rem.startswith('/') else ('/' + rem)
        elif path == '/api/index.py' or path == '/api/index' or path == '/':
            if raw_uri and not raw_uri.startswith('/api/index'):
                clean_raw = raw_uri.split('?')[0]
                if clean_raw:
                    environ['PATH_INFO'] = clean_raw
        return self.wsgi_app(environ, start_response)

app.wsgi_app = NormalizePathMiddleware(app.wsgi_app)

# Upstash Redis Initialization
UPSTASH_URL = os.getenv("UPSTASH_REDIS_REST_URL", "").strip()
UPSTASH_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "").strip()

redis_client = None
if UPSTASH_URL and UPSTASH_TOKEN:
    try:
        from upstash_redis import Redis
        redis_client = Redis(url=UPSTASH_URL, token=UPSTASH_TOKEN)
        logger.info("Initialized Upstash Redis REST client.")
    except Exception as e:
        logger.warning("Failed to initialize Upstash Redis, falling back to local storage: %s", e)
        redis_client = None
else:
    logger.info("Upstash credentials not provided. Using local file storage fallback for favorites.")

# Helper storage functions for favorites
def _load_local_favorites():
    try:
        if not LOCAL_FAVORITES_FILE.exists():
            return {}
        with open(LOCAL_FAVORITES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("Error reading local favorites file: %s", e)
        return {}

def _save_local_favorites(data):
    try:
        LOCAL_FAVORITES_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(LOCAL_FAVORITES_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.warning("Error writing local favorites file: %s", e)

def get_all_favorites():
    if redis_client:
        try:
            raw_dict = redis_client.hgetall("favorites") or {}
            favorites = []
            for _, val in raw_dict.items():
                if isinstance(val, dict):
                    favorites.append(val)
                elif isinstance(val, str):
                    try:
                        favorites.append(json.loads(val))
                    except Exception:
                        pass
            favorites.sort(key=lambda x: x.get("saved_at", ""), reverse=True)
            return favorites
        except Exception as e:
            logger.error("Redis hgetall failed: %s. Using local fallback.", e)

    data = _load_local_favorites()
    favorites = list(data.values())
    favorites.sort(key=lambda x: x.get("saved_at", ""), reverse=True)
    return favorites

def set_favorite(item):
    recipe_id = str(item.get("id"))
    item["saved_at"] = datetime.now(timezone.utc).isoformat()
    if redis_client:
        try:
            redis_client.hset("favorites", recipe_id, json.dumps(item))
            return item
        except Exception as e:
            logger.error("Redis hset failed: %s. Using local fallback.", e)

    data = _load_local_favorites()
    data[recipe_id] = item
    _save_local_favorites(data)
    return item

def delete_favorite(recipe_id):
    recipe_id = str(recipe_id)
    if redis_client:
        try:
            deleted = redis_client.hdel("favorites", recipe_id)
            if deleted and deleted > 0:
                return True
            return False
        except Exception as e:
            logger.error("Redis hdel failed: %s. Using local fallback.", e)

    data = _load_local_favorites()
    if recipe_id in data:
        del data[recipe_id]
        _save_local_favorites(data)
        return True
    return False

# ----------------- TheMealDB API Integration ----------------- #

THEMEALDB_BASE = "https://www.themealdb.com/api/json/v1/1"
REQUEST_TIMEOUT = 5.0

def fetch_single_ingredient_meals(ingredient_tag):
    """
    Query TheMealDB filter.php?i=term.
    Normalization: lowercased, trimmed, spaces replaced with underscores.
    """
    clean_term = ingredient_tag.strip().lower().replace(" ", "_")
    url = f"{THEMEALDB_BASE}/filter.php?i={clean_term}"
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code == 200:
            data = resp.json()
            meals = data.get("meals")
            if isinstance(meals, list):
                return ingredient_tag, meals
            return ingredient_tag, []
        logger.warning("TheMealDB filter returned status %s for '%s'", resp.status_code, ingredient_tag)
        return ingredient_tag, []
    except Exception as e:
        logger.warning("Error fetching ingredient '%s': %s", ingredient_tag, e)
        return ingredient_tag, []

def parse_meal_detail(meal):
    """
    Parse a full meal record from TheMealDB lookup into our standardized schema.
    """
    if not isinstance(meal, dict):
        return {}

    ingredients = []
    for i in range(1, 21):
        ing = str(meal.get(f"strIngredient{i}") or "").strip()
        meas = str(meal.get(f"strMeasure{i}") or "").strip()
        if ing:
            ingredients.append({"name": ing, "measure": meas})

    tags = []
    raw_tags = meal.get("strTags")
    if raw_tags and isinstance(raw_tags, str):
        tags = [t.strip() for t in raw_tags.split(",") if t.strip()]

    return {
        "id": str(meal.get("idMeal") or ""),
        "name": str(meal.get("strMeal") or "").strip(),
        "category": meal.get("strCategory") or "General",
        "area": meal.get("strArea") or "International",
        "thumbnail": meal.get("strMealThumb") or "",
        "instructions": str(meal.get("strInstructions") or "").strip(),
        "ingredients": ingredients,
        "source_url": meal.get("strSource") or "",
        "youtube_url": meal.get("strYoutube") or "",
        "tags": tags
    }

# ----------------- API Endpoints ----------------- #

@app.route("/api/health", methods=["GET"])
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "storage": "upstash-redis" if redis_client else "local-fallback",
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

@app.route("/api/search", methods=["GET"])
@app.route("/search", methods=["GET"])
def search_recipes():
    try:
        raw_ingredients = request.args.get("ingredients", "")
        if not raw_ingredients:
            return jsonify({"error": "Missing required 'ingredients' query parameter"}), 400

        # Split, strip, filter empty and deduplicate while maintaining case-insensitive uniqueness
        seen = set()
        cleaned_ingredients = []
        for item in raw_ingredients.split(","):
            trimmed = item.strip()
            if trimmed and trimmed.lower() not in seen:
                seen.add(trimmed.lower())
                cleaned_ingredients.append(trimmed)

        if len(cleaned_ingredients) == 0:
            return jsonify({"error": "At least 1 valid ingredient is required"}), 400

        if len(cleaned_ingredients) > 10:
            return jsonify({"error": "Maximum of 10 ingredient tags allowed"}), 400

        # Query TheMealDB in parallel for all ingredients
        merged_meals = {}
        fetch_success = False

        max_threads = min(len(cleaned_ingredients), 8)
        with ThreadPoolExecutor(max_workers=max_threads) as executor:
            future_map = {
                executor.submit(fetch_single_ingredient_meals, ing): ing
                for ing in cleaned_ingredients
            }
            for future in as_completed(future_map):
                try:
                    ing_tag, meals = future.result()
                    fetch_success = True
                    for meal in (meals or []):
                        if not isinstance(meal, dict):
                            continue
                        meal_id = str(meal.get("idMeal") or "").strip()
                        if not meal_id:
                            continue
                        meal_name = str(meal.get("strMeal") or "").strip()
                        meal_thumb = str(meal.get("strMealThumb") or "").strip()

                        if meal_id not in merged_meals:
                            merged_meals[meal_id] = {
                                "id": meal_id,
                                "name": meal_name,
                                "thumbnail": meal_thumb,
                                "match_count": 1,
                                "matched_ingredients": [ing_tag]
                            }
                        else:
                            merged_meals[meal_id]["match_count"] += 1
                            if ing_tag not in merged_meals[meal_id]["matched_ingredients"]:
                                merged_meals[meal_id]["matched_ingredients"].append(ing_tag)
                except Exception as e:
                    logger.error("Ingredient thread execution error: %s", e)

        # If no meals found or network issue, return empty recipes cleanly
        if not merged_meals:
            return jsonify({
                "count": 0,
                "query_ingredients": cleaned_ingredients,
                "recipes": []
            }), 200

        # Rank recipes: primary by match_count descending, secondary by name alphabetically
        sorted_recipes = sorted(
            merged_meals.values(),
            key=lambda r: (-r.get("match_count", 1), (r.get("name") or "").lower())
        )

        top_results = sorted_recipes[:30]

        return jsonify({
            "count": len(sorted_recipes),
            "query_ingredients": cleaned_ingredients,
            "recipes": top_results
        })
    except Exception as err:
        logger.exception("Unexpected error in search_recipes: %s", err)
        return jsonify({"error": f"Search error: {str(err)}"}), 500

@app.route("/api/recipe/<recipe_id>", methods=["GET"])
@app.route("/recipe/<recipe_id>", methods=["GET"])
def get_recipe_detail(recipe_id):
    if not recipe_id or not str(recipe_id).isdigit():
        return jsonify({"error": "Invalid recipe ID"}), 400

    url = f"{THEMEALDB_BASE}/lookup.php?i={recipe_id}"
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return jsonify({"error": "Upstream error fetching recipe"}), 502

        data = resp.json()
        meals = data.get("meals")
        if not meals:
            return jsonify({"error": f"Recipe with ID {recipe_id} not found"}), 404

        parsed = parse_meal_detail(meals[0])
        return jsonify(parsed)
    except requests.Timeout:
        return jsonify({"error": "Upstream recipe request timed out"}), 502
    except Exception as e:
        logger.error("Error fetching recipe %s: %s", recipe_id, e)
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/random", methods=["GET"])
@app.route("/random", methods=["GET"])
def get_random_recipe():
    """Bonus stretch endpoint: returns a serendipitous surprise recipe!"""
    url = f"{THEMEALDB_BASE}/random.php"
    try:
        resp = requests.get(url, timeout=REQUEST_TIMEOUT)
        if resp.status_code != 200:
            return jsonify({"error": "Upstream error fetching random recipe"}), 502

        data = resp.json()
        meals = data.get("meals")
        if not meals:
            return jsonify({"error": "No recipe returned"}), 502

        parsed = parse_meal_detail(meals[0])
        return jsonify(parsed)
    except Exception as e:
        logger.error("Error fetching random recipe: %s", e)
        return jsonify({"error": "Failed to fetch random recipe"}), 500

@app.route("/api/favorites", methods=["GET"])
@app.route("/favorites", methods=["GET"])
def list_favorites():
    favorites = get_all_favorites()
    return jsonify({
        "count": len(favorites),
        "favorites": favorites
    })

@app.route("/api/favorites", methods=["POST"])
@app.route("/favorites", methods=["POST"])
def add_favorite():
    body = request.get_json(silent=True) or {}
    recipe_id = body.get("id")
    name = body.get("name")

    if not recipe_id or not name:
        return jsonify({"error": "Recipe 'id' and 'name' are required"}), 400

    item = {
        "id": str(recipe_id),
        "name": str(name).strip(),
        "thumbnail": body.get("thumbnail", ""),
        "category": body.get("category", ""),
        "area": body.get("area", ""),
    }

    saved = set_favorite(item)
    return jsonify(saved), 200

@app.route("/api/favorites/<recipe_id>", methods=["DELETE"])
@app.route("/favorites/<recipe_id>", methods=["DELETE"])
def remove_favorite(recipe_id):
    if not recipe_id:
        return jsonify({"error": "Recipe ID is required"}), 400

    success = delete_favorite(recipe_id)
    if success:
        return jsonify({"deleted": True, "id": str(recipe_id)}), 200
    return jsonify({"error": f"Recipe {recipe_id} not found in favorites"}), 404

# ----------------- Static Frontend Fallback for Local Dev ----------------- #

@app.route("/", methods=["GET"])
def serve_index():
    index_file = PUBLIC_DIR / "index.html"
    if index_file.exists():
        return send_from_directory(PUBLIC_DIR, "index.html")
    return jsonify({"status": "PantryCraft API Running", "endpoints": ["/api/search", "/api/recipe/<id>", "/api/favorites"]}), 200

@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    target = PUBLIC_DIR / filename
    if target.exists() and target.is_file():
        return send_from_directory(PUBLIC_DIR, filename)
    index_file = PUBLIC_DIR / "index.html"
    if index_file.exists():
        return send_from_directory(PUBLIC_DIR, "index.html")
    return jsonify({"error": f"File {filename} not found"}), 404

# Global Error Handlers (Return JSON for API requests instead of default HTML 500/404)
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"error": "API route not found", "path": request.path}), 404
    index_file = PUBLIC_DIR / "index.html"
    if index_file.exists():
        return send_from_directory(PUBLIC_DIR, "index.html")
    return jsonify({"error": "Not found", "path": request.path}), 404

@app.errorhandler(500)
def server_error(e):
    logger.exception("Flask internal 500 error: %s", e)
    return jsonify({"error": str(e), "type": type(e).__name__, "path": request.path}), 500

@app.errorhandler(Exception)
def unhandled_exception(e):
    logger.exception("Unhandled server exception: %s", e)
    return jsonify({"error": str(e), "type": type(e).__name__, "path": request.path}), 500

# Export for Vercel
# Vercel's @vercel/python looks for 'app' in api/index.py
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    logger.info("Starting local Pantry-to-Recipe Finder server on http://localhost:%s", port)
    app.run(host="0.0.0.0", port=port, debug=True)
