// English header: The complaints page. Tied to CreateComplaintCommand / GetUserComplaintsQuery
// on the backend; OrderId is optional there, so "General (no specific order)" is a valid
// submission too. Complaint text is typed by the user, so it is escaped before it is rendered.

import { api } from '../api.js';
import { showToast } from '../components/toast.js';
import { requireLogin } from '../components/authGuard.js';
import { escapeHtml } from '../utils/escapeHtml.js';

const STATUS_LABELS = { Open: 'Open', InProgress: 'In progress', Resolved: 'Resolved' };

// Fills the "Related Order" dropdown with the user's orders.
async function populateOrderDropdown(preselectOrderId) {
    const select = document.getElementById('complaint-order-select');
    if (!select) return;

    const orders = await api.getOrders();
    select.innerHTML = `<option value="">General (no specific order)</option>` +
        orders.map(o => `<option value="${o.id}">Order #${o.id} - ${o.total} EGP</option>`).join('');

    if (preselectOrderId) select.value = String(preselectOrderId);
}

async function renderComplaintsList() {
    const list = document.getElementById('complaints-list');
    if (!list) return;

    const complaints = await api.getComplaints();
    if (complaints.length === 0) {
        list.innerHTML = `<p class="empty-grid-message">No complaints filed.</p>`;
        return;
    }

    list.innerHTML = complaints.map(c => `
        <div class="complaint-row" data-complaint-id="${c.id}">
            <div>
                <p class="complaint-order-ref">${c.orderId ? `Order #${c.orderId}` : 'General'} &middot; ${STATUS_LABELS[c.status] ?? escapeHtml(c.status)}</p>
                <p class="complaint-message-text">${escapeHtml(c.message)}</p>
            </div>
            <button type="button" data-action="delete-complaint" data-target="${c.id}">Delete</button>
        </div>`).join('');
}

function showFormError(form, message) {
    const errorBox = form.querySelector('.complaint-error-message');
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
}

async function handleSubmit(form) {
    const orderId = form.querySelector('#complaint-order-select').value || null;
    const message = form.querySelector('[name="message"]').value.trim();
    const submitBtn = form.querySelector('[type="submit"]');

    if (!message) {
        showFormError(form, 'Please describe the issue before submitting.');
        return;
    }

    if (submitBtn) submitBtn.disabled = true;
    try {
        await api.createComplaint(orderId, message);
        form.reset();
        form.querySelector('.complaint-error-message')?.classList.add('hidden');
        showToast('Complaint submitted.');
        await renderComplaintsList();
    } catch (err) {
        showFormError(form, err.message || 'Could not submit the complaint.');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

// Route handler for #/complaints and #/complaints/<orderId>.
export async function openComplaintsPage(preselectOrderId) {
    if (!requireLogin(preselectOrderId ? `complaints/${preselectOrderId}` : 'complaints', 'Log in to file or view complaints.')) return;

    try {
        await populateOrderDropdown(preselectOrderId);
        await renderComplaintsList();
    } catch (err) {
        showToast(err.message || 'Could not load your complaints.');
    }
}

export function initComplaintsView() {
    const form = document.getElementById('complaint-form');
    form?.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSubmit(form);
    });

    document.addEventListener('app:action', async (e) => {
        if (e.detail.action !== 'delete-complaint') return;
        try {
            await api.deleteComplaint(e.detail.target);
            await renderComplaintsList();
        } catch (err) {
            showToast(err.message || 'Could not delete the complaint.');
        }
    });
}
