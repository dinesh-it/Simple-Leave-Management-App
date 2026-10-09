// Leave math: event title parsing, business day spans and counts, balances and reports.
// Ported from the old js/main.js, the numbers must stay the same (see tests/leave.test.mjs).
// Uses the global moment with moment-business-days, no DOM access.

export const DEFAULT_TYPE_FILTER = ['PL', 'SL', 'OPH', 'ML', 'PTL', 'MTL', 'RL', 'WFH', 'CO', 'LOP', 'HBD', '-'];

// Other names used for a type, in the config or in event titles. Optional holidays are titled OPH in the
// calendar, older configs call them OH.
const TYPE_ALIASES = { OH: 'OPH' };

// Upper case type with aliases resolved, also for half days (HOH -> HOPH)
export function normalizeType(type) {
    const t = String(type).toUpperCase();
    if (TYPE_ALIASES[t]) {
        return TYPE_ALIASES[t];
    }
    if (t.length > 1 && t[0] == 'H' && TYPE_ALIASES[t.substring(1)]) {
        return 'H' + TYPE_ALIASES[t.substring(1)];
    }
    return t;
}

// Types that are not leave: birthdays and events without a known type
const NOT_LEAVE = ['HBD', '-'];

let typeFilter = DEFAULT_TYPE_FILTER;
let halfDayTypes = withHalfDays(DEFAULT_TYPE_FILTER);

function withHalfDays(types) {
    const all = [];
    types.forEach((t) => {
        all.push(t);
        all.push('H' + t);
    });
    return all;
}

// Leave types and company holidays (business days skip weekends and these holidays)
export function setupLeaveCalendar(config) {
    typeFilter = (config.typeFilter || DEFAULT_TYPE_FILTER).map((t) => (t == '-' ? t : normalizeType(t)));
    halfDayTypes = withHalfDays(typeFilter);
    moment.locale('en-GB', {
        holidays: Object.keys(config.holidayList || {}),
        holidayFormat: 'YYYY-MM-DD',
        workingWeekdays: [1, 2, 3, 4, 5]
    });
}

// All types with their half day variants, in the order of the config (PL, HPL, SL, HSL, ...)
export function allTypes() {
    return halfDayTypes.slice();
}

function titleCase(str) {
    return str.toLowerCase().replace(/\b(\w)/g, (x) => x.toUpperCase());
}

// "PL: Name", "PL - Name" or "Name - PL" -> [TYPE, Name], unknown parts become '-'
export function splitSummary(summary) {
    if (!summary) {
        return ['-', '-'];
    }
    const cols = [];
    let parts = summary.split(':');
    if (parts.length < 2) {
        parts = summary.split('-');
    }

    parts[0] = parts[0].trim();
    if (parts[1]) {
        parts[1] = parts[1].trim();
    }

    if (parts[0] == 'Maternity Leave') {
        parts[0] = 'MtL';
    }

    if (halfDayTypes.indexOf(normalizeType(parts[0])) >= 0) {
        cols[0] = normalizeType(parts[0]);
        parts.splice(0, 1);
    } else if (parts[1] && typeFilter.indexOf(normalizeType(parts[1])) >= 0) {
        cols[0] = normalizeType(parts[1]);
        parts.splice(1, 1);
    } else {
        cols[0] = '-';
    }

    cols[0] = cols[0].toUpperCase();
    cols[1] = titleCase(parts.toString().trim());

    // First name only, except for Shefali (full name kept)
    if (cols[1].match(' ') && !cols[1].toLowerCase().match('shefali')) {
        cols[1] = cols[1].split(' ')[0];
    }

    if (!cols[1]) {
        cols[1] = '-';
    }
    return cols;
}

// Half day types start with H (HPL, HSL...), HBD is a birthday
export function isHalfDay(type) {
    return /^H/i.test(type) && type != 'HBD';
}

export function baseType(type) {
    return isHalfDay(type) ? type.substring(1) : type;
}

export function isLeaveType(type) {
    return NOT_LEAVE.indexOf(baseType(type)) < 0;
}

export function eventDate(d) {
    return moment(d.dateTime || d.date);
}

// Start and end of an event, clipped to from..to and moved to business days
export function eventSpan(event, from, to) {
    let start = eventDate(event.start);
    let end = eventDate(event.end);

    if (start < from) {
        start = from.clone();
    }
    if (end > to) {
        end = to.clone();
    }
    if (!start.isBusinessDay()) {
        start = start.nextBusinessDay();
    }
    if (!end.isBusinessDay()) {
        end = end.nextBusinessDay();
    }
    return [start, end];
}

