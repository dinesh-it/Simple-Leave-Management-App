// Microsoft identity (MSAL) and Microsoft Graph helpers
var GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
var GRAPH_SCOPES = ['User.Read', 'Group.ReadWrite.All', 'Files.Read.All'];
var GRAPH_TIME_ZONE = 'India Standard Time';

var msalInstance = null;
var msal_ready = null;

// Resolves with the signed in account (or null) once MSAL is initialized
function msal_init() {
    if (!msal_ready) {
        msalInstance = new msal.PublicClientApplication({
            auth: {
                clientId: CLIENT_ID,
                authority: 'https://login.microsoftonline.com/' + TENANT_ID,
                redirectUri: window.location.origin + window.location.pathname
            },
            cache: {
                cacheLocation: 'localStorage'
            }
        });
        msal_ready = msalInstance.initialize().then(function() {
            if (!msalInstance.getActiveAccount()) {
                var accounts = msalInstance.getAllAccounts();
                if (accounts.length) {
                    msalInstance.setActiveAccount(accounts[0]);
                }
            }
        });
    }
    // Always the current account, it changes after login / logout
    return msal_ready.then(function() {
        return msalInstance.getActiveAccount();
    });
}

function msal_account() {
    return msalInstance ? msalInstance.getActiveAccount() : null;
}

function msal_login() {
    return msal_init().then(function() {
        return msalInstance.loginPopup({
            scopes: GRAPH_SCOPES,
            prompt: 'select_account'
        });
    }).then(function(result) {
        msalInstance.setActiveAccount(result.account);
        return result.account;
    });
}

// Signs out of this app only, the browser's Microsoft session is kept
function msal_logout() {
    return msal_init().then(function(account) {
        return msalInstance.clearCache({
            account: account
        });
    });
}

// interactive: allow a popup when silent renewal needs user interaction (user triggered actions only)
function get_token(interactive) {
    return msal_init().then(function(account) {
        if (!account) {
            throw new Error('Not signed in');
        }
        var request = {
            scopes: GRAPH_SCOPES,
            account: account
        };
        return msalInstance.acquireTokenSilent(request).catch(function(err) {
            if (interactive && err instanceof msal.InteractionRequiredAuthError) {
                return msalInstance.acquireTokenPopup(request);
            }
            throw err;
        });
    }).then(function(result) {
        return result.accessToken;
    });
}

function graph_request(method, url, body, interactive) {
    if (url.indexOf('https://') !== 0) {
        url = GRAPH_BASE + url;
    }
    return get_token(interactive).then(function(token) {
        var options = {
            method: method,
            headers: {
                'Authorization': 'Bearer ' + token,
                'Prefer': 'outlook.timezone="' + GRAPH_TIME_ZONE + '"'
            }
        };
        if (body) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        return fetch(url, options);
    }).then(function(resp) {
        return resp.text().then(function(text) {
            var data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch (e) {
                data = {};
            }
            if (!resp.ok) {
                var err = new Error((data.error && data.error.message) || resp.status + ' ' + resp.statusText);
                err.status = resp.status;
                err.code = data.error && data.error.code;
                throw err;
            }
            return data;
        });
    });
}

function graph_get(url) {
    return graph_request('GET', url);
}

function graph_post(url, body, interactive) {
    return graph_request('POST', url, body, interactive);
}

// Follows @odata.nextLink and resolves with all items of a collection
function graph_get_all(url) {
    var items = [];

    function next(page_url) {
        return graph_get(page_url).then(function(data) {
            items = items.concat(data.value || []);
            if (data['@odata.nextLink']) {
                return next(data['@odata.nextLink']);
            }
            return items;
        });
    }
    return next(url);
}

// Shares API id for a OneDrive/SharePoint sharing link
function graph_share_id(sharing_url) {
    var b64 = btoa(unescape(encodeURIComponent(sharing_url)));
    return 'u!' + b64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
}

// Graph event -> the Google Calendar shaped event the report code works with
function to_legacy_event(ev) {
    var start, end;
    if (ev.isAllDay) {
        start = { date: ev.start.dateTime.substring(0, 10) };
        end = { date: ev.end.dateTime.substring(0, 10) };
    } else {
        start = { dateTime: ev.start.dateTime };
        end = { dateTime: ev.end.dateTime };
    }
    return {
        id: ev.id,
        summary: ev.subject,
        start: start,
        end: end
    };
}
