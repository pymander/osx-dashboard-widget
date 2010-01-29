// Copyright (c) 2008 2ndSite Inc. (www.freshbooks.com)
// Licenced under the MIT license (see MITLICENSE.txt).

com.freshbooks.api.UA = "FreshBooks Time Tracker Widget 1.0";

debug = false;
xmlTimeout = 15 * 1000; // Wait this many milliseconds for FreshBooks to reply before cancelling an XML call.

//
// Just sets the given named element's visibility style accordingly.
function setElementVisibility(elementName, setVisible)
{
	$("#"+elementName).css("visibility",setVisible ? "visible" : "hidden");
}


//
// Function: formatTwoDigits(number)
// Format a number as one or two digits with a leading zero if needed
//
// number: The number to format
//
// Returns the formatted number as a string.
//
function formatTwoDigits(number)
{
    var digits = number.toString(10);

    // Add a leading zero if it's only one digit long
    if (digits.length == 1) {
        digits = "0" + digits;
    }
    
    return digits;
}

function updateTimerDisplay()
{
	var hours, minutes, clockedTime = Math.floor(clocker.getTime()/1000);

	// Same for hours, minutes, and seconds
	hours = Math.floor(clockedTime / (60*60));
	clockedTime -= hours * (60*60);
	
	minutes = Math.floor(clockedTime / 60);
	clockedTime -= minutes * 60;

	$("#count")[0].innerText = hours + ":" + formatTwoDigits(minutes) + ":" + formatTwoDigits(clockedTime);
}

var updateTimerDisplayInterval;

//
// Function: startDisplayUpdateTimer()
// Start the interval timer to update the countdown once a second
//
function startDisplayUpdateTimer()
{
    updateTimerDisplay();

    if (!updateTimerDisplayInterval)
        updateTimerDisplayInterval = setInterval(updateTimerDisplay, 200);
}

//
// Function: stopDisplayUpdateTimer()
// Remove the interval timer
//
function stopDisplayUpdateTimer()
{
    if (updateTimerDisplayInterval) {
        clearInterval(updateTimerDisplayInterval);
        updateTimerDisplayInterval = null;
    }
}

//
// Function: load()
// Called by HTML body element's onload event when the widget is ready to start
//
function load()
{
    setupParts();

	$("#url").text("");
	$("#submitStatus").text("");
	$("#statusmsg").text("");

	sync();

	setElementVisibility("stopbutton",  false);
	setElementVisibility("updatedTime", false);
	startDisplayUpdateTimer();

	// Default to showing the back when there's no auth info
	var login = document.getElementById("sitename").value;
	var token = document.getElementById("authtoken").value;
	if (login.length == 0 || token.length == 0)
	{
		setTimeout(showBack, 250);
		return;
	}
}

//
// Function: remove()
// Called when the widget has been removed from the Dashboard
//
function remove()
{
    // Stop any timers to prevent CPU usage
    // Remove any preferences as needed
    widget.setPreferenceForKey(null, createInstancePreferenceKey("clocker"));
	widget.setPreferenceForKey(null, createInstancePreferenceKey("sitename"));
	widget.setPreferenceForKey(null, createInstancePreferenceKey("authtoken"));
	widget.setPreferenceForKey(null, createInstancePreferenceKey("Notes"));
	widget.setPreferenceForKey(null, createInstancePreferenceKey("myProjects"));
	widget.setPreferenceForKey(null, createInstancePreferenceKey("project"));
	widget.setPreferenceForKey(null, createInstancePreferenceKey("task"));
    stopDisplayUpdateTimer();
}

//
// Function: hide()
// Called when the widget has been hidden
//
function hide()
{
    stopDisplayUpdateTimer();
	widget.setPreferenceForKey($("#Notes")[0].value, createInstancePreferenceKey("Notes"));
	widget.setPreferenceForKey($("#Projects")[0].selectedIndex, createInstancePreferenceKey("project"));
	widget.setPreferenceForKey($("#Tasks")[0].selectedIndex, createInstancePreferenceKey("task"));
}

