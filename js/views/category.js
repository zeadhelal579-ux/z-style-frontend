// English header: The category / search results page. Every filter (category, gender, colours,
// price range, search text) is sent to api.getProducts() - see GetProductsQuery on the backend
// for the exact filter set. Besides the product grid this view owns three small pieces of UI:
// the row of category pills (so shoppers can jump between categories without going home),
// the "Recently Viewed" strip, and the filter sidebar - which is reset every time a new
// category or search is opened, so the checkboxes never disagree with the results.

import { api } from '../api.js';
import { appState, recordRecentlyViewed } from '../state.js';
import { renderProductGrid } from '../components/productCard.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escapeHtml.js';

// pageSize 100 is the backend maximum - a category has ~10 items, and a search should show
// every match instead of silently stopping at the default page of 20.
const PAGE_SIZE = 100;

let currentFilters = {};

const isWishlisted = (product) => appState.wishlist.some(p => p.id === product.id);

// Draws the product grid for the current filters.
async function loadAndRenderProducts() {
    const grid = document.getElementById('category-products-grid');
    if (!grid) return;

    grid.innerHTML = `<p class="loading-message">Loading...</p>`;
    try {
        const result = await api.getProducts(currentFilters);
        grid.innerHTML = result.items.length
            ? renderProductGrid(result.items, { isWishlisted })
            : `<p class="empty-grid-message">No products match your filters.</p>`;
    } catch {
        grid.innerHTML = `<p class="error-message">Could not load products right now.</p>`;
    }
}

// Row of pills, one per category, with the open category highlighted.
function renderCategoryPills() {
    const container = document.getElementById('category-pills');
    if (!container) return;

    container.innerHTML = appState.categories.map(cat => `
        <button type="button" class="category-pill${cat.slug === currentFilters.categorySlug ? ' active' : ''}"
            data-action="navigate" data-target="category" data-param="${escapeHtml(cat.slug)}">${escapeHtml(cat.name)}</button>`).join('');
}

// Draws the "Recently Viewed" cards into the strip's grid (the strip keeps its own heading).
function renderRecentlyViewedStrip() {
    const strip = document.getElementById('recently-viewed-strip');
    const grid = strip?.querySelector('.products-dynamic-grid');
    if (!strip || !grid) return;

    if (appState.recentlyViewed.length === 0) {
        strip.classList.add('hidden');
        return;
    }
    strip.classList.remove('hidden');
    grid.innerHTML = renderProductGrid(appState.recentlyViewed, { isWishlisted });
}

// Phones keep the filter panel collapsed behind the "Filters" button.
function setFiltersOpen(open) {
    document.getElementById('category-filters')?.classList.toggle('filters-open', open);
    document.querySelector('[data-action="toggle-filters"]')?.setAttribute('aria-expanded', String(open));
}

// Puts the sidebar controls back to "no filters".
function resetFilterControls() {
    document.querySelectorAll('[data-filter="color"], [data-filter="gender"]').forEach(el => { el.checked = false; });
    const priceMin = document.getElementById('filter-price-min');
    const priceMax = document.getElementById('filter-price-max');
    if (priceMin) priceMin.value = '';
    if (priceMax) priceMax.value = '';
}

// Reads the sidebar controls into currentFilters and reloads the grid.
function applyFilterControls() {
    const colorInputs = document.querySelectorAll('[data-filter="color"]');
    const genderInputs = document.querySelectorAll('[data-filter="gender"]');
    const priceMin = document.getElementById('filter-price-min');
    const priceMax = document.getElementById('filter-price-max');

    currentFilters.colors = [...colorInputs].filter(c => c.checked).map(c => c.value);
    currentFilters.minPrice = priceMin?.value || undefined;
    currentFilters.maxPrice = priceMax?.value || undefined;
    const checkedGender = [...genderInputs].find(g => g.checked);
    currentFilters.gender = checkedGender ? checkedGender.value : undefined;
    loadAndRenderProducts();
}

function bindFilterControls() {
    const applyFilters = debounce(applyFilterControls, 250);

    document.querySelectorAll('[data-filter="color"], [data-filter="gender"]')
        .forEach(el => el.addEventListener('change', applyFilters));
    document.getElementById('filter-price-min')?.addEventListener('input', applyFilters);
    document.getElementById('filter-price-max')?.addEventListener('input', applyFilters);

    document.addEventListener('app:action', (e) => {
        if (e.detail.action === 'clear-filters') {
            resetFilterControls();
            applyFilterControls();
        }
        if (e.detail.action === 'toggle-filters') {
            const sidebar = document.getElementById('category-filters');
            setFiltersOpen(!sidebar?.classList.contains('filters-open'));
        }
    });
}

// Route handler for #/category/<slug> and #/category/search:<text>.
export function openCategoryPage(slugOrSearch) {
    const titleEl = document.getElementById('category-page-title');

    if (slugOrSearch && slugOrSearch.startsWith('search:')) {
        const text = decodeURIComponent(slugOrSearch.slice('search:'.length));
        currentFilters = { search: text, pageSize: PAGE_SIZE };
        if (titleEl) titleEl.textContent = `Search results for "${text}"`;
    } else {
        currentFilters = { categorySlug: slugOrSearch, pageSize: PAGE_SIZE };
        const category = appState.categories.find(c => c.slug === slugOrSearch);
        if (titleEl) titleEl.textContent = category ? category.name : 'All Products';
    }

    resetFilterControls();
    setFiltersOpen(false);
    renderCategoryPills();
    renderRecentlyViewedStrip();
    loadAndRenderProducts();
}

export function initCategoryView() {
    bindFilterControls();
}

// Called by productDetail.js when a product page opens, so it shows up in the strip next
// time a category view renders.
export function trackRecentlyViewedFromProduct(productDetail) {
    recordRecentlyViewed({
        id: productDetail.id,
        name: productDetail.name,
        basePrice: productDetail.basePrice,
        isPromo: productDetail.isPromo,
        promoPrice: productDetail.promoPrice,
        categoryName: productDetail.categoryName,
        categorySlug: productDetail.categorySlug,
        primaryImageUrl: productDetail.variants?.[0]?.imageUrls?.[0] || '',
        colors: productDetail.variants.map(v => ({ variantId: v.id, color: v.color, colorHex: v.colorHex }))
    });
}
