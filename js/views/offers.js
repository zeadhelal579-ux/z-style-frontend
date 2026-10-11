// English header: GetOffersQuery on the backend returns every IsPromo product using the same
// ProductSummaryDto shape as everything else, so this page reuses productCard.js directly -
// it only adds the fetch-and-render wiring.

import { api } from '../api.js';
import { appState } from '../state.js';
import { renderProductGrid } from '../components/productCard.js';

const isWishlisted = (product) => appState.wishlist.some(p => p.id === product.id);

// Route handler for #/offers.
export async function openOffersPage() {
    const grid = document.getElementById('offers-products-grid');
    if (!grid) return;

    grid.innerHTML = `<p class="loading-message">Loading...</p>`;
    try {
        const offers = await api.getOffers();
        grid.innerHTML = offers.length
            ? renderProductGrid(offers, { isWishlisted })
            : `<p class="empty-grid-message">No active offers right now.</p>`;
    } catch {
        grid.innerHTML = `<p class="error-message">Could not load offers right now.</p>`;
    }
}