//
// Function: show()
// Called when the widget has been shown
//
function show()
{
	startDisplayUpdateTimer();
}

//
// Function: sync()
// Called when the widget has been synchronized with .Mac
//
function sync()
{
	var c = widget.preferenceForKey(createInstancePreferenceKey("clocker"));
	var s = widget.preferenceForKey(createInstancePreferenceKey("sitename"));
	var a = widget.preferenceForKey(createInstancePreferenceKey("authtoken"));
	var n = widget.preferenceForKey(createInstancePreferenceKey("Notes"));
	var p = widget.preferenceForKey(createInstancePreferenceKey("myProjects"));
	var r = widget.preferenceForKey(createInstancePreferenceKey("project"));
	var t = widget.preferenceForKey(createInstancePreferenceKey("task"));

	if (c) clocker.setState(c);
	if (s) {document.getElementById("sitename").value  = s; $("#url").text(s+".freshbooks.com");}
	if (a) document.getElementById("authtoken").value = a;
	if (n) $("#Notes")[0].value = n;
	if (p) {
		myProjects = JSON.parse(p);
		fillOutProjects();
		if (r) $("#Projects")[0].selectedIndex = parseInt(r);
		setTasksFromProject();
		if (t) $("#Tasks")[0].selectedIndex = parseInt(t);
	}
}

//
// Function: showBack(event)
// Called when the info button is clicked to show the back of the widget
//
// event: onClick event from the info button
//
function showBack(event)
{
    var front = document.getElementById("front");
    var back = document.getElementById("back");

    if (window.widget) {
        widget.prepareForTransition("ToBack");
    }

    front.style.display = "none";
    back.style.display = "block";

    if (window.widget) {
        setTimeout('widget.performTransition();', 0);
    }
	
	$("#sitename")[0].focus();
}

//
// Function: showFront(event)
// Called when the done button is clicked from the back of the widget
//
// event: onClick event from the done button
//
function showFront(event)
{
    var front = document.getElementById("front");
    var back = document.getElementById("back");

    if (window.widget) {
        widget.prepareForTransition("ToFront");
    }

    front.style.display="block";
    back.style.display="none";

    if (window.widget) {
        setTimeout('widget.performTransition();', 0);
    }
}

if (window.widget) {
    widget.onremove = remove;
    widget.onhide = hide;
    widget.onshow = show;
    widget.onsync = sync;
}


function clickedStartStop(event)
{
	if (clocker.clockRunning)
	{
		clocker.stopClock();
		widget.setPreferenceForKey(clocker.getState(), createInstancePreferenceKey("clocker"));
	}
	else
	{
		if ($("#updatedTime").css("visibility") == "visible") $("#updatedTime")[0].blur();
		clocker.startClock();
		widget.setPreferenceForKey(clocker.getState(), createInstancePreferenceKey("clocker"));
	}
}

var myProjects;

// Since we return objects instead of arrays, it's handy to know if there's anyone home.
function hasItems(o) {
	if (!o) return false;
	for (k in o) {
		return true;
	}
	return false;
}

function setTasksFromProject() {
	// Set the Tasks combo box based on the currently-selected value of the Project combo box
	var projects = $("#Projects")[0];
	var tasks = $("#Tasks")[0];
	
	//while (tasks.length > 0) tasks.remove(0);
	tasks.options.length = 0;
	
	var taskList = myProjects[projects.options[projects.selectedIndex].value].tasks;
	
	var sortedList = [];
	for (var tid in taskList) {
		sortedList.push({"id":tid,"name":taskList[tid].name});
	}
	sortedList.sort(com.freshbooks.api.sorttask);

	for (var i in sortedList)
	{
		tasks.add( new Option(
			sortedList[i].name,
			sortedList[i].id));
	}
}

function errorLoading(list) {
	if (list.status.text == "Timeout") {
		setStatus("statusmsg", "Connection timed out.  Check your password!");
	} else if (list.status.text == "HTTP status 400") {
		setStatus("statusmsg", "Check your site name and/or password!");
	} else if (list.status.text == "HTTP status 404") {
		setStatus("statusmsg", "Check your site name!");
	} else {
		setStatus("statusmsg", list.status.text);
	}

	hourglass.stop();
	$("#done")[0].object.setEnabled(true);
}

