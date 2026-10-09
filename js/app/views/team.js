// Team view: everyone's leave, for admins only. main.js imports this module only when the user is an admin,
// so for everyone else none of this markup exists on the page.
import { state, loadRange, onRefresh } from '../state.js';
import * as leave from '../leave.js';
import { LeaveTable } from '../components/table.js';
import { downloadSheet } from '../export.js';
import { legend } from './personal.js';
import { drawBarChart, monthChartData, typeColor, typeOrder, onThemeChange } from '../components/charts.js';
import { $, $$, esc, fmt, show, typeToggles, checkedValues, typeBadge, dateValue, parseDateInput, showAlert } from '../components/ui.js';

let section;
let table;
let range;
let rows = [];
let visible = false;

export async function init(views, params) {
    $('.view-tabs').insertAdjacentHTML('beforeend',
        '<li class="nav-item" role="presentation"><a class="nav-link" id="tab-team" href="#team" role="tab" aria-controls="view-team" aria-selected="false">' +
        'Team</a></li>');

    section = document.createElement('section');
    section.id = 'view-team';
    section.className = 'd-none';
    section.setAttribute('role', 'tabpanel');
    section.setAttribute('aria-labelledby', 'tab-team');
    section.innerHTML = template();
    views.appendChild(section);
    document.body.insertAdjacentHTML('beforeend', monthlyModal());

    range = initialRange(params);
    $('#team-from', section).value = dateValue(range[0]);
    $('#team-to', section).value = dateValue(range[1]);

    table = new LeaveTable($('#team-table', section), columns(), {
        label: 'Team leaves',
        pageSize: 50,
        sort: { key: 'date', dir: 'desc' },
        rowClass: (row) => 'row-' + leave.highlight(row),
        empty: () => 'No leave matches the filters'
    });

    $('#team-person', section).addEventListener('change', update);
    $('#team-types', section).addEventListener('change', update);
    $('#team-search', section).addEventListener('input', (e) => {
        table.setSearch(e.target.value);
        renderDerived();
    });
    $('#team-range', section).addEventListener('submit', (e) => {
        e.preventDefault();
        applyRange();
    });
    $('#team-download', section).addEventListener('click', download);
    $('#team-summary', section).addEventListener('click', selectPerson);
    $('#summary-search', section).addEventListener('input', () => renderSummary(table.filtered()));
    $('#team-summary', section).addEventListener('keydown', (e) => {
        if (e.key == 'Enter' || e.key == ' ') {
            e.preventDefault();
            selectPerson(e);
        }
    });
    $('#team-clear-person', section).addEventListener('click', () => {
        $('#team-person', section).value = '';
        update();
    });
    $('#monthly-download').addEventListener('click', downloadMonthly);
    $('#monthly-modal').addEventListener('show.bs.modal', renderMonths);
    onThemeChange(() => renderCharts(table.filtered()));

    if (params.get('search')) {
        $('#team-search', section).value = params.get('search');
        table.setSearch(params.get('search'));
    }

    await refresh();
    onRefresh(refresh);
}

export function setVisible(v) {
    visible = v;
    show(section, v);
    if (v) {
        ['#chart-month', '#chart-person'].forEach((id) => {
            const chart = Chart.getChart($(id, section));
            if (chart) {
                chart.resize();
            }
        });
    }
}

