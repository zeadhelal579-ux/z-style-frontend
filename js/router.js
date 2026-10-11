// English header: Two things the old Script1.js didn't have: (1) the URL hash actually
// changes on navigation, so back/forward and shareable links work (frontend-architecture.md
// section 4); (2) one delegated click listener replaces the ~40 inline onclick="" handlers
// (section 3), since ES6 modules can't be reached by inline HTML attributes without manually
// polluting `window`.

const routeHandlers = {};

export function registerRoute(name, handler) {
    routeHandlers[name] = handler;
}

export function navigateTo(viewName, param) {
    const hash = param ? `#/${viewName}/${param}` : `#/${viewName}`;
    if (location.hash === hash) {
        renderCurrentRoute(); // same hash - force a re-render instead of relying on hashchange
    } else {
        location.hash = hash;
    }
}

// Like navigateTo, but replaces the current history entry instead of adding one. Used by the
// login guard: pressing Back from the login page must not land on the guarded page again
// (which would immediately redirect back to login and trap the visitor).
export function redirectTo(viewName, param) {
    const hash = param ? `#/${viewName}/${param}` : `#/${viewName}`;
    history.replaceState(null, '', hash);
    renderCurrentRoute();
}

function renderCurrentRoute() {
    // "#/product/12" -> "product/12" -> view "product", param "12". (The leading "#/" is
    // already stripped, so there is no empty first segment to skip.)
    const [view, param] = location.hash.replace(/^#\/?/, '').split('/');
    const resolvedView = view || 'home';

    document.querySelectorAll('.spa-view').forEach(el => el.classList.remove('active'));
    // Unknown routes fall back to the home view instead of leaving a blank page.
    const target = document.getElementById(`view-${resolvedView}`) || document.getElementById('view-home');
    target.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    const handler = routeHandlers[resolvedView];
    if (handler) handler(param);
}

export function initRouter() {
    window.addEventListener('hashchange', renderCurrentRoute);
    renderCurrentRoute();

    // Single delegated listener for every [data-action] element, replacing every
    // onclick="..." in the original HTMLPage1.html.
    document.addEventListener('click', (event) => {
        const el = event.target.closest('[data-action]');
        if (!el) return;

        // Ctrl/Cmd/Shift/middle-click on a real link should open it in a new tab as usual.
        if (el.tagName === 'A' && (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)) return;
        // Our handler performs the navigation, so the anchor's own default jump is cancelled.
        if (el.tagName === 'A') event.preventDefault();

        const { action, target, param } = el.dataset;

        switch (action) {
            case 'navigate':
                navigateTo(target, param);
                break;
            default:
                document.dispatchEvent(new CustomEvent('app:action', { detail: { action, target, param, el } }));
        }
    });
}
