// English header: Two small, purely-visual interactions that don't belong in any single
// view because they're global chrome, not page content: (1) the mobile hamburger menu -
// frontend-architecture.md gap #5, the original nav-menu just vanished under 992px with no
// replacement; (2) the floating chatbot window open/close + a canned reply. A real AI-backed
// chatbot was never part of backend-architecture.md's endpoint list, so this keeps the
// existing "types into a box, gets a reply" experience working without inventing a new
// backend feature that was never agreed on.

export function initMobileMenu() {
    document.addEventListener('app:action', (e) => {
        if (e.detail.action !== 'toggle-mobile-menu') return;
        document.getElementById('nav-menu')?.classList.toggle('mobile-open');
    });

    // Close the menu automatically once a link inside it is used.
    document.getElementById('nav-menu')?.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="navigate"]')) {
            document.getElementById('nav-menu')?.classList.remove('mobile-open');
        }
    });
}

const CANNED_REPLIES = [
    'تقدر تلاقي أحدث العروض في صفحة Offers من الناف بار.',
    'لو عايز تنسيق كامل، جرب صفحة الـ Wishlist وضيف قطعتين، هيظهرلك اقتراح تنسيق تلقائي.',
    'أي حجم مش لاقيه متوفر، جرب تختار لون تاني لنفس المنتج، ساعات الكمية بتفرق حسب اللون.'
];

function appendChatMessage(text, isUser) {
    const stream = document.getElementById('chatbot-stream');
    if (!stream) return;
    const bubble = document.createElement('div');
    bubble.className = `chat-msg ${isUser ? 'user-node' : 'system-node'}`;
    bubble.textContent = text;
    stream.appendChild(bubble);
    stream.scrollTop = stream.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('chatbot-input-field');
    if (!input || !input.value.trim()) return;

    appendChatMessage(input.value.trim(), true);
    input.value = '';

    const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
    setTimeout(() => appendChatMessage(reply, false), 400);
}

export function initChatbot() {
    document.addEventListener('app:action', (e) => {
        if (e.detail.action === 'toggle-chatbot') {
            document.getElementById('chatbot-window')?.classList.toggle('open');
        }
        if (e.detail.action === 'send-chat-message') {
            sendChatMessage();
        }
    });

    document.getElementById('chatbot-input-field')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
}
