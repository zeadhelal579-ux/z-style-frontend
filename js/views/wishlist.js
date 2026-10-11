// English header: The wishlist list itself is account-backed (GET /api/wishlist); compare and
// "outfit coordination" are pure client-side features that operate on whatever the wishlist
// already loaded. This file is also the ONE place that handles every heart button in the app
// (category grid, offers, similar products, the wishlist page and the product page): it
// toggles the product, keeps every visible heart and the navbar badge in sync, and announces
// the change with a `wishlist:changed` event so other views (the product page) can react.
// Guests cannot save items, so they get a toast that leads them to the login page.

import { appState, isLoggedIn, refreshWishlist, toggleWishlist } from '../state.js';
import { renderProductGrid } from '../components/productCard.js';
import { renderWishlistBadge } from '../components/navbarState.js';
import { showToast } from '../components/toast.js';
import { navigateTo } from '../router.js';
import { requireLogin } from '../components/authGuard.js';
import { resolveAssetUrl } from '../config.js';
import { escapeHtml } from '../utils/escapeHtml.js';

let compareSelection = [];

// True while the wishlist page is the visible view.
const isWishlistViewActive = () => document.getElementById('view-wishlist')?.classList.contains('active');

// Draws the saved products (from state - the caller refreshes first when it needs fresh data).
function renderWishlistGrid() {
    const grid = document.getElementById('wishlist-products-grid');
    const emptyMessage = document.getElementById('wishlist-empty-message');
    if (!grid) return;

    if (appState.wishlist.length === 0) {
        grid.innerHTML = '';
        emptyMessage?.classList.remove('hidden');
        return;
    }
    emptyMessage?.classList.add('hidden');
    grid.innerHTML = renderProductGrid(appState.wishlist, { isWishlisted: true, showCompareToggle: true });
    syncCompareCheckboxes();
}

// Keeps the "Compare" checkboxes in step with the current two-item selection.
function syncCompareCheckboxes() {
    document.querySelectorAll('[data-action="toggle-compare"]').forEach(box => {
        box.checked = compareSelection.some(p => p.id === Number(box.dataset.target));
    });
}

// Closes the comparison pop-up and clears the two selected products.
function closeCompare() {
    compareSelection = [];
    syncCompareCheckboxes();
    document.getElementById('wishlist-compare-panel')?.classList.remove('active');
}

// Pop-up (the stylesheet's .utility-popup-modal, shown with `.active`) holding a side-by-side
// table for the two selected products.
function renderCompareTable() {
    const panel = document.getElementById('wishlist-compare-panel');
    if (!panel) return;

    if (compareSelection.length < 2) {
        panel.classList.remove('active');
        return;
    }

    const [a, b] = compareSelection;
    const priceOf = (p) => (p.isPromo && p.promoPrice ? `${p.promoPrice} EGP (was ${p.basePrice})` : `${p.basePrice} EGP`);
    const colorsOf = (p) => escapeHtml(p.colors.map(c => c.color).join(', '));
    const head = (p) => `<th><img src="${resolveAssetUrl(p.primaryImageUrl)}" alt="">${escapeHtml(p.name)}</th>`;

    panel.innerHTML = `
        <div class="modal-inner-card" role="dialog" aria-label="Compare products">
            <button type="button" class="modal-close-cross" data-action="close-compare" aria-label="Close">&#10005;</button>
            <h3>Compare</h3>
            <table class="compare-table">
                <tr><th></th>${head(a)}${head(b)}</tr>
                <tr><td>Price</td><td>${priceOf(a)}</td><td>${priceOf(b)}</td></tr>
                <tr><td>Category</td><td>${escapeHtml(a.categoryName)}</td><td>${escapeHtml(b.categoryName)}</td></tr>
                <tr><td>For</td><td>${escapeHtml(a.gender)}</td><td>${escapeHtml(b.gender)}</td></tr>
                <tr><td>Colours</td><td>${colorsOf(a)}</td><td>${colorsOf(b)}</td></tr>
            </table>
        </div>`;
    panel.classList.add('active');
}

