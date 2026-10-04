/**
 * PantryCraft — Frontend Application Logic
 * Vanilla JavaScript (ES6+)
 */

(() => {
  'use strict';

  // State Management
  const state = {
    currentTab: 'search', // 'search' | 'favorites'
    ingredients: [],      // Array of strings (pantry tags)
    searchResults: [],    // Array of meal objects from /api/search
    activeFilter: 'all',  // 'all' | 'multi'
    activeSort: 'match-desc', // 'match-desc' | 'name-asc'
    favorites: new Map(), // Map<recipeId, favoriteItem>
    currentModalRecipe: null,
    isSearching: false,
    favoritesLoaded: false
  };

  // DOM Elements
  const DOM = {
    // Header & Tabs
    tabSearch: document.getElementById('tab-search'),
    tabFavorites: document.getElementById('tab-favorites'),
    viewSearch: document.getElementById('view-search'),
    viewFavorites: document.getElementById('view-favorites'),
    favCountBadge: document.getElementById('fav-count-badge'),
    btnSurpriseMe: document.getElementById('btn-surprise-me'),
    brandLogo: document.getElementById('brand-logo'),

    // Ingredient Input & Chips
    ingredientForm: document.getElementById('ingredient-form'),
    ingredientInput: document.getElementById('ingredient-input'),
    btnAddIngredient: document.getElementById('btn-add-ingredient'),
    tagContainer: document.getElementById('tag-container'),
    tagPlaceholder: document.getElementById('tag-placeholder'),
    currentTagCount: document.getElementById('current-tag-count'),
    tagCounterLabel: document.getElementById('tag-counter-label'),
    staplesList: document.getElementById('staples-list'),
    btnClearTags: document.getElementById('btn-clear-tags'),
    btnSearchRecipes: document.getElementById('btn-search-recipes'),
    btnSearchText: document.getElementById('btn-search-text'),
    searchSpinner: document.getElementById('search-spinner'),

    // Search Results Section
    resultsSection: document.getElementById('results-section'),
    resultsHeadline: document.getElementById('results-headline'),
    resultsSubtext: document.getElementById('results-subtext'),
    recipeGrid: document.getElementById('recipe-grid'),
    resultsEmpty: document.getElementById('results-empty'),
    btnTryPopular: document.getElementById('btn-try-popular'),
    loadingSkeletons: document.getElementById('loading-skeletons'),
    filterPills: document.getElementById('filter-pills'),
    countAll: document.getElementById('count-all'),
    countMulti: document.getElementById('count-multi'),
    sortSelect: document.getElementById('sort-select'),

    // Favorites View
    favoritesGrid: document.getElementById('favorites-grid'),
    favoritesEmpty: document.getElementById('favorites-empty'),
    favCountLabel: document.getElementById('fav-count-label'),
    btnExploreRecipes: document.getElementById('btn-explore-recipes'),

    // Modal
    recipeModal: document.getElementById('recipe-modal'),
    modalPanel: document.getElementById('modal-panel'),
    modalClose: document.getElementById('modal-close'),
    modalLoader: document.getElementById('modal-loader'),
    modalContent: document.getElementById('modal-content'),
    modalRecipeImg: document.getElementById('modal-recipe-img'),
    modalCategory: document.getElementById('modal-category'),
    modalArea: document.getElementById('modal-area'),
    modalRecipeTitle: document.getElementById('modal-recipe-title'),
    modalBtnFavorite: document.getElementById('modal-btn-favorite'),
    modalFavoriteText: document.getElementById('modal-favorite-text'),
    modalBtnSource: document.getElementById('modal-btn-source'),
    modalBtnYoutube: document.getElementById('modal-btn-youtube'),
    modalTagsContainer: document.getElementById('modal-tags-container'),
    modalIngredientsCount: document.getElementById('modal-ingredients-count'),
    modalIngredientsList: document.getElementById('modal-ingredients-list'),
    modalInstructionsBody: document.getElementById('modal-instructions-body'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  const MAX_INGREDIENTS = 10;
  const LOCAL_STORAGE_FAVS_KEY = 'pantrycraft_cached_favorites_v1';

  // ---------------------------------------------------------------------------
  // Toast Notifications
  // ---------------------------------------------------------------------------
  function showToast(message, icon = '✨', durationMs = 3200) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-text">${message}</span>
    `;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 260);
    }, durationMs);
  }

  // ---------------------------------------------------------------------------
  // Tab Switching
  // ---------------------------------------------------------------------------
  function switchTab(targetTab) {
    state.currentTab = targetTab;

    if (targetTab === 'search') {
      DOM.tabSearch.classList.add('active');
      DOM.tabSearch.setAttribute('aria-selected', 'true');
      DOM.tabFavorites.classList.remove('active');
      DOM.tabFavorites.setAttribute('aria-selected', 'false');

      DOM.viewSearch.style.display = 'block';
      DOM.viewFavorites.style.display = 'none';
    } else {
      DOM.tabFavorites.classList.add('active');
      DOM.tabFavorites.setAttribute('aria-selected', 'true');
      DOM.tabSearch.classList.remove('active');
      DOM.tabSearch.setAttribute('aria-selected', 'false');

      DOM.viewSearch.style.display = 'none';
      DOM.viewFavorites.style.display = 'block';

      renderFavoritesView();
    }
  }

  // ---------------------------------------------------------------------------
  // Ingredient Tag Management & Auto-Search Trigger
  // ---------------------------------------------------------------------------
  let searchDebounceTimer = null;
  function triggerSearchWithDebounce(delayMs = 250) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (state.ingredients.length === 0) {
      state.searchResults = [];
      DOM.resultsSection.style.display = 'none';
      return;
    }
    searchDebounceTimer = setTimeout(() => {
      performSearch();
    }, delayMs);
  }

  function addIngredient(rawName, autoSearch = true) {
    const name = rawName.trim();
    if (!name) return;

    if (state.ingredients.length >= MAX_INGREDIENTS) {
      showToast(`Maximum ${MAX_INGREDIENTS} ingredients allowed.`, '⚠️');
      return;
    }

    // Check duplicate case-insensitively
    const exists = state.ingredients.some(
      item => item.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      showToast(`"${name}" is already in your pantry!`, 'ℹ️');
      return;
    }

    state.ingredients.push(name);
    updateTagUI();
    DOM.ingredientInput.value = '';
    DOM.ingredientInput.focus();

    if (autoSearch) {
      triggerSearchWithDebounce(150);
    }
  }

  function removeIngredient(index) {
    if (index >= 0 && index < state.ingredients.length) {
      state.ingredients.splice(index, 1);
      updateTagUI();
      if (state.ingredients.length > 0) {
        triggerSearchWithDebounce(150);
      } else {
        state.searchResults = [];
        DOM.resultsSection.style.display = 'none';
      }
    }
  }

  function clearAllIngredients() {
    state.ingredients = [];
    state.searchResults = [];
    updateTagUI();
    DOM.resultsSection.style.display = 'none';
    DOM.ingredientInput.focus();
  }

  function updateTagUI() {
    const count = state.ingredients.length;
    DOM.currentTagCount.textContent = count;

    if (count >= MAX_INGREDIENTS) {
      DOM.tagCounterLabel.classList.add('limit-reached');
    } else {
      DOM.tagCounterLabel.classList.remove('limit-reached');
    }

    // Toggle Clear All and Search Button disabled states
    DOM.btnClearTags.style.display = count > 0 ? 'inline-flex' : 'none';
    DOM.btnSearchRecipes.disabled = count === 0 || state.isSearching;

    // Render chips
    DOM.tagContainer.innerHTML = '';
    if (count === 0) {
      DOM.tagPlaceholder.style.display = 'block';
      DOM.tagContainer.appendChild(DOM.tagPlaceholder);
    } else {
      state.ingredients.forEach((ing, index) => {
        const chip = document.createElement('div');
        chip.className = 'ingredient-chip';
        chip.innerHTML = `
          <span>${escapeHtml(ing)}</span>
          <button type="button" class="chip-remove-btn" title="Remove ${escapeHtml(ing)}" data-index="${index}">&times;</button>
        `;
        DOM.tagContainer.appendChild(chip);
      });
    }

    // Update Quick Staples styling if present
    document.querySelectorAll('.staple-pill').forEach(pill => {
      const stapleName = pill.dataset.name;
      const isAdded = state.ingredients.some(
        item => item.toLowerCase() === stapleName.toLowerCase()
      );
      if (isAdded) {
        pill.classList.add('added');
      } else {
        pill.classList.remove('added');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Recipe Search Execution
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Recipe Search Execution & Fallback Engine
  // ---------------------------------------------------------------------------
  async function fallbackClientSideSearch(ingredients) {
    const cleanIngredients = [];
    const seen = new Set();
    ingredients.forEach(item => {
      const trimmed = item.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase());
        cleanIngredients.push(trimmed);
      }
    });

    const merged = {};
    const fetchPromises = cleanIngredients.map(async ing => {
      const cleanTerm = ing.trim().toLowerCase().replace(/\s+/g, '_');
      try {
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(cleanTerm)}`);
        if (!res.ok) return;
        const data = await res.json();
        const meals = data.meals || [];
        meals.forEach(m => {
          if (!m || !m.idMeal) return;
          const id = String(m.idMeal);
          if (!merged[id]) {
            merged[id] = {
              id: id,
              name: (m.strMeal || '').trim(),
              thumbnail: m.strMealThumb || '',
              match_count: 1,
              matched_ingredients: [ing]
            };
          } else {
            merged[id].match_count += 1;
            if (!merged[id].matched_ingredients.includes(ing)) {
              merged[id].matched_ingredients.push(ing);
            }
          }
        });
      } catch (e) {
        console.warn(`Fallback fetch failed for ${ing}:`, e);
      }
    });

    await Promise.all(fetchPromises);

    const sorted = Object.values(merged).sort((a, b) => {
      if (b.match_count !== a.match_count) {
        return b.match_count - a.match_count;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    return sorted.slice(0, 30);
  }

  async function performSearch() {
    if (state.ingredients.length === 0 || state.isSearching) return;

    state.isSearching = true;
    DOM.btnSearchRecipes.disabled = true;
    DOM.btnSearchText.textContent = 'Searching Kitchen Database...';
    DOM.searchSpinner.style.display = 'inline-block';

    DOM.resultsSection.style.display = 'block';
    DOM.loadingSkeletons.style.display = 'grid';
    DOM.recipeGrid.style.display = 'none';
    DOM.resultsEmpty.style.display = 'none';

    // Scroll gently toward results
    DOM.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const queryParam = encodeURIComponent(state.ingredients.join(','));
      let recipes = null;

      // 1. Attempt backend search
      try {
        const response = await fetch(`/api/search?ingredients=${queryParam}`);
        if (response.ok) {
          const data = await response.json();
          recipes = data.recipes || [];
        } else {
          console.warn(`Backend search returned HTTP ${response.status}. Using direct fallback.`);
        }
      } catch (backendErr) {
        console.warn('Backend search unreachable. Using direct fallback:', backendErr);
      }

      // 2. Client-side resilient fallback if backend returned error or is unreachable
      if (recipes === null) {
        recipes = await fallbackClientSideSearch(state.ingredients);
      }

      state.searchResults = recipes;
      renderSearchResults();
    } catch (err) {
      console.error('Search error:', err);
      showToast(`Search failed: ${err.message}`, '❌');
      DOM.recipeGrid.innerHTML = '';
      DOM.resultsEmpty.style.display = 'block';
      document.getElementById('empty-state-message').textContent =
        `Error loading recipes (${err.message}). Please try again.`;
    } finally {
      state.isSearching = false;
      DOM.loadingSkeletons.style.display = 'none';
      DOM.btnSearchRecipes.disabled = state.ingredients.length === 0;
      DOM.btnSearchText.textContent = 'Find Matching Recipes';
      DOM.searchSpinner.style.display = 'none';
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering Search Results
  // ---------------------------------------------------------------------------
  function renderSearchResults() {
    const rawList = state.searchResults || [];
    const countAll = rawList.length;
    const multiMatchCount = rawList.filter(r => (r.match_count || 1) > 1).length;

    DOM.countAll.textContent = countAll;
    DOM.countMulti.textContent = multiMatchCount;

    if (countAll === 0) {
      DOM.recipeGrid.style.display = 'none';
      DOM.resultsEmpty.style.display = 'block';
      DOM.resultsHeadline.textContent = 'No Matches Found';
      DOM.resultsSubtext.textContent = 'Try adjusting or removing some ingredients';
      return;
    }

    DOM.resultsEmpty.style.display = 'none';
    DOM.recipeGrid.style.display = 'grid';
    DOM.resultsHeadline.textContent = `Showing ${countAll} Recipes`;
    DOM.resultsSubtext.textContent = `Matched from ${state.ingredients.length} pantry ingredients`;

    // Filter
    let displayed = [...rawList];
    if (state.activeFilter === 'multi') {
      displayed = displayed.filter(r => (r.match_count || 1) > 1);
    }

    // Sort
    if (state.activeSort === 'name-asc') {
      displayed.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      displayed.sort((a, b) => (b.match_count || 1) - (a.match_count || 1) || a.name.localeCompare(b.name));
    }

    DOM.recipeGrid.innerHTML = '';
    displayed.forEach(recipe => {
      const card = createRecipeCard(recipe, { showOverlapTags: true });
      DOM.recipeGrid.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // Recipe Card Component
  // ---------------------------------------------------------------------------
  function createRecipeCard(recipe, options = {}) {
    const { showOverlapTags = false, isFavoriteView = false } = options;
    const card = document.createElement('article');
    card.className = 'recipe-card';
    card.dataset.id = recipe.id;

    const isFav = state.favorites.has(String(recipe.id));
    const matchCount = recipe.match_count || 1;
    const isMulti = matchCount > 1;

    // Badges & Tag HTML
    let matchBadgeHtml = '';
    if (!isFavoriteView) {
      matchBadgeHtml = `
        <div class="card-match-badge ${isMulti ? 'multi-match' : 'single-match'}">
          ${isMulti ? '🔥 ' + matchCount + ' Matches' : '1 Match'}
        </div>
      `;
    }

    let overlapTagsHtml = '';
    if (showOverlapTags && recipe.matched_ingredients && recipe.matched_ingredients.length > 0) {
      overlapTagsHtml = `
        <div class="card-overlap-tags">
          ${recipe.matched_ingredients.map(ing => `<span class="overlap-tag">✓ ${escapeHtml(ing)}</span>`).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-media" role="button" tabindex="0" title="View recipe for ${escapeHtml(recipe.name)}">
        <img class="card-thumb" src="${escapeHtml(recipe.thumbnail || '')}" alt="${escapeHtml(recipe.name)}" loading="lazy" />
        ${matchBadgeHtml}
        <button 
          type="button" 
          class="card-fav-btn ${isFav ? 'is-favorite' : ''}" 
          title="${isFav ? 'Remove from favorites' : 'Save to favorites'}"
          aria-label="${isFav ? 'Remove from favorites' : 'Save to favorites'}"
          data-id="${escapeHtml(recipe.id)}"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
          </svg>
        </button>
      </div>

      <div class="card-content">
        <h3 class="card-title" role="button" tabindex="0">${escapeHtml(recipe.name)}</h3>
        ${overlapTagsHtml}
        <div class="card-footer">
          <button type="button" class="btn-card-view">
            <span>View Recipe</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    `;

    // Event handlers
    const openDetail = () => openRecipeModal(recipe.id);
    card.querySelector('.card-media').addEventListener('click', (e) => {
      if (e.target.closest('.card-fav-btn')) return;
      openDetail();
    });
    card.querySelector('.card-title').addEventListener('click', openDetail);
    card.querySelector('.btn-card-view').addEventListener('click', openDetail);

    // Keyboard trigger on card media
    card.querySelector('.card-media').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDetail();
      }
    });

    // Favorite button click
    const favBtn = card.querySelector('.card-fav-btn');
    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(recipe, favBtn);
    });

    return card;
  }

  // ---------------------------------------------------------------------------
  // Favorites Management & Upstash REST Sync
  // ---------------------------------------------------------------------------
  async function loadFavorites() {
    // 1. Try loading cached favorites from localStorage first for instant paint
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_FAVS_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => state.favorites.set(String(item.id), item));
          updateFavoriteCounterUI();
        }
      }
    } catch (e) {
      console.warn('LocalStorage cache load failed:', e);
    }

    // 2. Fetch live favorites from server
    try {
      const resp = await fetch('/api/favorites');
      if (resp.ok) {
        const data = await resp.json();
        state.favorites.clear();
        (data.favorites || []).forEach(item => {
          state.favorites.set(String(item.id), item);
        });
        state.favoritesLoaded = true;
        saveFavoritesToLocalCache();
        updateFavoriteCounterUI();
        if (state.currentTab === 'favorites') {
          renderFavoritesView();
        }
      }
    } catch (err) {
      console.warn('Could not fetch server favorites, using local cache:', err);
    }
  }

  function saveFavoritesToLocalCache() {
    try {
      const list = Array.from(state.favorites.values());
      localStorage.setItem(LOCAL_STORAGE_FAVS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save favorites to localStorage:', e);
    }
  }

  async function toggleFavorite(recipe, buttonElement) {
    const id = String(recipe.id);
    const isCurrentlySaved = state.favorites.has(id);

    if (isCurrentlySaved) {
      // Remove
      state.favorites.delete(id);
      saveFavoritesToLocalCache();
      updateFavoriteCounterUI();
      updateAllCardFavButtons(id, false);
      showToast(`Removed "${recipe.name}" from favorites.`, '🗑️');

      if (state.currentTab === 'favorites') {
        renderFavoritesView();
      }

      // Sync backend
      try {
        await fetch(`/api/favorites/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Failed to sync favorite deletion with server:', err);
      }
    } else {
      // Add
      const favItem = {
        id: id,
        name: recipe.name,
        thumbnail: recipe.thumbnail,
        category: recipe.category || '',
        area: recipe.area || '',
        saved_at: new Date().toISOString()
      };

      state.favorites.set(id, favItem);
      saveFavoritesToLocalCache();
      updateFavoriteCounterUI();
      updateAllCardFavButtons(id, true);
      showToast(`Saved "${recipe.name}" to favorites! ❤️`, '⭐');

      // Sync backend
      try {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(favItem)
        });
      } catch (err) {
        console.error('Failed to sync favorite addition with server:', err);
      }
    }

    // Also update modal favorite button if open
    if (state.currentModalRecipe && String(state.currentModalRecipe.id) === id) {
      updateModalFavoriteButton(state.favorites.has(id));
    }
  }

  function updateAllCardFavButtons(recipeId, isSaved) {
    document.querySelectorAll(`.card-fav-btn[data-id="${recipeId}"]`).forEach(btn => {
      if (isSaved) {
        btn.classList.add('is-favorite');
        btn.setAttribute('title', 'Remove from favorites');
        btn.setAttribute('aria-label', 'Remove from favorites');
        btn.querySelector('svg').setAttribute('fill', 'currentColor');
      } else {
        btn.classList.remove('is-favorite');
        btn.setAttribute('title', 'Save to favorites');
        btn.setAttribute('aria-label', 'Save to favorites');
        btn.querySelector('svg').setAttribute('fill', 'none');
      }
    });
  }

  function updateFavoriteCounterUI() {
    const count = state.favorites.size;
    DOM.favCountBadge.textContent = count;
    DOM.favCountBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    DOM.favCountLabel.textContent = `${count} ${count === 1 ? 'recipe' : 'recipes'} saved`;
  }

  function renderFavoritesView() {
    const favsList = Array.from(state.favorites.values());
    favsList.sort((a, b) => (b.saved_at || '').localeCompare(a.saved_at || ''));

    if (favsList.length === 0) {
      DOM.favoritesGrid.style.display = 'none';
      DOM.favoritesEmpty.style.display = 'block';
      return;
    }

    DOM.favoritesEmpty.style.display = 'none';
    DOM.favoritesGrid.style.display = 'grid';
    DOM.favoritesGrid.innerHTML = '';

    favsList.forEach(recipe => {
      const card = createRecipeCard(recipe, { isFavoriteView: true });
      DOM.favoritesGrid.appendChild(card);
    });
  }

  // ---------------------------------------------------------------------------
  // Modal Recipe Detail View
  // ---------------------------------------------------------------------------
  function parseMealDetailClient(meal) {
    if (!meal) return null;
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ing = (meal[`strIngredient${i}`] || '').trim();
      const meas = (meal[`strMeasure${i}`] || '').trim();
      if (ing) {
        ingredients.push({ name: ing, measure: meas });
      }
    }
    const tags = meal.strTags
      ? meal.strTags.split(',').map(t => t.trim()).filter(Boolean)
      : [];

    return {
      id: String(meal.idMeal || ''),
      name: (meal.strMeal || '').trim(),
      category: meal.strCategory || 'General',
      area: meal.strArea || 'International',
      thumbnail: meal.strMealThumb || '',
      instructions: (meal.strInstructions || '').trim(),
      ingredients: ingredients,
      source_url: meal.strSource || '',
      youtube_url: meal.strYoutube || '',
      tags: tags
    };
  }

  async function openRecipeModal(recipeId) {
    DOM.recipeModal.style.display = 'flex';
    DOM.recipeModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    DOM.modalLoader.style.display = 'flex';
    DOM.modalContent.style.display = 'none';

    try {
      let recipe = null;
      try {
        const resp = await fetch(`/api/recipe/${recipeId}`);
        if (resp.ok) {
          recipe = await resp.json();
        }
      } catch (beErr) {
        console.warn('Backend recipe fetch failed, trying direct lookup:', beErr);
      }

      if (!recipe) {
        const directResp = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipeId}`);
        if (directResp.ok) {
          const data = await directResp.json();
          if (data.meals && data.meals.length > 0) {
            recipe = parseMealDetailClient(data.meals[0]);
          }
        }
      }

      if (!recipe) {
        throw new Error('Recipe not found');
      }

      state.currentModalRecipe = recipe;
      populateModal(recipe);
    } catch (err) {
      console.error('Modal load error:', err);
      showToast(`Error loading recipe: ${err.message}`, '❌');
      closeRecipeModal();
    }
  }

  async function openSurpriseRecipe() {
    DOM.recipeModal.style.display = 'flex';
    DOM.recipeModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    DOM.modalLoader.style.display = 'flex';
    DOM.modalContent.style.display = 'none';

    try {
      showToast('Finding a chef surprise for you...', '🎲', 2000);
      let recipe = null;

      try {
        const resp = await fetch('/api/random');
        if (resp.ok) {
          recipe = await resp.json();
        }
      } catch (beErr) {
        console.warn('Backend random fetch failed, trying direct:', beErr);
      }

      if (!recipe) {
        const directResp = await fetch('https://www.themealdb.com/api/json/v1/1/random.php');
        if (directResp.ok) {
          const data = await directResp.json();
          if (data.meals && data.meals.length > 0) {
            recipe = parseMealDetailClient(data.meals[0]);
          }
        }
      }

      if (!recipe) {
        throw new Error('Failed to fetch surprise recipe');
      }

      state.currentModalRecipe = recipe;
      populateModal(recipe);
    } catch (err) {
      console.error('Surprise recipe error:', err);
      showToast('Could not fetch surprise recipe. Please try again.', '❌');
      closeRecipeModal();
    }
  }

  function populateModal(recipe) {
    DOM.modalRecipeTitle.textContent = recipe.name;
    DOM.modalRecipeImg.src = recipe.thumbnail || '';
    DOM.modalRecipeImg.alt = recipe.name;
    DOM.modalCategory.textContent = recipe.category || 'General';
    DOM.modalArea.textContent = recipe.area || 'International';

    // Source & Youtube links
    if (recipe.source_url) {
      DOM.modalBtnSource.href = recipe.source_url;
      DOM.modalBtnSource.style.display = 'inline-flex';
    } else {
      DOM.modalBtnSource.style.display = 'none';
    }

    if (recipe.youtube_url) {
      DOM.modalBtnYoutube.href = recipe.youtube_url;
      DOM.modalBtnYoutube.style.display = 'inline-flex';
    } else {
      DOM.modalBtnYoutube.style.display = 'none';
    }

    // Tags
    DOM.modalTagsContainer.innerHTML = '';
    if (recipe.tags && recipe.tags.length > 0) {
      recipe.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'modal-tag-pill';
        span.textContent = `#${tag}`;
        DOM.modalTagsContainer.appendChild(span);
      });
    }

    // Favorite state in modal
    const isFav = state.favorites.has(String(recipe.id));
    updateModalFavoriteButton(isFav);

    // Ingredients List with Interactive Checkboxes
    const ingredients = recipe.ingredients || [];
    DOM.modalIngredientsCount.textContent = `${ingredients.length} items`;
    DOM.modalIngredientsList.innerHTML = '';

    ingredients.forEach(item => {
      const li = document.createElement('li');
      li.className = 'ingredient-item';
      li.innerHTML = `
        <input type="checkbox" aria-label="Mark ${escapeHtml(item.name)} as prepared">
        <span><strong class="measure-text">${escapeHtml(item.measure || '')}</strong> ${escapeHtml(item.name)}</span>
      `;
      // Toggle checked state on click
      li.addEventListener('click', (e) => {
        const checkbox = li.querySelector('input[type="checkbox"]');
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
        }
        if (checkbox.checked) {
          li.classList.add('checked');
        } else {
          li.classList.remove('checked');
        }
      });
      DOM.modalIngredientsList.appendChild(li);
    });

    // Cooking Instructions parsed cleanly
    DOM.modalInstructionsBody.innerHTML = '';
    const rawInstructions = recipe.instructions || 'No instructions provided.';
    
    // Split into paragraphs or numbered steps
    const steps = rawInstructions
      .split(/\r?\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (steps.length > 0) {
      steps.forEach((step, idx) => {
        // Strip existing leading "1. " or "STEP 1" if already numbered
        const cleanStep = step.replace(/^(STEP\s*\d+:?|\d+[\.\)])\s*/i, '');
        const stepDiv = document.createElement('div');
        stepDiv.className = 'instruction-step';
        stepDiv.innerHTML = `
          <div class="step-num">${idx + 1}</div>
          <div class="step-text">${escapeHtml(cleanStep)}</div>
        `;
        DOM.modalInstructionsBody.appendChild(stepDiv);
      });
    } else {
      DOM.modalInstructionsBody.textContent = rawInstructions;
    }

    DOM.modalLoader.style.display = 'none';
    DOM.modalContent.style.display = 'block';
  }

  function updateModalFavoriteButton(isSaved) {
    if (isSaved) {
      DOM.modalBtnFavorite.classList.add('is-saved');
      DOM.modalFavoriteText.textContent = 'Saved in Favorites';
      DOM.modalBtnFavorite.querySelector('svg').setAttribute('fill', '#ffffff');
    } else {
      DOM.modalBtnFavorite.classList.remove('is-saved');
      DOM.modalFavoriteText.textContent = 'Save to Favorites';
      DOM.modalBtnFavorite.querySelector('svg').setAttribute('fill', 'none');
    }
  }

  function closeRecipeModal() {
    DOM.recipeModal.style.display = 'none';
    DOM.recipeModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    state.currentModalRecipe = null;
  }

  // ---------------------------------------------------------------------------
  // Utility: HTML Sanitizer
  // ---------------------------------------------------------------------------
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ---------------------------------------------------------------------------
  // Event Listeners Setup
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    // Brand Logo click -> Reset to search tab
    DOM.brandLogo.addEventListener('click', () => switchTab('search'));

    // Tab Navigation
    DOM.tabSearch.addEventListener('click', () => switchTab('search'));
    DOM.tabFavorites.addEventListener('click', () => switchTab('favorites'));
    DOM.btnExploreRecipes.addEventListener('click', () => switchTab('search'));

    // Surprise Me Button
    DOM.btnSurpriseMe.addEventListener('click', openSurpriseRecipe);

    // Ingredient Form Submit (Add via Enter or Button)
    DOM.ingredientForm.addEventListener('submit', (e) => {
      e.preventDefault();
      addIngredient(DOM.ingredientInput.value);
    });

    DOM.btnAddIngredient.addEventListener('click', () => {
      addIngredient(DOM.ingredientInput.value);
    });

    // Tag Container Click for Remove Buttons
    DOM.tagContainer.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.chip-remove-btn');
      if (removeBtn) {
        const index = parseInt(removeBtn.dataset.index, 10);
        removeIngredient(index);
      }
    });

    // Clear All Tags
    DOM.btnClearTags.addEventListener('click', clearAllIngredients);

    // Quick Staples Clicks (Toggle add/remove with instant search)
    DOM.staplesList.addEventListener('click', (e) => {
      const stapleBtn = e.target.closest('.staple-pill');
      if (stapleBtn) {
        const stapleName = stapleBtn.dataset.name;
        const index = state.ingredients.findIndex(
          item => item.toLowerCase() === stapleName.toLowerCase()
        );
        if (index >= 0) {
          removeIngredient(index);
        } else {
          addIngredient(stapleName, true);
        }
      }
    });

    // Search Execution
    DOM.btnSearchRecipes.addEventListener('click', performSearch);

    // Empty state "Try Chicken + Garlic + Rice"
    DOM.btnTryPopular.addEventListener('click', () => {
      state.ingredients = ['Chicken', 'Garlic', 'Rice'];
      updateTagUI();
      performSearch();
    });

    // Filter Pills
    DOM.filterPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.pill-btn');
      if (pill) {
        DOM.filterPills.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeFilter = pill.dataset.filter;
        renderSearchResults();
      }
    });

    // Sort Dropdown
    DOM.sortSelect.addEventListener('change', (e) => {
      state.activeSort = e.target.value;
      renderSearchResults();
    });

    // Modal Events
    DOM.modalClose.addEventListener('click', closeRecipeModal);
    DOM.recipeModal.addEventListener('click', (e) => {
      if (e.target === DOM.recipeModal) {
        closeRecipeModal();
      }
    });

    // Modal Favorite Toggle
    DOM.modalBtnFavorite.addEventListener('click', () => {
      if (state.currentModalRecipe) {
        toggleFavorite(state.currentModalRecipe, DOM.modalBtnFavorite);
      }
    });

    // Global Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && DOM.recipeModal.style.display === 'flex') {
        closeRecipeModal();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // App Initialization
  // ---------------------------------------------------------------------------
  function init() {
    setupEventListeners();
    updateTagUI();
    loadFavorites();
    console.log('🍳 PantryCraft initialized successfully.');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
