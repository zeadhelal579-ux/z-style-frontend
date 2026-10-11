// English header: One card renderer for every product grid in the app. Consumes exactly the
// shape ProductSummaryDto sends from the backend (id, name, basePrice, isPromo, promoPrice,
// primaryImageUrl, colors[]), so there is a single place to update if that shape changes.
// `isWishlisted` can be a boolean (same for every card) or a function (product => boolean).

import { resolveAssetUrl } from '../config.js';
import { escapeHtml } from '../utils/escapeHtml.js';

// Renders one product card as an HTML string.
export function renderProductCard(product, { isWishlisted = false, showCompareToggle = false } = {}) {
    const hasPromo = product.isPromo && product.promoPrice;
    const price = hasPromo ? product.promoPrice : product.basePrice;
    const saved = typeof isWishlisted === 'function' ? isWishlisted(product) : isWishlisted;
    const name = escapeHtml(product.name);

    const colorDots = (product.colors || [])
        .map(c => `<span class="color-dot" style="background:${escapeHtml(c.colorHex)}" title="${escapeHtml(c.color)}"></span>`)
        .join('');

    return `
        <article class="product-display-card" data-product-id="${product.id}">
            <button
                type="button"
                class="wishlist-heart-btn${saved ? ' active' : ''}"
                data-action="toggle-wishlist"
                data-target="${product.id}"
                aria-pressed="${saved ? 'true' : 'false'}"
                aria-label="${saved ? 'Remove from wishlist' : 'Save to wishlist'}">${saved ? '&#9829;' : '&#9825;'}</button>
            <a class="card-img-frame" href="#/product/${product.id}" data-action="navigate" data-target="product" data-param="${product.id}">
                <img src="${resolveAssetUrl(product.primaryImageUrl)}" alt="${name}" loading="lazy" width="600" height="750">
            </a>
            <div class="card-color-circles-palette">${colorDots}</div>
            <h3 class="card-product-name">${name}</h3>
            <p class="card-price-row">
                ${hasPromo ? `<span class="price-struck">${product.basePrice} EGP</span>` : ''}
                <span class="price-current">${price} EGP</span>
            </p>
            ${showCompareToggle ? `
            <label class="compare-checkbox-row">
                <input type="checkbox" data-action="toggle-compare" data-target="${product.id}">
                Compare
            </label>` : ''}
        </article>`;
}

// Renders a whole grid, or a friendly empty message.
export function renderProductGrid(products, options = {}) {
    if (!products || products.length === 0) {
        return `<p class="empty-grid-message">No products to show yet.</p>`;
    }
    return products.map(p => renderProductCard(p, options)).join('');
}
