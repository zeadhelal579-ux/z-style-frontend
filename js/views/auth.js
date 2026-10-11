// English header: One form, two modes (#tab-login / #tab-signup decide which fields show).
// Signup sends first name, last name and phone along with email and password. A successful
// submit calls completeLogin() so the navbar updates immediately, then the visitor is sent to
// the page they were trying to reach (appState.postLoginTarget, set by the login guard) or home.

import { api } from '../api.js';
import { appState, completeLogin } from '../state.js';
import { navigateTo } from '../router.js';
import { renderNavbarAuthState, renderCartBadge, renderWishlistBadge } from '../components/navbarState.js';

let currentAuthMode = 'login';
let submitting = false;

// Switches between the Log In and Sign Up layouts.
function setAuthMode(mode) {
    currentAuthMode = mode;
    document.getElementById('tab-login')?.classList.toggle('active', mode === 'login');
    document.getElementById('tab-signup')?.classList.toggle('active', mode === 'signup');
    document.getElementById('signup-fields-extended')?.classList.toggle('hidden-fields-group', mode === 'login');
    const submitBtn = document.getElementById('auth-submit-btn');
    if (submitBtn) submitBtn.textContent = mode === 'login' ? 'Log In' : 'Create Account';
    hideAuthError();
}

function hideAuthError() {
    document.getElementById('auth-error-message')?.classList.add('hidden');
}

function showAuthError(message) {
    const box = document.getElementById('auth-error-message');
    if (box) {
        box.textContent = message;
        box.classList.remove('hidden');
    }
}

// Empties one input and flashes it red for a moment.
function clearField(id) {
    const input = document.getElementById(id);
    if (input) {
        input.value = '';
        input.classList.add('field-error');
        setTimeout(() => input.classList.remove('field-error'), 1500);
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    hideAuthError();

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('auth-submit-btn');

    submitting = true;
    if (submitBtn) submitBtn.disabled = true;
    try {
        let response;
        if (currentAuthMode === 'login') {
            response = await api.login(email, password);
        } else {
            const firstName = document.getElementById('auth-fname').value.trim();
            const lastName = document.getElementById('auth-lname').value.trim();
            const phoneNumber = document.getElementById('auth-phone').value.trim();
            response = await api.register({ email, password, firstName, lastName, phoneNumber });
        }

        await completeLogin(response);
        renderNavbarAuthState();
        renderCartBadge();
        renderWishlistBadge();

        document.getElementById('auth-universal-form')?.reset();
        const destination = appState.postLoginTarget || 'home';
        appState.postLoginTarget = null;
        navigateTo(destination);
    } catch (err) {
        // Only the password is cleared on an error - the rest of the form stays filled in.
        clearField('auth-password');
        showAuthError(err.message || 'Something went wrong. Please try again.');
    } finally {
        submitting = false;
        if (submitBtn) submitBtn.disabled = false;
    }
}

export function initAuthView() {
    document.getElementById('auth-universal-form')?.addEventListener('submit', handleAuthSubmit);

    document.getElementById('tab-login')?.addEventListener('click', () => setAuthMode('login'));
    document.getElementById('tab-signup')?.addEventListener('click', () => setAuthMode('signup'));
    setAuthMode('login');

    document.querySelectorAll('[data-action="toggle-password-visibility"]').forEach(el => {
        el.addEventListener('click', () => {
            const input = document.getElementById(el.dataset.target);
            if (input) input.type = input.type === 'password' ? 'text' : 'password';
        });
    });

    document.getElementById('reset-auth-form')?.addEventListener('click', () => {
        document.getElementById('auth-universal-form')?.reset();
        hideAuthError();
    });
}
