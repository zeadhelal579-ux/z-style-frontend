// English header: Keeps the navbar in sync with the real session. It fixes the original
// problem where the Log In / Sign Up buttons stayed visible after a successful login: it is
// called once on app start and again right after login/logout. It also owns the two small
// count badges (cart and wishlist) so every view updates them through one place.

import { appState, isLoggedIn } from '../state.js';

// Swaps the guest buttons for the profile button (and back) depending on the session.
export function renderNavbarAuthState() {
    const guestControls = document.getElementById('navbar-guest-controls');
    const userControls = document.getElementById('navbar-user-controls');
    const userNameLabel = document.getElementById('navbar-user-name');

    if (!guestControls || !userControls) return;

    if (isLoggedIn() && appState.currentUser) {
        guestControls.classList.add('hidden');
        userControls.classList.remove('hidden');
        if (userNameLabel) userNameLabel.textContent = appState.currentUser.firstName;
    } else {
        guestControls.classList.remove('hidden');
        userControls.classList.add('hidden');
    }
}

// Shows the total quantity in the bag; hidden when the bag is empty.
export function renderCartBadge() {
    const badge = document.getElementById('cart-count-badge');
    if (!badge) return;

    const count = (appState.cart.items || []).reduce((sum, item) => sum + item.quantity, 0);
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
}

// Shows how many products are saved; hidden when the wishlist is empty.
export function renderWishlistBadge() {
    const badge = document.getElementById('wishlist-badge');
    if (!badge) return;

    const count = appState.wishlist.length;
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
}
