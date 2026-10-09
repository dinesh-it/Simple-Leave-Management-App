// Add Leave dialog: quick dates, half days, balance hints, a review step, then the Graph event and Slack post
import { state, refreshAll } from './state.js';
import { createEvent } from './calendar.js';
import { checkSession } from './session.js';
import { computeBalance, userLimit } from './leave.js';
import { $, esc, fmt, show, toast, dateValue, parseDateInput } from './components/ui.js';

const PARTS = { FULL: '', FH: 'First Half', SH: 'Second Half' };
let modal;
let used = {};
let pending = null;

export function init() {
    modal = $('#add-leave-modal');

    // Non admins can only add leave for themselves: no title field at all
    if (!state.isAdmin) {
        $('#al-title-group').remove();
    }

    modal.addEventListener('show.bs.modal', open);
    $('#al-type').addEventListener('change', () => {
        updateTypeInfo();
        updateDaysInfo();
        updateTitle();
    });
    $('#al-when').addEventListener('change', applyWhen);
    modal.querySelectorAll('input[name="al-part"]').forEach((el) => el.addEventListener('change', applyPart));
    $('#al-days').addEventListener('input', syncTo);
    $('#al-from').addEventListener('change', syncTo);
    $('#al-to').addEventListener('change', syncDays);
    $('#al-next').addEventListener('click', review);
    $('#al-back').addEventListener('click', () => step('form'));
    $('#al-confirm').addEventListener('click', confirm);
    $('#al-form').addEventListener('submit', (e) => {
        e.preventDefault();
        review();
    });
}

function open() {
    used = computeBalance(state.yearOwn);
    pending = null;
    show($('#al-error'), false);
    step('form');
    $('#al-when').value = 'today';
    applyWhen();
    updateTypeInfo();
    updateTitle();
}

function step(name) {
    const reviewing = name == 'review';
    show($('#al-step-form'), !reviewing);
    show($('#al-step-review'), reviewing);
    show($('#al-next'), !reviewing);
    show($('#al-back'), reviewing);
    show($('#al-confirm'), reviewing);
    show($('#al-cancel'), !reviewing);
    if (reviewing) {
        $('#al-confirm').focus();
    }
}

const part = () => modal.querySelector('input[name="al-part"]:checked').value;
const type = () => $('#al-type').value;
const isFull = () => part() == 'FULL';

function remaining(t) {
    return userLimit(state.config, t, state.user) - (used[t] || 0);
}

// Remaining balance of the selected type, before this request
function updateTypeInfo() {
    const t = type();
    const info = $('#al-type-info');
    if (!(state.config.eventLimits || {})[t]) {
        info.textContent = '';
        return;
    }
    const remain = remaining(t);
    info.innerHTML = remain > 0 ?
        '<i class="bi bi-info-circle me-1" aria-hidden="true"></i>' + esc(fmt(remain)) + ' day' + (remain == 1 ? '' : 's') + ' of ' + esc(t) + ' remaining<sup>*</sup>' :
        '<i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>You have no ' + esc(t) + ' remaining<sup>*</sup>';
}

function requestedDays() {
    if (!isFull()) {
        return 0.5;
    }
    return Math.max(parseInt($('#al-days').value, 10) || 1, 1);
}

// Balance after this request
function updateDaysInfo() {
    const t = type();
    const info = $('#al-days-info');
    info.className = 'form-text mb-3';
    if (!(state.config.eventLimits || {})[t]) {
        info.textContent = '';
        return;
    }
    const after = remaining(t) - requestedDays();
    if (after < 0) {
        info.classList.add('text-danger');
        info.textContent = fmt(-after) + ' day' + (after == -1 ? '' : 's') + ' over limit (LOP) after this request';
    } else {
        info.textContent = fmt(after) + ' day' + (after == 1 ? '' : 's') + ' remaining after this request';
    }
}

function ownTitle() {
    return (isFull() ? '' : 'H') + type() + ': ' + state.user;
}

function updateTitle() {
    if (state.isAdmin) {
        $('#al-title').value = ownTitle();
    }
}

// Quick choice: today / tomorrow / yesterday, moved to a working day when it is a holiday or weekend
function applyWhen() {
    const when = $('#al-when').value;
    const info = $('#al-when-info');
    info.textContent = '';
    let date = moment().startOf('day');
    if (when == 'tomorrow') {
        date.add(1, 'day');
    } else if (when == 'yesterday') {
        date.subtract(1, 'day');
    }
    if (when == 'other') {
        $('#al-from').focus();
    } else if (!date.isBusinessDay()) {
        const label = when.charAt(0).toUpperCase() + when.slice(1);
        date = when == 'yesterday' ? date.prevBusinessDay() : date.nextBusinessDay();
        info.textContent = label + ' is a holiday, using ' + date.format('ddd, D MMM') + ' instead.';
        $('#al-when').value = 'other';
    }
    $('#al-from').value = dateValue(date);
    $('#al-days').value = 1;
    syncTo();
}

