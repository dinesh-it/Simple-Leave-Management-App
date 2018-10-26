// Calendar details
// Client ID and API key from the Developer Console
var CLIENT_ID = '661067137711-dlotfvbf0jhp86o2v69k0o6eulqst95l.apps.googleusercontent.com';
var Type_Filter = ['PL', 'SL', 'ML', 'PTL', 'MTL', 'RL', 'WFH', 'CO', 'LOP', 'HBD', '-'];
var remove_events = ['-', 'HBD', 'MTL', 'PTL', 'ML', 'RL', 'LOP'];
var Calendar_id = 'exceleron.com_6hfq85f5bl0k6mo0nel5vjs83k@group.calendar.google.com';
var total_emps = 29;
var event_limits = {
	PL: 18,
	SL: 12
};
var admin_names = {
	PRADNYA: 1,
	VASUNDHAR: 1,
	//DINESH: 1,
};

var HolidayList = {                                                                                                                                                       
	'2018-01-01':"New Year",                                                                                                                                              
	'2018-01-15':"Makara Sankranti",                                                                                                                                      
	'2018-01-26':"Republic Day*",                                                                                                                                         
	'2018-03-30':"Good Friday",                                                                                                                                           
	'2018-05-01':"May Day*",                                                                                                                                              
	'2018-08-15':"Independence Day*",                                                                                                                                     
	'2018-09-13':"Ganesh Chaturthi",                                                                                                                                      
	'2018-10-02':"Gandhi Jayanthi*",                                                                                                                                      
	'2018-10-19':"Vijayadashami",                                                                                                                                         
	'2018-11-01':"Kannada Rajyotsava*",
	'2018-11-08':"Deepavali (Balipadyami)",
	'2018-12-25':"Christmas",
};