function template() {
    const types = state.config.typeFilter || [];
    const removed = state.config.removeEvents || [];
    const checked = types.filter((t) => removed.indexOf(t) < 0);
    return `
    <div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
        <h1 class="h4 mb-0">Team</h1>
        <span class="text-body-secondary small"><i class="bi bi-shield-check me-1" aria-hidden="true"></i>Everyone's leave, visible to admins only</span>
    </div>

    <div class="row g-4 mb-4">
        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header bg-transparent d-flex flex-wrap align-items-baseline gap-2">
                    <span class="fw-semibold me-auto"><i class="bi bi-bar-chart me-2 text-primary" aria-hidden="true"></i>Month wise</span>
                    <span class="small text-body-secondary">follows the Team leaves filters</span>
                </div>
                <div class="card-body"><div class="chart-box" id="chart-month-box"><canvas id="chart-month" aria-label="Leave days per month by type" role="img"></canvas></div>
                    <p class="text-body-secondary text-center my-5 d-none" id="chart-month-empty">No data</p></div>
            </div>
        </div>
        <div class="col-lg-6">
            <!-- Who's out: Today and Later this week as tabs of one card -->
            <div class="card h-100 whos-out-card">
                <div class="card-header bg-transparent d-flex align-items-stretch gap-2 py-0">
                    <span class="fw-semibold me-2 py-2 d-flex align-items-center"><i class="bi bi-person-x me-2 text-primary" aria-hidden="true"></i>Who's out</span>
                    <ul class="nav nav-underline whos-out-tabs ms-auto" role="tablist">
                        <li class="nav-item" role="presentation">
                            <button class="nav-link active" id="out-tab-today" data-bs-toggle="tab" data-bs-target="#out-today" type="button" role="tab" aria-controls="out-today" aria-selected="true">Today <span class="tab-date">${esc(moment().format('ddd, D MMM'))}</span></button>
                        </li>
                        <li class="nav-item" role="presentation">
                            <button class="nav-link" id="out-tab-week" data-bs-toggle="tab" data-bs-target="#out-week-pane" type="button" role="tab" aria-controls="out-week-pane" aria-selected="false">Later this week</button>
                        </li>
                    </ul>
                </div>
                <div class="tab-content whos-out-body">
                    <div class="tab-pane fade show active card-body" id="out-today" role="tabpanel" aria-labelledby="out-tab-today" tabindex="0" aria-live="polite"></div>
                    <div class="tab-pane fade" id="out-week-pane" role="tabpanel" aria-labelledby="out-tab-week" tabindex="0">
                        <ul class="list-group list-group-flush" id="out-week"></ul>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="card mb-4">
        <div class="card-header bg-transparent d-flex flex-wrap align-items-baseline gap-2">
            <span class="fw-semibold me-auto"><i class="bi bi-people me-2 text-primary" aria-hidden="true"></i>Person wise</span>
            <span class="small text-body-secondary">follows the Team leaves filters</span>
        </div>
        <div class="card-body"><div class="chart-box" id="chart-person-box"><canvas id="chart-person" aria-label="Leave days per person by type" role="img"></canvas></div>
            <p class="text-body-secondary text-center my-5 d-none" id="chart-person-empty">No data</p></div>
    </div>

    <div class="row g-4">
    <div class="col-xl-8">
    <div class="card h-100">
        <div class="card-header bg-transparent d-flex flex-wrap align-items-center gap-2">
            <span class="fw-semibold me-auto"><i class="bi bi-list-ul me-2 text-primary" aria-hidden="true"></i>Team leaves</span>
            ${legend()}
            <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-toggle="modal" data-bs-target="#monthly-modal"><i class="bi bi-file-earmark-spreadsheet me-1" aria-hidden="true"></i>Monthly report</button>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="team-download"><i class="bi bi-download me-1" aria-hidden="true"></i>Download</button>
        </div>
        <div class="card-body">
            <form class="row g-2 align-items-end mb-2" id="team-range">
                <div class="col-12 col-md-3">
                    <label class="form-label small mb-1" for="team-person">Person</label>
                    <div class="input-group input-group-sm">
                        <select class="form-select" id="team-person"><option value="">Everyone</option></select>
                        <button class="btn btn-outline-secondary" type="button" id="team-clear-person" aria-label="Show everyone"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
                    </div>
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label small mb-1" for="team-from">From</label>
                    <input type="date" class="form-control form-control-sm" id="team-from" required>
                </div>
                <div class="col-6 col-md-3">
                    <label class="form-label small mb-1" for="team-to">To</label>
                    <input type="date" class="form-control form-control-sm" id="team-to" required>
                </div>
                <div class="col-12 col-md-3">
                    <button type="submit" class="btn btn-sm btn-primary w-100"><i class="bi bi-arrow-repeat me-1" aria-hidden="true"></i>Show range</button>
                </div>
            </form>
            <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
                <div class="type-toggles" id="team-types" role="group" aria-label="Leave types">${typeToggles('team-type', types, checked)}</div>
                <input type="search" class="form-control form-control-sm ms-md-auto search-input" id="team-search" placeholder="Search" aria-label="Search team leaves">
            </div>
            <div id="team-table"></div>
        </div>
    </div>
    </div>

    <div class="col-xl-4">
    <div class="card h-100">
        <div class="card-header bg-transparent fw-semibold"><i class="bi bi-table me-2 text-primary" aria-hidden="true"></i>Per person <span class="fw-normal small text-body-secondary">(days, current filters)</span></div>
        <div class="card-body">
            <input type="search" class="form-control form-control-sm mb-3" id="summary-search" placeholder="Search person" aria-label="Search the per person summary">
            <div class="table-responsive" id="team-summary"></div>
        </div>
    </div>
    </div>
    </div>`;
}

