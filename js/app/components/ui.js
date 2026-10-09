// Small DOM helpers shared by the views: escaping, toasts, the alert dialog and the loading indicator

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Every value from the calendar or the config goes through esc() before it is put into HTML
export function esc(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

// 1, 0.5, 11.5 (no trailing zeros)
export function fmt(n) {
    return String(Math.round(n * 10) / 10);
}

export function plural(n, word) {
    return fmt(n) + ' ' + word + (n == 1 ? '' : 's');
}

export function show(el, visible) {
    el.classList.toggle('d-none', !visible);
}

// Message dialog, replaces alert(). Newlines in message become line breaks.
export function showAlert(title, message) {
    const modal = $('#alert-modal');
    $('.modal-title', modal).textContent = title || 'Alert';
    $('.modal-body', modal).innerHTML = esc(message).replace(/\n/g, '<br>');
    bootstrap.Modal.getOrCreateInstance(modal).show();
}

// Short notice in the corner, variant: success | danger | warning | info
export function toast(message, variant = 'success') {
    const el = document.createElement('div');
    el.className = 'toast align-items-center border-0 text-bg-' + variant;
    el.setAttribute('role', variant == 'danger' ? 'alert' : 'status');
    el.setAttribute('aria-live', variant == 'danger' ? 'assertive' : 'polite');
    el.innerHTML = '<div class="d-flex"><div class="toast-body">' + esc(message) + '</div>' +
        '<button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>';
    $('#toast-area').appendChild(el);
    el.addEventListener('hidden.bs.toast', () => el.remove());
    bootstrap.Toast.getOrCreateInstance(el, { delay: 5000 }).show();
}

// Full page loading indicator with a message
export function loading(message) {
    $('#loading-msg').textContent = message || 'Loading...';
    show($('#loading'), true);
}

export function loadingDone() {
    show($('#loading'), false);
}

// Toggle buttons for leave types, values are base types (PL also matches HPL)
export function typeToggles(name, types, checked) {
    return types.map((t) => {
        const id = name + '-' + (t == '-' ? 'other' : t);
        return '<input type="checkbox" class="btn-check" name="' + esc(name) + '" id="' + esc(id) + '" value="' + esc(t) + '"' +
            (checked.indexOf(t) >= 0 ? ' checked' : '') + ' autocomplete="off">' +
            '<label class="btn btn-sm btn-outline-secondary type-toggle" for="' + esc(id) + '">' + esc(t == '-' ? 'Other' : t) + '</label>';
    }).join('');
}

export function checkedValues(root, name) {
    return $$('input[name="' + name + '"]:checked', root).map((el) => el.value);
}

export function typeBadge(type) {
    return '<span class="badge type-badge" data-type="' + esc(type.replace(/^H(?!BD)/, '')) + '">' + esc(type) + '</span>';
}

// <input type=date> value <-> moment
export function dateValue(m) {
    return m.format('YYYY-MM-DD');
}

export function parseDateInput(value) {
    const m = moment(value, 'YYYY-MM-DD', true);
    return m.isValid() ? m : null;
}
