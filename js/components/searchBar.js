// English header: Wires the navbar search box to the search-history state functions already
// built in state.js (recordSearchTerm/removeSearchTerm/appState.searchHistory) and to
// actually running a search - none of that was connected to the DOM yet. Search only fires on
// Enter (a discrete action, not continuous typing), so no debounce is needed here - see
// utils/debounce.js, which category.js's filter sidebar uses instead. Keeps the last 5 terms
// with individual removal, per project-report.md section 3.2.

import { appState, recordSearchTerm, removeSearchTerm } from '../state.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../utils/escapeHtml.js';

function renderDropdown() {
    const dropdown = document.getElementById('search-dropdown');
    if (!dropdown) return;

    if (appState.searchHistory.length === 0) {
        dropdown.innerHTML = `<p class="search-dropdown-empty">No recent searches</p>`;
        return;
    }

    // Search terms are typed by the user, so they are escaped before going into the markup.
    dropdown.innerHTML = appState.searchHistory.map(term => `
        <div class="search-history-row">
            <span data-action="rerun-search" data-target="${escapeHtml(term)}">${escapeHtml(term)}</span>
            <button type="button" data-action="remove-search-term" data-target="${escapeHtml(term)}" aria-label="Remove">&#10005;</button>
        </div>`).join('');
}

function runSearch(term) {
    if (!term.trim()) return;
    recordSearchTerm(term);
    renderDropdown();
    document.getElementById('global-search')?.blur();
    navigateTo('category', `search:${encodeURIComponent(term.trim())}`);
}

export function initSearchBar() {
    const input = document.getElementById('global-search');
    const dropdown = document.getElementById('search-dropdown');
    if (!input || !dropdown) return;

    renderDropdown();

    // The stylesheet shows the dropdown with `.visible` (display:none otherwise). The short
    // blur delay lets a click on a history row land before the dropdown disappears.
    input.addEventListener('focus', () => dropdown.classList.add('visible'));
    input.addEventListener('blur', () => setTimeout(() => dropdown.classList.remove('visible'), 150));

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') runSearch(input.value);
    });

    document.addEventListener('app:action', (e) => {
        const { action, target } = e.detail;
        if (action === 'rerun-search') {
            input.value = target;
            runSearch(target);
        }
        if (action === 'remove-search-term') {
            removeSearchTerm(target);
            renderDropdown();
        }
    });
}