// [business days, "2, 3, 4" or "Mar 2 to Mar 9"]
export function daysDiff(date1, date2) {
    let diff = date2.businessDiff(date1, 'days');
    if (diff == 0 && (date1.isBefore(date2) || date1.isSame(date2, 'day'))) {
        diff = 1;
    }
    let date3 = date1.clone();
    let eventDays = date1.format('Do');
    if (diff < 5) {
        for (let i = 1; i < diff; i++) {
            date3 = date3.businessAdd(1, 'day');
            eventDays += ', ' + date3.format('Do');
        }
    } else {
        eventDays = date1.format('MMM Do') + ' to ' + date3.businessAdd(diff - 1, 'day').format('MMM Do');
    }
    return [diff, eventDays];
}

/**
 * One list row for an event within from..to:
 * {id, summary, type, name, date (YYYY-MM-DD), day ("Oct, Wed"), dates, days, start, last}
 * last is the last business day the event covers.
 */
export function toRow(event, from, to) {
    const [start, end] = eventSpan(event, from, to);
    const [type, name] = splitSummary(event.summary);
    const [fullDays, dates] = daysDiff(start, end);
    let days = fullDays;
    if (isHalfDay(type)) {
        days = days / 2;
    }
    return {
        id: event.id,
        summary: event.summary,
        type,
        name,
        date: start.format('YYYY-MM-DD'),
        day: start.format('MMM') + ', ' + start.format('ddd'),
        dates,
        days,
        start,
        last: fullDays > 1 ? start.clone().businessAdd(fullDays - 1) : start.clone()
    };
}

// Old table row shape [type, name, date, "Mon, Day", dates, days]
export function rowCells(row) {
    return [row.type, row.name, row.date, row.day, row.dates, row.days];
}

function overlaps(event, from, to) {
    return eventDate(event.end) > from && eventDate(event.start) <= to;
}

export function toRows(events, from, to) {
    return events.filter((ev) => overlaps(ev, from, to)).map((ev) => toRow(ev, from, to));
}

// True when the name in the event title is the signed in user's first name
export function isOwnEvent(event, loginName) {
    if (!loginName) {
        return false;
    }
    const name = splitSummary(event.summary)[1].toUpperCase();
    const me = loginName.toUpperCase();
    return name == me || name.split(' ')[0] == me;
}

export function yearRange(now) {
    const day = now ? moment(now) : moment();
    return [day.clone().startOf('year'), day.clone().endOf('year')];
}

// Days used per base type ({PL: 2, SL: 0.5}) in the current calendar year, half day types count half
export function computeBalance(events, now) {
    const [from, to] = yearRange(now);
    const used = {};
    toRows(events, from, to).forEach((row) => {
        const type = baseType(row.type);
        used[type] = (used[type] || 0) + row.days;
    });
    return used;
}

// Leave limit for a person, with any extra allowance from the config
export function userLimit(config, type, name) {
    let limit = (config.eventLimits || {})[type] || 0;
    const extra = config.userExtraAllowance || {};
    if (extra[name] && extra[name][type]) {
        limit += extra[name][type];
    }
    return limit;
}

// 'ok' | 'warning' (above 80% of the limit) | 'danger' (at or over the limit)
export function usageState(used, limit) {
    if (!limit) {
        return 'ok';
    }
    const percent = (used / limit) * 100;
    if (percent >= 100) {
        return 'danger';
    }
    if (percent > 80) {
        return 'warning';
    }
    return 'ok';
}

// {Name: 'YYYY-MM-DD'} from HBD events (titled "HBD: Name", also when HBD is not in the config's types)
export function birthdays(events) {
    const list = {};
    events.forEach((ev) => {
        let [type, name] = splitSummary(ev.summary);
        if (type != 'HBD') {
            const m = /^\s*HBD\s*[:-]\s*(.+)$/i.exec(ev.summary || '');
            if (!m) {
                return;
            }
            name = splitSummary('PL: ' + m[1])[1];
        }
        list[name] = eventDate(ev.start).format('YYYY-MM-DD');
    });
    return list;
}

// {Name: {PL: 3, SL: 0.5}} from list rows (half day types counted under the base type)
export function personSummary(rows) {
    const summary = {};
    rows.forEach((row) => {
        const type = baseType(row.type);
        if (!summary[row.name]) {
            summary[row.name] = {};
        }
        summary[row.name][type] = (summary[row.name][type] || 0) + row.days;
    });
    return summary;
}

// {March: ['02', '03']} business dates an event covers, starting at start (days may be 0.5)
export function businessDates(start, days) {
    let day = start.clone();
    const months = {};
    for (let i = 0; i < days; i++) {
        const m = day.format('MMMM');
        if (!months[m]) {
            months[m] = [];
        }
        months[m].push(day.format('DD'));
        day = day.businessAdd(1, 'days');
    }
    return months;
}

