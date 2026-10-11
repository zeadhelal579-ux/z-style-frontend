// English header: The bag page. The 3-second Undo (project-report.md section 3.1, item 5) is
// client-side only: the row disappears from view immediately, but the real removal is delayed
// until the Undo toast has expired - if the shopper clicks Undo in time the row is simply put
// back and the data layer is never asked to delete anything. Rows are addressed by a single
// id: the server row id for signed-in users, the locally generated id for guests.

import { appState, refreshCart, removeCartItem, updateCartItemQuantity } from '../state.js';
import { resolveAssetUrl } from '../config.js';
import { showToast } from '../components/toast.js';
import { renderCartBadge } from '../components/navbarState.js';
import { navigateTo } from '../router.js';
import { requireLogin } from '../components/authGuard.js';
import { escapeHtml } from '../utils/escapeHtml.js';

const rowId = (item) => item.id ?? item.productVariantId;

// Draws the rows and the total, always from the items currently on screen (so the total also
// follows the optimistic remove / undo, not just the last server response).
function renderCartItems() {
    const list = document.getElementById('cart-items-list');
    const emptyMessage = document.getElementById('cart-empty-message');
    if (!list) return;

    const items = appState.cart.items || [];

    if (items.length === 0) {
        list.querySelectorAll('.cart-item-row').forEach(row => row.remove());
        emptyMessage?.classList.remove('hidden');
    } else {
        emptyMessage?.classList.add('hidden');
        const rows = items.map(item => `
            <div class="cart-item-row" data-cart-item-id="${rowId(item)}">
                <img src="${resolveAssetUrl(item.imageUrl)}" alt="${escapeHtml(item.productName)}" loading="lazy">
                <div class="cart-item-info">
                    <h4>${escapeHtml(item.productName)}</h4>
                    <p class="cart-item-meta">${escapeHtml(item.color)} &middot; ${escapeHtml(item.size)}</p>
                    <p class="cart-item-price">${item.unitPrice} EGP</p>
                </div>
                <div class="cart-qty-stepper">
                    <button type="button" aria-label="Decrease quantity" data-action="cart-decrement" data-target="${rowId(item)}">-</button>
                    <span>${item.quantity}</span>
                    <button type="button" aria-label="Increase quantity" data-action="cart-increment" data-target="${rowId(item)}">+</button>
                </div>
                <button type="button" class="cart-remove-btn" data-action="cart-remove" data-target="${rowId(item)}">Remove</button>
            </div>`).join('');

        // The empty-state <p> lives inside the list container, so only the rows are replaced.
        list.querySelectorAll('.cart-item-row').forEach(row => row.remove());
        list.insertAdjacentHTML('beforeend', rows);
    }

    const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const totalEl = document.getElementById('cart-total-amount');
    if (totalEl) totalEl.textContent = `${total} EGP`;
}

// +/- buttons (never goes below 1 - use Remove for that).
async function changeQuantity(id, delta) {
    const item = (appState.cart.items || []).find(i => String(rowId(i)) === String(id));
    if (!item) return;
    const newQuantity = item.quantity + delta;
    if (newQuantity < 1) return;

    try {
        await updateCartItemQuantity(id, newQuantity);
    } catch (err) {
        showToast(err.message || 'Could not update the quantity.');
    }
    renderCartItems();
    renderCartBadge();
}

// Hides the row now, deletes for real after the undo window unless Undo was pressed.
function removeWithUndo(id) {
    const items = appState.cart.items || [];
    const item = items.find(i => String(rowId(i)) === String(id));
    if (!item) return;

    appState.cart.items = items.filter(i => i !== item);
    renderCartItems();
    renderCartBadge();

    let undone = false;

    showToast(`Removed "${item.productName}".`, {
        actionLabel: 'Undo',
        durationMs: 3000,
        onAction: () => {
            undone = true;
            appState.cart.items.push(item);
            renderCartItems();
            renderCartBadge();
        }
    });

    setTimeout(async () => {
        if (undone) return;
        try {
            await removeCartItem(id);
        } catch {
            // row was already gone on the server - the refresh below shows the truth anyway
        }
        renderCartItems();
        renderCartBadge();
    }, 3000);
}

// Payment needs an account (orders belong to a user) and at least one item.
function goToCheckout() {
    if ((appState.cart.items || []).length === 0) {
        showToast('Your bag is empty.');
        return;
    }
    if (!requireLogin('cart', 'Please log in to continue to payment.')) return;
    navigateTo('checkout');
}

export function initCartView() {
    document.addEventListener('app:action', (e) => {
        const { action, target } = e.detail;
        if (action === 'cart-increment') changeQuantity(target, 1);
        if (action === 'cart-decrement') changeQuantity(target, -1);
        if (action === 'cart-remove') removeWithUndo(target);
        if (action === 'go-to-checkout') goToCheckout();
    });
}

// Route handler for #/cart.
export async function openCartPage() {
    try {
        await refreshCart();
    } catch (err) {
        showToast(err.message || 'Could not load your bag.');
    }
    renderCartItems();
    renderCartBadge();
}
