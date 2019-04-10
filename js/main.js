var CompanyHolidays;

// To filter Half day events from calendar
var temp_types = [];

var all_events_report;
var count_table_timer;
var login_name = '';
var calendar_iframe;
var cumulative_data = {};
var cal_all_events;
var admin_login = false;
var logged_in_user_data = {};
var loging_data_computed = false;
var show_graph_flag = false;
var today = moment();
var this_month = today.format('YYYY-MM');
var today_date = today.format('YYYY-MM-DD');
var today_tmrw = [today.format('DD'), today.clone().add(1,'days').format('DD')];
var today_events = {};
var last_session_validated = 0;

// Array of API discovery doc URLs for APIs used by the quickstart
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest"];

// Authorization scopes required by the API; multiple scopes can be
// included, separated by spaces.
var SCOPES = "https://www.googleapis.com/auth/calendar";

var authorizeButton;
var signoutButton;

// Processor options
var group_name_case_sensitive = 0;
var group_first_name = 1;

var help = "group_name_case_sensitive, group_first_name, login_name, refresh_data().";

$(document).ready(function() {

	CompanyHolidays = _.keys(HolidayList);
	moment.locale('en-GB', {
		holidays: CompanyHolidays,
		holidayFormat: 'YYYY-MM-DD',
		workingWeekdays: [1,2,3,4,5]
	});

	$(".filter-box").hide();
	$(window).on("focus", function(event)
	{
		if(moment() - last_session_validated > 180000) {
			validate_session();
		}
		return false;
	});

	$.each(Type_Filter, function(i,v){
		temp_types.push(v);
		temp_types.push('H' + v);
	});

	$('.company_name').text(company_name);

	authorizeButton = document.getElementById("authorize-button");
	signoutButton = document.getElementById("signout-button");

	calendar_iframe = '<iframe src="https://calendar.google.com/calendar/embed?src=' + encodeURI(Calendar_id) + '&ctz=Asia/Calcutta" style="border: 0" width="800" height="600" frameborder="0" scrolling="no"></iframe>';

	init_holiday_list();
	initialize();

	bind_events();
});

