// English header: Single entry point (index.html loads only this file as type="module").
// Bootstraps the session and the data the first screen needs, registers every view with the
// router, then wires the one-time event listeners each view needs. Data loading is allowed to
// fail without taking the whole page down: the shell always starts, and each view shows its
// own message when it can't load something.

import { initRouter, registerRoute } from './router.js';
import { loadSessionFromStorage, loadCategories, restoreSession } from './state.js';
import { USE_DEMO_API } from './config.js';
import { renderNavbarAuthState, renderCartBadge, renderWishlistBadge } from './components/navbarState.js';

import { initHomeView } from './views/home.js';
import { initCategoryView, openCategoryPage } from './views/category.js';
import { initProductDetailView, openProductDetailPage } from './views/productDetail.js';
import { initAuthView } from './views/auth.js';
import { initCartView, openCartPage } from './views/cart.js';
import { initCheckoutView, openCheckoutPage } from './views/checkout.js';
import { initWishlistView, openWishlistPage } from './views/wishlist.js';
import { openOffersPage } from './views/offers.js';
import { initOrdersView, openOrdersPage } from './views/orders.js';
import { initComplaintsView, openComplaintsPage } from './views/complaints.js';
import { initProfilePanel } from './views/profile.js';
import { initMobileMenu, initChatbot } from './components/uiToggles.js';
import { initSearchBar } from './components/searchBar.js';

async function bootstrap() {
    loadSessionFromStorage();

    // Categories and the session check are independent, so they load together; allSettled
    // means one failing never blocks the other (or the rest of the startup).
    await Promise.allSettled([loadCategories(), restoreSession()]);

    renderNavbarAuthState();
    renderCartBadge();
    renderWishlistBadge();

    // Notes that only make sense for the built-in demo backend (see config.js).
    if (USE_DEMO_API) {
        document.querySelectorAll('[data-demo-note]').forEach(el => el.classList.remove('hidden'));
    }

    // Every view gets its one-time listener setup here...
    initHomeView();
    initCategoryView();
    initProductDetailView();
    initAuthView();
    initCartView();
    initCheckoutView();
    initWishlistView();
    initOrdersView();
    initComplaintsView();
    initProfilePanel();
    initMobileMenu();
    initChatbot();
    initSearchBar();

    // ...and its route registration here - `param` is whatever came after the second slash
    // in the URL hash, e.g. "#/product/12" -> param = "12".
    registerRoute('home', () => {});
    registerRoute('category', (param) => openCategoryPage(param));
    registerRoute('product', (param) => openProductDetailPage(param));
    registerRoute('auth', () => {});
    registerRoute('cart', () => openCartPage());
    registerRoute('checkout', () => openCheckoutPage());
    registerRoute('wishlist', () => openWishlistPage());
    registerRoute('orders', (param) => openOrdersPage(param));
    registerRoute('complaints', (param) => openComplaintsPage(param));
    registerRoute('offers', () => openOffersPage());

    initRouter();
}

// Module scripts run after the document is parsed, but guard both cases anyway.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
