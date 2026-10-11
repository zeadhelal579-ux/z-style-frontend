// English header: The profile side panel opens from the navbar's profile button (only visible
// once logged in, see navbarState.js). It shows the account details, shortcuts to the Orders
// and Complaints pages (which have no other entry point in the navbar), and Log Out.

import { api } from '../api.js';
import { appState, logout } from '../state.js';
import { renderNavbarAuthState, renderCartBadge, renderWishlistBadge } from '../components/navbarState.js';
import { navigateTo } from '../router.js';

// Fills the panel from the server's view of the account.
async function renderProfilePanel() {
    const panel = document.getElementById('profile-side-panel');
    if (!panel) return;

    const cached = appState.currentUser;
    if (cached) {
        panel.querySelector('#profile-name').textContent = `${cached.firstName} ${cached.lastName}`;
        panel.querySelector('#profile-email').textContent = cached.email;
    }

    try {
        const profile = await api.getCurrentUser();
        panel.querySelector('#profile-name').textContent = `${profile.firstName} ${profile.lastName}`;
        panel.querySelector('#profile-email').textContent = profile.email;
        panel.querySelector('#profile-phone').textContent = profile.phoneNumber || '-';
    } catch (err) {
        // A rejected session (401) means the token is no longer valid - sign out so the UI is
        // honest. Any other error (offline, server down) leaves the cached details on screen.
        if (err?.status === 401) handleLogout();
    }
}

function openPanel() {
    document.getElementById('profile-side-panel')?.classList.add('open');
    renderProfilePanel();
}

function closePanel() {
    document.getElementById('profile-side-panel')?.classList.remove('open');
}

function handleLogout() {
    logout();
    renderNavbarAuthState();
    renderCartBadge();
    renderWishlistBadge();
    closePanel();
    navigateTo('home');
}

export function initProfilePanel() {
    document.addEventListener('app:action', (e) => {
        const { action, target } = e.detail;
        if (action === 'open-profile-panel') openPanel();
        if (action === 'close-profile-panel') closePanel();
        if (action === 'logout') handleLogout();
        if (action === 'profile-navigate') {
            closePanel();
            navigateTo(target);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closePanel();
    });

    // A click anywhere outside the open panel (that isn't the button that opens it) closes it.
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('profile-side-panel');
        if (!panel?.classList.contains('open')) return;
        if (e.target.closest('#profile-side-panel') || e.target.closest('[data-action="open-profile-panel"]')) return;
        closePanel();
    });
}