function loadTasks()
{
    var login = document.getElementById("sitename").value;
	var token = document.getElementById("authtoken").value;
	var taskCount = 0;       // Semaphore for closures so they know when everyone's done
	
	for (pid in myProjects) { taskCount++; }
	if (taskCount == 0) {
		setStatus("statusmsg", "No projects found.  Add some!");
		hourglass.stop();
		$("#done")[0].object.setEnabled(true);
		return false;
	}

	setStatus("statusmsg", "Loading " + taskCount + (taskCount > 1 ? " more projects" : " project"), true, xmlTimeout);

	for (pid in myProjects)
	{
		com.freshbooks.api.fetchFullList(login,token,'task',{project_id:pid},xmlTimeout,
			(function(proj_id){ return function (list) {
				taskCount--; // This is safe because JS is not multithreaded.
				if (list.status.ok) {
					myProjects[proj_id].tasks = list.list;
				} else {
					setStatus("statusmsg", "Error loading a project's tasks.", true, xmlTimeout);
				}

				if (taskCount) {
					setStatus("statusmsg", "Loading " + taskCount + " more project" + (taskCount > 1 ? "s" : ""), true, xmlTimeout);
				} else {
					// We're done loading stuff!
					// Flip to the front after a short delay (weird flippy behaviour otherwise)
					setTimeout("showFront();",500);
					$("#done")[0].object.setEnabled(true);
					// We've finished loading tasks, and we've sent off all
					// outstanding requests.  It's time to update the Tasks
					// combo box.
					setTasksFromProject();				
					setStatus("statusmsg", "");
					hourglass.stop();
					// Save our current setup.
					widget.setPreferenceForKey(JSON.stringify(myProjects), createInstancePreferenceKey("myProjects"));
				}
			}})(pid));
	}
}

function fillOutProjects()
{
	// Get our combo box
	var pr = $("#Projects")[0];

	// Clear all previous values
	pr.options.length = 0;
	
	var sortedList = [];

	for (var id in myProjects) {
		sortedList.push({"id":id,"name":myProjects[id].name});
	}
	sortedList.sort(com.freshbooks.api.sortproject);
	
	// Add the new items
	for (var i in sortedList)
	{
		if (debug) alert("Adding " + sortedList[i].id + " '" + sortedList[i].name + "'");
		pr.add( new Option(
			sortedList[i].name,
			sortedList[i].id));
	}
}

function loadProjects(event)
{
    var login = $("#sitename")[0].value;
	var token = $("#authtoken")[0].value;
	
	if (!login || !token) {
		setStatus("statusmsg", "Please enter your sitename and token.");
		return false;
	}
	
	com.freshbooks.api.fetchFullList(login,token,'project',{},xmlTimeout,
		function (list) {
			if (list.status.ok) {
				if (debug) alert("Got project list OK");
				
				myProjects = list.list;

				fillOutProjects();
				loadTasks();
				
				// At this point we know the login credentials work, so save them!
				widget.setPreferenceForKey(login, createInstancePreferenceKey("sitename"));
				widget.setPreferenceForKey(token, createInstancePreferenceKey("authtoken"));
				$("#url").text(login+".freshbooks.com");
			}
			else
			{
				errorLoading(list);
			}
		});
	
	setStatus("statusmsg", "Loading Projects...", false, xmlTimeout);
	hourglass.start();
	$("#done")[0].object.setEnabled(false);
}


