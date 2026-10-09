var CompanyHolidays;

// To filter Half day events from calendar
var temp_types = [];

var all_events_report;
var count_table_timer;
var login_name = '';
var cumulative_data = {};
var cal_all_events;
var global_from_date;
var global_to_date;
var admin_login = false;
var logged_in_user_data = {};
var loging_data_computed = false;
var show_graph_flag = false;
var today = moment();
var this_month = today.format('YYYY-MM');
var today_date = today.format('YYYY-MM-DD');
var tomorrow_date = today.clone().add(1, 'days').format('YYYY-MM-DD');
var today_date_dd = today.format('DD');
var today_events = {};
var last_session_validated = 0;

// Config defaults
var Type_Filter = ['PL', 'SL', 'ML', 'PTL', 'MTL', 'RL', 'WFH', 'CO', 'LOP', 'HBD', '-'];
var remove_events = ['-', 'HBD', 'MTL', 'PTL', 'ML', 'RL', 'LOP'];
var total_emps = 27;
var event_limits = { 
	PL: 18,
	SL: 12
};
var admin_names = {};
var show_fuel_gauge = false;
var HolidayList = {};
var company_name = "Dinesh";
var user_extra_allowance = {};
var slack_webhook_url = '';
var calendar_link = '';
// The one Microsoft 365 group calendar the app reads and writes, found by the group's display name
// (or by calendarGroupId from the workspace config)
var calendar_name = 'Shared Vacation (IN)';
var calendar_group_id = '';
var leave_calendar_id = null;

// Calendars listed for the signed in user (Microsoft Graph calendar resources)
var all_calendars = [];

var authorizeButton;
var signoutButton;

// Processor options
var group_name_case_sensitive = 0;
var group_first_name = 1;

var help = "group_name_case_sensitive, group_first_name, login_name, refresh_data().";

$(document).ready(function() {
    // This page is the MSAL redirect target, inside the login popup only the bridge runs
    if (IS_AUTH_RESPONSE) {
        return;
    }

    authorizeButton = document.getElementById("authorize-button");
    signoutButton = document.getElementById("signout-button");

    $(".filter-box").hide();
    $(window).on("focus", function(event) {
        if (moment() - last_session_validated > 180000) {
            validate_session();
        }
        return false;
    });

    initialize();

    bind_events();

    handleClientLoad();
});

function init() {

    $('.company_name').text(company_name);

    CompanyHolidays = Object.keys(HolidayList);
    moment.locale('en-GB', {
        holidays: CompanyHolidays,
        holidayFormat: 'YYYY-MM-DD',
        workingWeekdays: [1, 2, 3, 4, 5]
    });
    init_holiday_list();
	console.log("Company holidays initialized");
	print_fun_info();

    $.each(Type_Filter, function(i, v) {
        temp_types.push(v);
        temp_types.push('H' + v);
    });
}

function init_holiday_list() {
    var leave_list_table = $('#holidays_list tbody');
    var today = moment();
    for (key in HolidayList) {
        var date = moment(key);
        d = date.format('DD-MM-YYYY - dddd');
        var day = date.format('ddd');
        var style;
        if (day == 'Sun' || day == 'Sat') {
            style = 'danger';
        } else if (day == 'Fri' || day == 'Mon') {
            style = 'success'
        } else {
            style = 'info';
        }
        if (date < today) {
            style = 'warning past hide';
        }
        var newline = '<tr class="' + style + '"><td>' + d + "</td><td>" + HolidayList[key] + "</td></tr>";
        leave_list_table.append(newline);
    }

    $('#holiday-show-past').click(function() {
        if ($(this).hasClass('sp')) {
            $(this).removeClass('sp').text('Hide Past Dates');
            leave_list_table.find('.past').removeClass('hide');
        } else {
            $(this).addClass('sp').text('Show Past Dates');
            leave_list_table.find('.past').addClass('hide');
        }
    });
}

function initialize() {

    // Custom checkbox filter
    $.fn.dataTableExt.afnFiltering.push(function(oSettings, aData, iDataIndex) {
        if (oSettings.sTableId == 'all-events') {
            var id = aData[0].replace(/ /g, "_");
            var show = $('#type_' + id).is(':checked');
            if (!show) {
                if (id.match(/^H/i) && id != 'HBD') {
                    id = id.substring(1);
                    show = $('#type_' + id).is(':checked');
                }
            }
            return show;
        } else {
            return true;
        }
    });

    // Init plugins
    $("#datepicker-from").datepicker();
    $("#datepicker-to").datepicker();
    $('#add-from-date').datepicker({
        dateFormat: 'dd/mm/yy'
    });
    $('#add-to-date').datepicker({
        dateFormat: 'dd/mm/yy'
    });
    $('#all-events-report').dataTable();
    $('.options-box button').tooltip({
        placement: 'bottom'
    });

    // Remove graph on collapse complete, to fix issue - graph overlay on another graph
    $('#chart-container*').on('hidden.bs.collapse', function(e) {
        $(e.target).html('');
    });
}

