// English header: The one place environment settings live. This storefront ships in
// STANDALONE mode (USE_DEMO_API = true): the catalog is built in (demo/catalog.js) and
// accounts, carts, wishlists, orders and complaints are kept in this browser's localStorage
// by demo/demoApi.js, so the site works as a plain static deployment with no server at all.
// To use the real ASP.NET Core backend instead, deploy it, set USE_DEMO_API = false and put
// its public HTTPS address in API_BASE_URL / ASSET_BASE_URL (the backend's CORS setting
// Cors:AllowedOrigins must also list this site's address).

import { resolveArtUrl } from './demo/productArt.js';

export const USE_DEMO_API = true;

// Real-backend settings (only used when USE_DEMO_API = false).
export const API_BASE_URL = 'https://localhost:7123/api';
// Same origin WITHOUT "/api" - uploaded product photos are served from its /uploads folder.
export const ASSET_BASE_URL = 'https://localhost:7123';

// Demo-mode behaviour.
export const DEMO_LATENCY_MS = 90;          // fake network delay so loading states feel real
export const DEMO_ORDER_STAGE_SECONDS = 60; // seconds an order spends in each tracking stage; 0 = stay "Placed"

// localStorage key holding the session token (demo token or real JWT).
export const TOKEN_KEY = 'z_style_token';

// Turns any image reference into something an <img> can load:
//  - "art:..." short URLs from the built-in catalog are drawn on demand (see productArt.js)
//  - absolute http(s) and data: URLs pass through unchanged
//  - in standalone mode a relative path is a file of this site (e.g. "assets/products/a.jpg")
//  - with the real backend a relative path is an upload served by it (e.g. "/uploads/products/a.jpg")
export function resolveAssetUrl(url) {
    if (!url) return '';
    if (url.startsWith('art:')) return resolveArtUrl(url);
    if (/^(https?:|data:)/.test(url)) return url;
    if (USE_DEMO_API) return url;
    return `${ASSET_BASE_URL}${url}`;
}
