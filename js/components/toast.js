// English header: A single bottom toast. It supports an optional action button, which is how
// the cart's 3-second "Undo" (views/cart.js) and the "Log in" / "View bag" shortcuts work.
// Message and button text are escaped because they can contain product names or server errors.

import { escapeHtml } from '../utils/escapeHtml.js';

let activeTimer = null;

// Shows `message`; `onAction` runs (once) if the shopper clicks the action button.
export function showToast(message, { actionLabel, onAction, durationMs = 3000 } = {}) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    clearTimeout(activeTimer);
    container.innerHTML = `
        <div class="undo-toast-bar" role="status">
            <span>${escapeHtml(message)}</span>
            ${actionLabel ? `<button class="toast-action-btn" type="button">${escapeHtml(actionLabel)}</button>` : ''}
        </div>`;
    container.classList.add('visible');

    if (actionLabel && onAction) {
        container.querySelector('.toast-action-btn').addEventListener('click', () => {
            onAction();
            hideToast();
        }, { once: true });
    }

    activeTimer = setTimeout(hideToast, durationMs);
}

export function hideToast() {
    const container = document.getElementById('toast-container');
    if (!container) return;
    container.classList.remove('visible');
    clearTimeout(activeTimer);
}