function bind_events() {
    $(document).on('click', 'td.link', function() {
        var cell = $(this);
        progress_bar("Applying filter...");
        var name = $('td:first', cell.parents('tr')).text();
        var th = $('#all-events-report th').eq(cell.index()).text();
        var type = th; //th.split(' in ')[0];
        console.log("Name: " + name + "Type: " + type);
        var name_search = $('#yadcf-filter--all-events-1');
        var type_search = $('#yadcf-filter--all-events-0');
        window.scrollTo(0, 30);
        name_search.find('option[value="' + name + '"]').prop('selected', true).trigger('change');
        type_search.find('option[value="' + type + '"]').prop('selected', true).trigger('change');
        progress_bar('', true);
        $('#filter-reset').removeClass('hide');
        document.body.scrollTop = document.documentElement.scrollTop = 0;
    });

    $('input[name="add_event_day"]').on('change', function() {
        var day_type = $('input[name="add_event_day"]:checked').val();
        if (day_type == 'FULL') {
            $('#add-event-from-label').html('From');
            $('#add-event-to').show();
            $('#add-event-days-div').show();
        } else if (day_type == 'FH' || day_type == 'SH') {
            $('#add-event-from-label').html('On');
            $('#add-event-to').hide();
            $('#add-event-days-div').hide();
        }
    });

    $('#filter-reset').on('click', function() {
        // TODO: Trying to reset
        yadcf.exResetAllFilters(all_events_report);
        yadcf.exResetAllFilters(event_list_table);
        $('#filter-reset').addClass('hide');
    });

    $('#show-graph').on('click', function(e) {
        if (!show_graph_flag) {
            show_graph_flag = true;
            process_all_events(cal_all_events);
        } else {
            show_graph_flag = false;
            $('#chart-container').collapse('hide');
            $('#chart-container-monthly').collapse('hide');
            $('#chart-container-weekly').collapse('hide');
        }
    });

    $('[id^=type_]').on("change", function(e) {
        $('#all-events').dataTable().fnDraw();
    });

    $('#show_cal').on('click', function() {
        if (calendar_link) {
            window.open(calendar_link, '_blank', 'noopener');
        }
    });

    var cur_global_search = '';
    $('#global_search').on('keyup change', function() {
        if (cur_global_search != this.value.toUpperCase()) {
            $('#all-events').DataTable().search(this.value, true, true).draw();
            cur_global_search = this.value.toUpperCase();
        }
    });

    event_list_table = $('#all-events').dataTable({
        "bJQueryUI": true,
        "bProcessing": true,
        "ddCustomFilter": true,
        "order": [
            [2, 'desc']
        ],
        "bAutowidth": false,
        'iDisplayLength': 50,
        drawCallback: function() {
            update_chart();
        },

        columnDefs: [{
            className: "hidden-xs",
            "targets": [3, 4]
        }],
        "rowCallback": function(row, col, i) {
            // Check if this event occurs today, tomorrow or in future.
            if (col[2] >= this_month) {
                if (col[2] == today_date || (col[2] < (this_month + '-31') && col[4].match(today_date_dd))) {
                    $(row).addClass('today');
                    set_today_event(col);
                } else if (col[2] > today_date) {
                    if (col[2] == tomorrow_date) {
                        $(row).addClass('tomorrow');
                    } else {
                        $(row).addClass('future');
                    }
                } else if (col[4].match('to')) {
                    var d = moment(col[2].split('<br>')[0]);
                    var last = d.businessAdd(col[5], 'days');
                    if (last >= today) {
                        $(row).addClass('today');
                        set_today_event(col);
                    }
                }
            }
            // For range of dates
            else if (col[4].match('to')) {
                var d = moment(col[2].split('<br>')[0]);
                var last = d.add(col[5], 'days');
                if (last >= today) {
                    $(row).addClass('today');
                    set_today_event(col);
                }
            }
        }

    }).yadcf(
        [{
            column_number: 0
        }, {
            column_number: 1,
            text_data_delimiter: ","
        }, {
            column_number: 3,
            text_data_delimiter: ","
        }, {
            column_number: 4,
            text_data_delimiter: ","
        }]
    );

    $('#event_type').change(function(e) {
        var selected = $(this).val();
        var msg = '';
        if (event_limits[selected]) {
            if(!logged_in_user_data[selected]) {
                logged_in_user_data[selected] = 0;
            }
            var remain = event_limits[selected] - logged_in_user_data[selected];
            if (user_extra_allowance && user_extra_allowance[login_name] && user_extra_allowance[login_name][selected]) {
                remain += user_extra_allowance[login_name][selected];
            }
            if (remain > 1) {
                msg = remain + ' leave(s)';
            } else if (remain > 0) {
                msg = remain + ' leave';
            } else {
                msg = "You don't have " + selected + "'s";
            }
            msg += " remaining<sup>*</sup>";
            $('#add-event-days').attr('max', remain);
        } else {
            $('#add-event-days').attr('max', 120);
        }
        $('#event-selector-info').html(msg);
        var event_name = selected + ': ' + login_name;
        $('#new_event_name').val(event_name);
        $('#add-event-days').trigger('change');
    });

    $('input[name="add_event_day"]').change(function(e) {
        var selected = $(this).val();
        var event_type = $('#event_type').val();
        if (selected == 'FULL') {
            var event_name = event_type + ': ' + login_name;
            $('#new_event_name').val(event_name);
        } else {
            var event_name = 'H' + event_type + ': ' + login_name;
            $('#new_event_name').val(event_name);
        }
    });

    $('#new_event_name').on('focusout', function(e) {
        $(this).prop('readonly', true);
        $('#new_event_name_edit').text('Edit');
    });

    $('#new_event_name_edit').click(function(e) {
        var btn_name = $(this).text();
        if (btn_name == 'Edit') {
            $('#new_event_name').prop('readonly', false);
            $(this).text('Done');
        } else {
            $('#new_event_name').prop('readonly', true);
            $(this).text('Edit');
        }
    });

    $('#show_add_event').click(function() {
        if (!validate_session()) {
            return false;
        }
        $('#event_type').trigger('change');
        $('#date-selector').trigger('change');
    });

    $('#date-selector').change(function(e, data) {
        $('#date-selector-info').text('');
        var selected = $(this).val();
        var today = moment();
        var date = today.clone();
        if (selected == 'today') {
            if (!date.isBusinessDay()) {
                $('#date-selector-info').text(selected + ' holiday');
                $('#date-selector').val('tomorrow').trigger('change', {
                    from_today: true
                });
                return;
            }
        } else if (selected == 'tomorrow') {
            date.add(1, 'days');
        } else if (selected == 'yesterday') {
            date.subtract(1, 'days');
        } else if (selected == 'other') {
            $('#advanced_mode').collapse('show');
        }
        if (!date.isBusinessDay() && selected != 'other') {
            var msg = selected + ' holiday';
            if (data && data.from_today) {
                msg = 'today and ' + msg;
            }
            $('#date-selector-info').text(msg);
            $('#date-selector').val('other');
            $('#advanced_mode').collapse('show');
        }
        $('#add-event-days').val(1).trigger('change');
        $('#add-from-date').datepicker('setDate', date.format('DD/MM/YYYY')).trigger('change');
    });

    $('#event_add_btn').click(function() {
        create_event(getFormDataAsJSON($('#add_event_form')));
    });

    $('#add-event-days , #add-from-date').on('change', function() {
        var days = $('#add-event-days').val();
        days--;
        var from_date = moment($('#add-from-date').val(), 'DD/MM/YYYY');
        if (!from_date.isBusinessDay()) {
            $('#add-from-date-info').text('this day holiday');
        } else {
            $('#add-from-date-info').text('');
        }
        $('#add-to-date').datepicker('option', 'minDate', $('#add-from-date').val());
        $('#add-to-date').datepicker('setDate', from_date.businessAdd(days, 'days').format('DD/MM/YYYY'));
        var et = $('#event_type').val();
        var info = '';
        if (event_limits[et]) {
            var remain = event_limits[et] - logged_in_user_data[et] - days - 1;

            if (user_extra_allowance && user_extra_allowance[login_name] && user_extra_allowance[login_name][et]) {
                remain += user_extra_allowance[login_name][et];
            }

            if (remain < 0) {
                info = remain * -1 + ' LOP';
            } else if (remain > 0) {
                info = remain + ' remaining';
            } else {
                info = "Done!"
            }
        }
        $('#add-event-days-info').text(info);
    });

    $('#add-to-date').on('change', function() {
        var from_date = moment($('#add-from-date').val(), 'DD/MM/YYYY');
        var to_date = moment($('#add-to-date').val(), 'DD/MM/YYYY');
        if (!to_date.isBusinessDay()) {
            $('#add-to-date-info').text('this day holiday');
        } else {
            $('#add-to-date-info').text('');
        }
        var days = from_date.businessDiff(to_date);
        days++;
        $('#add-event-days').val(days).trigger('change');
    });

    $('#download_bi_monthly').on('click', function(e) {
        progress_bar("Preparing download!");
        var table = getBiMonthlyTable(cumulative_data);
        if (!table) {
            m_alert("No records found, Please select month which has data");
            e.preventDefault();
            e.stopPropagation();
            progress_bar('', true);
            return 0;
        }
        var data = ExcellentExport.excel(this, table.get(0), 'Monthly Leaves');
        progress_bar('', true);
        return data;
    });


    $('#monthly-report').on('click', function() {
        if (!validate_session()) {
            return false;
        }
        var div = $('#bi-monthly-months');

        var str = '<div class="form-check">' +
            '<input class="form-check-input" type="checkbox" value="" id="">' +
            '&nbsp;<label class="form-check-label" for=""></label>' +
            '</div>';

        div.html('');
        var current_month = moment().month();

        $.each(moment.months(), function(number, month) {
            var ele = $(str);
            var selected = false;
            if (current_month - 1 == number) {
                selected = true;
            }
            ele.find('input').val(month).attr('id', 'bi-' + month).prop('checked', selected);
            ele.find('label').text(month).attr('for', 'bi-' + month);
            div.append(ele);
        });
    });

}

