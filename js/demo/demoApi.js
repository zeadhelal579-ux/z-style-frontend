// English header: A complete stand-in for the ASP.NET backend that runs entirely inside the
// browser. It exposes the same methods, arguments and return shapes as `httpApi` in api.js
// (ProductSummaryDto, ProductDetailDto, CartDto, OrderDto, ...), so no view needs to know
// whether it is talking to a server. Products come from demo/catalog.js; accounts, carts,
// wishlists, orders and complaints live in one localStorage record ("z_style_demo_db").
// Business rules copy the real handlers: validation messages, ownership checks (a user only
// sees their own cart/orders/complaints), promo-aware pricing, order snapshots, and the
// "cart is emptied when an order is placed" behaviour. This is demo-grade security only -
// everything is stored on the visitor's own device.

import { CATEGORIES, PRODUCTS } from './catalog.js';
import { TOKEN_KEY, DEMO_LATENCY_MS, DEMO_ORDER_STAGE_SECONDS } from '../config.js';

const DB_KEY = 'z_style_demo_db';
const DB_VERSION = 1;
const FIRST_ORDER_ID = 1001;
const TOKEN_PREFIX = 'demo-token.';

const ORDER_STAGES = ['Placed', 'InWarehouse', 'Shipped', 'Delivered'];
const PAYMENT_METHODS = ['CashOnDelivery', 'Visa', 'VodafoneCash', 'Fawry'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors the backend's { error: "..." } responses, with the HTTP status for reference.
class ApiError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

// ---------------------------------------------------------------------------
// Storage: one JSON record, read fresh on every call so several tabs stay in sync.
// ---------------------------------------------------------------------------

let memoryFallback = null; // used only if localStorage is blocked (private mode, strict settings)

// Shape of a brand-new database.
function emptyDb() {
    return {
        version: DB_VERSION,
        users: [],
        carts: {},
        wishlists: {},
        orders: [],
        complaints: [],
        seq: { cartItem: 0, order: FIRST_ORDER_ID - 1, complaint: 0 }
    };
}

// Reads the database; falls back to an in-memory copy, then to an empty database.
function loadDb() {
    try {
        const raw = localStorage.getItem(DB_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.version === DB_VERSION) return parsed;
        }
    } catch {
        // blocked or corrupted storage - fall through to the fallbacks below
    }
    return memoryFallback ?? emptyDb();
}

// Writes the database, keeping an in-memory copy in case storage is unavailable.
function saveDb(db) {
    memoryFallback = db;
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch {
        // quota exceeded or storage blocked - the in-memory copy still serves this session
    }
}

