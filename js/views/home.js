// English header: The home page's category circles. They render from appState.categories
// (loaded once in main.js through api.getCategories()), so adding a category in the catalog /
// backend adds a circle here with no code change.

import { appState } from '../state.js';
import { resolveAssetUrl } from '../config.js';
import { escapeHtml } from '../utils/escapeHtml.js';

// Draws the round category buttons (or a short message if categories could not be loaded).
export function renderCategoryCircles() {
    const container = document.getElementById('home-category-circles');
    if (!container) return;

    if (appState.categories.length === 0) {
        container.innerHTML = `<p class="error-message">Categories could not be loaded right now.</p>`;
        return;
    }

    container.innerHTML = appState.categories
        .map(cat => `
            <button class="category-circle-item" type="button"
                data-action="navigate" data-target="category" data-param="${escapeHtml(cat.slug)}">
                <span class="category-circle-img" style="background-image:url('${resolveAssetUrl(cat.iconUrl)}')"></span>
                <span class="category-circle-label">${escapeHtml(cat.name)}</span>
            </button>`)
        .join('');
}

export function initHomeView() {
    renderCategoryCircles();
}
