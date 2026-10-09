// App state: the signed in user, the config and the calendar events per date range.
// Non admins only ever keep their own events, everyone's events are kept for admins only.
import { fetchEvents } from './calendar.js';
import { isOwnEvent, birthdays, yearRange } from './leave.js';

export const state = {
    user: '',           // first name from the Microsoft profile, '' when it could not be read
    displayName: '',    // full name from the Microsoft profile, for the user menu
    isAdmin: false,
    config: null,
    calendar: null,     // {groupId, name, canEdit}
    yearOwn: [],        // own events of the current calendar year, for the balance
    birthdays: {}       // {Name: 'YYYY-MM-DD'} of everyone
};

// 'from|to' -> Promise of {own, team}, team is null for non admins
const cache = new Map();

export function loadRange(from, to) {
    const key = from.format() + '|' + to.format();
    if (!cache.has(key)) {
        const loading = fetchEvents(state.calendar.groupId, from, to).then((all) => {
            Object.assign(state.birthdays, birthdays(all));
            return {
                own: all.filter((ev) => isOwnEvent(ev, state.user)),
                team: state.isAdmin ? all : null
            };
        });
        loading.catch(() => cache.delete(key));
        cache.set(key, loading);
    }
    return cache.get(key);
}

export async function loadYear() {
    const [from, to] = yearRange();
    state.yearOwn = (await loadRange(from, to)).own;
}

const listeners = [];

// fn runs after every refresh (a new event was added)
export function onRefresh(fn) {
    listeners.push(fn);
}

// Drops the cached ranges, reloads the current year and lets the views reload theirs
export async function refreshAll() {
    cache.clear();
    await loadYear();
    for (const fn of listeners) {
        await fn();
    }
}