function applyPart() {
    const full = isFull();
    $('#al-from-label').textContent = full ? 'From' : 'On';
    show($('#al-days-col'), full);
    show($('#al-to-col'), full);
    if (!full) {
        $('#al-days').value = 1;
    }
    syncTo();
    updateTitle();
}

function holidayNote(el, date) {
    el.textContent = date && !date.isBusinessDay() ? 'This day is a holiday or weekend' : '';
}

// From + days -> To
function syncTo() {
    const from = parseDateInput($('#al-from').value);
    holidayNote($('#al-from-info'), from);
    if (from) {
        const days = Math.max(parseInt($('#al-days').value, 10) || 1, 1);
        const to = from.clone().businessAdd(days - 1, 'days');
        $('#al-to').min = dateValue(from);
        $('#al-to').value = dateValue(to);
        holidayNote($('#al-to-info'), to);
    }
    updateDaysInfo();
}

// From + To -> days
function syncDays() {
    const from = parseDateInput($('#al-from').value);
    const to = parseDateInput($('#al-to').value);
    holidayNote($('#al-to-info'), to);
    if (from && to && !to.isBefore(from)) {
        $('#al-days').value = from.businessDiff(to) + 1;
    }
    updateDaysInfo();
}

function fail(message) {
    const box = $('#al-error');
    box.textContent = message;
    show(box, true);
}

function review() {
    show($('#al-error'), false);
    if (!state.calendar) {
        fail('The leave calendar is not available, please reload the page.');
        return;
    }
    if (!state.user) {
        fail('Could not read your Microsoft profile, please sign in again.');
        return;
    }
    const from = parseDateInput($('#al-from').value);
    const to = isFull() ? parseDateInput($('#al-to').value) : from;
    if (!from || !to) {
        fail('Please choose the date(s).');
        return;
    }
    if (to.isBefore(from)) {
        fail('The To date must be on or after the From date.');
        return;
    }

    // Non admins: always TYPE: own name, nothing from the form is used
    let title = ownTitle();
    if (state.isAdmin) {
        title = $('#al-title').value.trim() || ownTitle();
    }

    const p = PARTS[part()];
    const description = $('#al-description').value.trim();
    pending = {
        title,
        from: dateValue(from),
        to: dateValue(to),
        part: p,
        location: $('#al-location').value.trim(),
        description: (p ? '(' + p + ') ' : '') + description,
        slackDescription: description
    };

    $('#al-review-calendar').textContent = state.calendar.name;
    const rows = [['Title', title], [p ? 'On' : 'From', from.format('ddd, D MMM YYYY')]];
    if (!p) {
        rows.push(['To', to.format('ddd, D MMM YYYY')]);
    } else {
        rows.push(['Part', p]);
    }
    if (pending.location) {
        rows.push(['Location', pending.location]);
    }
    if (description) {
        rows.push(['Description', description]);
    }
    $('#al-review').innerHTML = rows.map(([k, v]) => '<dt class="col-4 col-sm-3">' + esc(k) + '</dt><dd class="col-8 col-sm-9">' + esc(v) + '</dd>').join('');
    step('review');
}

async function confirm() {
    if (!pending) {
        return;
    }
    const event = pending;
    const btn = $('#al-confirm');
    btn.disabled = true;
    show($('#al-error'), false);
    try {
        if (!(await checkSession())) {
            bootstrap.Modal.getOrCreateInstance(modal).hide();
            return;
        }
        const created = await createEvent(state.calendar.groupId, event);
        if (!created || !created.id) {
            throw new Error('Something went wrong, the event was not created');
        }
        pending = null;
        bootstrap.Modal.getOrCreateInstance(modal).hide();
        notify_slack_event_created({
            title: event.title,
            from: event.from,
            to: event.to,
            part: event.part,
            description: event.slackDescription,
            calendar: state.calendar.name,
            created_by: state.user
        });
        toast('Added ' + event.title + ' (' + (event.from == event.to ? event.from : event.from + ' to ' + event.to) + ')');
        await refreshAll();
    } catch (e) {
        console.log('Failed to create event: ', e);
        if (e.status == 403) {
            fail('Microsoft 365 did not allow adding events to the calendar "' + state.calendar.name + '". ' +
                'You need to be a member of the "' + state.calendar.name + '" group (ask its owner). (' + e.message + ')');
        } else {
            fail('Failed to add the event: ' + e.message);
        }
    } finally {
        btn.disabled = false;
    }
}
