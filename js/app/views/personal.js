// Personal view: only the signed in user's own leave, for everyone (admins included)
import { state, loadRange, onRefresh } from '../state.js';
import * as leave from '../leave.js';
import { LeaveTable } from '../components/table.js';
import { downloadSheet } from '../export.js';
import { drawBarChart, monthChartData, onThemeChange } from '../components/charts.js';
import { $, esc, fmt, typeToggles, checkedValues, typeBadge, dateValue, parseDateInput, showAlert } from '../components/ui.js';

const UPCOMING_COUNT = 5;
const TYPE_NAMES = {
    PL: 'Personal Leave', SL: 'Sick Leave', OPH: 'Optional Holiday', WFH: 'Work From Home', ML: 'Marriage Leave', PTL: 'Paternity Leave',
    MTL: 'Maternity Leave', CO: 'Comp Off', RL: 'Relocation Leave', LOP: 'Loss Of Pay'
};

let root;
let table;
let range;
let rows = [];

export async function init(container, params) {
    root = container;
    root.innerHTML = template();
    range = initialRange(params);
    $('#my-from', root).value = dateValue(range[0]);
    $('#my-to', root).value = dateValue(range[1]);

    table = new LeaveTable($('#my-leaves-table', root), columns(), {
        label: 'My leaves',
        sort: { key: 'date', dir: 'desc' },
        rowClass: (row) => 'row-' + leave.highlight(row),
        empty: emptyMessage
    });

    $('#my-types', root).addEventListener('change', renderList);
    $('#my-search', root).addEventListener('input', (e) => {
        table.setSearch(e.target.value);
        renderChart();
    });
    onThemeChange(renderChart);
    $('#my-range', root).addEventListener('submit', (e) => {
        e.preventDefault();
        applyRange();
    });
    $('#my-download', root).addEventListener('click', download);

    if (params.get('search')) {
        $('#my-search', root).value = params.get('search');
        table.setSearch(params.get('search'));
    }

    await refresh();
    onRefresh(refresh);
}

function template() {
    // Personal list shows every leave type except birthdays and unknown ones, which can be turned on
    const types = (state.config.typeFilter || []).filter((t) => t != '-');
    const checked = types.filter((t) => t != 'HBD');
    return `
    <div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
        <h1 class="h4 mb-0">Hi ${esc(state.user || 'there')}</h1>
        <span class="text-body-secondary small">Only your own leave is shown here</span>
    </div>

    <h2 class="h6 text-uppercase text-body-secondary fw-semibold mb-2">My leave balance <span class="fw-normal">${esc(moment().format('YYYY'))}</span></h2>
    <div class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 g-3 mb-4" id="balance-cards"></div>

    <div class="row g-4 mb-4">
        <div class="col-lg-4">
            <div class="card h-100">
                <div class="card-header bg-transparent fw-semibold"><i class="bi bi-calendar-event me-2 text-primary" aria-hidden="true"></i>Upcoming</div>
                <ul class="list-group list-group-flush" id="upcoming"></ul>
            </div>
        </div>
        <div class="col-lg-8">
            <div class="card h-100">
                <div class="card-header bg-transparent d-flex flex-wrap align-items-baseline gap-2">
                    <span class="fw-semibold me-auto"><i class="bi bi-bar-chart me-2 text-primary" aria-hidden="true"></i>Leave days per month</span>
                    <span class="small text-body-secondary" id="my-chart-range"></span>
                </div>
                <div class="card-body">
                    <div class="chart-box" style="height: 240px"><canvas id="my-chart-month" role="img" aria-label="My leave days per month by type"></canvas></div>
                    <p class="text-body-secondary text-center my-5 d-none" id="my-chart-month-empty">No leave in this range</p>
                </div>
            </div>
        </div>
    </div>

    <div class="row g-4">
        <div class="col-12">
            <div class="card">
                <div class="card-header bg-transparent d-flex flex-wrap align-items-center gap-2">
                    <span class="fw-semibold me-auto"><i class="bi bi-list-ul me-2 text-primary" aria-hidden="true"></i>My leaves</span>
                    ${legend()}
                    <button type="button" class="btn btn-sm btn-outline-secondary" id="my-download"><i class="bi bi-download me-1" aria-hidden="true"></i>Download</button>
                </div>
                <div class="card-body">
                    <form class="row g-2 align-items-end mb-2" id="my-range">
                        <div class="col-6 col-md-4">
                            <label class="form-label small mb-1" for="my-from">From</label>
                            <input type="date" class="form-control form-control-sm" id="my-from" required>
                        </div>
                        <div class="col-6 col-md-4">
                            <label class="form-label small mb-1" for="my-to">To</label>
                            <input type="date" class="form-control form-control-sm" id="my-to" required>
                        </div>
                        <div class="col-12 col-md-4">
                            <button type="submit" class="btn btn-sm btn-primary w-100"><i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>Show range</button>
                        </div>
                    </form>
                    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
                        <div class="type-toggles" id="my-types" role="group" aria-label="Leave types">${typeToggles('my-type', types, checked)}</div>
                        <input type="search" class="form-control form-control-sm ms-md-auto search-input" id="my-search" placeholder="Search" aria-label="Search my leaves">
                    </div>
                    <div id="my-leaves-table"></div>
                </div>
            </div>
        </div>
    </div>`;
}