// Wraps a handler so every call waits a short, fake network delay first - this keeps the
// "Loading..." states and the optimistic-UI code paths behaving like they would online.
function endpoint(handler) {
    return async (...args) => {
        await new Promise(resolve => setTimeout(resolve, DEMO_LATENCY_MS));
        return handler(...args);
    };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Random id for user accounts.
function newId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// Salted SHA-256 so a password is never stored in plain text, even in demo mode. Falls back
// to a tiny non-cryptographic hash on insecure origins where crypto.subtle is unavailable.
async function hashPassword(password, salt) {
    const bytes = new TextEncoder().encode(`${salt}:${password}`);
    if (globalThis.crypto?.subtle) {
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0x811c9dc5;
    for (const byte of bytes) {
        hash ^= byte;
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

// Finds the signed-in user from the session token, or throws 401 like [Authorize] would.
function requireUser(db) {
    let token = null;
    try {
        token = localStorage.getItem(TOKEN_KEY);
    } catch {
        // storage blocked - treated as signed out
    }
    const userId = token && token.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null;
    const user = userId ? db.users.find(u => u.id === userId) : null;
    if (!user) throw new ApiError('Please log in to continue.', 401);
    return user;
}

const productById = (id) => PRODUCTS.find(p => p.id === id);
const categoryOf = (product) => CATEGORIES.find(c => c.id === product.categoryId);
const effectivePrice = (p) => (p.isPromo && p.promoPrice != null ? p.promoPrice : p.basePrice);

// Newest first, id as a stable tie-breaker (same ordering as the real queries).
const byNewest = (a, b) => b.createdAt - a.createdAt || a.id - b.id;

// ProductSummaryDto: the card shape used by grids, offers and the wishlist.
function toSummary(product) {
    const category = categoryOf(product);
    return {
        id: product.id,
        name: product.name,
        basePrice: product.basePrice,
        isPromo: product.isPromo,
        promoPrice: product.promoPrice,
        categoryName: category.name,
        categorySlug: category.slug,
        gender: product.gender,
        primaryImageUrl: product.variants[0]?.images[0] ?? '',
        colors: product.variants.map(v => ({ variantId: v.id, color: v.color, colorHex: v.colorHex }))
    };
}

// ProductDetailDto: everything the product page needs in one object.
function toDetail(product) {
    const category = categoryOf(product);
    return {
        id: product.id,
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        isPromo: product.isPromo,
        promoPrice: product.promoPrice,
        categoryName: category.name,
        categorySlug: category.slug,
        gender: product.gender,
        variants: product.variants.map(v => ({
            id: v.id,
            color: v.color,
            colorHex: v.colorHex,
            imageUrls: [...v.images]
        })),
        sizes: product.sizes.map(s => ({ size: s.size, stockQuantity: s.stockQuantity }))
    };
}

// Cart rows pointing at a product/colour that no longer exists in the catalog (for example
// after the catalog file was edited between deployments) are silently dropped.
function liveCartRows(db, userId) {
    return (db.carts[userId] ?? []).filter(row => {
        const product = productById(row.productId);
        return product && product.variants.some(v => v.id === row.productVariantId);
    });
}

// CartItemDto for one stored row.
function toCartItem(row) {
    const product = productById(row.productId);
    const variant = product.variants.find(v => v.id === row.productVariantId);
    const unitPrice = effectivePrice(product);
    return {
        id: row.id,
        productId: product.id,
        productName: product.name,
        productVariantId: variant.id,
        color: variant.color,
        colorHex: variant.colorHex,
        imageUrl: variant.images[0] ?? '',
        size: row.size,
        quantity: row.quantity,
        unitPrice,
        lineTotal: unitPrice * row.quantity
    };
}

// True when the colour option really belongs to that product.
function variantBelongsToProduct(productId, variantId) {
    const product = productById(productId);
    return Boolean(product && product.variants.some(v => v.id === variantId));
}

// There is no admin in standalone mode, so an order walks through the tracking stages on its
// own: every DEMO_ORDER_STAGE_SECONDS it moves one step (Placed -> InWarehouse -> Shipped ->
// Delivered). Set that constant to 0 in config.js to keep orders on "Placed".
function currentStatus(order) {
    if (!DEMO_ORDER_STAGE_SECONDS || order.status === 'Cancelled') return order.status;
    const elapsedSeconds = (Date.now() - Date.parse(order.createdAt)) / 1000;
    const index = Math.min(ORDER_STAGES.length - 1, Math.max(0, Math.floor(elapsedSeconds / DEMO_ORDER_STAGE_SECONDS)));
    return ORDER_STAGES[index];
}

// Auth response shared by register and login.
function toAuthResponse(user) {
    return {
        token: `${TOKEN_PREFIX}${user.id}`,
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
    };
}

// Throws one combined 400 error from a list of validation messages (no-op when empty).
function failIfInvalid(errors) {
    if (errors.length > 0) throw new ApiError(errors.join(' '), 400);
}

// ---------------------------------------------------------------------------
// The API - same names and shapes as httpApi in api.js
// ---------------------------------------------------------------------------

export const demoApi = {
    // --- Auth ---

    // Same rules as RegisterValidator.cs: valid email, 6+ char password with a digit and a
    // lowercase letter, names up to 50 chars, phone up to 20; a taken email is a 409.
    register: endpoint(async (data = {}) => {
        const email = String(data.email ?? '').trim();
        const password = String(data.password ?? '');
        const firstName = String(data.firstName ?? '').trim();
        const lastName = String(data.lastName ?? '').trim();
        const phoneNumber = String(data.phoneNumber ?? '').trim();

        const errors = [];
        if (!email) errors.push('Email is required.');
        else if (!EMAIL_PATTERN.test(email)) errors.push('Please enter a valid email address.');
        if (!password) {
            errors.push('Password is required.');
        } else {
            if (password.length < 6) errors.push('Password must be at least 6 characters.');
            if (!/[0-9]/.test(password)) errors.push('Password must contain at least one digit.');
            if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter.');
        }
        if (!firstName) errors.push('First name is required.');
        else if (firstName.length > 50) errors.push('First name must be 50 characters or fewer.');
        if (!lastName) errors.push('Last name is required.');
        else if (lastName.length > 50) errors.push('Last name must be 50 characters or fewer.');
        if (!phoneNumber) errors.push('Phone number is required.');
        else if (phoneNumber.length > 20) errors.push('Phone number must be 20 characters or fewer.');
        failIfInvalid(errors);

        const db = loadDb();
        if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            throw new ApiError('This email is already registered.', 409);
        }

        const salt = newId();
        const user = {
            id: newId(),
            email,
            firstName,
            lastName,
            phoneNumber,
            salt,
            passwordHash: await hashPassword(password, salt)
        };
        db.users.push(user);
        saveDb(db);
        return toAuthResponse(user);
    }),

    // Missing account and wrong password give the same message, so emails can't be probed.
    login: endpoint(async (email, password) => {
        const cleanEmail = String(email ?? '').trim();
        const errors = [];
        if (!cleanEmail) errors.push('Email is required.');
        else if (!EMAIL_PATTERN.test(cleanEmail)) errors.push('Please enter a valid email address.');
        if (!password) errors.push('Password is required.');
        failIfInvalid(errors);

        const db = loadDb();
        const user = db.users.find(u => u.email.toLowerCase() === cleanEmail.toLowerCase());
        const valid = user && (await hashPassword(String(password), user.salt)) === user.passwordHash;
        if (!valid) throw new ApiError('Invalid email or password.', 401);
        return toAuthResponse(user);
    }),

    getCurrentUser: endpoint(async () => {
        const user = requireUser(loadDb());
        return {
            userId: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber
        };
    }),

    // --- Categories ---

    getCategories: endpoint(async () =>
        [...CATEGORIES].sort((a, b) => a.displayOrder - b.displayOrder).map(c => ({ ...c }))),

    // --- Products ---

    // Same filter set as GetProductsQuery (category, gender, colours, price range, search),
    // newest first, paged. One extension: the search text also matches the category name, so
    // typing "shoes" or "hoodie" finds products even when the word isn't in the item name.
    getProducts: endpoint(async (filters = {}) => {
        const { categorySlug, gender, colors, minPrice, maxPrice, search } = filters;
        const min = minPrice === undefined || minPrice === '' ? NaN : Number(minPrice);
        const max = maxPrice === undefined || maxPrice === '' ? NaN : Number(maxPrice);
        const wantedColors = (Array.isArray(colors) ? colors : colors ? [colors] : []).map(c => String(c).toLowerCase());
        const needle = String(search ?? '').trim().toLowerCase();

        const matches = PRODUCTS.filter(p => {
            const category = categoryOf(p);
            if (categorySlug && category.slug !== categorySlug) return false;
            if (gender && p.gender !== gender) return false;
            if (!Number.isNaN(min) && p.basePrice < min) return false;
            if (!Number.isNaN(max) && p.basePrice > max) return false;
            if (needle && !p.name.toLowerCase().includes(needle) && !category.name.toLowerCase().includes(needle)) return false;
            if (wantedColors.length > 0 && !p.variants.some(v => wantedColors.includes(v.color.toLowerCase()))) return false;
            return true;
        }).sort(byNewest);

        const requestedPage = Number(filters.page);
        const requestedSize = Number(filters.pageSize);
        const page = requestedPage >= 1 ? Math.floor(requestedPage) : 1;
        const pageSize = requestedSize >= 1 && requestedSize <= 100 ? Math.floor(requestedSize) : 20;

        return {
            items: matches.slice((page - 1) * pageSize, page * pageSize).map(toSummary),
            page,
            pageSize,
            totalCount: matches.length,
            totalPages: Math.ceil(matches.length / pageSize)
        };
    }),

    getProduct: endpoint(async (id) => {
        const product = productById(Number(id));
        if (!product) throw new ApiError(`Product ${id} was not found.`, 404);
        return toDetail(product);
    }),

    getOffers: endpoint(async () => PRODUCTS.filter(p => p.isPromo).sort(byNewest).map(toSummary)),

    // --- Cart (signed-in users only; guests keep their cart in localStorage via state.js) ---

    getCart: endpoint(async () => {
        const db = loadDb();
        const user = requireUser(db);
        const items = liveCartRows(db, user.id).map(toCartItem);
        return { items, total: items.reduce((sum, item) => sum + item.lineTotal, 0) };
    }),

    // Adds to an existing row for the same colour + size, otherwise creates one; returns the
    // real row id (the bug the original backend example had was returning 0 here).
    addToCart: endpoint(async (item = {}) => {
        const db = loadDb();
        const user = requireUser(db);

        const productId = Number(item.productId);
        const variantId = Number(item.productVariantId);
        const size = String(item.size ?? '').trim();
        const quantity = Number(item.quantity);

        const errors = [];
        if (!Number.isInteger(quantity) || quantity <= 0) errors.push('Quantity must be greater than 0.');
        if (!size) errors.push('Size is required.');
        failIfInvalid(errors);

        if (!variantBelongsToProduct(productId, variantId)) {
            throw new ApiError('That colour option was not found for this product.', 404);
        }

        const rows = (db.carts[user.id] ??= []);
        let row = rows.find(r => r.productVariantId === variantId && r.size === size);
        if (row) {
            row.quantity += quantity;
        } else {
            row = { id: ++db.seq.cartItem, productId, productVariantId: variantId, size, quantity, addedAt: new Date().toISOString() };
            rows.push(row);
        }
        saveDb(db);
        return row.id;
    }),

    updateCartItemQuantity: endpoint(async (id, quantity) => {
        const db = loadDb();
        const user = requireUser(db);
        const amount = Number(quantity);
        if (!Number.isInteger(amount) || amount <= 0) throw new ApiError('Quantity must be greater than 0.', 400);

        const row = (db.carts[user.id] ?? []).find(r => r.id === Number(id));
        if (!row) throw new ApiError('Cart item was not found.', 404);
        row.quantity = amount;
        saveDb(db);
        return null;
    }),

    removeCartItem: endpoint(async (id) => {
        const db = loadDb();
        const user = requireUser(db);
        const rows = db.carts[user.id] ?? [];
        const index = rows.findIndex(r => r.id === Number(id));
        if (index === -1) throw new ApiError('Cart item was not found.', 404);
        rows.splice(index, 1);
        saveDb(db);
        return null;
    }),

    // Folds the guest's localStorage cart into the account right after login. Lines are
    // client-controlled, so malformed ones, or ones whose colour doesn't belong to the
    // product, are skipped instead of trusted - and the call never fails the login.
    mergeGuestCart: endpoint(async (lines) => {
        const db = loadDb();
        const user = requireUser(db);
        const rows = (db.carts[user.id] ??= []);

        for (const line of Array.isArray(lines) ? lines : []) {
            const productId = Number(line?.productId);
            const variantId = Number(line?.productVariantId);
            const size = String(line?.size ?? '').trim();
            const quantity = Number(line?.quantity);
            if (!Number.isInteger(quantity) || quantity <= 0 || !size) continue;
            if (!variantBelongsToProduct(productId, variantId)) continue;

            const match = rows.find(r => r.productVariantId === variantId && r.size === size);
            if (match) {
                match.quantity += quantity;
            } else {
                rows.push({ id: ++db.seq.cartItem, productId, productVariantId: variantId, size, quantity, addedAt: new Date().toISOString() });
            }
        }
        saveDb(db);
        return null;
    }),

    // --- Wishlist ---

    getWishlist: endpoint(async () => {
        const db = loadDb();
        const user = requireUser(db);
        return (db.wishlists[user.id] ?? [])
            .slice()
            .sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt))
            .map(entry => productById(entry.productId))
            .filter(Boolean)
            .map(toSummary);
    }),

    // One call flips membership; returns true when the product is now in the wishlist.
    toggleWishlist: endpoint(async (productId) => {
        const db = loadDb();
        const user = requireUser(db);
        const id = Number(productId);
        if (!productById(id)) throw new ApiError(`Product ${productId} was not found.`, 404);

        const list = (db.wishlists[user.id] ??= []);
        const index = list.findIndex(entry => entry.productId === id);
        if (index !== -1) {
            list.splice(index, 1);
            saveDb(db);
            return false;
        }
        list.push({ productId: id, addedAt: new Date().toISOString() });
        saveDb(db);
        return true;
    }),

    // --- Orders ---

    getOrders: endpoint(async () => {
        const db = loadDb();
        const user = requireUser(db);
        return db.orders
            .filter(o => o.userId === user.id)
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)
            .map(o => ({ id: o.id, status: currentStatus(o), total: o.total, createdAt: o.createdAt }));
    }),

    getOrder: endpoint(async (id) => {
        const db = loadDb();
        const user = requireUser(db);
        const order = db.orders.find(o => o.id === Number(id) && o.userId === user.id);
        if (!order) throw new ApiError(`Order ${id} was not found.`, 404);
        return {
            id: order.id,
            status: currentStatus(order),
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            total: order.total,
            createdAt: order.createdAt,
            items: order.items.map(i => ({ ...i }))
        };
    }),

    // Snapshots each cart line's name and price into the order, then empties the cart - all in
    // one save, so the order either fully happens or nothing changes. Returns the new order id.
    createOrder: endpoint(async (shippingAddress, paymentMethod) => {
        const db = loadDb();
        const user = requireUser(db);

        const address = String(shippingAddress ?? '').trim();
        const errors = [];
        if (!address) errors.push('Shipping address is required.');
        else if (address.length > 300) errors.push('Shipping address must be 300 characters or fewer.');
        if (!PAYMENT_METHODS.includes(paymentMethod)) errors.push('Please choose a valid payment method.');
        failIfInvalid(errors);

        const rows = liveCartRows(db, user.id);
        if (rows.length === 0) throw new ApiError('Cannot place an order with an empty cart.', 400);

        const items = rows.map(toCartItem).map(i => ({
            productId: i.productId,
            productName: i.productName,
            color: i.color,
            size: i.size,
            quantity: i.quantity,
            unitPrice: i.unitPrice
        }));

        const order = {
            id: ++db.seq.order,
            userId: user.id,
            status: 'Placed',
            shippingAddress: address,
            paymentMethod,
            total: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
            createdAt: new Date().toISOString(),
            items
        };
        db.orders.push(order);
        db.carts[user.id] = [];
        saveDb(db);
        return order.id;
    }),

    // --- Complaints ---

    getComplaints: endpoint(async () => {
        const db = loadDb();
        const user = requireUser(db);
        return db.complaints
            .filter(c => c.userId === user.id)
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id)
            .map(c => ({ id: c.id, orderId: c.orderId, message: c.message, status: c.status, createdAt: c.createdAt }));
    }),

    // OrderId is optional (a general complaint is fine); when given it must be the caller's.
    createComplaint: endpoint(async (orderId, message) => {
        const db = loadDb();
        const user = requireUser(db);

        const text = String(message ?? '').trim();
        const errors = [];
        if (!text) errors.push('Please describe the issue before submitting.');
        else if (text.length > 1000) errors.push('The message must be 1000 characters or fewer.');
        failIfInvalid(errors);

        let linkedOrderId = null;
        if (orderId !== null && orderId !== undefined && orderId !== '') {
            linkedOrderId = Number(orderId);
            if (!db.orders.some(o => o.id === linkedOrderId && o.userId === user.id)) {
                throw new ApiError(`Order ${orderId} was not found.`, 404);
            }
        }

        const complaint = {
            id: ++db.seq.complaint,
            userId: user.id,
            orderId: linkedOrderId,
            message: text,
            status: 'Open',
            createdAt: new Date().toISOString()
        };
        db.complaints.push(complaint);
        saveDb(db);
        return { id: complaint.id, orderId: complaint.orderId, message: complaint.message, status: complaint.status, createdAt: complaint.createdAt };
    }),

    deleteComplaint: endpoint(async (id) => {
        const db = loadDb();
        const user = requireUser(db);
        const index = db.complaints.findIndex(c => c.id === Number(id) && c.userId === user.id);
        if (index === -1) throw new ApiError('Complaint was not found.', 404);
        db.complaints.splice(index, 1);
        saveDb(db);
        return null;
    })
};