// Just for Fun -- :-)
function print_fun_info() {
    var start_date = moment().startOf('year');
    var end_date = moment().endOf('year');
    var today = moment();
    var total_wdays = start_date.businessDiff(end_date, 'days');
    var total_days = end_date.diff(start_date, 'days');
    console.log("\nNot sure why you came to look for console!", "\nBut here are some extra details I can give for you \n", "\nLet's say all weekends are considered as holidays", "\nAnd we have ", CompanyHolidays.length, " gvt. holidays ", HolidayList, "\n \nSo, In this year we have: ", total_days, " total days", "\nand in that, we have only ", total_wdays, ' working days', "\nand we also have 18PL + 12SL (30 leaves)", "\n \nWhich means we have ", (total_days - total_wdays), " + ", 30, " leaves in this year :-)");
    console.log("Completed Working days: ", start_date.businessDiff(today, 'days') - 1);
    console.log("Remaining working days: ", today.businessDiff(end_date, 'days'), ' (' + today.format('DD/MM/YY') + ' to ' + end_date.format('DD/MM/YY') + ')');
}

/**
 *  On load, initialize MSAL and restore a cached Microsoft session if any.
 */
function handleClientLoad() {
    progress_bar("Initializing...");
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    msal_init().then(function(account) {
        progress_bar("Signing in...");
        updateSigninStatus(!!account);
    }, function(err) {
        console.log('MSAL init failed: ', err);
        m_alert('ERROR: Failed to initialize Microsoft sign in!\n' + err.message);
        updateSigninStatus(false);
    });
}

/**
 *  Called when the signed in status changes, to update the UI
 *  appropriately. After a sign-in, the API is called.
 */
function updateSigninStatus(isSignedIn) {
	setConfigFromDrive(isSignedIn);
}

function loadCalendars(isSignedIn) {
    last_session_validated = moment();
    if (isSignedIn) {
        progress_bar("SignIn Success!");
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'inline';
        var params = getUrlVars();
        var from = params['from'];
        var to = params['to'];
        $('.valid-session').show();
        $('#sign-in-info').hide();
        $('.filter-box').show();
        render_calendar_link();

        $('#cal_list').html('').prop('disabled', true);
        leave_calendar_id = null;
        eraseCookie('sci');

        // Login name is needed before events are processed (own leave counts)
        graph_get('/me?$select=givenName,displayName').then(updateLoginInfo, function(err) {
            console.log('Failed to get user profile: ', err);
        }).then(function() {
            progress_bar("Getting Calendar");
            if (calendar_group_id) {
                return calendar_group_id;
            }
            var name = calendar_name.replace(/'/g, "''");
            return graph_get("/groups?$filter=displayName eq '" + encodeURIComponent(name) + "'&$select=id,displayName").then(function(data) {
                var groups = data.value || [];
                if (!groups.length) {
                    throw new Error('Group calendar "' + calendar_name + '" not found');
                }
                return groups[0].id;
            });
        }).then(function(group_id) {
            leave_calendar_id = group_id;
            return graph_get(calendar_path() + '?$select=id,name,canEdit');
        }).then(function(cal) {
            // A group calendar is always named "Calendar", show the group name instead
            cal.name = calendar_name;
            all_calendars = [cal];
            console.log("Using " + cal.name + " as the leave calendar");
            $('#cal_list').append($('<option>').val(leave_calendar_id).text(cal.name).attr('selected', 'selected'));
            listEvents(from, to);
        }, function(err) {
            console.log('Failed to get calendar: ', err);
            progress_bar("ERROR: Failed to get calendar!");
            m_alert('ERROR: Failed to get the calendar "' + calendar_name + '"!\n' + err.message +
                '\n\nYou need to be a member of the "' + calendar_name + '" group.');
        });

    } else {
        progress_bar("Logged Out!");
        authorizeButton.style.display = 'inline';
        signoutButton.style.display = 'none';
        $('.valid-session').hide();
        $('#sign-in-info').show();
        $('.filter-box').hide();
        progress_bar("", true);
        setTimeout(function() {
            $('.processing').hide()
        }, 1000);
    }
    progress_bar('', true);
}

function render_calendar_link() {
    if (calendar_link) {
        $('#show_cal').removeClass('hide');
    } else {
        $('#show_cal').addClass('hide');
    }
}

function session_expired() {
    m_alert("Session expired!");
    updateSigninStatus(false);
}

// Returns false when nobody is signed in. Otherwise checks, silently, that a token can
// still be obtained and calls on_valid only when it can.
function validate_session(on_valid) {
    console.log("Validating Session!");
    last_session_validated = moment();
    if (!msal_account()) {
        session_expired();
        return false;
    }
    get_token(false).then(function() {
        if (on_valid) {
            on_valid();
        }
    }, function(err) {
        console.log('Silent token renewal failed: ', err);
        session_expired();
    });
    return true;
}

/**
 *  Sign in the user upon button click.
 */
function handleAuthClick(event) {
    progress_bar('', true);
    $(".processing").show();
    msal_login().then(function() {
        updateSigninStatus(true);
    }, function(err) {
        console.log('Login failed: ', err);
        $(".processing").hide();
        m_alert('Login cancelled or failed!\n' + err.message);
        updateSigninStatus(false);
    });
    return false;
}

/**
 *  Sign out the user upon button click.
 */
function handleSignoutClick(event) {
    progress_bar("Logging Out!");
    msal_logout().then(function() {
        location.reload();
    }, function(err) {
        console.log('Logout failed: ', err);
        location.reload();
    });
}

/**
 * Fetch all events of the selected calendar between from and to (MM/DD/YYYY),
 * defaults to the current year.
 */
function listEvents(from, to) {

    progress_bar("Fetching data...");
    var calendar_id = get_calendar_id();

    if (!calendar_id) {
        progress_bar("ERROR: Failed to choose calendar!");
        return;
    }

    if (!from || !to) {
        from = moment().startOf('year').format('MM/DD/YYYY');
        to = moment().endOf('year').format('MM/DD/YYYY');
    }

    var from_date_obj = moment(from, 'MM/DD/YYYY');
    var to_date_obj = moment(to, 'MM/DD/YYYY');

    // to_date should be end of the day
    to_date_obj.add(1, 'days').subtract(1, 'seconds');;

    $("#datepicker-from").datepicker('setDate', from);
    $("#datepicker-to").datepicker('setDate', to);

    // Set ISO date format
    var from_date = from_date_obj.format();
    var to_date = to_date_obj.format();

    var url = '/groups/' + encodeURIComponent(calendar_id) + '/calendarView' +
        '?startDateTime=' + encodeURIComponent(from_date) +
        '&endDateTime=' + encodeURIComponent(to_date) +
        '&$select=subject,start,end,isAllDay,isCancelled' +
        '&$orderby=start/dateTime' +
        '&$top=500';

    graph_get_all(url).then(function(items) {
        var events = $.map($.grep(items, function(ev) { return !ev.isCancelled; }), to_legacy_event);
        cal_all_events = events;
        global_from_date = from_date_obj;
        global_to_date = to_date_obj;
        process_all_events(events);

        $.each(remove_events, function(i, v) {
            $("#type_" + v).removeAttr('checked').trigger('change');
        });
    }, function(err) {
        console.log('Failed to get events: ', err);
        progress_bar("ERROR: Failed to get events!");
        m_alert('ERROR: Failed to get events!\n' + err.message);
    });
}

function get_calendar_id() {
    return leave_calendar_id;
}

// Graph path of the leave calendar (the calendar of the Microsoft 365 group)
function calendar_path() {
    return '/groups/' + encodeURIComponent(leave_calendar_id) + '/calendar';
}

// Logged in user info from Microsoft Graph /me
function updateLoginInfo(userProfile) {
    if (!userProfile) {
        return;
    }
    var first_name = userProfile.givenName || (userProfile.displayName || '').split(' ')[0];
    console.log("Found Logged in User Name: ", first_name);
    login_name = first_name;
    signoutButton.innerHTML = ' ' + login_name;
    $('#monthly-report').addClass('hide');
    $.each(admin_names, function(name) {
        if (name == login_name.toUpperCase()) {
            admin_login = true;
            $('#monthly-report').removeClass('hide');
            console.log('Showing Monthly Report button for user: ', name);
            //if(name == 'VASUNDHAR') {
            //    enable_v_filter();
            //}
            return;
        }
    });
}

/* This function is not used currently */
function enable_v_filter() {
    $('#v-filter').removeClass('hide');
    event_list_table.yadcf(
        [{
            column_number: 0,
            filter_type: 'multi_select',
            filter_container_id: 'v-filter-1'
        }, {
            column_number: 1,
            text_data_delimiter: ",",
            filter_type: 'multi_select',
            filter_container_id: 'v-filter-2'
        }, {
            column_number: 3,
            text_data_delimiter: ",",
            filter_type: 'multi_select',
            filter_container_id: 'v-filter-3'
        }]
    );
}

function getUrlVars() {
    var vars = [],
        hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        if (hash[1] && hash[1].match('#')) {
            hash[1] = hash[1].split('#')[0];
        }
        vars[hash[0]] = hash[1];
    }
    return vars;
}