// Picks one top-ish and one bottom-ish saved item and shows them as an outfit idea.
function renderMixMatchSuggestion() {
    const box = document.getElementById('outfit-coordination-box');
    if (!box) return;

    const tops = appState.wishlist.filter(p => ['t-shirts', 'shirts', 'hoodies'].includes(p.categorySlug));
    const bottoms = appState.wishlist.filter(p => ['pants'].includes(p.categorySlug));

    if (tops.length === 0 || bottoms.length === 0) {
        box.innerHTML = `<p class="empty-grid-message">Save a top and a bottom to see an outfit suggestion.</p>`;
        return;
    }

    const top = tops[0];
    const bottom = bottoms[0];
    box.innerHTML = `
        <div class="mix-match-pair">
            <img src="${resolveAssetUrl(top.primaryImageUrl)}" alt="${escapeHtml(top.name)}" loading="lazy">
            <span class="mix-match-plus">+</span>
            <img src="${resolveAssetUrl(bottom.primaryImageUrl)}" alt="${escapeHtml(bottom.name)}" loading="lazy">
        </div>
        <p>${escapeHtml(top.name)} &amp; ${escapeHtml(bottom.name)}</p>`;
}

// Updates every heart button for this product currently in the DOM.
function syncHeartButtons(productId, saved) {
    document.querySelectorAll(`.wishlist-heart-btn[data-target="${productId}"]`).forEach(btn => {
        btn.classList.toggle('active', saved);
        btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
        btn.setAttribute('aria-label', saved ? 'Remove from wishlist' : 'Save to wishlist');
        btn.innerHTML = saved ? '&#9829;' : '&#9825;';
    });
}

// Handles one heart click anywhere in the app.
async function handleToggleWishlist(rawProductId) {
    const productId = Number(rawProductId);
    if (!Number.isInteger(productId)) return;

    if (!isLoggedIn()) {
        showToast('Log in to save items to your wishlist.', {
            actionLabel: 'Log in',
            onAction: () => navigateTo('auth'),
            durationMs: 4000
        });
        return;
    }

    try {
        const saved = await toggleWishlist(productId);
        syncHeartButtons(productId, saved);
        renderWishlistBadge();
        document.dispatchEvent(new CustomEvent('wishlist:changed', { detail: { productId, saved } }));

        if (!saved) {
            compareSelection = compareSelection.filter(p => p.id !== productId);
        }
        if (isWishlistViewActive()) {
            renderWishlistGrid();
            renderCompareTable();
            renderMixMatchSuggestion();
        }
    } catch (err) {
        showToast(err.message || 'Could not update your wishlist.');
    }
}

// Route handler for #/wishlist.
export async function openWishlistPage() {
    if (!requireLogin('wishlist', 'Log in to see your wishlist.')) return;

    try {
        await refreshWishlist();
    } catch (err) {
        showToast(err.message || 'Could not load your wishlist.');
    }
    renderWishlistBadge();
    renderWishlistGrid();
    renderCompareTable();
    renderMixMatchSuggestion();
}

export function initWishlistView() {
    // Clicking the dark backdrop (not the card) or pressing Escape closes the comparison.
    const comparePanel = document.getElementById('wishlist-compare-panel');
    comparePanel?.addEventListener('click', (e) => {
        if (e.target === comparePanel) closeCompare();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && comparePanel?.classList.contains('active')) closeCompare();
    });

    document.addEventListener('app:action', (e) => {
        const { action, target } = e.detail;

        if (action === 'close-compare') {
            closeCompare();
        }

        if (action === 'toggle-wishlist') {
            handleToggleWishlist(target);
        }

        if (action === 'toggle-compare') {
            const product = appState.wishlist.find(p => p.id === Number(target));
            if (!product) return;
            const alreadyIn = compareSelection.some(p => p.id === product.id);
            if (alreadyIn) {
                compareSelection = compareSelection.filter(p => p.id !== product.id);
            } else if (compareSelection.length < 2) {
                compareSelection.push(product);
            } else {
                compareSelection = [compareSelection[1], product];
            }
            syncCompareCheckboxes();
            renderCompareTable();
        }
    });
}