function submitHours(event)
{
    var login = $("#sitename")[0].value;
	var token = $("#authtoken")[0].value;
	var r     = com.freshbooks.api.GetXMLHttpRequest(login, token, true);

	if (login.length == 0 || token.length == 0)
	{
		// Um, we need some auth info first!
		showBack();
		return;
	}

    // Read time; we must log in (fractional) hours.
	// 3600 seconds per hour, 1000 milliseconds per second
	var loggedTime = clocker.getTime() / 3600000;

	// Read Project
	var projectId = $("#Projects")[0].value;

	// Read Task
	var taskId = $("#Tasks")[0].value;
	if (taskId == "") {
		setStatus("submitStatus","You need to select a task");
		return false;
	}

	// Read notes
	var notes = $("#Notes")[0].value;

	// Notify user that we're posting
	$("#Projects")[0].disabled = true;
	$("#Tasks")[0].disabled = true;
	$("#Notes")[0].disabled = true;
	$("#submithours")[0].object.setEnabled(false);

	function enableInputs() {
		$("#Projects")[0].disabled = false;
		$("#Tasks")[0].disabled = false;
		$("#Notes")[0].disabled = false;
		$("#submithours")[0].object.setEnabled(true);
	};

	var entryCreateTimeout = setTimeout( function () {
			setStatus("submitStatus", "Timed out. :(");
			r.abort();
			enableInputs();
			entryCreateTimeout = null;
		}, xmlTimeout);

	// Notify the user when we're done posting
	r.onreadystatechange = function () {
		if (r.readyState == 4 && r.status == 200)
		{
			if (entryCreateTimeout)
			{
				clearTimeout(entryCreateTimeout);
				entryCreateTimeout = null;
			}
			
			if (com.freshbooks.api.getResponseStatus(r.responseXML) == "ok") {
				enableInputs();
				
				clocker.reset();
			
				setStatus("submitStatus", "Hours submitted!");
				$("#Notes")[0].value = "";
				widget.setPreferenceForKey(null, createInstancePreferenceKey("Notes"));
			} else {
				enableInputs();
				setStatus("submitStatus", $("error",r.responseXML).text());
			}
		}
	};

	// Don't count while we're submitting
	clocker.stopClock();

	// Fade in feedback text
	setStatus("submitStatus", "Submitting...", false, xmlTimeout);
	
	var d = new Date();
	// Post hours
	r.send(com.freshbooks.api.Request("time_entry.create",
		{
			time_entry: {
				project_id: projectId,
				task_id: taskId,
				hours: loggedTime,
				notes: notes,
				date: (""+d.getFullYear()+"-"+formatTwoDigits(d.getMonth()+1)+"-"+formatTwoDigits(d.getDate()))
			}
		}));
}




function headToFreshBooks(event)
{
    widget.openURL("http://www.freshbooks.com");
}


function headToMyFreshBooks(event)
{
    widget.openURL("https://" + $("#sitename")[0].value + ".freshbooks.com");
}


function getHelp(event)
{
    widget.openURL("http://www.freshbooks.com/widgets/need-help/");
}


function loginKeypress(event)
{
	switch (event.keyCode) {
		case 3:
		case 13:
			return loadProjects(event);
	}
	return true;
}


function enterToSubmitHours(event)
{
	switch (event.keyCode) {
		case 3: // Use enter to submit hours instead of performing a CR in the field
			return submitHours(event);
	}
	return true;
}


//
// Returns true if the supplied timestring is in the correct format.
function isValidTime(timestring)
{
	var ta = timestring.match(/^(\d*):(\d{0,2}):(\d{0,2})$/);
	if (ta == null) {
		return false;
	}
	if (parseInt(ta[2]) > 59 || parseInt(ta[3]) > 59)
		return false;
	return true;
}

//
// See what the result would be if we insert the users character into the string.
// Kind of silly, but it seems to be the most effective way to validate input!
function playKeypress(event,textbox)
{
	var curTime = textbox.value;
	var sstart = textbox.selectionStart;
	var send = textbox.selectionEnd;
	var c;
	if (event.charCode == 8)
	{	// Backspace
		c = "";
		if (sstart == send) { // NO selection
			if (sstart > 0) sstart--;
		}
	}
	else if (event.charCode == 63272)
	{	// Delete
		c = "";
		if (sstart == send) { // NO selection
			if (send < textbox.value.length-1) send++;
		}
	}
	else c = String.fromCharCode(event.charCode);

	return curTime.substr(0,sstart) + c + curTime.substr(send);
}

