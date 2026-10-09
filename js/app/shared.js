// Holidays and birthdays: shown to everyone, admins and non admins
import { state, loadBirthdays } from './state.js';
import { $, esc } from './components/ui.js';

export function initShared() {
    renderHolidays();
    $('#holidays-show-past').addEventListener('change', (e) => {
        $('#holidays-list').classList.toggle('show-past', e.target.checked);
    });
    // Birthdays come from their own calendar, loaded in the background; rendered when the list is opened
    loadBirthdays().then(() => {
        if ($('#birthdays-modal').classList.contains('show')) {
            renderBirthdays();
        }
    });
    $('#birthdays-modal').addEventListener('show.bs.modal', renderBirthdays);
}

function renderHolidays() {
    const today = moment().startOf('day');
    const list = state.config.holidayList || {};
    const rows = Object.keys(list).sort().map((key) => {
        const date = moment(key, 'YYYY-MM-DD');
        const day = date.format('ddd');
        let cls = 'hl-future';
        if (day == 'Sat' || day == 'Sun') {
            cls = 'hl-danger';
        } else if (day == 'Mon' || day == 'Fri') {
            cls = 'hl-success';
        }
        if (date.isBefore(today)) {
            cls = 'hl-muted past';
        }
        return '<tr class="' + cls + '"><td class="text-nowrap">' + esc(date.format('ddd, D MMM YYYY')) + '</td><td>' + esc(list[key]) + '</td></tr>';
    });
    $('#holidays-list').innerHTML = rows.join('') ||
        '<tr><td colspan="2" class="text-body-secondary text-center py-3">No holidays configured</td></tr>';
}

function renderBirthdays() {
    const list = $('#birthdays-list');
    if (state.birthdays === null) {
        list.innerHTML = '<tr><td colspan="2" class="text-body-secondary text-center py-3">Loading birthdays...</td></tr>';
        return;
    }
    if (state.birthdaysError) {
        list.innerHTML = '<tr><td colspan="2" class="text-danger text-center py-3">' + esc(state.birthdaysError).replace(/\n/g, '<br>') + '</td></tr>';
        return;
    }
    const today = moment().startOf('day');
    const rows = Object.keys(state.birthdays).map((name) => {
        let date = moment(state.birthdays[name], 'YYYY-MM-DD');
        while (date.isBefore(today)) {
            date = date.add(1, 'year');
        }
        return { name, date };
    }).sort((a, b) => a.date - b.date);

    list.innerHTML = rows.map((b) => {
        const holiday = !b.date.isBusinessDay();
        return '<tr class="' + (holiday ? 'hl-danger' : '') + '"><td class="text-nowrap">' + esc(b.date.format('ddd, D MMM YYYY')) +
            (b.date.isSame(today, 'day') ? ' <span class="badge text-bg-primary">Today</span>' : '') +
            '</td><td>' + esc(b.name) + '</td></tr>';
    }).join('') || '<tr><td colspan="2" class="text-body-secondary text-center py-3">No birthdays in the "' + esc(state.config.birthdayCalendarName) + '" calendar</td></tr>';
}
