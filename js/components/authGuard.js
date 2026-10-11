// English header: One shared answer to "this page needs an account". Orders, complaints, the
// wishlist page, payment and checkout all call requireLogin(); a guest is sent to the login
// page with a short explanation, and after logging in the app returns them to `returnTo`
// instead of the home page (auth.js reads appState.postLoginTarget).

import { appState, isLoggedIn } from '../state.js';
import { redirectTo } from '../router.js';
import { showToast } from './toast.js';

// Returns true when the visitor is signed in; otherwise redirects to login and returns false.
export function requireLogin(returnTo, message = 'Please log in to continue.') {
    if (isLoggedIn()) return true;
    appState.postLoginTarget = returnTo;
    showToast(message, { durationMs: 3500 });
    redirectTo('auth');
    return false;
}
