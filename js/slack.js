// Slack notification for events created through the app

function slack_escape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// details: {title, from, to, part, description, calendar, created_by}
function build_slack_event_message(details) {
    var when = details.from;
    if (details.to && details.to != details.from) {
        when += ' to ' + details.to;
    }
    if (details.part) {
        when += ' (' + details.part + ')';
    }

    var fields = [
        { type: 'mrkdwn', text: '*When:*\n' + slack_escape(when) },
        { type: 'mrkdwn', text: '*Calendar:*\n' + slack_escape(details.calendar || '-') }
    ];
    if (details.description) {
        fields.push({ type: 'mrkdwn', text: '*Description:*\n' + slack_escape(details.description.substring(0, 1900)) });
    }

    return {
        text: 'New event: ' + details.title + ', ' + when + ', created by ' + details.created_by,
        blocks: [{
            type: 'section',
            text: { type: 'mrkdwn', text: ':calendar: *New event:* ' + slack_escape(details.title) }
        }, {
            type: 'section',
            fields: fields
        }, {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: 'created by ' + slack_escape(details.created_by) }]
        }]
    };
}

// Fire and forget: Slack webhooks do not allow CORS, so the response is opaque and
// only network level failures can be seen here
function notify_slack_event_created(details) {
    if (!slack_webhook_url) {
        return;
    }
    var msg = build_slack_event_message(details);
    try {
        fetch(slack_webhook_url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: 'payload=' + encodeURIComponent(JSON.stringify(msg))
        }).catch(function(err) {
            console.error('Slack notification failed: ', err);
        });
    } catch (err) {
        console.error('Slack notification failed: ', err);
    }
}
