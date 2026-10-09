// The leave calendar: the calendar of one Microsoft 365 group, through Microsoft Graph (js/msgraph.js)

// {groupId, name, canEdit} of the Microsoft 365 group calendar with this display name (or this group id)
async function findGroupCalendar(displayName, groupId) {
    if (!groupId) {
        const name = displayName.replace(/'/g, "''");
        const data = await graph_get("/groups?$filter=displayName eq '" + encodeURIComponent(name) + "'&$select=id,displayName");
        const groups = data.value || [];
        if (!groups.length) {
            throw new Error('Group calendar "' + displayName + '" not found');
        }
        groupId = groups[0].id;
    }
    const cal = await graph_get(calendarPath(groupId) + '?$select=id,name,canEdit');
    // A group calendar is always named "Calendar", show the group name instead
    return { groupId, name: displayName, canEdit: cal.canEdit !== false };
}

// The leave calendar: calendarName (or calendarGroupId) in the workspace config
export function findCalendar(config) {
    return findGroupCalendar(config.calendarName, config.calendarGroupId);
}

// The calendar with the birthdays (HBD: Name events): birthdayCalendarName (or birthdayCalendarGroupId)
export function findBirthdayCalendar(config) {
    return findGroupCalendar(config.birthdayCalendarName, config.birthdayCalendarGroupId);
}

function calendarPath(groupId) {
    return '/groups/' + encodeURIComponent(groupId) + '/calendar';
}

// Events (not cancelled) between from and to (moments), in the shape the leave math works with
export async function fetchEvents(groupId, from, to) {
    const url = '/groups/' + encodeURIComponent(groupId) + '/calendarView' +
        '?startDateTime=' + encodeURIComponent(from.format()) +
        '&endDateTime=' + encodeURIComponent(to.format()) +
        '&$select=subject,start,end,isAllDay,isCancelled' +
        '&$orderby=start/dateTime' +
        '&$top=500';
    const items = await graph_get_all(url);
    return items.filter((ev) => !ev.isCancelled).map(to_legacy_event);
}

// All day event from the first to the last day (YYYY-MM-DD, both included)
export function createEvent(groupId, { title, from, to, location, description }) {
    // All day events end at midnight after the last day
    const endExclusive = moment(to).add(1, 'days').format('YYYY-MM-DD');
    return graph_post(calendarPath(groupId) + '/events', {
        subject: title,
        isAllDay: true,
        location: { displayName: location || '' },
        body: { contentType: 'text', content: description || '' },
        start: { dateTime: from + 'T00:00:00', timeZone: GRAPH_TIME_ZONE },
        end: { dateTime: endExclusive + 'T00:00:00', timeZone: GRAPH_TIME_ZONE }
    }, true);
}
