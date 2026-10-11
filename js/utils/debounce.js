// English header: Standard debounce. Used by views/category.js's filter sidebar (colour,
// gender, price min/max) so dragging through several filters in a row doesn't fire a
// GetProductsQuery request per change - only after the user pauses.
export function debounce(fn, delayMs = 300) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delayMs);
    };
}