// {October: {Arun: {PL: ['01', '05']}}} - the data of the monthly report
export function monthlyReport(rows) {
    const report = {};
    rows.forEach((row) => {
        const months = businessDates(row.start, row.days);
        Object.keys(months).forEach((m) => {
            if (!report[m]) {
                report[m] = {};
            }
            if (!report[m][row.name]) {
                report[m][row.name] = {};
            }
            const prev = report[m][row.name][row.type] || [];
            report[m][row.name][row.type] = prev.concat(months[m]);
        });
    });
    return report;
}

// Monthly report as sheet rows for the chosen months, null when they have no records
export function monthlyReportSheet(report, months) {
    const types = allTypes().filter((t) => !t.match(/HBD|-$/));
    const sheet = [];
    let found = false;
    months.forEach((month) => {
        const names = report[month];
        if (!names) {
            return;
        }
        sheet.push([], [], [month], [''].concat(types));
        Object.keys(names).forEach((name) => {
            const events = names[name];
            const keys = Object.keys(events);
            if (keys.length == 1 && keys[0] == '-') {
                return;
            }
            let atLeastOne = false;
            const line = [name];
            types.forEach((t) => {
                if (events[t]) {
                    line.push(events[t].join(','));
                    atLeastOne = true;
                } else {
                    line.push('-');
                }
            });
            if (atLeastOne) {
                sheet.push(line);
                found = true;
            }
        });
    });
    return found ? sheet : null;
}

// {0..11: {PL: days}} leave days per month (by business date, half days count half)
export function monthlyTotals(rows) {
    const totals = {};
    rows.forEach((row) => {
        if (!isLeaveType(row.type)) {
            return;
        }
        const type = baseType(row.type);
        const per = isHalfDay(row.type) ? 0.5 : 1;
        let day = row.start.clone();
        const count = Math.max(Math.ceil(row.days), 1);
        for (let i = 0; i < count; i++) {
            const m = day.month();
            if (!totals[m]) {
                totals[m] = {};
            }
            totals[m][type] = (totals[m][type] || 0) + per;
            day = day.businessAdd(1, 'days');
        }
    });
    return totals;
}

export function coversDay(row, day) {
    return !row.start.isAfter(day, 'day') && !row.last.isBefore(day, 'day');
}

// [{name, type, half}] for the people with a leave (or WFH) event covering day
export function whosOut(rows, day) {
    if (!day.isBusinessDay()) {
        return [];
    }
    return rows.filter((row) => isLeaveType(row.type) && coversDay(row, day))
        .map((row) => ({ name: row.name, type: baseType(row.type), half: isHalfDay(row.type) }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

// People in the office: total employees minus everyone out or WFH (a half day counts half)
export function presentCount(totalEmps, out) {
    return out.reduce((total, o) => total - (o.half ? 0.5 : 1), totalEmps);
}

// Business days from day to Friday of the same week
export function restOfWeek(day) {
    const days = [];
    const d = day.clone().startOf('day');
    while (d.day() >= 1 && d.day() <= 5) {
        if (d.isBusinessDay()) {
            days.push(d.clone());
        }
        d.add(1, 'day');
    }
    return days;
}

// Working days after today for the second Who's out tab: the rest of this week, or all of next week
// when this week has no working day left (Friday, the weekend, or before a Friday holiday).
// {next: false|true, days: [moments]}
export function laterDays(day) {
    const today = day.clone().startOf('day');
    const rest = restOfWeek(today).filter((d) => d.isAfter(today, 'day'));
    if (rest.length) {
        return { next: false, days: rest };
    }
    return { next: true, days: restOfWeek(today.clone().add(1, 'week').startOf('isoWeek')) };
}

// 'today' (covers today) | 'tomorrow' (starts tomorrow) | 'future' (starts later) | ''
export function highlight(row, now) {
    const today = moment(now).startOf('day');
    if (coversDay(row, today)) {
        return 'today';
    }
    if (row.start.isSame(today.clone().add(1, 'day'), 'day')) {
        return 'tomorrow';
    }
    if (row.start.isAfter(today, 'day')) {
        return 'future';
    }
    return '';
}

// Leave rows still to come (or ongoing), soonest first
export function upcoming(rows, now, count) {
    const today = moment(now).startOf('day');
    return rows.filter((row) => isLeaveType(row.type) && !row.last.isBefore(today, 'day'))
        .sort((a, b) => a.start - b.start)
        .slice(0, count);
}
