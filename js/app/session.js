// Microsoft session checks (MSAL in js/msgraph.js): on window focus after 3 minutes and before adding an event
import { showAlert } from './components/ui.js';

const CHECK_AFTER_MS = 3 * 60 * 1000;
let lastCheck = Date.now();
let onExpired = () => {};

export function watchSession(expired) {
    onExpired = expired;
    window.addEventListener('focus', () => {
        if (Date.now() - lastCheck > CHECK_AFTER_MS) {
            checkSession();
        }
    });
}

// True when a token can still be obtained silently, otherwise the user is signed out
export async function checkSession() {
    lastCheck = Date.now();
    if (!msal_account()) {
        expire();
        return false;
    }
    try {
        await get_token(false);
        return true;
    } catch (e) {
        console.log('Silent token renewal failed: ', e);
        expire();
        return false;
    }
}

function expire() {
    showAlert('Session expired!', 'Please sign in again.');
    onExpired();
}