export function legend() {
    return '<span class="d-none d-sm-inline-flex gap-1 small" aria-label="Highlights">' +
        '<span class="hl-chip hl-today">Today</span><span class="hl-chip hl-tomorrow">Tomorrow</span><span class="hl-chip hl-future">Future</span></span>';
}

function columns() {
    return [
        { key: 'type', label: 'Type', value: (r) => r.type, html: (r) => typeBadge(r.type) },
        { key: 'date', label: 'Start date', value: (r) => r.date, className: 'text-nowrap' },
        { key: 'day', label: 'Day', value: (r) => r.day, hideXs: true },
        { key: 'dates', label: 'Dates', value: (r) => r.dates, hideXs: true },
        { key: 'days', label: 'Days', value: (r) => r.days, html: (r) => esc(fmt(r.days)), className: 'text-end' }
    ];
}

function initialRange(params) {
    const [from, to] = leave.yearRange();
    const f = params.get('from') && moment(params.get('from'), 'MM/DD/YYYY', true);
    const t = params.get('to') && moment(params.get('to'), 'MM/DD/YYYY', true);
    if (f && t && f.isValid() && t.isValid() && !t.isBefore(f)) {
        return [f.startOf('day'), t.endOf('day')];
    }
    return [from, to];
}

function emptyMessage() {
    if (!state.user) {
        return 'Could not read your Microsoft profile, so no leave can be shown.';
    }
    const name = esc(state.user);
    return 'No leave found for ' + name + ' in this range.<br>Events must be titled <code>TYPE: ' + name + '</code>, e.g. <code>PL: ' + name + '</code>.';
}

async function refresh() {
    renderBalance();
    await Promise.all([renderUpcoming(), loadList()]);
}

// Balance cards: current year only, never affected by the range or the filters
function renderBalance() {
    const used = leave.computeBalance(state.yearOwn);
    const types = Object.keys(state.config.eventLimits || {});
    const box = $('#balance-cards', root);
    if (!types.length) {
        box.innerHTML = '<div class="col-12 text-body-secondary">No leave limits are configured.</div>';
        return;
    }
    box.innerHTML = types.map((type) => {
        const u = used[type] || 0;
        const base = state.config.eventLimits[type] || 0;
        const limit = leave.userLimit(state.config, type, state.user);
        const remain = limit - u;
        const stateCls = leave.usageState(u, limit);
        const percent = limit > 0 ? Math.min((u / limit) * 100, 100) : 0;
        // Over the limit: "Over by N" instead of a negative number
        const second = remain < 0 ?
            '<div class="balance-stat balance-over"><span class="balance-value">' + esc(fmt(-remain)) + '</span><span class="balance-label">Over by</span></div>' :
            '<div class="balance-stat"><span class="balance-value">' + esc(fmt(remain)) + '</span><span class="balance-label">Available</span></div>';
        const extra = limit - base;
        const limitText = 'Limit ' + fmt(limit) + (extra > 0 ? ' (incl. ' + fmt(extra) + ' extra)' : '');
        return `<div class="col"><div class="card balance-card h-100 is-${stateCls}" data-type="${esc(type)}">
            <div class="card-body">
                <div class="d-flex align-items-center gap-2 mb-2">${typeBadge(type)}<span class="small text-body-secondary text-truncate">${esc(TYPE_NAMES[type] || '')}</span></div>
                <div class="balance-stats">
                    <div class="balance-stat balance-taken"><span class="balance-value">${esc(fmt(u))}</span><span class="balance-label">Taken</span></div>
                    ${second}
                </div>
                <div class="progress mb-2" role="progressbar" aria-label="${esc(type)} taken" aria-valuenow="${esc(fmt(u))}" aria-valuemin="0" aria-valuemax="${esc(fmt(limit))}">
                    <div class="progress-bar" style="width: ${percent}%"></div>
                </div>
                <div class="small text-body-secondary balance-meta">${esc(limitText)}</div>
            </div></div></div>`;
    }).join('');
}

