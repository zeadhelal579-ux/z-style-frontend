// English header: Central app state. Follows the storage table in
// frontend-architecture.md section 6 exactly: cart/wishlist live server-side once logged in,
// guest cart + recentlyViewed + searchHistory stay in localStorage, currentUser/token persist
// across browser restarts.

import { api, TOKEN_KEY } from './api.js';

const GUEST_CART_KEY = 'z_style_guest_cart';
const USER_KEY = 'z_style_user';
const RECENTLY_VIEWED_KEY = 'z_style_recently_viewed';
const SEARCH_HISTORY_KEY = 'z_style_search_history';

const MAX_RECENTLY_VIEWED = 5;
const MAX_SEARCH_HISTORY = 5;

export const appState = {
    currentUser: null,   // { userId, email, firstName, lastName } | null
    cart: { items: [], total: 0 },
    wishlist: [],
    categories: [],
    recentlyViewed: [],
    searchHistory: [],
    postLoginTarget: null // route to open after a successful login (e.g. "cart" when a guest hit checkout)
};

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

// Storage can be full or blocked (private mode, strict browser settings); the app must keep
// working in memory for the session instead of crashing on a failed write.
function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore - the in-memory appState is still correct for this session
    }
}

// --- Session bootstrap ---

export function isLoggedIn() {
    try {
        return Boolean(localStorage.getItem(TOKEN_KEY));
    } catch {
        return false;
    }
}

export function loadSessionFromStorage() {
    appState.currentUser = readJson(USER_KEY, null);
    appState.recentlyViewed = readJson(RECENTLY_VIEWED_KEY, []);
    appState.searchHistory = readJson(SEARCH_HISTORY_KEY, []);
}

// --- Auth transitions ---

export async function completeLogin(authResponse) {
    localStorage.setItem(TOKEN_KEY, authResponse.token);
    appState.currentUser = {
        userId: authResponse.userId,
        email: authResponse.email,
        firstName: authResponse.firstName,
        lastName: authResponse.lastName
    };
    writeJson(USER_KEY, appState.currentUser);

    // Fold whatever was in the guest cart into the now-known account, then load the
    // authoritative server cart. A failed merge must not undo a successful login, so the
    // guest lines are simply kept (and retried) until a merge succeeds.
    const guestLines = readJson(GUEST_CART_KEY, []);
    if (guestLines.length > 0) {
        try {
            await api.mergeGuestCart(guestLines);
            localStorage.removeItem(GUEST_CART_KEY);
        } catch {
            // keep the guest cart for the next login
        }
    }

    try {
        await refreshCart();
        await refreshWishlist();
    } catch {
        appState.cart = { items: [], total: 0 };
        appState.wishlist = [];
    }
}

// Called once at startup. A stored token is only trusted after the server accepts it: if it
// answers 401 (expired JWT, cleared demo data) the session is dropped cleanly instead of
// leaving the whole app stuck on a failed request. Any other failure (server unreachable)
// keeps the session and the app simply starts with an empty cart.
export async function restoreSession() {
    try {
        await refreshCart();
        if (isLoggedIn()) {
            await refreshWishlist();
            if (!appState.currentUser) {
                const profile = await api.getCurrentUser();
                appState.currentUser = { userId: profile.userId, email: profile.email, firstName: profile.firstName, lastName: profile.lastName };
                writeJson(USER_KEY, appState.currentUser);
            }
        }
    } catch (err) {
        if (err?.status === 401) {
            logout();
            await refreshCart();
        } else {
            appState.cart = { items: [], total: 0 };
            appState.wishlist = [];
            throw err;
        }
    }
}

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    appState.currentUser = null;
    appState.cart = { items: [], total: 0 };
    appState.wishlist = [];
    appState.postLoginTarget = null;
}

// --- Cart ---

export async function refreshCart() {
    if (isLoggedIn()) {
        appState.cart = await api.getCart();
    } else {
        const lines = readGuestLines();
        appState.cart = {
            items: lines,
            total: lines.reduce((sum, l) => sum + (l.unitPrice || 0) * l.quantity, 0)
        };
    }
    return appState.cart;
}

// Guest cart lines get their own numeric `id` (a colour + size pair is the real identity,
// but the cart view addresses rows by a single id, exactly like server-side rows). Lines
// saved before ids existed are numbered on read.
function readGuestLines() {
    const lines = readJson(GUEST_CART_KEY, []);
    let nextId = lines.reduce((max, l) => Math.max(max, Number(l.id) || 0), 0) + 1;
    lines.forEach(l => { if (!l.id) l.id = nextId++; });
    return lines;
}

export async function addToCart({ productId, productVariantId, size, quantity, unitPrice, productName, color, colorHex, imageUrl }) {
    if (isLoggedIn()) {
        await api.addToCart({ productId, productVariantId, size, quantity });
    } else {
        const lines = readGuestLines();
        const existing = lines.find(l => l.productVariantId === productVariantId && l.size === size);
        if (existing) {
            existing.quantity += quantity;
        } else {
            const id = lines.reduce((max, l) => Math.max(max, l.id), 0) + 1;
            lines.push({ id, productId, productVariantId, size, quantity, unitPrice, productName, color, colorHex, imageUrl });
        }
        writeJson(GUEST_CART_KEY, lines);
    }
    await refreshCart();
}

export async function updateCartItemQuantity(id, quantity) {
    if (isLoggedIn()) {
        await api.updateCartItemQuantity(id, quantity);
    } else {
        const lines = readGuestLines();
        const item = lines.find(l => String(l.id) === String(id));
        if (item) item.quantity = quantity;
        writeJson(GUEST_CART_KEY, lines);
    }
    await refreshCart();
}

export async function removeCartItem(id) {
    if (isLoggedIn()) {
        await api.removeCartItem(id);
    } else {
        const lines = readGuestLines().filter(l => String(l.id) !== String(id));
        writeJson(GUEST_CART_KEY, lines);
    }
    await refreshCart();
}

// --- Wishlist (account-only, per frontend-architecture.md section 6) ---

export async function refreshWishlist() {
    appState.wishlist = isLoggedIn() ? await api.getWishlist() : [];
    return appState.wishlist;
}

export async function toggleWishlist(productId) {
    if (!isLoggedIn()) return false;
    const nowInWishlist = await api.toggleWishlist(productId);
    await refreshWishlist();
    return nowInWishlist;
}

// --- Recently viewed (client-only) ---

export function recordRecentlyViewed(productSummary) {
    const withoutDuplicate = appState.recentlyViewed.filter(p => p.id !== productSummary.id);
    appState.recentlyViewed = [productSummary, ...withoutDuplicate].slice(0, MAX_RECENTLY_VIEWED);
    writeJson(RECENTLY_VIEWED_KEY, appState.recentlyViewed);
}

// --- Search history (client-only) ---

export function recordSearchTerm(term) {
    const trimmed = term.trim();
    if (!trimmed) return;
    const withoutDuplicate = appState.searchHistory.filter(t => t.toLowerCase() !== trimmed.toLowerCase());
    appState.searchHistory = [trimmed, ...withoutDuplicate].slice(0, MAX_SEARCH_HISTORY);
    writeJson(SEARCH_HISTORY_KEY, appState.searchHistory);
}

export function removeSearchTerm(term) {
    appState.searchHistory = appState.searchHistory.filter(t => t !== term);
    writeJson(SEARCH_HISTORY_KEY, appState.searchHistory);
}

// --- Categories (fetched once, cached in memory for the session) ---

export async function loadCategories() {
    appState.categories = await api.getCategories();
    return appState.categories;
}
