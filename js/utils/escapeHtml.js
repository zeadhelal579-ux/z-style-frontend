// English header: Escapes text before it is placed inside an innerHTML template. Product data
// comes from our own catalog/backend, but search terms, complaint messages and shipping
// addresses are typed by the user - escaping them stops a pasted "<script>" or "<img onerror>"
// from running when the text is rendered back into the page.
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
