// English header: The order list and the Amazon-style tracking page. Status stages match
// OrderStatus on the backend exactly: Placed -> InWarehouse -> Shipped -> Delivered (Cancelled
// is shown separately, it doesn't fit the linear progress bar). While an order is still on its
// way, the open order re-checks its status every few seconds so the tracker moves on its own.

import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { requireLogin } from '../components/authGuard.js';
import { escapeHtml } from '../utils/escapeHtml.js';

const STAGE_ORDER = ['Placed', 'InWarehouse', 'Shipped', 'Delivered'];
const STAGE_LABELS = {
    Placed: 'Order Placed',
    InWarehouse: 'In Warehouse',
    Shipped: 'Shipped',
    Delivered: 'Delivered',
    Cancelled: 'Cancelled'
};
const POLL_INTERVAL_MS = 8000;

let pollTimer = null;
let openOrderId = null;

const statusLabel = (status) => STAGE_LABELS[status] ?? status;
const formatDate = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const isOrdersViewActive = () => document.getElementById('view-orders')?.classList.contains('active');

// Progress bar for the four stages, or a banner for a cancelled order.
function renderProgressTracker(status) {
    if (status === 'Cancelled') {
        return `<p class="order-cancelled-banner">This order was cancelled.</p>`;
    }

    const currentIndex = STAGE_ORDER.indexOf(status);
    return `
        <div class="order-progress-tracker">
            ${STAGE_ORDER.map((stage, i) => `
                <div class="progress-stage${i <= currentIndex ? ' completed' : ''}">
                    <span class="progress-dot"></span>
                    <span class="progress-label">${STAGE_LABELS[stage]}</span>
                </div>`).join('<span class="progress-connector"></span>')}
        </div>`;
}

// Re-fetches the open order while it is still in transit, and repaints only on a change.
function schedulePoll(order) {
    clearTimeout(pollTimer);
    if (order.status === 'Delivered' || order.status === 'Cancelled') return;

    pollTimer = setTimeout(async () => {
        if (!isOrdersViewActive() || openOrderId !== order.id) return;
        try {
            const fresh = await api.getOrder(order.id);
            if (!isOrdersViewActive() || openOrderId !== order.id) return;
            if (fresh.status !== order.status) {
                renderOrderDetail(fresh);
                renderOrderList();
            } else {
                schedulePoll(order);
            }
        } catch {
            // transient failure - try again on the next tick
            schedulePoll(order);
        }
    }, POLL_INTERVAL_MS);
}

function renderOrderDetail(order) {
    const detail = document.getElementById('order-detail-panel');
    if (!detail) return;
    openOrderId = order.id;

    detail.innerHTML = `
        <h3>Order #${order.id}</h3>
        <p class="order-meta-line">Placed on ${formatDate(order.createdAt)}</p>
        ${renderProgressTracker(order.status)}
        <div class="order-items-list">
            ${order.items.map(i => `
                <div class="order-item-row">
                    <span>${escapeHtml(i.productName)} &middot; ${escapeHtml(i.color)} &middot; ${escapeHtml(i.size)} &times; ${i.quantity}</span>
                    <span>${i.unitPrice * i.quantity} EGP</span>
                </div>`).join('')}
        </div>
        <p class="order-total-line">Total: ${order.total} EGP</p>
        <p class="order-meta-line">Shipping to: ${escapeHtml(order.shippingAddress)}</p>
        <button type="button" class="file-complaint-btn" data-action="navigate" data-target="complaints" data-param="${order.id}">
            Report a problem with this order
        </button>`;
    detail.classList.remove('hidden');
    schedulePoll(order);
}

async function renderOrderList() {
    const list = document.getElementById('orders-list');
    if (!list) return;

    const orders = await api.getOrders();
    if (orders.length === 0) {
        list.innerHTML = `<p class="empty-grid-message">No orders yet. Your orders will appear here after checkout.</p>`;
        return;
    }

    list.innerHTML = orders.map(o => `
        <button type="button" class="order-summary-row${o.id === openOrderId ? ' selected' : ''}" data-action="view-order" data-target="${o.id}">
            <span>Order #${o.id}<small class="order-row-date">${formatDate(o.createdAt)}</small></span>
            <span class="order-row-status status-${escapeHtml(o.status)}">${statusLabel(o.status)}</span>
            <span>${o.total} EGP</span>
        </button>`).join('');
}

// Loads one order into the detail panel, with a friendly message if it can't be opened.
async function showOrder(orderId) {
    try {
        renderOrderDetail(await api.getOrder(orderId));
        await renderOrderList();
    } catch (err) {
        showToast(err.message || 'Could not open that order.');
    }
}

// Route handler for #/orders and #/orders/<id>.
export async function openOrdersPage(orderId) {
    clearTimeout(pollTimer);
    openOrderId = null;
    document.getElementById('order-detail-panel')?.classList.add('hidden');

    if (!requireLogin(orderId ? `orders/${orderId}` : 'orders', 'Log in to see your orders.')) return;

    try {
        if (orderId) {
            await showOrder(orderId);
        } else {
            await renderOrderList();
        }
    } catch (err) {
        showToast(err.message || 'Could not load your orders.');
    }
}

export function initOrdersView() {
    document.addEventListener('app:action', (e) => {
        if (e.detail.action === 'view-order') showOrder(e.detail.target);
    });
}