function init_holiday_list() {
	var leave_list_table = $('#holidays_list tbody');
	var today = moment();
	for( key in HolidayList) {
		var date = moment(key);
		d = date.format('DD-MM-YYYY - dddd');
		var day = date.format('ddd');
		var style;
		if(day == 'Sun' || day == 'Sat'){
			style = 'danger';
		}
		else if(day == 'Fri' || day == 'Mon'){
			style = 'success'
		}
		else {
			style = 'info';
		}
		if(date < today) {
			style = 'warning past hide';
		}
		var newline = '<tr class="' + style + '"><td>' + d + "</td><td>" + HolidayList[key] + "</td></tr>";
		leave_list_table.append(newline);
	}

	$('#holiday-show-past').click(function() {
		if($(this).hasClass('sp')){
			$(this).removeClass('sp').text('Hide Past Dates');
			leave_list_table.find('.past').removeClass('hide');
		}
		else {
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
			if(!show) {
				if(id.match(/^H/i) && id != 'HBD'){
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
	$('#add-from-date').datepicker({ dateFormat: 'dd/mm/yy' });
	$('#add-to-date').datepicker({ dateFormat: 'dd/mm/yy' });
	$('#all-events-report').dataTable();
	$('.options-box button').tooltip({
		placement: 'bottom'
	});
}

function bind_events() {
	$(document).on('click','td.link', function(){
		var cell = $(this);
		progress_bar("Applying filter...");
		var name = $('td:first', cell.parents('tr')).text();
		var th = $('#all-events-report th').eq(cell.index()).text();
		var type = th;//th.split(' in ')[0];
		console.log("Name: " + name + "Type: " + type);
		var name_search = $('#yadcf-filter--all-events-1');
		var type_search = $('#yadcf-filter--all-events-0');
		window.scrollTo(0,30);
		name_search.find('option[value="'+ name +'"]').prop('selected', true).trigger('change');
		type_search.find('option[value="'+ type +'"]').prop('selected', true).trigger('change');
		progress_bar('',true);
		$('#filter-reset').removeClass('hide');
		document.body.scrollTop = document.documentElement.scrollTop = 0;
	});

	$('input[name="add_event_day"]').on('change', function() {
		var day_type = $('input[name="add_event_day"]:checked').val();
		if(day_type == 'FULL'){
			$('#add-event-from-label').html('From');
			$('#add-event-to').show();
			$('#add-event-days-div').show();
		}
		else if (day_type == 'FH' || day_type == 'SH') {
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
		if(!show_graph_flag){
			show_graph_flag = true;
			process_all_events(cal_all_events);
		}
		else {
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
		var cal_view = $('#calender_view');
		if(!cal_view.hasClass('in')){
			cal_view.removeClass('hide');
			cal_view.collapse('show');
		}
		else {
			cal_view.collapse('hide');
		}
	});

	var cur_global_search = '';
	$('#global_search').on('keyup change', function () {
		if(cur_global_search != this.value.toUpperCase()) {
			$('#all-events').DataTable().search(this.value, true, true).draw();
			cur_global_search = this.value.toUpperCase();
		}
	});

	event_list_table = $('#all-events').dataTable({
		"bJQueryUI": true,
		"bProcessing": true,
		"ddCustomFilter": true,
		"order" : [[2,'desc']],
		"bAutowidth" : false,
		'iDisplayLength': 50,
		drawCallback: function() {
			update_chart();
		},

		columnDefs: [
			{ className: "hidden-xs", "targets": [3,4] }
		],
		"rowCallback": function(row, col, i){
			// Check if this event occurs today, tomorrow or in future.
			if(col[2] >= this_month) {
				if(col[2] == today_date || (col[2] < (this_month + '-31') && col[4].match(today_tmrw[0]))){
					$(row).addClass('today');
					set_today_event(col);
				}
				else if(col[2] > today_date){
					var date_arr = col[4].split(',');
					var found = 0;
					$.each(date_arr, function(i,v){
						if(parseInt(v) == parseInt(today_tmrw[1])){
							$(row).addClass('tomorrow');
							found = 1;
							return;
						}
					});
					if(!found){
						$(row).addClass('future');
					}
				}
				else if(col[4].match('to')){
					var d = moment(col[2].split('<br>')[0]);
					var last = d.businessAdd(col[5], 'days');
					if(last >= today){
						$(row).addClass('today');
						set_today_event(col);
					}
				}
				else if(col[4].match(today_tmrw[1])){
					$(row).addClass('tomorrow');
				}

			}
			// For range of dates
			else if(col[4].match('to')){
				var d = moment(col[2].split('<br>')[0]);
				var last = d.add(col[5], 'days');
				if(last >= today){
					$(row).addClass('today');
					set_today_event(col);
				}
			}
		}

	}).yadcf(
		[
			{
				column_number: 0
			},
			{
				column_number: 1,
				text_data_delimiter: ","
			},
			{
				column_number: 3,
				text_data_delimiter: ","
			},
			{
				column_number: 4,
				text_data_delimiter: ","
			}
		]
	);

	$('#event_type').change(function(e){
		var selected = $(this).val();
		var msg = '';
		if(event_limits[selected]) {
			var remain = event_limits[selected] - logged_in_user_data[selected];
			if(remain > 1) {
				msg = remain + ' leave(s)';
			}
			else if(remain > 0) {
				msg = remain + ' leave';
			}
			else {
				msg = "You don't have remaining " + selected + "'s";
			}
			msg += " remaining<sup>*</sup>";
			$('#add-event-days').attr('max', remain);
		}
		else {
			$('#add-event-days').attr('max', 120);
		}
		$('#event-selector-info').html(msg);
		var event_name = selected + ': ' + login_name;
		$('#new_event_name').val(event_name);
		$('#add-event-days').trigger('change');
	});

	$('input[name="add_event_day"]').change(function(e){
		var selected = $(this).val();
		var event_type = $('#event_type').val();
		if(selected == 'FULL') {
			var event_name = event_type + ': ' + login_name;
			$('#new_event_name').val(event_name);
		}
		else {
			var event_name = 'H' + event_type + ': ' + login_name;
			$('#new_event_name').val(event_name);
		}
	});

	$('#new_event_name').on('focusout', function(e){
		$(this).prop('readonly', true);
		$('#new_event_name_edit').text('Edit');
	});

	$('#new_event_name_edit').click(function(e){
		var btn_name = $(this).text();
		if(btn_name == 'Edit') {
			$('#new_event_name').prop('readonly', false);
			$(this).text('Done');
		}
		else {
			$('#new_event_name').prop('readonly', true);
			$(this).text('Edit');
		}
	});

	$('#show_add_event').click(function(){
		if(!validate_session()) {
			return false;
		}
		$('#event_type').trigger('change');
		$('#date-selector').trigger('change');
	});

	$('#date-selector').change(function(e, data){
		$('#date-selector-info').text('');
		var selected = $(this).val();
		var today = moment();
		var date = today.clone();
		if(selected == 'today') {
			if(!date.isBusinessDay()) {
				$('#date-selector-info').text(selected + ' holiday');
				$('#date-selector').val('tomorrow').trigger('change', { from_today: true });
				return;
			}
		}
		else if(selected == 'tomorrow') {
			date.add(1, 'days');
		}
		else if(selected == 'yesterday') {
			date.subtract(1, 'days');
		}
		else if(selected == 'other'){
			$('#advanced_mode').collapse('show');
		}
		if(!date.isBusinessDay() && selected != 'other') {
			var msg = selected + ' holiday';
			if(data && data.from_today) {
				msg = 'today and ' + msg;
			}
			$('#date-selector-info').text(msg);
			$('#date-selector').val('other');
			$('#advanced_mode').collapse('show');
		}
		$('#add-event-days').val(1).trigger('change');
		$('#add-from-date').datepicker('setDate', date.format('DD/MM/YYYY')).trigger('change');
	});

	$('#event_add_btn').click(function(){
		create_event(getFormDataAsJSON($('#add_event_form')));
	});

	$('#add-event-days , #add-from-date').on('change', function() {
		var days = $('#add-event-days').val();
		days--;
		var from_date = moment($('#add-from-date').val(), 'DD/MM/YYYY');
		if(!from_date.isBusinessDay()) {
			$('#add-from-date-info').text('this day holiday');
		}
		else {
			$('#add-from-date-info').text('');
		}
		$('#add-to-date').datepicker('option', 'minDate', $('#add-from-date').val());
		$('#add-to-date').datepicker('setDate', from_date.businessAdd(days, 'days').format('DD/MM/YYYY'));
		var et = $('#event_type').val();
		var info = '';
		if(event_limits[et]) {
			var remain = event_limits[et] - logged_in_user_data[et] - days - 1;
			if(remain < 0) {
				info = remain * -1 + ' LOP';
			}
			else if(remain > 0) {
				info = remain + ' remaining';
			}
			else {
				info = "Done!"
			}
		}
		$('#add-event-days-info').text(info);
	});

	$('#add-to-date').on('change', function() {
		var from_date = moment($('#add-from-date').val(), 'DD/MM/YYYY');
		var to_date = moment($('#add-to-date').val(), 'DD/MM/YYYY');
		if(!to_date.isBusinessDay()) {
			$('#add-to-date-info').text('this day holiday');
		}
		else {
			$('#add-to-date-info').text('');
		}
		var days = from_date.businessDiff(to_date);
		days++;
		$('#add-event-days').val(days).trigger('change');
	});

	$('#download_bi_monthly').on('click', function(e) {
		progress_bar("Preparing download!");
		var table = getBiMonthlyTable(cumulative_data);
		if(!table) {
			m_alert("No records found, Please select month which has data");
			e.preventDefault();
			e.stopPropagation();
			progress_bar('',true);
			return 0;
		}
		var data = ExcellentExport.excel(this, table.get(0), 'Monthly Leaves');
		progress_bar('',true);
		return data;
	});


	$('#monthly-report').on('click', function() {
		if(!validate_session()) {
			return false;
		}
		var div = $('#bi-monthly-months');

		var str = '<div class="form-check">' +
		'<input class="form-check-input" type="checkbox" value="" id="">' + 
		'&nbsp;<label class="form-check-label" for=""></label>' +
		'</div>';

		div.html('');
		var current_month = moment().month();

		$.each(moment.months(), function(number, month){
			var ele = $(str);
			var selected = false;
			if(current_month-1 == number) {
				selected = true;
			}
			ele.find('input').val(month).attr('id', 'bi-'+month).prop('checked', selected);
			ele.find('label').text(month).attr('for', 'bi-'+month);
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
	console.log("\nNot sure why you came to look for console!"
		, "\nBut here are some extra details I can give for you \n"
		, "\nLet's say all weekends are considered as holidays"
		, "\nAnd we have ", CompanyHolidays.length, " gvt. holidays "
		, HolidayList
		, "\n \nSo, In this year we have: ", total_days,  " total days"
		, "\nand in that, we have only ", total_wdays, ' working days'
		, "\nand we also have 18PL + 12SL (30 leaves)"
		, "\n \nWhich means we have ", (total_days - total_wdays), " + ", 30, " leaves in this year :-)");
		console.log("Completed Working days: ", start_date.businessDiff(today, 'days') - 1);
		console.log("Remaining working days: ", today.businessDiff(end_date, 'days'),  ' (' + today.format('DD/MM/YY') + ' to ' + end_date.format('DD/MM/YY') + ')');
}

/**
*  On load, called to load the auth2 library and API client library.
*/
function handleClientLoad() {
	gapi.load('client:auth2', initClient);
}

/**
Initializes the API client library and sets up sign-in state
*  listeners.
*/
function initClient() {
	progress_bar("Initializing...");
	gapi.client.init({
		discoveryDocs: DISCOVERY_DOCS,
		clientId: CLIENT_ID,
		scope: SCOPES
	}).then(function() {
		// Listen for sign-in state changes.
		progress_bar("Signing in...");
		gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

		// Handle the initial sign-in state.
		updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
		authorizeButton.onclick = handleAuthClick;
		signoutButton.onclick = handleSignoutClick;
		updateLoginInfo(gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile());
	});
}

/**
*  Called when the signed in status changes, to update the UI
*  appropriately. After a sign-in, the API is called.
*/
function updateSigninStatus(isSignedIn) {
	last_session_validated = moment();
	if (isSignedIn) {
		progress_bar("SignIn Success!");
		updateLoginInfo(gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile());
		authorizeButton.style.display = 'none';
		signoutButton.style.display = 'inline';
		var params = getUrlVars();
		var from = params['from'];
		var to = params['to'];
		listEvents(from,to);
		$('.valid-session').show();
		$('#sign-in-info').hide();
		$('.filter-box').show();
		$('#calendar_iframe').html(calendar_iframe);
		print_fun_info();
	} else {
		progress_bar("Logged Out!");
		authorizeButton.style.display = 'inline';
		signoutButton.style.display = 'none';
		$('.valid-session').hide();
		$('#sign-in-info').show();
		$('.filter-box').hide();
		$('#calendar_iframe').html('');
		progress_bar("", true);
		setTimeout(function() { $('.processing').hide() }, 1000);
	}
	progress_bar('',true);
}

function validate_session() {
	console.log("Validating Session!");
	last_session_validated = moment();
	if(!gapi.auth2.getAuthInstance().isSignedIn.get()) {
		m_alert("Session expired!");
		updateSigninStatus(false);
		return false;
	}
	else {
		return true;
	}
}

/**
*  Sign in the user upon button click.
*/
function handleAuthClick(event) {
	progress_bar('',true);
	gapi.auth2.getAuthInstance().signIn();
	$(".processing").show();
}

/**
*  Sign out the user upon button click.
*/
function handleSignoutClick(event) {
	progress_bar("Logging Out!");
	gapi.auth2.getAuthInstance().signOut();
	location.reload();
	progress_bar('',true);
}

/**
* Print the summary and start datetime/date of the next ten events in
* the authorized user's calendar. If no events are found an
* appropriate message is printed.
*/
function listEvents(from, to) {

	progress_bar("Fetching data...");
	if (!from || !to) {
		from = moment().startOf('year').format('MM/DD/YYYY');
		to = moment().endOf('year').format('MM/DD/YYYY');
	}

	var from_date_obj = moment(from, 'MM/DD/YYYY');
	var to_date_obj = moment(to, 'MM/DD/YYYY');

	// to_date should be end of the day
	to_date_obj.add(1,'days').subtract(1, 'seconds');;

	$("#datepicker-from").datepicker('setDate', from);
	$("#datepicker-to").datepicker('setDate', to);

	// Set ISO date format
	var from_date = from_date_obj.format();
	var to_date = to_date_obj.format();

	var status = gapi.client.calendar.events.list({
		'calendarId': Calendar_id,
		'timeMin': from_date,
		'timeMax': to_date,
		'showDeleted': false,
		'singleEvents': true,
		'maxResults': 100000,
		'orderBy': 'startTime'
	}).then(function(response) {
		var events = response.result.items;
		cal_all_events = events;
		process_all_events(events);

		$.each(remove_events, function(i,v){
			$("#type_" + v).removeAttr('checked').trigger('change');
		});
	});
}

// We will get logged in User info here
// https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile
function updateLoginInfo(userProfile) {
	if(!userProfile) {
		return;
	}
	var first_name = userProfile.getGivenName();
	console.log("Found Logged in User Name: ", first_name);
	login_name = first_name;
	signoutButton.innerHTML = ' ' + login_name;
	$('#monthly-report').addClass('hide');
	$.each(admin_names, function(name) {
		if(name == login_name.toUpperCase()) {
			admin_login = true;
			$('#monthly-report').removeClass('hide');
			console.log('Showing Monthly Report button for user: ', name);
			//if(name == 'VASUNDHAR') {
			//	enable_v_filter();
			//}
			return;
		}
	});
}

/* This function is not used currently */
function enable_v_filter() {
	$('#v-filter').removeClass('hide');
	event_list_table.yadcf(
		[
			{
				column_number: 0,
				filter_type: 'multi_select',
				filter_container_id: 'v-filter-1'
			},
			{
				column_number: 1,
				text_data_delimiter: ",",
				filter_type: 'multi_select',
				filter_container_id: 'v-filter-2'
			},
			{
				column_number: 3,
				text_data_delimiter: ",",
				filter_type: 'multi_select',
				filter_container_id: 'v-filter-3'
			}
		]
	);
}

function getUrlVars()
{
	var vars = [], hash;
	var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
	for(var i = 0; i < hashes.length; i++)
	{
		hash = hashes[i].split('=');
		vars.push(hash[0]);
		if(hash[1] && hash[1].match('#')) {
			hash[1] = hash[1].split('#')[0];
		}
		vars[hash[0]] = hash[1];
	}
	return vars;
}

// TODO: We should find a way to stop processing same data more than once
function process_all_events(events) {
	var cal_url = 'https://www.google.com/calendar/event?eid='
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
			if(cols[0].match(/^H/i)) {
				if(cols[0] != 'HBD') {
					days = days/2;
				}
			}

			all_rows[i] = [
				cols[0],
				cols[1],
				date,
				month + ", " + day,
				event_dates,
			days];

			auto_completes[cols[1]] = 1;

			if(cols[0] == 'HBD') {
				birthdays[cols[1]] = date;
			}

			var all_dates = getAllBuisnessDates(start, days);
			if(all_dates) {
				$.each(all_dates, function(m,dates) {
					if(!cols || !cols[0] || !cols[1]) {
						return true;
					}
					if(!cumulative_data[m]) {
						cumulative_data[m] = {};
					}
					if(!cumulative_data[m][cols[1]]) {
						cumulative_data[m][cols[1]] = {};
					}
					if(!cumulative_data[m][cols[1]][cols[0]]) {
						cumulative_data[m][cols[1]][cols[0]] = dates;
					}
					else {
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
		if($("#type_" + id).length < 1)
			filter_box.append("<input type='checkbox' checked='checked' id='type_" + id + "'>" + val + "</input> &nbsp;");
	});

	// Set auto complete suggestions for search bar
	$('#global_search , #all-events_filter input').autocomplete({
		source: _.keys(auto_completes)
	});

	// Draw tables
	$('#all-events').DataTable().clear();
	$('#all-events').DataTable().rows.add(all_rows).draw();
	add_birthdays(birthdays);
}

function getAllBuisnessDates(start, days) {
	var first_date = start.clone();
	var month_dates = {};
	for(var i=0; i<days;i++) {
		var m = first_date.format('MMMM');
		var d = first_date.format('DD');
		if(!month_dates[m]) {
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
	if(days < 1) {
		time_str += "<br>" + date_time.format('h:mm a');
		time_str += " - " + end_time.format('h:mm a');
	}
	return [time_str, month, day];
}

function days_diff(date1, date2) {
	var diff = date2.businessDiff(date1, 'days');
	if(diff == 0) {
		diff = 1;
	}
	var date3 = date1.clone();
	var event_days = date1.format('Do');
	if(diff < 5){
		for(var i =1;i<diff;i++){
			date3 = date3.businessAdd(1,'day');
			event_days += ', ' + date3.format('Do');
		}
	}
	else{
		event_days = date1.format('MMM Do') + " to " + date3.businessAdd((diff -1), 'day').format('MMM Do');
	}
	return [ diff, event_days];
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
	if(cols_t[0] == 'Maternity Leave'){
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

	if(!group_name_case_sensitive) {
		cols[1] = cols_t.toString().trim().toTitleCase();
	}
	else {
		cols[1] = cols_t.toString().trim();
	}

	if(group_first_name && cols[1].match(' ')) {
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

function chart_data(x_axis, series, title_txt, sub_text) {
	var chart = {
		type: 'column'
	};
	var title = {
		text: title_txt
	};
	var subtitle = {
		text: sub_text
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

	if(x_axis.length * series.length < 50) {
		dataLabels_enabled = true;
	}

	var plotOptions = {
		bar: {
			dataLabels: {
				enabled: true,
				color: '#000',
				style: {fontWeight: 'bolder'},
				formatter: function() {return this.x + ': ' + this.y},
				inside: true,
				rotation: 270
			}
		},
		series: {
			dataLabels: {
				enabled: dataLabels_enabled,
				color: '#FFFFFF',
				style: {fontWeight: 'bolder'},
				formatter: function() {return this.y},
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

	subtitle = _.defaults(subtitle, { text : 'Data based on the applied filter' });
	title = _.defaults(title, { text : 'Graphical Representation' });

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
	var x_axis = _.keys(optimize_data);
	var y_axis = _.keys(events_header);
	var series = [];
	var data_y_t = {};
	if(x_axis.length < 2) {
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
	var x_axis = ['Jan','Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	var x_axis_t = _.keys(monthly_data.types);

	$.each(x_axis, function(i, month) {
		var data = monthly_data[month];
		if(!data) {
			data = {};
		}
		$.each(x_axis_t, function(i, type) {
			if(!data_y_t[type]) {
				data_y_t[type] = [];
			}
			if(data[type]) {
				data_y_t[type].push(data[type]);
			}
			else {
				data_y_t[type].push(0);
			}
		});
	});

	$.each(data_y_t, function(type, array) {
		series.push({ name: type, data: array });
	});

	var json = chart_data(x_axis, series, 'Month wise View');

	$("#chart-container-monthly").highcharts(json);
	$("#chart-container-monthly").collapse('show');
}

function draw_weekly_chart(weekly_data) {
	var series = [];
	var data_y_t = {};
	var x_axis = ['Mon','Tue', 'Wed', 'Thu', 'Fri'];
	var x_axis_t = _.keys(weekly_data.types);
	$.each(x_axis, function(i, day) {
		var data = weekly_data[day];
		if(!data) {
			data = {};
		}
		$.each(x_axis_t, function(i, type) {
			if(!data_y_t[type]) {
				data_y_t[type] = [];
			}
			if(data[type]) {
				data_y_t[type].push(data[type]);
			}
			else {
				data_y_t[type].push(0);
			}
		});
	});

	$.each(data_y_t, function(type, array) {
		series.push({ name: type, data: array });
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

		if(event.match(/^H/i) && event != 'HBD') {
			event = event.substring(1);
		}

		if (!optimize_data[row[1]][event]) {
			optimize_data[row[1]][event] = 0;
		}

		if(!loging_data_computed && row[1] == login_name) {
			if(!logged_in_user_data[event]) {
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

	populate_counts_table(optimize_data, _.keys(events_header));
	progress_bar('',true);

	setTimeout(draw_fuel_graph, 100);
	if(show_graph_flag){
		setTimeout(draw_monthly_chart, 100, monthly_data);
		setTimeout(draw_weekly_chart, 100, weekly_data);
		setTimeout(draw_graph, 100, optimize_data, events_header);
	}
}

function add_monthly_data(type, event, monthly_data) {
	if(!event[2] || !event[5]) {
		return monthly_data;
	}
	if(type != "-") {
		var diff = event[5];
		var date1 = moment(event[2].split(' ')[0]);
		if(diff < 2) {
			return _add_month_data(monthly_data, date1, type, diff);
		}
		var date3 = date1.clone().businessAdd(diff);
		if(date1.format('MMM') == date3.format('MMM')) {
			return _add_month_data(monthly_data, date1, type, diff);
		}
		else {
			for(var i=0; i<diff;i++) {
				monthly_data = _add_month_data(monthly_data, date1, type, 1);
				date3 = date1.businessAdd(1,'day');
			}
		}
	}
	return monthly_data;
}

function add_weekly_data(type, event, weekly_data) {
	if(!event[2] || !event[5]) {
		return weekly_data;
	}
	if(type != "-") {
		var diff = event[5];
		var date1 = moment(event[2].split(' ')[0]);
		if(diff < 2) {
			return _add_weekly_data(weekly_data, date1, type, diff);
		}
		else {
			for(var i=0; i<diff;i++) {
				weekly_data = _add_weekly_data(weekly_data, date1, type, 1);
				date1 = date1.businessAdd(1,'day');
			}
		}
	}
	return weekly_data;
}


function _add_month_data (monthly_data, date, type, diff) {
	var mon = date.format('MMM');
	if(!monthly_data[mon]) {
		monthly_data[mon] = {};
		monthly_data[mon][type] = 0;
	}
	else if(!monthly_data[mon][type]) {
		monthly_data[mon][type] = 0;
	}
	monthly_data[mon][type] += diff;
	if(!monthly_data.types) {
		monthly_data.types = {};
	}
	monthly_data.types[type] = 1;
	return monthly_data;
}

function _add_weekly_data (weekly_data, date, type, diff) {
	var day = date.format('ddd');
	if(!weekly_data[day]) {
		weekly_data[day] = {};
		weekly_data[day][type] = 0;
	}
	else if(!weekly_data[day][type]) {
		weekly_data[day][type] = 0;
	}
	weekly_data[day][type] += diff;
	if(!weekly_data.types) {
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

	$.each(filtered_data, function(name, event_days) {
		row_str = '<tr>';
		row_str += '<td class="link">' + name + '</td>';
		var td_class = 'link high';
		$.each(cols, function(i, event) {
			var tt_msg = event + " : " + name;
			if(event_days[event] && event_days[event] > 0){
				tt_msg += "\nTaken/Applied: " + event_days[event];
				if(event_limits[event]) {
					var taken_percent = (event_days[event]/event_limits[event]) * 100;
					tt_msg += ' leave(s)  (' + parseInt(taken_percent) + '%)';
					var remain_days = event_limits[event] - event_days[event];
					if(user_extra_allowance && user_extra_allowance[name] && user_extra_allowance[name][event]) {
						remain_days += user_extra_allowance[name][event];
					}
					if(remain_days > 0) {
						tt_msg += "\nRemaining: " + remain_days + ' leave(s)';
					}
					else if(remain_days < 0) {
						tt_msg += "\nOverdue: " + (remain_days * -1) + ' leave(s)';
					}

					if(taken_percent > 100) {
						td_class += ' danger'
						tt_msg += "\nAlready in LOP";
					}
					else if(taken_percent == 100) {
						td_class += ' warning'
						tt_msg += "\nUsed all";
					}
					else if(taken_percent > 80) {
						td_class += ' warning'
					}
				}
				row_str += '<td class="' + td_class + '" data-toggle="tooltip" title="' + tt_msg + '">' + event_days[event] + '</td>';
			}
			else {
				tt_msg += "\nTaken/Applied: 0";
				if(event_limits[event]) {
					var remain_days = event_limits[event];
					tt_msg += "\nRemaining: " + remain_days + ' leave(s)';
				}
				row_str += '<td class="' + td_class + '" data-toggle="tooltip" title="' + tt_msg + '">0</td>';
			}
		});
		row_str += '</tr>';
		report_table.append(row_str);
	});
	report_table.find('td').tooltip({ container: 'body' });

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
	if(!today_events[row[0]]) {
		today_events[row[0]] = {};
	}
	else if(!today_events[row[0]][row[1]]) {
		today_events[row[0]][row[1]] = 0;
	}
	today_events[row[0]][row[1]]++;
}

function create_event(data) {

	if(!validate_session()) {
		return false;
	}
	var time_zone = 'Asia/Kolkata';
	var start_time = { 'timeZone': time_zone };
	var end_time = { 'timeZone': time_zone };

	if(data.add_event_day == 'FULL') {
		start_time.dateTime = moment(data.from_date + ' 10:00', 'DD/MM/YYYY HH:mm').format('YYYY-MM-DDTHH:mm:ss');
		end_time.dateTime = moment(data.to_date + ' 18:30', 'DD/MM/YYYY HH:mm').format('YYYY-MM-DDTHH:mm:ss');
	}
	else if(data.add_event_day == 'FH') {
		start_time.dateTime = moment(data.from_date + ' 10:00', 'DD/MM/YYYY HH:mm').format('YYYY-MM-DDTHH:mm:ss');
		end_time.dateTime = moment(data.from_date + ' 13:00', 'DD/MM/YYYY HH:mm').format('YYYY-MM-DDTHH:mm:ss');
	}
	else if(data.add_event_day == 'SH') {
		start_time.dateTime = moment(data.from_date + ' 14:00', 'DD/MM/YYYY HH:mm').format('YYYY-MM-DDTHH:mm:ss');
		end_time.dateTime = moment(data.from_date + ' 18:30', 'DD/MM/YYYY HH:mm').format('YYYY-MM-DDTHH:mm:ss');
	}

	var event = {
		'summary': data.new_event_title,
		'location': data.location,
		'description': data.description,
		'reminders': {
			'useDefault': true
		},
		'start': start_time,
		'end': end_time
	};

	var details = "Title:  " + event.summary + "\n";
	details +=    "From:  " + event.start.dateTime + "\n";
	details +=    "To:  " + event.end.dateTime + "\n \n";
	details +=    " I will be creating above event.";

	if(!confirm(details)) {
		console.log("User cancelled create event!");
		return;
	}

	progress_bar("Creating event...");
	var request = gapi.client.calendar.events.insert({
		'calendarId': Calendar_id,
		'resource': event
	});

	request.execute(function(event) {
		gapi_resp_process(event, function () { $('#add_event_modal').modal('hide'); });
		progress_bar('', true);
	});
}

function getFormDataAsJSON(form) {
	var o = {};
	var a = form.serializeArray();
	$.each(a, function () {
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
		if(!$('#bi-' + month).length || !$('#bi-' + month).is(':checked')) {
			return true;
		}
		table.append('<tr></tr>');
		table.append('<tr></tr>');
		table.append('<tr><th colspan="' + total_cols + '"><b><center>' + month + '</center></b></th></tr>');
		var row = $('<tr>');
		row.append('<td></td>');
		$.each(temp_types, function(i, event) {
			if(event.match(/HBD|-$/)) {
				return true;
			}
			row.append('<td><b><center>' + event + '</center></b></td>');
		});
		table.append(row);

		$.each(names, function(name, events) {
			var row1 = $('<tr>');
			row1.append('<td><strong>' + name + '</strong></td>');
			var keys = _.keys(events);
			if(keys.length == 1 && keys[0] == '-') {
				return true;
			}
			var atleast_one = false;
			$.each(temp_types, function(i, event) {
				if(event.match(/HBD|-$/)) {
					return true;
				}
				if(events[event]) {
					row1.append('<td>' + events[event] + '</td>');
					atleast_one = true;
				}
				else {
					row1.append('<td>-</td>');
				}
			});
			if(atleast_one) {
				table.append(row1);
				rec_found = 1;
			}
		});
	});

	if(rec_found == 0) {
		return;
	}

	return table;
}

function delete_event(event_id) {
	var request = gapi.client.calendar.events.delete({
		'calendarId': Calendar_id,
		'eventId': event_id
	});
	request.execute(function(event) {
		gapi_resp_process(event, function () { $('#add_event_modal').modal('hide'); });
	});
}

function gapi_resp_process(event, callback) {

	console.log('GAPI Response: ', event);
	if(event.error) {
		var msg = 'ERROR: ' +  event.error.message;
		if(login_name != 'Dinesh') {
			msg += "\nSeems bug? Inform to Dinesh D!";
		}
		m_alert(msg);
	}
	else if(event.status && event.status == 'confirmed') {
		listEvents();
		if(callback) {
			callback();
		}
	}
	else {
		m_alert('Something went wrong!');
	}
}

var progress_bar_timer;
function progress_bar(msg, completed) {
	if(!completed) {
		$('#processing_msg').text(msg);
		progress_bar_timer = setTimeout( function() {
			$(".processing").show();
		}, 1);
	}
	else {
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
function draw_fuel_graph() {

	if(d3_fuel_grap_drawn) {
		return;
	}
	$('#total_events_gauge').collapse('show');
	var total = total_emps;
	today_event_names = {};
	today_events_count = {};
	$.each(temp_types, function(i, t){
		if(!today_events[t] || t == '-' || t == 'HBD') {
			return true;
		}
		var names = _.keys(today_events[t]);
		var count = names.length;
		if(t.match(/^H/i)) {
			count = count/2;
			t = t.substring(1);
		}

		total -= count;

		if(!today_event_names[t]) {
			today_event_names[t] = [];
			today_events_count[t] = 0;
		}
		$.each(names, function(i, name) {
			today_event_names[t].push(name);
		});
		today_events_count[t] += count;
	});
	today_events_count['TOTAL'] = total;

	$.each(['TOTAL', 'WFH', 'SL', 'PL'], function(i,v) {
		if(!today_events_count[v]) {
			today_events_count[v] = 0;
		}
		if(!d3Gauges['gauge_' + v]) {
			d3Gauges['gauge_' + v] = loadLiquidFillGauge("fillgauge_" + v, today_events_count[v], d3_gauge_config);
		}
		else {
			d3Gauges['gauge_' + v].update(today_events_count[v]);
		}
	});

	$.each(['SL', 'PL'], function(i,v) {
		var cp_config = d3_gauge_config;
		cp_config.maxValue = event_limits[v];
		if(!logged_in_user_data[v]) {
			logged_in_user_data[v] = 0;
		}
		if(!d3Gauges['gauge_ind' + v]) {
			d3Gauges['gauge_ind' + v] = loadLiquidFillGauge("fillgauge_ind_" + v, logged_in_user_data[v], cp_config);
		}
		else {
			d3Gauges['gauge_ind' + v].update(logged_in_user_data[v]);
		}
	});
	d3_fuel_grap_drawn = true;
	$('#show-graph').trigger('click');

	var params = getUrlVars();
	var search_param = login_name;
	if(admin_names[login_name.toUpperCase()]) {
		search_param = '';
	}
	if(params['search']) {
		search_param = params['search'];
	}
	if(search_param && search_param != ''){
		$('#all-events').DataTable().search(search_param).draw();
		$('#global_search').val(search_param);
	}
}

function show_event_names(t) {
	if(t.match(/^IN-/)) {
		var tt = t.split('-')[1];
		var msg = 'You(' + login_name + ') have taken/applied ';
		msg += logged_in_user_data[tt] + ' ' + tt + ' out of ' + event_limits[tt];
		msg += "\n \n*Counts calculated per calendar year";
		m_alert(msg, "Your(" + login_name + ") " + tt);
	}
	else if(t == 'ALL') {
		m_alert("I don't have all the names to display", "Today Present");
	}
	else if(!today_event_names[t]) {
		m_alert("No " + t + " today, or no one updated today", 'Today ' + t);
	}
	else {
		var msg = 'Today ' + t + " taken by \n \n";
		msg += today_event_names[t].join(', ');
		m_alert(msg, 'Today ' + t);
	}
}

function m_alert(msg, title) {
	var modal = $('#alert-modal');
	if(!title) {
		title = 'Alert';
	}
	modal.find('.title').html(title);
	msg = msg.replace(/(?:\&rho;n|\r|\n)/g, '<br>');
	modal.find('.body').html(msg);
	modal.modal('show');
}

var bd_done = false;
function add_birthdays(BirthdayList) {
	if(bd_done) {
		return false;
	}
	var bd_list_table = $('#birthdays_list tbody');
	bd_list_table.html('');
	var today = moment();
	for( name in BirthdayList) {
		var date = moment(BirthdayList[name]);
		if(date < today) {
			date = date.add(1, 'year');
		}
		var d = date.format('MMM, Do - ddd');
		var d_o = date.format('YYYYMMDD');
		var style = '';
		if(!date.isBusinessDay()){
			style = 'danger';
		}
		var newline = '<tr class="' + style + '"><td data-order="' + d_o + '">' + d + "</td><td>" + name + "</td></tr>";
		bd_list_table.append(newline);
	}
	$('#birthdays_list').DataTable({ paging: false });
	bd_done = true;
}

