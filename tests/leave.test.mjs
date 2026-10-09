// Tests for js/app/leave.js: run with `node --test` from the project root.
// baseline.json holds the outputs of the old jQuery build (js/main.js) on the same events,
// so these tests also check that the counts did not change with the rewrite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);

// The vendored browser builds of moment and moment-business-days
globalThis.moment = require('../js/plugins/moment-with-locales.min.js');
moment.suppressDeprecationWarnings = true;
new Function('window', 'moment', 'module', readFileSync(new URL('js/plugins/moment-business-days.js', root), 'utf8'))({}, moment, {});

const leave = await import('../js/app/leave.js');
const baseline = JSON.parse(readFileSync(new URL('tests/fixtures/baseline.json', root), 'utf8'));

leave.setupLeaveCalendar(baseline.config);

// Local time, so the day is the same in every time zone
const NOW = moment('2026-10-07T10:00:00');
const [FROM, TO] = leave.yearRange(NOW);
const legacy = (ev) => ({ id: ev.id, summary: ev.subject, start: { date: ev.start.dateTime.substring(0, 10) }, end: { date: ev.end.dateTime.substring(0, 10) } });
const EVENTS = baseline.events.map(legacy);
const ROWS = leave.toRows(EVENTS, FROM, TO);
const sortJson = (list) => list.map((x) => JSON.stringify(x)).sort();

test('rows match the old build', () => {
    assert.deepEqual(sortJson(ROWS.map(leave.rowCells)), sortJson(baseline.rows));
});

test('monthly report data matches the old build', () => {
    assert.deepEqual(leave.monthlyReport(ROWS), baseline.monthlyReport);
});

test('per person summary matches the old counts table (removeEvents types left out)', () => {
    const shown = ROWS.filter((r) => baseline.config.removeEvents.indexOf(leave.baseType(r.type)) < 0);
    assert.deepEqual(leave.personSummary(shown), baseline.countsTable);
});

test('own balance matches the old build', () => {
    for (const name of ['Priya', 'Arun', 'Meena']) {
        const own = EVENTS.filter((ev) => leave.isOwnEvent(ev, name));
        assert.deepEqual(leave.computeBalance(own, NOW), baseline['ownCounts_' + name], name);
    }
});

test('birthdays of everyone', () => {
    assert.deepEqual(Object.keys(leave.birthdays(EVENTS)).sort(), baseline.birthdays);
    assert.equal(leave.birthdays(EVENTS).Arun, '2026-06-15');
});

test('summary parsing rules', () => {
    const cases = {
        'PL: Priya': ['PL', 'Priya'],
        'PL - Priya': ['PL', 'Priya'],
        'Meena - SL': ['SL', 'Meena'],
        'HSL: priya': ['HSL', 'Priya'],
        'hpl: PRIYA': ['HPL', 'Priya'],
        'HBD: Arun': ['HBD', 'Arun'],
        'PL: Ravi Kumar': ['PL', 'Ravi'],
        'PL: Shefali Kumar': ['PL', 'Shefali Kumar'],
        'Maternity Leave: Anu': ['MTL', 'Anu'],
        'Team lunch': ['-', 'Team'],
        '': ['-', '-']
    };
    for (const [summary, expected] of Object.entries(cases)) {
        assert.deepEqual(leave.splitSummary(summary), expected, summary);
    }
});

test('spans skip weekends and holidays', () => {
    // Wed 30 Sep to Mon 5 Oct, Fri 2 Oct is a holiday
    const row = ROWS.find((r) => r.name == 'Arun' && r.date == '2026-09-30');
    assert.equal(row.days, 3);
    assert.equal(row.dates, '30, 1, 5');
    assert.equal(row.last.format('YYYY-MM-DD'), '2026-10-05');
    // Fri 9 Oct to Tue 13 Oct over a weekend
    const meena = ROWS.find((r) => r.name == 'Meena' && r.date == '2026-10-09');
    assert.equal(meena.days, 3);
    assert.equal(meena.last.format('YYYY-MM-DD'), '2026-10-13');
});

test('events are clipped to the year', () => {
    const dec = ROWS.find((r) => r.name == 'Priya' && r.type == 'SL' && r.date == '2026-12-28');
    assert.equal(dec.days, 4);
    assert.ok(!ROWS.some((r) => r.date.startsWith('2025')));
});

test('own event matching', () => {
    assert.equal(leave.isOwnEvent({ summary: 'PL: priya' }, 'Priya'), true);
    assert.equal(leave.isOwnEvent({ summary: 'HSL: Priya' }, 'Priya'), true);
    assert.equal(leave.isOwnEvent({ summary: 'PL: Arun' }, 'Priya'), false);
    assert.equal(leave.isOwnEvent({ summary: 'PL: Shefali Kumar' }, 'Shefali'), true);
    // Profile not readable: nothing is the user's own
    assert.equal(leave.isOwnEvent({ summary: 'PL: Priya' }, ''), false);
    assert.equal(leave.isOwnEvent({ summary: 'PL: -' }, ''), false);
});