// TODO: We should find a way to stop processing same data more than once
function process_all_events(events) {
    var col_0_vals = {};
    var all_rows = [];
    var birthdays = {};
    var auto_completes = {};
    cumulative_data = {};
    var returns;
    if (events && events.length > 0) {
        for (i = 0; i < events.length; i++) {
            var event = events[i];
            var start = get_dataTime(event.start);
            var end = get_dataTime(event.end);

            if(start < global_from_date) {
                start = global_from_date;
            }
            if(end > global_to_date) {
                end = global_to_date;
            }

            if(!start.isBusinessDay()) {
                start = start.nextBusinessDay();
            }

            if(start != end && !end.isBusinessDay()) {
                end = end.nextBusinessDay();
            }

            var summary = event.summary;

            var cols = split_summary(summary);

            var days_past = 0;

            col_0_vals[cols[0]] = 1;

            returns = days_diff(start, end);
            var days = returns[0];
            var event_dates = returns[1];
            returns = getFormatedTime(start, days, end);
            var date = returns[0];
            var month = returns[1];
            var day = returns[2];

            // May be some other more accurate way
            if (cols[0].match(/^H/i)) {
                if (cols[0] != 'HBD') {
                    days = days / 2;
                }
            }

            all_rows[i] = [
                cols[0],
                cols[1],
                date,
                month + ", " + day,
                event_dates,
                days
            ];

            auto_completes[cols[1]] = 1;

            if (cols[0] == 'HBD') {
                birthdays[cols[1]] = date;
            }

            var all_dates = getAllBuisnessDates(start, days);
            if (all_dates) {
                $.each(all_dates, function(m, dates) {
                    if (!cols || !cols[0] || !cols[1]) {
                        return true;
                    }
                    if (!cumulative_data[m]) {
                        cumulative_data[m] = {};
                    }
                    if (!cumulative_data[m][cols[1]]) {
                        cumulative_data[m][cols[1]] = {};
                    }
                    if (!cumulative_data[m][cols[1]][cols[0]]) {
                        cumulative_data[m][cols[1]][cols[0]] = dates;
                    } else {
                        cumulative_data[m][cols[1]][cols[0]] = cumulative_data[m][cols[1]][cols[0]].concat(dates);
                    }
                });
            }
        }
    }

    // Update type filter checkboxs with available types
    var filter_box = $("#type_filter_box");
    $.each(Type_Filter, function(i, val) {
        var id = val.replace(/ /g, "_");
        if ($("#type_" + id).length < 1)
            filter_box.append("<input type='checkbox' checked='checked' id='type_" + id + "'>" + val + "</input> &nbsp;");
    });

    // Set auto complete suggestions for search bar
    $('#global_search , #all-events_filter input').autocomplete({
        source: Object.keys(auto_completes)
    });

    // Draw tables
    $('#all-events').DataTable().clear();
    $('#all-events').DataTable().rows.add(all_rows).draw();
    add_birthdays(birthdays);
}

function getAllBuisnessDates(start, days) {
    var first_date = start.clone();
    var month_dates = {};
    for (var i = 0; i < days; i++) {
        var m = first_date.format('MMMM');
        var d = first_date.format('DD');
        if (!month_dates[m]) {
            month_dates[m] = [];
        }
        month_dates[m].push(d);
        first_date = first_date.businessAdd(1, 'days');
    }
    return month_dates;
}

function get_dataTime(event_date) {
    var date = event_date.dateTime;
    if (!date) {
        date = event_date.date;
    }
    return new moment(date);
}