function monthlyModal() {
    return `
    <div class="modal fade" id="monthly-modal" tabindex="-1" aria-labelledby="monthly-title" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title h5" id="monthly-title">Monthly report <span class="text-body-secondary fw-normal" id="monthly-year"></span></h2>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <p class="mb-2">Choose the month(s) to download. The report lists each person's leave dates per type.</p>
                    <div class="row row-cols-3 g-2" id="monthly-months"></div>
                    <div class="alert alert-warning mt-3 mb-0 d-none" id="monthly-error" role="alert"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="button" class="btn btn-primary" id="monthly-download"><i class="bi bi-download me-1" aria-hidden="true"></i>Download</button>
                </div>
            </div>
        </div>
    </div>`;
}

function columns() {
    return [
        { key: 'type', label: 'Type', value: (r) => r.type, html: (r) => typeBadge(r.type) },
        { key: 'name', label: 'Name', value: (r) => r.name },
        { key: 'date', label: 'Start date', value: (r) => r.date, className: 'text-nowrap' },
        { key: 'day', label: 'Day', value: (r) => r.day, hideXs: true },
        { key: 'dates', label: 'Dates', value: (r) => r.dates, hideXs: true },
        { key: 'days', label: 'Days', value: (r) => r.days, html: (r) => esc(fmt(r.days)), className: 'text-end' }
    ];
}

function initialRange(params) {
    const f = params.get('from') && moment(params.get('from'), 'MM/DD/YYYY', true);
    const t = params.get('to') && moment(params.get('to'), 'MM/DD/YYYY', true);
    if (f && t && f.isValid() && t.isValid() && !t.isBefore(f)) {
        return [f.startOf('day'), t.endOf('day')];
    }
    return leave.yearRange();
}

async function refresh() {
    await Promise.all([renderWhosOut(), loadList()]);
}

async function renderWhosOut() {
    const today = moment().startOf('day');
    const todayBox = $('#out-today', section);
    const weekBox = $('#out-week', section);
    const later = leave.laterDays(today);
    $('#out-tab-week', section).textContent = later.next ? 'Next week' : 'Later this week';

    const last = later.days.length ? later.days[later.days.length - 1] : today;
    const to = last.clone().endOf('day');
    let rows = [];
    try {
        rows = leave.toRows((await loadRange(today, to)).team, today, to);
    } catch (e) {
        console.log("Failed to get this week's leave: ", e);
        todayBox.innerHTML = '<p class="text-danger mb-0">Could not load who is out</p>';
        return;
    }

    if (today.day() == 0 || today.day() == 6) {
        todayBox.innerHTML = '<p class="text-body-secondary mb-0">Today is not a working day.</p>';
    } else {
        const out = leave.whosOut(rows, today);
        const total = state.config.totalEmps;
        const holiday = !today.isBusinessDay();
        todayBox.innerHTML = (holiday ? '<p class="text-body-secondary">Today is a holiday.</p>' : '') +
            `<div class="d-flex align-items-baseline gap-2 mb-3">
                <span class="present-value">${esc(fmt(leave.presentCount(total, out)))}</span>
                <span class="text-body-secondary">of ${esc(total)} in the office</span>
            </div>` +
            (out.length ? '<ul class="list-unstyled mb-0 out-list">' + out.map(outItem).join('') + '</ul>' :
                '<p class="text-body-secondary mb-0">Nobody is out today</p>');
    }

    weekBox.innerHTML = later.days.map((day) => {
        const list = leave.whosOut(rows, day);
        return `<li class="list-group-item"><div class="fw-semibold small mb-1">${esc(day.format('dddd, D MMM'))}</div>` +
            (list.length ? '<ul class="list-unstyled mb-0 out-list">' + list.map(outItem).join('') + '</ul>' :
                '<span class="text-body-secondary small">Nobody is out</span>') + '</li>';
    }).join('') || '<li class="list-group-item text-body-secondary">No working days ' + (later.next ? 'next week' : 'left this week') + '</li>';
}