//
// Initiate editing of the amount of time logged in the clock.
function editClockedTime(event)
{
	var ut = $("#updatedTime")[0];

	clocker.stopClock();
	setElementVisibility("count",false);
	setElementVisibility("updatedTime",true);
	$("#submithours")[0].object.setEnabled(false);
	var curtime = $("#count")[0].innerHTML;
	ut.value = isValidTime(curtime) ? curtime : "0:00:00";
	ut.focus();
	ut.selectionStart = 0;
	ut.selectionEnd = ut.value.indexOf(":");
}

function validateClockedKey(event)
{
	if (event.ctrlKey || event.altKey) return true;
	switch (event.keyCode) {
		case 3:
		case 13: // Enter and Return
			event.preventDefault();
			$("#updatedTime")[0].blur();
			return false;
		case 27: // Esc
			event.preventDefault();
			$("#updatedTime")[0].value = $("#count")[0].innerHTML;
			$("#updatedTime")[0].blur();
			return false;
		case 63232: // Arrow keys
		case 63233:
		case 63234:
		case 63235:
			return true;
		case 8:     // Backspace -- We need to validate these keypresses, too
		case 63272: // Delete
		case 48:
		case 49:
		case 50:
		case 51:
		case 52:
		case 53:
		case 54:
		case 55:
		case 56:
		case 57:
		case 58:
			return validateUpdatedTime(event);
		case 9:
			tabToNextField();
			// Intentional fall-through
		default:
			event.preventDefault();
			return false;
	}
}

function updateClockedTime(event,throwaway)
{
	function map(f,a) { for (var x in a) { a[x] = f(a[x]); } return a; }
	function getInt(x) { var y = parseInt(x,10); return isNaN(y) ? 0 : y; }
    // Insert Code Here
	setElementVisibility("count",true);
	setElementVisibility("updatedTime",false);
	$("#submithours")[0].object.setEnabled(true);

	if (throwaway) return;

	// Update clocked time with what we have...
	var ts = $("#updatedTime")[0].value;
	var ta = map(getInt, ts.split(":"));
	clocker.stopClock(); // Just to make sure
	clocker.millisecondsClocked = 1000 * (ta[2] + 60 * (ta[1] + 60 * ta[0]));	
}

function tabToNextField()
{
	var ut = $("#updatedTime")[0];
	var startOfNextNumber = ut.value.indexOf(":",ut.selectionStart)+1;
	if (startOfNextNumber < 0) return;
	var endOfNextNumber = ut.value.indexOf(":",startOfNextNumber);
	ut.selectionStart = startOfNextNumber;
	ut.selectionEnd = endOfNextNumber > -1 ? endOfNextNumber : ut.value.length;
}

function validateUpdatedTime(event)
{
	var newTime = playKeypress(event,$("#updatedTime")[0]);
	var ut = $("#updatedTime")[0];

	if (isValidTime(newTime)) {
		return true;
	} else if ((ut.selectionStart == ut.selectionEnd) &&
				(ut.value.substr(ut.selectionStart,1) == ":") &&
				(event.keyCode == 58) ) {
		tabToNextField();
	}

	event.preventDefault();
	return false;
}


function addTimeStampToNotes(event)
{
	var n = $("#Notes")[0];
	var notes = n.value;
	var d = new Date();
	var h = d.getHours();
	var m = d.getMinutes();
	var ampm;
	// Noon is PM
	if (h == 12) {
		ampm = "PM";
	// Midnight is 12AM
	} else if (h == 0) {
		ampm = "AM";
		h = 12;
	// Things over 12 are in the afternoon.
	} else if (h > 12) {
		h %= 12;
		ampm = "PM";
	// Anything else is in the morning
	} else {
		ampm = "AM";
	}
	var ts = h + ":" + formatTwoDigits(m) + ampm;
	$("#Notes")[0].value = notes.substr(0,n.selectionStart) + ts + notes.substr(n.selectionEnd);
	n.selectionStart = n.selectionEnd = n.selectionStart + ts.length;
}
