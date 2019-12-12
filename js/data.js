// Calendar details
// Client ID and API key from the Developer Console
var CLIENT_ID = 'YOUR-GOOGLE-DEVELOPER-API-CLIENT-ID';
var Type_Filter = ['PL', 'SL', 'ML', 'PTL', 'MTL', 'RL', 'WFH', 'CO', 'LOP', 'HBD', '-'];
var remove_events = ['-', 'HBD', 'MTL', 'PTL', 'ML', 'RL', 'LOP'];
var total_emps = 40;
var event_limits = {
	PL: 20,
	SL: 10
};
var admin_names = {
	DINESH: 1
};

var show_fuel_gauge = false;

var HolidayList = {
	'2018-01-01':"New Year",
	'2018-01-26':"Republic Day*",
	'2018-03-30':"Good Friday",
	'2018-05-01':"May Day*",
	'2018-08-15':"Independence Day*",
	'2018-09-13':"Ganesh Chaturthi",
	'2018-10-02':"Gandhi Jayanthi*",
	'2018-10-19':"Vijayadashami",
	'2018-11-08':"Deepavali (Balipadyami)",
	'2018-12-25':"Christmas"
};

var company_name = 'Company';

// Carry forwards and or subtractions/ additions to their default event limits
// This will be directly applied for the current filter
var user_extra_allowance = {
	'Dinesh' : {
		PL: 6, // Add 6 PL (carry forward)
		SL: -2 // Reduce 2 SL's
	}
};