function outItem(o) {
    return '<li class="d-flex align-items-center gap-2 py-1">' + typeBadge(o.type) + '<span>' + esc(o.name) + '</span>' +
        (o.half ? '<span class="text-body-secondary small">(half day)</span>' : '') + '</li>';
}

async function loadList() {
    try {
        const { team } = await loadRange(range[0], range[1]);
        rows = leave.toRows(team, range[0], range[1]);
    } catch (e) {
        console.log('Failed to get events: ', e);
        rows = [];
        showAlert('Calendar', 'Failed to get the team leave!\n' + e.message);
    }
    renderPeople();
    update();
}

function renderPeople() {
    const select = $('#team-person', section);
    const current = select.value;
    const names = Array.from(new Set(rows.map((r) => r.name))).sort((a, b) => a.localeCompare(b));
    select.innerHTML = '<option value="">Everyone</option>' +
        names.map((n) => '<option value="' + esc(n) + '">' + esc(n) + '</option>').join('');
    select.value = names.indexOf(current) >= 0 ? current : '';
}

// Person and type filters, then the table applies the search; summary and charts use the same rows
function update() {
    const person = $('#team-person', section).value;
    const types = checkedValues(section, 'team-type');
    table.setRows(rows.filter((r) => (!person || r.name == person) && types.indexOf(leave.baseType(r.type)) >= 0));
    renderDerived();
}

function renderDerived() {
    const filtered = table.filtered();
    renderSummary(filtered);
    renderCharts(filtered);
}

function renderSummary(filtered) {
    const summary = leave.personSummary(filtered);
    const search = $('#summary-search', section).value.trim().toLowerCase();
    const names = Object.keys(summary).sort((a, b) => a.localeCompare(b));
    const shown = names.filter((n) => n.toLowerCase().indexOf(search) >= 0);
    const types = typeOrder(state.config, Array.from(new Set(filtered.map((r) => leave.baseType(r.type)))));
    const box = $('#team-summary', section);
    if (!names.length) {
        box.innerHTML = '<p class="text-body-secondary text-center my-4">No leave matches the filters</p>';
        return;
    }
    if (!shown.length) {
        box.innerHTML = '<p class="text-body-secondary text-center my-4">No person matches "' + esc(search) + '"</p>';
        return;
    }
    const limits = state.config.eventLimits || {};
    const head = '<tr><th scope="col">Person</th>' + types.map((t) => '<th scope="col" class="text-end">' + esc(t == '-' ? 'Other' : t) + '</th>').join('') + '</tr>';
    const body = shown.map((name) => {
        const cells = types.map((t) => {
            const v = summary[name][t] || 0;
            if (!limits[t]) {
                return '<td class="text-end' + (v ? '' : ' text-body-secondary') + '">' + esc(fmt(v)) + '</td>';
            }
            const limit = leave.userLimit(state.config, t, name);
            const remain = limit - v;
            const usage = leave.usageState(v, limit);
            const note = remain < 0 ? fmt(-remain) + ' over' : fmt(remain) + ' left';
            const title = t + ' : ' + name + '\nTaken / applied: ' + fmt(v) + ' of ' + fmt(limit) +
                (remain < 0 ? '\nOver the limit by ' + fmt(-remain) : '\nRemaining: ' + fmt(remain));
            // The note stays on the same line, so rows are as high as the Team leaves rows
            return '<td class="text-end text-nowrap cell-' + usage + '" title="' + esc(title) + '">' + esc(fmt(v)) +
                '<span class="summary-note">· ' + esc(note) + '</span></td>';
        }).join('');
        return '<tr data-person="' + esc(name) + '" tabindex="0" role="button" aria-label="Show ' + esc(name) + "'s leave\">" +
            '<th scope="row">' + esc(name) + '</th>' + cells + '</tr>';
    }).join('');
    box.innerHTML = '<table class="table table-sm table-hover align-middle mb-0 summary-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
}