test('limits and usage states', () => {
    const config = baseline.config;
    assert.equal(leave.userLimit(config, 'PL', 'Priya'), 20);
    assert.equal(leave.userLimit(config, 'PL', 'Arun'), 18);
    assert.equal(leave.userLimit(config, 'WFH', 'Arun'), 0);
    // 18 + 2 with 5 used -> 15 remaining
    assert.equal(leave.userLimit(config, 'PL', 'Priya') - 5, 15);
    assert.equal(leave.usageState(5, 20), 'ok');
    assert.equal(leave.usageState(15, 18), 'warning');
    assert.equal(leave.usageState(12, 12), 'danger');
    assert.equal(leave.usageState(13, 12), 'danger');
    assert.equal(12 - 13, -1); // shown as 1 over the limit
});

test("who's out and present count", () => {
    const today = NOW.clone().startOf('day');
    const out = leave.whosOut(ROWS, today);
    assert.deepEqual(out, [
        { name: 'Arun', type: 'SL', half: false },
        { name: 'Meena', type: 'PL', half: true }
    ]);
    assert.equal(leave.presentCount(10, out), 8.5);
    assert.deepEqual(leave.restOfWeek(today).map((d) => d.format('YYYY-MM-DD')), ['2026-10-07', '2026-10-08', '2026-10-09']);
    assert.deepEqual(leave.whosOut(ROWS, moment('2026-10-08')).map((o) => o.name + ':' + o.type), ['Priya:WFH']);
    assert.deepEqual(leave.whosOut(ROWS, moment('2026-10-10')), []);
    // A holiday has nobody out
    assert.deepEqual(leave.whosOut(ROWS, moment('2026-10-02')), []);
});

test('highlights', () => {
    const find = (name, date) => ROWS.find((r) => r.name == name && r.date == date);
    assert.equal(leave.highlight(find('Arun', '2026-10-07'), NOW), 'today');
    assert.equal(leave.highlight(find('Priya', '2026-10-08'), NOW), 'tomorrow');
    assert.equal(leave.highlight(find('Meena', '2026-10-09'), NOW), 'future');
    assert.equal(leave.highlight(find('Arun', '2026-04-06'), NOW), '');
});

test('monthly report sheet', () => {
    const report = leave.monthlyReport(ROWS);
    const sheet = leave.monthlyReportSheet(report, ['October']);
    assert.deepEqual(sheet[2], ['October']);
    assert.deepEqual(sheet[3].slice(0, 5), ['', 'PL', 'HPL', 'SL', 'HSL']);
    const arun = sheet.find((line) => line[0] == 'Arun');
    assert.equal(arun[1], '01,05');
    assert.equal(arun[3], '07');
    assert.equal(leave.monthlyReportSheet(report, ['January']), null);
});

test('monthly totals and upcoming', () => {
    const totals = leave.monthlyTotals(ROWS);
    assert.equal(totals[9].PL, 5.5); // Arun 1 + 5 Oct, Meena 9, 12, 13 Oct, Meena half day
    assert.equal(totals[8].PL, 1);
    assert.ok(!totals[5]); // June only has a birthday
    const priya = ROWS.filter((r) => r.name == 'Priya');
    assert.deepEqual(leave.upcoming(priya, NOW, 5).map((r) => r.type + ' ' + r.date), ['WFH 2026-10-08', 'SL 2026-12-28']);
});

test('optional holidays: OPH in the calendar, OH in older configs', async () => {
    const { parseConfig } = await import('../js/app/config.js');
    // The real workspace config calls the type OH
    const config = parseConfig(JSON.stringify({
        typeFilter: ['PL', 'SL', 'OH', 'WFH', 'HBD', '-'],
        removeEvents: ['-', 'HBD'],
        eventLimits: { PL: 18, SL: 12, OH: 1 },
        userExtraAllowance: { Priya: { OH: 1 } }
    }));
    assert.deepEqual(config.typeFilter, ['PL', 'SL', 'OPH', 'WFH', 'HBD', '-']);
    assert.deepEqual(config.eventLimits, { PL: 18, SL: 12, OPH: 1 });
    assert.deepEqual(config.userExtraAllowance, { Priya: { OPH: 1 } });
    leave.setupLeaveCalendar(config);
    try {
        assert.deepEqual(leave.splitSummary('OPH: Priya'), ['OPH', 'Priya']);
        assert.deepEqual(leave.splitSummary('oph - priya'), ['OPH', 'Priya']);
        assert.deepEqual(leave.splitSummary('Priya - OPH'), ['OPH', 'Priya']);
        assert.deepEqual(leave.splitSummary('OH: Priya'), ['OPH', 'Priya']);
        const own = [{ id: 'o1', summary: 'OPH: Priya', start: { date: '2026-03-04' }, end: { date: '2026-03-05' } }];
        assert.deepEqual(leave.computeBalance(own, NOW), { OPH: 1 });
        assert.equal(leave.userLimit(config, 'OPH', 'Priya'), 2);
        // Counts as out of office in the Team view
        assert.equal(leave.whosOut(leave.toRows(own, FROM, TO), moment('2026-03-04')).length, 1);
    } finally {
        leave.setupLeaveCalendar(baseline.config);
    }
});