async function renderUpcoming() {
    const today = moment().startOf('day');
    const until = today.clone().add(6, 'months').endOf('day');
    const box = $('#upcoming', root);
    try {
        const { own } = await loadRange(today, until);
        const next = leave.upcoming(leave.toRows(own, today, until), moment(), UPCOMING_COUNT);
        box.innerHTML = next.map((row) => {
            const hl = leave.highlight(row);
            const when = row.last.isSame(row.start, 'day') ?
                row.start.format('ddd, D MMM') :
                row.start.format('ddd, D MMM') + ' – ' + row.last.format('ddd, D MMM');
            const badge = hl == 'today' ? '<span class="hl-chip hl-today">Today</span>' :
                hl == 'tomorrow' ? '<span class="hl-chip hl-tomorrow">Tomorrow</span>' : '';
            return `<li class="list-group-item d-flex align-items-center gap-2">
                ${typeBadge(row.type)}
                <span class="me-auto">${esc(when)}${leave.isHalfDay(row.type) ? ' <span class="text-body-secondary small">(half day)</span>' : ''}</span>
                ${badge}<span class="text-body-secondary small text-nowrap">${esc(fmt(row.days))} d</span></li>`;
        }).join('') || '<li class="list-group-item text-body-secondary">No upcoming leave</li>';
    } catch (e) {
        console.log('Failed to get upcoming leave: ', e);
        box.innerHTML = '<li class="list-group-item text-danger">Could not load upcoming leave</li>';
    }
}

async function loadList() {
    try {
        const { own } = await loadRange(range[0], range[1]);
        rows = leave.toRows(own, range[0], range[1]);
    } catch (e) {
        console.log('Failed to get events: ', e);
        rows = [];
        showAlert('Calendar', 'Failed to get your leave!\n' + e.message);
    }
    renderList();
}

function renderList() {
    const types = checkedValues(root, 'my-type');
    table.setRows(rows.filter((row) => types.indexOf(leave.baseType(row.type)) >= 0));
    renderChart();
}

// Own leave days per month, for exactly the rows My leaves shows (range, types and search)
function renderChart() {
    $('#my-chart-range', root).textContent = range[0].format('D MMM YYYY') + ' – ' + range[1].format('D MMM YYYY') + ' · follows the My leaves filters';
    drawBarChart($('#my-chart-month', root), $('#my-chart-month-empty', root), monthChartData(state.config, table.filtered()), false);
}

async function applyRange() {
    const from = parseDateInput($('#my-from', root).value);
    const to = parseDateInput($('#my-to', root).value);
    if (!from || !to || to.isBefore(from)) {
        showAlert('Date range', 'Please choose a From date on or before the To date.');
        return;
    }
    range = [from.startOf('day'), to.endOf('day')];
    await loadList();
}

function download() {
    const header = ['Type', 'Start Date', 'Day', 'Dates', 'Total Days'];
    const data = table.filtered().map((r) => [r.type, r.date, r.day, r.dates, r.days]);
    downloadSheet('my-leave', 'My leave', [header].concat(data));
}