function selectPerson(e) {
    const tr = e.target.closest('tr[data-person]');
    if (!tr) {
        return;
    }
    $('#team-person', section).value = tr.dataset.person;
    update();
    $('#team-table', section).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCharts(filtered) {
    const leaveRows = filtered.filter((r) => leave.isLeaveType(r.type));
    const types = typeOrder(state.config, Array.from(new Set(leaveRows.map((r) => leave.baseType(r.type)))));
    const summary = leave.personSummary(leaveRows);
    const total = (n) => Object.values(summary[n]).reduce((a, b) => a + b, 0);
    const names = Object.keys(summary).sort((a, b) => total(b) - total(a) || a.localeCompare(b));

    // Both charts are vertical bars: month wise next to Who's out, person wise full width
    $('#chart-person-box', section).style.height = '300px';
    $('#chart-month-box', section).style.height = '300px';

    drawBarChart($('#chart-month', section), $('#chart-month-empty', section), monthChartData(state.config, filtered), false);
    drawBarChart($('#chart-person', section), $('#chart-person-empty', section), {
        labels: names,
        datasets: types.map((t) => ({
            label: t,
            backgroundColor: typeColor(t),
            data: names.map((n) => summary[n][t] || 0)
        }))
    }, false);
}

async function applyRange() {
    const from = parseDateInput($('#team-from', section).value);
    const to = parseDateInput($('#team-to', section).value);
    if (!from || !to || to.isBefore(from)) {
        showAlert('Date range', 'Please choose a From date on or before the To date.');
        return;
    }
    range = [from.startOf('day'), to.endOf('day')];
    await loadList();
}

function download() {
    const header = ['Type', 'Name', 'Start Date', 'Day', 'Dates', 'Total Days'];
    const data = table.filtered().map((r) => [r.type, r.name, r.date, r.day, r.dates, r.days]);
    downloadSheet('team-leave', 'Team leave', [header].concat(data));
}

function renderMonths() {
    show($('#monthly-error'), false);
    $('#monthly-year').textContent = range[0].format('YYYY');
    const last = moment().month() - 1;
    $('#monthly-months').innerHTML = moment.months().map((m, i) =>
        '<div class="col"><div class="form-check"><input class="form-check-input" type="checkbox" name="monthly-month" id="month-' + i + '" value="' + esc(m) + '"' +
        (i == last ? ' checked' : '') + '><label class="form-check-label" for="month-' + i + '">' + esc(m) + '</label></div></div>').join('');
}

function downloadMonthly() {
    const months = $$('input[name="monthly-month"]:checked').map((el) => el.value);
    const sheet = months.length ? leave.monthlyReportSheet(leave.monthlyReport(rows), months) : null;
    // Shown in the dialog itself, a second dialog on top of it would not be usable
    show($('#monthly-error'), !sheet);
    if (!sheet) {
        $('#monthly-error').textContent = 'No records found, please select months that have leave.';
        return;
    }
    downloadSheet('Leave-monthly-' + range[0].format('YYYY'), 'Monthly Leaves', sheet);
}