function getFormatedTime(date_time, days, end_time) {
    var time_str = date_time.format('YYYY-MM-DD');
    var month = date_time.format('MMM');
    var day = date_time.format('ddd');
    var start_hr = date_time.format('H');
    var end_hr = end_time.format('H');
    if (days < 1 && days != 0) {
        time_str += "<br>" + date_time.format('h:mm a');
        time_str += " - " + end_time.format('h:mm a');
    }
    return [time_str, month, day];
}

function days_diff(date1, date2) {
    var diff = date2.businessDiff(date1, 'days');
	if (diff == 0 && ( date1.isBefore(date2) || date1.isSame(date2, 'day'))) {
        diff = 1;
    }
    var date3 = date1.clone();
    var event_days = date1.format('Do');
    if (diff < 5) {
        for (var i = 1; i < diff; i++) {
            date3 = date3.businessAdd(1, 'day');
            event_days += ', ' + date3.format('Do');
        }
    } else {
        event_days = date1.format('MMM Do') + " to " + date3.businessAdd((diff - 1), 'day').format('MMM Do');
    }
    return [diff, event_days];
}

function split_summary(summary) {

    if (!summary) {
        return ['-', '-'];
    }
    var cols = [];

    var cols_t = summary.split(':');

    if (cols_t.length < 2) {
        cols_t = summary.split('-');
    }

    cols_t[0] = cols_t[0].trim();
    if (cols_t[1])
        cols_t[1] = cols_t[1].trim();

    // Just because swapna added it in full form
    if (cols_t[0] == 'Maternity Leave') {
        cols_t[0] = 'MtL';
    }

    if (temp_types.indexOf(cols_t[0].toUpperCase()) >= 0) {
        cols[0] = cols_t[0];
        cols_t.splice(0, 1);
    } else if (cols_t[1] && (Type_Filter.indexOf(cols_t[1].toUpperCase()) >= 0)) {
        cols[0] = cols_t[1];
        cols_t.splice(1, 1);
    } else {
        cols[0] = '-';
    }

    cols[0] = cols[0].toUpperCase();

    if (!group_name_case_sensitive) {
        cols[1] = cols_t.toString().trim().toTitleCase();
    } else {
        cols[1] = cols_t.toString().trim();
    }

    if (group_first_name && cols[1].match(' ') && !cols[1].toLowerCase().match('shefali')) {
		// For shefali it should no consider only the first name
		//console.log(cols[1]);
        cols[1] = cols[1].split(' ')[0];
    }

    if (!cols[1])
        cols[1] = '-';

    return cols;
}

function get_time(d) {
    var a_p = "";
    var curr_hour = d.getHours();
    if (curr_hour < 12) {
        a_p = "AM";
    } else {
        a_p = "PM";
    }
    if (curr_hour == 0) {
        curr_hour = 12;
    }
    if (curr_hour > 12) {
        curr_hour = curr_hour - 12;
    }

    var curr_min = d.getMinutes();

    curr_min = curr_min + "";

    if (curr_min.length == 1) {
        curr_min = "0" + curr_min;
    }

    return curr_hour + ":" + curr_min + " " + a_p;
}

function refresh_data() {

    progress_bar("Refreshing...");
    var params = getUrlVars();
    console.log(params);
    var from = $("#datepicker-from").val();
    var to = $("#datepicker-to").val();
    listEvents(from, to);
}

function update_chart() {
    var table = $('#all-events').DataTable();
    table.on('search.dt', function() {
        //filtered rows data as arrays
        clearTimeout(count_table_timer);
        count_table_timer = setTimeout(calculate_counts, 500, table);
    });
}

