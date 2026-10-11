// English header: "Place Order" calls POST /api/orders, which snapshots the current cart into
// an Order and empties the cart (see CreateOrderHandler.cs) - so after it succeeds the cart
// state is refreshed too, not just the page. The page itself needs an account and a
// non-empty bag; it also shows a read-only summary so the shopper sees what they are paying for.

import { api } from '../api.js';
import { appState, refreshCart } from '../state.js';
import { resolveAssetUrl } from '../config.js';
import { renderCartBadge } from '../components/navbarState.js';
import { showToast } from '../components/toast.js';
import { navigateTo, redirectTo } from '../router.js';
import { requireLogin } from '../components/authGuard.js';
import { escapeHtml } from '../utils/escapeHtml.js';

let placingOrder = false;

function showCheckoutError(message) {
    const errorBox = document.querySelector('#checkout-form .checkout-error-message')
        || document.querySelector('.checkout-error-message');
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

function hideCheckoutError() {
    document.querySelectorAll('.checkout-error-message').forEach(el => el.classList.add('hidden'));
}

// Items and total of the bag, shown next to the form.
function renderOrderSummary() {
    const list = document.getElementById('checkout-summary-items');
    const totalEl = document.getElementById('checkout-summary-total');
    if (!list || !totalEl) return;

    const items = appState.cart.items || [];
    list.innerHTML = items.map(item => `
        <div class="checkout-summary-row">
            <img src="${resolveAssetUrl(item.imageUrl)}" alt="" loading="lazy">
            <div class="checkout-summary-info">
                <span class="checkout-summary-name">${escapeHtml(item.productName)}</span>
                <span class="checkout-summary-meta">${escapeHtml(item.color)} &middot; ${escapeHtml(item.size)} &times; ${item.quantity}</span>
            </div>
            <span class="checkout-summary-price">${item.unitPrice * item.quantity} EGP</span>
        </div>`).join('');
    totalEl.textContent = `${items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)} EGP`;
}

// Route handler for #/checkout.
export async function openCheckoutPage() {
    if (!requireLogin('cart', 'Please log in to continue to payment.')) return;

    try {
        await refreshCart();
    } catch (err) {
        showToast(err.message || 'Could not load your bag.');
    }

    if ((appState.cart.items || []).length === 0) {
        showToast('Your bag is empty.');
        redirectTo('cart');
        return;
    }

    hideCheckoutError();
    renderOrderSummary();
}

async function handlePlaceOrder(form) {
    if (placingOrder) return;

    const address = form.querySelector('[name="shippingAddress"]').value.trim();
    const paymentInput = form.querySelector('[name="paymentMethod"]:checked');
    const submitBtn = form.querySelector('[type="submit"]');

    if (!address || !paymentInput) {
        showCheckoutError('Please add a shipping address and choose a payment method.');
        return;
    }

    hideCheckoutError();
    placingOrder = true;
    if (submitBtn) submitBtn.disabled = true; // a double click must never create two orders
    try {
        const orderId = await api.createOrder(address, paymentInput.value);
        form.reset();
        await refreshCart();
        renderCartBadge();
        showToast('Order placed successfully.');
        navigateTo('orders', orderId);
    } catch (err) {
        showCheckoutError(err.message || 'Could not place the order.');
    } finally {
        placingOrder = false;
        if (submitBtn) submitBtn.disabled = false;
    }
}

export function initCheckoutView() {
    const form = document.getElementById('checkout-form');
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        handlePlaceOrder(form);
    });
}
