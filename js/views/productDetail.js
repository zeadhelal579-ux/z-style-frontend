// English header: Powers the product detail page - GetProductByIdQuery on the backend returns
// everything in one call (variants with their photos, sizes with stock). The page lets the
// shopper pick a colour (which swaps the photos), flip between photos with the thumbnail row,
// choose a size and add to the bag. The wishlist button is wired through the shared handler in
// wishlist.js; this view only repaints its label when it hears `wishlist:changed`.

import { api } from '../api.js';
import { addToCart, appState } from '../state.js';
import { resolveAssetUrl } from '../config.js';
import { renderCartBadge } from '../components/navbarState.js';
import { renderProductGrid } from '../components/productCard.js';
import { trackRecentlyViewedFromProduct } from './category.js';
import { showToast } from '../components/toast.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../utils/escapeHtml.js';

let currentProduct = null;
let selectedVariantId = null;
let selectedSize = null;
let selectedImageIndex = 0;

const currentVariant = () => currentProduct?.variants.find(v => v.id === selectedVariantId);
const currentPrice = () => (currentProduct.isPromo && currentProduct.promoPrice ? currentProduct.promoPrice : currentProduct.basePrice);

// Blanks every part of the page so a previous product never shows while the next one loads.
function clearProductDetail() {
    ['product-gallery-main', 'product-gallery-thumbs', 'product-detail-price', 'product-color-swatches',
        'product-size-buttons', 'similar-products-strip'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '';
    });
    const desc = document.getElementById('product-detail-description');
    if (desc) desc.textContent = '';
    const colorLabel = document.getElementById('selected-color-label');
    if (colorLabel) colorLabel.textContent = '';
}

// Large photo for the chosen colour, plus a thumbnail row when there are several photos.
function renderGallery() {
    const main = document.getElementById('product-gallery-main');
    const thumbs = document.getElementById('product-gallery-thumbs');
    const variant = currentVariant();
    if (!main || !variant) return;

    const urls = variant.imageUrls;
    const index = Math.min(selectedImageIndex, Math.max(urls.length - 1, 0));
    const alt = `${escapeHtml(currentProduct.name)} - ${escapeHtml(variant.color)}`;

    main.innerHTML = urls.length ? `<img src="${resolveAssetUrl(urls[index])}" alt="${alt}" class="active">` : '';
    if (thumbs) {
        thumbs.innerHTML = urls.length > 1
            ? urls.map((url, i) => `
                <button type="button" class="gallery-thumb-btn${i === index ? ' selected' : ''}"
                    data-action="select-image" data-target="${i}" aria-label="Show photo ${i + 1}">
                    <img src="${resolveAssetUrl(url)}" alt="" loading="lazy">
                </button>`).join('')
            : '';
    }
}

// One round swatch per colour, with the selected colour's name shown next to the heading.
function renderColorSwatches() {
    const container = document.getElementById('product-color-swatches');
    if (!container) return;
    container.innerHTML = currentProduct.variants.map(v => `
        <button type="button" class="color-swatch-btn${v.id === selectedVariantId ? ' selected' : ''}"
            style="background:${escapeHtml(v.colorHex)}" title="${escapeHtml(v.color)}" aria-label="${escapeHtml(v.color)}"
            data-action="select-variant" data-target="${v.id}"></button>`).join('');

    const label = document.getElementById('selected-color-label');
    if (label) label.textContent = currentVariant()?.color ?? '';
}

// Size buttons; sold-out sizes are disabled.
function renderSizeButtons() {
    const container = document.getElementById('product-size-buttons');
    if (!container) return;
    container.innerHTML = currentProduct.sizes.map(s => `
        <button type="button" class="size-select-btn${s.size === selectedSize ? ' selected' : ''}"
            ${s.stockQuantity === 0 ? 'disabled' : ''}
            data-action="select-size" data-target="${escapeHtml(s.size)}">${escapeHtml(s.size)}</button>`).join('');
}

function renderPrice() {
    const priceEl = document.getElementById('product-detail-price');
    if (!priceEl) return;
    priceEl.innerHTML = currentProduct.isPromo && currentProduct.promoPrice
        ? `<span class="price-struck">${currentProduct.basePrice} EGP</span> <span class="price-current">${currentPrice()} EGP</span>`
        : `<span class="price-current">${currentPrice()} EGP</span>`;
}

