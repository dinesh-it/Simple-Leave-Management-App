// App entry: Microsoft sign in, workspace config, user and admin detection, calendar, views and routing
import { state, loadYear } from './state.js';
import { loadConfig, isAdminName } from './config.js';
import { findCalendar } from './calendar.js';
import { setupLeaveCalendar } from './leave.js';
import { watchSession } from './session.js';
import { initShared } from './shared.js';
import * as addLeave from './add-leave.js';
import * as personal from './views/personal.js';
import { $, $$, show, showAlert, loading, loadingDone } from './components/ui.js';

// The Team view module, loaded for admins only
let team = null;

// ?from=MM/DD/YYYY&to=MM/DD/YYYY&search=... apply to the view opened first
const params = new URLSearchParams(window.location.search);

if (!window.IS_AUTH_RESPONSE) {
    boot();
}

async function boot() {
    $('#login-btn').addEventListener('click', login);
    $('#logout-btn').addEventListener('click', logout);

    loading('Initializing...');
    let account = null;
    try {
        account = await msal_init();
    } catch (e) {
        console.log('MSAL init failed: ', e);
        showAlert('Sign in failed', 'Failed to initialize Microsoft sign in!\n' + e.message);
    }
    if (account) {
        await start();
    } else {
        showSignIn();
    }
}

function showSignIn() {
    loadingDone();
    show($('#app'), false);
    show($('#signin'), true);
}

async function login() {
    try {
        loading('Signing in...');
        await msal_login();
    } catch (e) {
        console.log('Login failed: ', e);
        showSignIn();
        showAlert('Sign in', 'Login cancelled or failed!\n' + e.message);
        return;
    }
    await start();
}

async function logout() {
    loading('Logging out...');
    try {
        await msal_logout();
    } catch (e) {
        console.log('Logout failed: ', e);
    }
    window.location.hash = '';
    window.location.reload();
}

async function start() {
    show($('#signin'), false);

    loading('Loading workspace config...');
    try {
        state.config = await loadConfig();
    } catch (e) {
        loadingDone();
        showAlert('Workspace config', e.message);
        return;
    }
    const config = state.config;
    // Used by js/slack.js
    window.slack_webhook_url = config.slackWebhookUrl;
    setupLeaveCalendar(config);

    loading('Reading your profile...');
    try {
        const me = await graph_get('/me?$select=givenName,displayName');
        state.user = me.givenName || (me.displayName || '').split(' ')[0] || '';
        state.displayName = me.displayName || state.user;
    } catch (e) {
        // Without a name nothing is the user's own and there is no Team view (fail closed)
        console.log('Failed to get user profile: ', e);
        state.user = '';
    }
    state.isAdmin = isAdminName(config, state.user);

    loading('Getting the calendar...');
    try {
        state.calendar = await findCalendar(config);
    } catch (e) {
        console.log('Failed to get calendar: ', e);
        loadingDone();
        showAlert('Calendar', 'Failed to get the calendar "' + config.calendarName + '"!\n' + e.message +
            '\n\nYou need to be a member of the "' + config.calendarName + '" group.');
        return;
    }

    renderShell();

    loading('Fetching leave...');
    try {
        await loadYear();
    } catch (e) {
        console.log('Failed to get events: ', e);
        showAlert('Calendar', 'Failed to get the leave events!\n' + e.message);
    }

    const first = currentView();
    initShared();
    addLeave.init();
    await personal.init($('#view-personal'), first == 'personal' ? params : new URLSearchParams());
    if (state.isAdmin) {
        team = await import('./views/team.js');
        await team.init($('#views'), first == 'team' ? params : new URLSearchParams());
    }

    window.addEventListener('hashchange', route);
    route();
    watchSession(showSignIn);
    loadingDone();
}

function renderShell() {
    $$('.company-name').forEach((el) => {
        el.textContent = state.config.companyName;
    });
    const name = state.displayName || state.user || 'Unknown user';
    $('#user-name').textContent = name;
    $('#user-initials').textContent = initials(name);
    $('#user-menu').setAttribute('aria-label', 'Account: ' + name);
    $('#user-role').innerHTML = state.isAdmin ? '<i class="bi bi-shield-check me-1" aria-hidden="true"></i>Admin' : 'Member';
    if (state.config.calendarLink) {
        $('#calendar-link').href = state.config.calendarLink;
    }
    show($('#calendar-item'), !!state.config.calendarLink);
    show($('#app'), true);
}

// "Priya Sharma" -> "PS", "Priya" -> "PR"
function initials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return (parts[0] || '?').substring(0, 2).toUpperCase();
}

function currentView() {
    const view = window.location.hash.replace(/^#/, '');
    return view == 'team' && state.isAdmin ? 'team' : 'personal';
}

function route() {
    const view = currentView();
    if (window.location.hash != '#' + view && window.location.hash) {
        // e.g. #team for a non admin
        history.replaceState(null, '', '#' + view);
    }
    $$('.view-tabs .nav-link').forEach((tab) => {
        const active = tab.getAttribute('href') == '#' + view;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        if (active) {
            tab.setAttribute('aria-current', 'page');
        } else {
            tab.removeAttribute('aria-current');
        }
    });
    show($('#view-personal'), view == 'personal');
    if (team) {
        team.setVisible(view == 'team');
    }
    document.title = (view == 'team' ? 'Team' : 'Personal') + ' · ' + state.config.companyName + ' Leave';
}