function chart_data(x_axis, series, title_txt) {
    var chart = {
        type: 'column'
    };

    var xAxis = {
        categories: x_axis,
        title: {
            text: null
        }
    };
    var yAxis = {
        min: 0,
        title: {
            text: 'Days',
            align: 'high'
        },
        labels: {
            overflow: 'justify'
        }
    };
    var tooltip = {
        valueSuffix: ' day(s)'
    };

    var dataLabels_enabled = false;

    if (x_axis.length * series.length < 50) {
        dataLabels_enabled = true;
    }

    var plotOptions = {
        bar: {
            dataLabels: {
                enabled: true,
                color: '#000',
                style: {
                    fontWeight: 'bolder'
                },
                formatter: function() {
                    return this.x + ': ' + this.y
                },
                inside: true,
                rotation: 270
            }
        },
        series: {
            dataLabels: {
                enabled: dataLabels_enabled,
                color: '#FFFFFF',
                style: {
                    fontWeight: 'bolder'
                },
                formatter: function() {
                    return this.y
                },
                inside: true
                //rotation: 270
            },
            pointPadding: 0,
            groupPadding: 0.1
        }
    };

    var legend = {
        layout: 'vertical',
        align: 'right',
        verticalAlign: 'top',
        x: 0,
        y: 0,
        floating: true,
        borderWidth: 1,
        backgroundColor: ((Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'),
        shadow: true
    };
    var credits = {
        enabled: true
    };

	if(!title_txt) {
		title_txt = 'Graphical Representation';
	}

    subtitle = {
        text: 'Data based on the applied filter'
    };
    title = {
        text: title_txt
    };

    var json = {};
    json.chart = chart;
    json.title = title;
    json.subtitle = subtitle;
    json.tooltip = tooltip;
    json.xAxis = xAxis;
    json.yAxis = yAxis;
    json.series = series;
    json.plotOptions = plotOptions;
    json.legend = legend;
    json.credits = credits;

    return json;
}

function draw_graph(optimize_data, events_header) {
    var x_axis = Object.keys(optimize_data);
    var y_axis = Object.keys(events_header);
    var series = [];
    var data_y_t = {};
    if (x_axis.length < 2) {
        $('#chart-container').collapse('hide');
        return;
    }

    $.each(y_axis, function(i, type_f) {
        $.each(x_axis, function(j, name) {
            var val = optimize_data[name][type_f];
            if (!val)
                val = 0;
            if (!data_y_t[type_f])
                data_y_t[type_f] = [];

            data_y_t[type_f].push(val);
        });
    });


    $.each(y_axis, function(i, key) {
        if (!data_y_t[key]) {
            data_y_t[key] = [];
        }
        series.push({
            name: key,
            data: data_y_t[key]
        });
    });

    var json = chart_data(x_axis, series, 'Name wise View');

    $("#chart-container").highcharts(json);
    $("#chart-container").collapse('show');
}

function draw_monthly_chart(monthly_data) {
    var series = [];
    var data_y_t = {};
    var x_axis = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var x_axis_t = Object.keys(monthly_data.types);

    $.each(x_axis, function(i, month) {
        var data = monthly_data[month];
        if (!data) {
            data = {};
        }
        $.each(x_axis_t, function(i, type) {
            if (!data_y_t[type]) {
                data_y_t[type] = [];
            }
            if (data[type]) {
                data_y_t[type].push(data[type]);
            } else {
                data_y_t[type].push(0);
            }
        });
    });

    $.each(data_y_t, function(type, array) {
        series.push({
            name: type,
            data: array
        });
    });

    var json = chart_data(x_axis, series, 'Month wise View');

    $("#chart-container-monthly").highcharts(json);
    $("#chart-container-monthly").collapse('show');
}

function draw_weekly_chart(weekly_data) {
    var series = [];
    var data_y_t = {};
    var x_axis = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    var x_axis_t = Object.keys(weekly_data.types);
    $.each(x_axis, function(i, day) {
        var data = weekly_data[day];
        if (!data) {
            data = {};
        }
        $.each(x_axis_t, function(i, type) {
            if (!data_y_t[type]) {
                data_y_t[type] = [];
            }
            if (data[type]) {
                data_y_t[type].push(data[type]);
            } else {
                data_y_t[type].push(0);
            }
        });
    });

    $.each(data_y_t, function(type, array) {
        series.push({
            name: type,
            data: array
        });
    });

    var json = chart_data(x_axis, series, 'Day wise View');

    $("#chart-container-weekly").highcharts(json);
    $("#chart-container-weekly").collapse('show');
}

function calculate_counts(table) {
    progress_bar("Calculating counts...");
    $('div.tooltip').remove();
    var optimize_data = {};
    var events_header = {};
    var monthly_data = {};
    var weekly_data = {};
    var filtered_data = table.rows({
        filter: 'applied'
    }).data();
    $.each(filtered_data, function(i, row) {
        var event = row[0];
        if (!optimize_data[row[1]])
            optimize_data[row[1]] = {};

        if (event.match(/^H/i) && event != 'HBD') {
            event = event.substring(1);
        }

        if (!optimize_data[row[1]][event]) {
            optimize_data[row[1]][event] = 0;
        }

        if (!loging_data_computed && row[1] == login_name) {
            if (!logged_in_user_data[event]) {
                logged_in_user_data[event] = 0;
            }
            logged_in_user_data[event] += row[5];
        }

        events_header[event] = 1;
        optimize_data[row[1]][event] += row[5];
        monthly_data = add_monthly_data(event, row, monthly_data);
        weekly_data = add_weekly_data(event, row, weekly_data);
    });
    loging_data_computed = true;

    populate_counts_table(optimize_data, Object.keys(events_header));
    progress_bar('', true);

    setTimeout(draw_fuel_graph, 100);
    if (show_graph_flag) {
        setTimeout(draw_monthly_chart, 100, monthly_data);
        setTimeout(draw_weekly_chart, 100, weekly_data);
        setTimeout(draw_graph, 100, optimize_data, events_header);
    }
}

function add_monthly_data(type, event, monthly_data) {
    if (!event[2] || !event[5]) {
        return monthly_data;
    }
    if (type != "-") {
        var diff = event[5];
        var date1 = moment(event[2].split(' ')[0]);
        if (diff < 2) {
            return _add_month_data(monthly_data, date1, type, diff);
        }
        var date3 = date1.clone().businessAdd(diff);
        if (date1.format('MMM') == date3.format('MMM')) {
            return _add_month_data(monthly_data, date1, type, diff);
        } else {
            for (var i = 0; i < diff; i++) {
                monthly_data = _add_month_data(monthly_data, date1, type, 1);
                date3 = date1.businessAdd(1, 'day');
            }
        }
    }
    return monthly_data;
}

function add_weekly_data(type, event, weekly_data) {
    if (!event[2] || !event[5]) {
        return weekly_data;
    }
    if (type != "-") {
        var diff = event[5];
        var date1 = moment(event[2].split(' ')[0]);
        if (diff < 2) {
            return _add_weekly_data(weekly_data, date1, type, diff);
        } else {
            for (var i = 0; i < diff; i++) {
                weekly_data = _add_weekly_data(weekly_data, date1, type, 1);
                date1 = date1.businessAdd(1, 'day');
            }
        }
    }
    return weekly_data;
}


function _add_month_data(monthly_data, date, type, diff) {
    var mon = date.format('MMM');
    if (!monthly_data[mon]) {
        monthly_data[mon] = {};
        monthly_data[mon][type] = 0;
    } else if (!monthly_data[mon][type]) {
        monthly_data[mon][type] = 0;
    }
    monthly_data[mon][type] += diff;
    if (!monthly_data.types) {
        monthly_data.types = {};
    }
    monthly_data.types[type] = 1;
    return monthly_data;
}

function _add_weekly_data(weekly_data, date, type, diff) {
    var day = date.format('ddd');
    if (!weekly_data[day]) {
        weekly_data[day] = {};
        weekly_data[day][type] = 0;
    } else if (!weekly_data[day][type]) {
        weekly_data[day][type] = 0;
    }
    weekly_data[day][type] += diff;
    if (!weekly_data.types) {
        weekly_data.types = {};
    }
    weekly_data.types[type] = 1;
    return weekly_data;
}

function populate_counts_table(filtered_data, cols) {
    // Show a table with leaves details, with dynamic columns

    // Remove old table
    if (all_events_report) {
        all_events_report.fnDestroy({
            remove: 1
        });
    }

    // create new table
    $('#report-table-cnt').html("<table id='all-events-report' class='table table-striped'></table>");
    var report_table = $("#all-events-report");

    // Add header
    var row_str = '<thead><tr><th>Name<br/></th>';
    $.each(cols, function(l, k) {
        row_str += '<th>' + k + '</th>';
    });
    row_str += '</tr></thead>';
    report_table.html(row_str);

    var leaves_remain = {};

    window.leaves_remain = function() {
        console.log(leaves_remain);
    }

    $.each(filtered_data, function(name, event_days) {
        row_str = '<tr>';
        row_str += '<td class="link">' + name + '</td>';
        leaves_remain[name] = {};
        var td_class = 'link high';
        $.each(cols, function(i, event) {
            var tt_msg = event + " : " + name;
            if (event_days[event] && event_days[event] > 0) {
                tt_msg += "\nTaken/Applied: " + event_days[event];
                if (event_limits[event]) {
                    event_limit_count = event_limits[event];
                    if (user_extra_allowance && user_extra_allowance[name] && user_extra_allowance[name][event]) {
                        event_limit_count += user_extra_allowance[name][event];
                    }

                    var remain_days = event_limit_count - event_days[event];
                    var taken_percent = (event_days[event] / event_limit_count) * 100;
                    tt_msg += ' leave(s)  (' + parseInt(taken_percent) + '%)';

                    if (remain_days > 0) {
                        tt_msg += "\nRemaining: " + remain_days + ' leave(s)';
                        leaves_remain[name][event] = remain_days;
                    } else if (remain_days < 0) {
                        tt_msg += "\nOverdue: " + (remain_days * -1) + ' leave(s)';
                        td_class += ' danger'
                        tt_msg += "\nAlready in LOP";
                    } else if (remain_days == 0) {
                        td_class += ' warning'
                        tt_msg += "\nUsed all";
                    }

                    if (taken_percent > 80 && taken_percent < 100) {
                        td_class += ' warning'
                    }
                }
                row_str += '<td class="' + td_class + '" data-toggle="tooltip" title="' + tt_msg + '">' + event_days[event] + '</td>';
            } else {
                tt_msg += "\nTaken/Applied: 0";
                if (event_limits[event]) {
					var remain_days = event_limits[event];
					if (user_extra_allowance && user_extra_allowance[name] && user_extra_allowance[name][event]) {
						remain_days += user_extra_allowance[name][event];
					}
                    tt_msg += "\nRemaining: " + remain_days + ' leave(s)';
                }
                row_str += '<td class="' + td_class + '" data-toggle="tooltip" title="' + tt_msg + '">0</td>';
            }
        });
        row_str += '</tr>';
        report_table.append(row_str);
    });
    report_table.find('td').tooltip({
        container: 'body'
    });

    all_events_report = $('#all-events-report').dataTable({
        "bJQueryUI": true,
        "bProcessing": true,
        'iDisplayLength': 50
    }).yadcf([{
        column_number: 0
        //column_data_type: "html"
    }]);

    return;
}

function set_today_event(row) {
    if (!today_events[row[0]]) {
        today_events[row[0]] = {};
    } else if (!today_events[row[0]][row[1]]) {
        today_events[row[0]][row[1]] = 0;
    }
    today_events[row[0]][row[1]]++;
}

function create_event(data) {
    validate_session(function() {
        submit_event(data);
    });
}

function submit_event(data) {

    var calendar = get_calendar_id() ? all_calendars[0] : null;
    if (!calendar) {
        m_alert('The calendar "' + calendar_name + '" is not available');
        return;
    }
    if (calendar.canEdit === false) {
        m_alert('You do not have permission to add events to the calendar "' + calendar.name + '"');
        return;
    }

    var from_date = moment(data.from_date, 'DD/MM/YYYY');
    var last_date;
    var desc = '';
    var part = '';

    if (data.add_event_day == 'FH' || data.add_event_day == 'SH') {
        last_date = from_date.clone();
        if(data.add_event_day == 'FH') {
            part = 'First Half';
        }
        else if(data.add_event_day == 'SH') {
            part = 'Second Half';
        }
        desc = '(' + part + ')';
    } else {
        last_date = moment(data.to_date, 'DD/MM/YYYY');
    }

    var start_str = from_date.format('YYYY-MM-DD');
    var end_str = last_date.format('YYYY-MM-DD');
    // All day events end at midnight after the last day
    var end_exclusive = last_date.clone().add(1, 'days').format('YYYY-MM-DD');

    var event = {
        'subject': data.new_event_title,
        'isAllDay': true,
        'location': {
            'displayName': data.location || ''
        },
        'body': {
            'contentType': 'text',
            'content': $.trim(desc + ' ' + (data.description || ''))
        },
        'start': {
            'dateTime': start_str + 'T00:00:00',
            'timeZone': GRAPH_TIME_ZONE
        },
        'end': {
            'dateTime': end_exclusive + 'T00:00:00',
            'timeZone': GRAPH_TIME_ZONE
        }
    };

    var details = "Title:  " + event.subject + "\n";
    details += "From:  " + start_str + "\n";
    details += "To:  " + end_str + "\n\n";
    details += " I will be creating above event.";

    if (!confirm(details)) {
        console.log("User cancelled create event!");
        return;
    }

    progress_bar("Creating event...");
    graph_post(calendar_path() + '/events', event, true).then(function(created) {
        progress_bar('', true);
        graph_resp_process(created, function() {
            $('#add_event_modal').modal('hide');
            notify_slack_event_created({
                title: event.subject,
                from: start_str,
                to: end_str,
                part: part,
                description: $.trim(data.description || ''),
                calendar: calendar ? calendar.name : $('#cal_list option:selected').text(),
                created_by: login_name
            });
        });
    }, function(err) {
        progress_bar('', true);
        graph_resp_process({
            error: {
                message: err.message
            }
        });
    });
}

function getFormDataAsJSON(form) {
    var o = {};
    var a = form.serializeArray();
    $.each(a, function() {
        if (o[this.name]) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
}

function getBiMonthlyTable(data) {
    var table = $('<table class="table">');

    var total_cols = temp_types.length;
    total_cols -= 2;
    var rec_found = 0;

    $.each(data, function(month, names) {
        if (!$('#bi-' + month).length || !$('#bi-' + month).is(':checked')) {
            return true;
        }
        table.append('<tr></tr>');
        table.append('<tr></tr>');
        table.append('<tr><th colspan="' + total_cols + '"><b><center>' + month + '</center></b></th></tr>');
        var row = $('<tr>');
        row.append('<td></td>');
        $.each(temp_types, function(i, event) {
            if (event.match(/HBD|-$/)) {
                return true;
            }
            row.append('<td><b><center>' + event + '</center></b></td>');
        });
        table.append(row);

        $.each(names, function(name, events) {
            var row1 = $('<tr>');
            row1.append('<td><strong>' + name + '</strong></td>');
            var keys = Object.keys(events);
            if (keys.length == 1 && keys[0] == '-') {
                return true;
            }
            var atleast_one = false;
            $.each(temp_types, function(i, event) {
                if (event.match(/HBD|-$/)) {
                    return true;
                }
                if (events[event]) {
                    row1.append('<td>' + events[event] + '</td>');
                    atleast_one = true;
                } else {
                    row1.append('<td>-</td>');
                }
            });
            if (atleast_one) {
                table.append(row1);
                rec_found = 1;
            }
        });
    });

    if (rec_found == 0) {
        return;
    }

    return table;
}

function graph_resp_process(event, callback) {

    console.log('Graph Response: ', event);
    if (event.error) {
        var msg = 'ERROR: ' + event.error.message;
        if (login_name != 'Dinesh') {
            msg += "\nSeems bug? Inform to Dinesh D!";
        }
        m_alert(msg);
    } else if (event.id) {
        listEvents();
        if (callback) {
            callback();
        }
    } else {
        m_alert('Something went wrong!');
    }
}

var progress_bar_timer;

function progress_bar(msg, completed) {
    if (!completed) {
        $('#processing_msg').text(msg);
        progress_bar_timer = setTimeout(function() {
            $(".processing").show();
        }, 1);
    } else {
        clearTimeout(progress_bar_timer);
        $(".processing").hide();
    }
}

var d3Gauges = {};
var d3_gauge_config = liquidFillGaugeDefaultSettings();
d3_gauge_config.circleColor = "#2fbeb5";
d3_gauge_config.minValue = 0;
d3_gauge_config.maxValue = total_emps;
d3_gauge_config.textColor = "#FF4444";
d3_gauge_config.waveTextColor = "#FFAAAA";
d3_gauge_config.waveColor = "#2fbea4";
d3_gauge_config.circleThickness = 0.05;
d3_gauge_config.textVertPosition = 0.8;
d3_gauge_config.waveAnimateTime = 1000;
d3_gauge_config.displayPercent = false;

var today_event_names = {};
var today_events_count = {};
var d3_fuel_grap_drawn = false;
var url_params = getUrlVars();

function draw_fuel_graph() {

    if (d3_fuel_grap_drawn) {
        return;
    }

    var search_param = login_name;
    if (admin_names[login_name.toUpperCase()]) {
        search_param = '';
    }
    if (url_params['search']) {
        search_param = url_params['search'];
    }
    if (search_param && search_param != '') {
        url_params['search'] = null;
        $('#global_search').val(search_param).trigger('keyup', '13');
    }

    $('#show-graph').trigger('click');

    if(!show_fuel_gauge) {
        $('#total_events_gauge').addClass('hide');
        d3_fuel_grap_drawn = true;
        return;
    }

    $('#total_events_gauge').collapse('show');
    var total = total_emps;
    today_event_names = {};
    today_events_count = {};
    $.each(temp_types, function(i, t) {
        if (!today_events[t] || t == '-' || t == 'HBD') {
            return true;
        }
        var names = Object.keys(today_events[t]);
        var count = names.length;
        if (t.match(/^H/i)) {
            count = count / 2;
            t = t.substring(1);
        }

        total -= count;

        if (!today_event_names[t]) {
            today_event_names[t] = [];
            today_events_count[t] = 0;
        }
        $.each(names, function(i, name) {
            today_event_names[t].push(name);
        });
        today_events_count[t] += count;
    });
    today_events_count['TOTAL'] = total;

    $.each(['TOTAL', 'WFH', 'SL', 'PL'], function(i, v) {
        if (!today_events_count[v]) {
            today_events_count[v] = 0;
        }
        if (!d3Gauges['gauge_' + v]) {
            d3Gauges['gauge_' + v] = loadLiquidFillGauge("fillgauge_" + v, today_events_count[v], d3_gauge_config);
        } else {
            d3Gauges['gauge_' + v].update(today_events_count[v]);
        }
    });

    $.each(['SL', 'PL'], function(i, v) {
        var cp_config = d3_gauge_config;
        cp_config.maxValue = event_limits[v];
        if (user_extra_allowance && user_extra_allowance[login_name] && user_extra_allowance[login_name][v]) {
            cp_config.maxValue += user_extra_allowance[login_name][v];
        }
        if (!logged_in_user_data[v]) {
            logged_in_user_data[v] = 0;
        }
        if (!d3Gauges['gauge_ind' + v]) {
            d3Gauges['gauge_ind' + v] = loadLiquidFillGauge("fillgauge_ind_" + v, logged_in_user_data[v], cp_config);
        } else {
            d3Gauges['gauge_ind' + v].update(logged_in_user_data[v]);
        }
    });
    d3_fuel_grap_drawn = true;
}

function show_event_names(t) {
    if (t.match(/^IN-/)) {
        var tt = t.split('-')[1];
        var limit = event_limits[tt];
        if (user_extra_allowance && user_extra_allowance[login_name] && user_extra_allowance[login_name][tt]) {
            limit += user_extra_allowance[login_name][tt];
        }
        var msg = 'You(' + login_name + ') have taken/applied ';
        msg += logged_in_user_data[tt] + ' ' + tt + ' out of ' + limit;
        msg += "\n \n*Counts calculated per calendar year";
        m_alert(msg, "Your(" + login_name + ") " + tt);
    } else if (t == 'ALL') {
        m_alert("I don't have all the names to display", "Today Present");
    } else if (!today_event_names[t]) {
        m_alert("No " + t + " today, or no one updated today", 'Today ' + t);
    } else {
        var msg = 'Today ' + t + " taken by \n \n";
        msg += today_event_names[t].join(', ');
        m_alert(msg, 'Today ' + t);
    }
}

function m_alert(msg, title) {
    var modal = $('#alert-modal');
    if (!title) {
        title = 'Alert';
    }
    modal.find('.title').html(title);
    msg = msg.replace(/(?:\&rho;n|\r|\n)/g, '<br>');
    modal.find('.body').html(msg);
    modal.modal('show');
}

var bd_done = false;

function add_birthdays(BirthdayList) {
    if (bd_done) {
        return false;
    }
    var bd_list_table = $('#birthdays_list tbody');
    bd_list_table.html('');
    var today = moment();
    for (name in BirthdayList) {
        var date = moment(BirthdayList[name]);
        if (date < today) {
            date = date.add(1, 'year');
        }
        var d = date.format('MMM, Do - ddd');
        var d_o = date.format('YYYYMMDD');
        var style = '';
        if (!date.isBusinessDay()) {
            style = 'danger';
        }
        var newline = '<tr class="' + style + '"><td data-order="' + d_o + '">' + d + "</td><td>" + name + "</td></tr>";
        bd_list_table.append(newline);
    }
    $('#birthdays_list').DataTable({
        paging: false
    });
    bd_done = true;
}

// Cookies
function createCookie(name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = "; expires=" + date.toGMTString();
    } else var expires = "";

    document.cookie = name + "=" + value + expires + "; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name, "", -1);
}

var doc_config;
function setConfigFromDrive(isSignedIn) {

	if(!isSignedIn) {
		loadCalendars(isSignedIn);
		return;
	}

	progress_bar("Loading workspace config...");
	graph_get('/shares/' + graph_share_id(CONFIG_SHARE_URL) + '/driveItem').then(function(item) {
		var download_url = item['@microsoft.graph.downloadUrl'];
		if (!download_url) {
			throw new Error('No download URL for the config file');
		}
		return fetch(download_url);
	}).then(function(resp) {
		if (!resp.ok) {
			throw new Error(resp.status + ' ' + resp.statusText);
		}
		return resp.text();
	}).then(function(text) {
		apply_workspace_config(text, isSignedIn);
	}, function(err) {
		console.log('Error: ', err);
		progress_bar('', true);
		alert("Your workspace does not seem to have this app configured");
	});
	console.log("setConfig requested");
}

function apply_workspace_config(text, isSignedIn) {
	var json_config;
	try {
		json_config = JSON.parse(text.replace(/^﻿/, ''));
	} catch (e) {
		console.log('Invalid workspace config: ', e);
		progress_bar('', true);
		alert("Your workspace config is invalid: " + e.message);
		return;
	}
	doc_config = text;
	Type_Filter = json_config.typeFilter;
	remove_events = json_config.removeEvents;
	total_emps = json_config.totalEmps;
	event_limits = json_config.eventLimits;
	admin_names = json_config.adminNames;
	show_fuel_gauge = json_config.showFuelGauge;
	HolidayList = json_config.holidayList;
	company_name = json_config.companyName;
	user_extra_allowance = json_config.userExtraAllowance;
	slack_webhook_url = json_config.slackWebhookUrl || '';
	calendar_link = json_config.calendarLink || '';
	calendar_name = json_config.calendarName || calendar_name;
	calendar_group_id = json_config.calendarGroupId || '';
	console.log("Config loaded");
	init();
	loadCalendars(isSignedIn);
}
