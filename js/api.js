// English header: The single data layer every view talks to. `httpApi` below sends real HTTP
// calls to the ASP.NET backend (attaching the JWT when `auth: true`), and each of its methods
// maps 1:1 to an endpoint. `demoApi` (demo/demoApi.js) implements the exact same method
// names and return shapes on top of localStorage, and config.js -> USE_DEMO_API decides which
// one is exported as `api`.

import { API_BASE_URL, TOKEN_KEY, USE_DEMO_API } from './config.js';
import { demoApi } from './demo/demoApi.js';

async function apiRequest(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };

    if (auth) {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    let res;
    try {
        res = await fetch(`${API_BASE_URL}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
    } catch {
        // fetch only rejects on network-level failures (server down, CORS, offline).
        throw new Error('Could not reach the server. Please check your connection and try again.');
    }

    if (!res.ok) {
        // The backend's ExceptionHandlingMiddleware / ToApiResult() always return
        // { error: "..." } or { errors: { field: ["..."] } } - surface that message when we
        // can, instead of a bare "API error 400".
        let message = `API error ${res.status} on ${path}`;
        try {
            const problem = await res.json();
            if (problem?.error) message = problem.error;
            else if (problem?.errors) message = Object.values(problem.errors).flat().join(' ');
        } catch {
            // response wasn't JSON - keep the generic message
        }
        const error = new Error(message);
        error.status = res.status; // lets callers tell "session rejected" (401) from other failures
        throw error;
    }

    return res.status === 204 ? null : res.json();
}

function buildQuery(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
        } else {
            params.append(key, value);
        }
    });
    return params.toString();
}

const httpApi = {
    // --- Auth ---
    register: (data) => apiRequest('/auth/register', { method: 'POST', body: data }),
    login: (email, password) => apiRequest('/auth/login', { method: 'POST', body: { email, password } }),
    getCurrentUser: () => apiRequest('/auth/me', { auth: true }),

    // --- Categories ---
    getCategories: () => apiRequest('/categories'),

    // --- Products ---
    getProducts: (filters = {}) => apiRequest(`/products?${buildQuery(filters)}`),
    getProduct: (id) => apiRequest(`/products/${id}`),
    getOffers: () => apiRequest('/products/offers'),

    // --- Cart ---
    getCart: () => apiRequest('/cart', { auth: true }),
    addToCart: (item) => apiRequest('/cart/items', { method: 'POST', body: item, auth: true }),
    updateCartItemQuantity: (id, quantity) =>
        apiRequest(`/cart/items/${id}`, { method: 'PUT', body: { quantity }, auth: true }),
    removeCartItem: (id) => apiRequest(`/cart/items/${id}`, { method: 'DELETE', auth: true }),
    mergeGuestCart: (lines) => apiRequest('/cart/merge', { method: 'POST', body: lines, auth: true }),

    // --- Wishlist ---
    getWishlist: () => apiRequest('/wishlist', { auth: true }),
    toggleWishlist: (productId) => apiRequest(`/wishlist/${productId}`, { method: 'POST', auth: true }),

    // --- Orders ---
    getOrders: () => apiRequest('/orders', { auth: true }),
    getOrder: (id) => apiRequest(`/orders/${id}`, { auth: true }),
    createOrder: (shippingAddress, paymentMethod) =>
        apiRequest('/orders', { method: 'POST', body: { shippingAddress, paymentMethod }, auth: true }),

    // --- Complaints ---
    getComplaints: () => apiRequest('/complaints', { auth: true }),
    createComplaint: (orderId, message) =>
        apiRequest('/complaints', { method: 'POST', body: { orderId: orderId || null, message }, auth: true }),
    deleteComplaint: (id) => apiRequest(`/complaints/${id}`, { method: 'DELETE', auth: true })
};

// Every view imports `api` from here and never knows which implementation it got: the real
// HTTP client above, or the browser-local demo backend (see config.js -> USE_DEMO_API).
export const api = USE_DEMO_API ? demoApi : httpApi;

export { TOKEN_KEY };