// Label and target of the "Save to Wishlist" button follow the wishlist state.
function renderWishlistButton() {
    const btn = document.getElementById('product-wishlist-btn');
    if (!btn || !currentProduct) return;
    const saved = appState.wishlist.some(p => p.id === currentProduct.id);
    btn.dataset.target = String(currentProduct.id);
    btn.classList.toggle('active', saved);
    btn.innerHTML = saved ? '&#9829; Saved to Wishlist' : '&#9825; Save to Wishlist';
}

// "You might also like": other products from the same category.
async function renderSimilarProducts() {
    const container = document.getElementById('similar-products-strip');
    if (!container || !currentProduct) return;
    const productId = currentProduct.id;
    try {
        const result = await api.getProducts({ categorySlug: currentProduct.categorySlug, pageSize: 5 });
        if (!currentProduct || currentProduct.id !== productId) return; // user already moved on
        const others = result.items.filter(p => p.id !== productId).slice(0, 4);
        container.innerHTML = renderProductGrid(others, { isWishlisted: (p) => appState.wishlist.some(w => w.id === p.id) });
    } catch {
        container.innerHTML = '';
    }
}

// Route handler for #/product/<id>.
export async function openProductDetailPage(productId) {
    const titleEl = document.getElementById('product-detail-name');
    currentProduct = null;
    clearProductDetail();
    if (titleEl) titleEl.textContent = 'Loading...';

    try {
        currentProduct = await api.getProduct(productId);
    } catch {
        if (titleEl) titleEl.textContent = 'Product not found';
        return;
    }

    selectedVariantId = currentProduct.variants[0]?.id ?? null;
    selectedImageIndex = 0;
    // A single in-stock size (e.g. "One Size" bags) is pre-selected to save a tap.
    const inStock = currentProduct.sizes.filter(s => s.stockQuantity > 0);
    selectedSize = currentProduct.sizes.length === 1 && inStock.length === 1 ? inStock[0].size : null;

    if (titleEl) titleEl.textContent = currentProduct.name;
    const descEl = document.getElementById('product-detail-description');
    if (descEl) descEl.textContent = currentProduct.description;

    renderPrice();
    renderColorSwatches();
    renderSizeButtons();
    renderGallery();
    renderWishlistButton();

    trackRecentlyViewedFromProduct(currentProduct);
    renderSimilarProducts();
}

// "Add to Bag": needs a colour and a size, then offers a shortcut to the bag.
async function handleAddToBag() {
    if (!currentProduct) return;
    if (!selectedVariantId || !selectedSize) {
        showToast('Please choose a size first.');
        return;
    }

    const variant = currentVariant();
    try {
        await addToCart({
            productId: currentProduct.id,
            productVariantId: selectedVariantId,
            size: selectedSize,
            quantity: 1,
            unitPrice: currentPrice(),
            productName: currentProduct.name,
            color: variant.color,
            colorHex: variant.colorHex,
            imageUrl: variant.imageUrls[0] || ''
        });
    } catch (err) {
        showToast(err.message || 'Could not add this item to your bag.');
        return;
    }

    renderCartBadge();
    showToast('Added to your bag.', { actionLabel: 'View bag', onAction: () => navigateTo('cart'), durationMs: 3500 });
}

export function initProductDetailView() {
    document.addEventListener('app:action', (e) => {
        const { action, target } = e.detail;
        if (!currentProduct) return;

        if (action === 'select-variant') {
            selectedVariantId = Number(target);
            selectedImageIndex = 0;
            renderColorSwatches();
            renderGallery();
        }
        if (action === 'select-image') {
            selectedImageIndex = Number(target);
            renderGallery();
        }
        if (action === 'select-size') {
            selectedSize = target;
            renderSizeButtons();
        }
        if (action === 'add-to-bag') {
            handleAddToBag();
        }
    });

    // The shared heart handler (wishlist.js) announces every change; repaint our button.
    document.addEventListener('wishlist:changed', renderWishlistButton);
}
