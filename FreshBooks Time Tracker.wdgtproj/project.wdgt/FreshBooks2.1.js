// FreshBooks API 2.1 wrapper functions
// v1.0, taavi@freshbooks.com January-March 2008

// Copyright (c) 2008 2ndSite Inc. (www.freshbooks.com)
// Licenced under the MIT license (see MITLICENSE.txt).

// This relies on the presence of jquery, and was written and tested with 1.2.2.

//
// JS-ifies the XML returned from a client.list request, by returning an
// object with members 'num_entries' and each of the actual 'client_id's;
// the value of each client_id is another object containing the actual
// client info.  Just pretend it's a Hash of Hashes.
var com;
if (!com) com = {};
if (!com.freshbooks) com.freshbooks = {};
com.freshbooks.api = {};

com.freshbooks.api.debug = false;

(function(){  // So we get private variables; goes to the end of the file...

// Shortcut
var ns = com.freshbooks.api;

ns.UA = "Generic";

// Short definition of the various kinds of list
var clientList = {
	head: "client",
	id:   "client_id",
	sort: "organization",
	items:["organization","username","first_name","last_name","email"]};
var invoiceList = {
	head: "invoice",
	id:   "invoice_id",
	sort: "number",
	items:["number","client_id","organization","amount","date"]};
var estimateList = {
	head: "estimate",
	id:   "estimate_id",
	sort: "number",
	items:["number","client_id","organization","status","amount","date"]};
var recurringList = {
	head: "recurring",
	id:   "recurring_id",
	sort: "organization",
	items:["stopped","client_id","organization","amount","date"]};
var itemList = {
	head: "item",
	id:   "item_id",
	sort: "name",
	items:["name","description","unit_cost","quantity","inventory"]};
var paymentList = {
	head: "payment",
	id:   "payment_id",
	sort: "date",
	items:["invoice_id","date","type","note","client_id"]};
var time_entryList = {
	head: "time_entry",
	id:   "time_entry_id",
	sort: "date",
	items:["project_id","task_id","hours","date","notes"]};
var projectList = {
	head: "project",
	id:   "project_id",
	sort: "name",
	items:["name","description","rate","bill_method","client_id"]};
var taskList = {
	head: "task",
	id:   "task_id",
	sort: "name",
	items:["name","description","billable","rate"]};

//
// JS-ifies the XML returned from a X.list request, by returning an
// array with each of the actual 'X_id's as array subscripts; the
// individual tag values are set to be object data members of the tag name.
// That is to say:
//  <client><client_id>1</client_id><name>John</name></client><client>
//  <client_id>3</client_id><name>Jane</name></client>
// translates to:
//  [,{name: "John"},,{name: "Jane"}] // i.e. an array with subscripts 1 and 3 set
// The use of closure means this only has to be written once for all list types.
// To add a new list type, just add the appropriate data definition above, and the
// appropriate call to parseList below.
var parseList = function(list) {
	return function(xml) {
		if (ns.getResponseStatus(xml) != "ok")
		{
			throw $("error",xml).text();
		}
		var headTag = $(list.head,xml);
		var parsedList = {};
		jQuery.map( headTag, function(c) {
			parsedList[$(list.id,c).text()] = {};
			thisItem = parsedList[$(list.id,c).text()];
			for (tag in list.items)
			{
				thisItem[list.items[tag]] =	$(list.items[tag],c).text();
			}
		});
		if (ns.debug) alert("Parsed " + list.head + ", size " + parsedList.length);
		return {status: {ok: $("response",xml).attr("status") == "ok" ? true : false,
						text: $("error",xml).text()},
				pagination: { page: $(list.head+"s",xml).attr("page"),
						per_page: $(list.head+"s",xml).attr("per_page"),
						pages: $(list.head+"s",xml).attr("pages"),
						total: $(list.head+"s",xml).attr("total")},
				list: parsedList};
	};
};

// Generate the closures to parse the different types
ns.clientList    = parseList(clientList);
ns.invoiceList   = parseList(invoiceList);
ns.estimateList  = parseList(estimateList);
ns.recurringList = parseList(recurringList);
ns.itemList      = parseList(itemList);
ns.paymentList   = parseList(paymentList);
ns.time_entryList = parseList(time_entryList);
ns.projectList   = parseList(projectList);
ns.taskList      = parseList(taskList);

var genSort = function(list) {
	return function(a,b) {
		var a1 = a[list.sort].toUpperCase();
		var b1 = b[list.sort].toUpperCase();
		if (a1 < b1) {
			return -1;
		} else if (a1 > b1) {
			return 1;
		} else {
			return 0;
		}
	};
};

ns.sortclient    = genSort(clientList);
ns.sortinvoice   = genSort(invoiceList);
ns.sortestimate  = genSort(estimateList);
ns.sortrecurring = genSort(recurringList);
ns.sortitem      = genSort(itemList);
ns.sortpayment   = genSort(paymentList);
ns.sorttime_entry = genSort(time_entryList);
ns.sortproject   = genSort(projectList);
ns.sorttask      = genSort(taskList);

ns.getResponseStatus = function (xml) {
	return $("response",xml).attr("status");
};

ns.mergeLists = function (list, acc) {
	var k;
	for (k in list.list) {
		acc.list[k] = list.list[k];
	}
	return acc;
};


// Recursively transform a nested JS object into an XML tree, e.g.:
//	{ time_entry: {	project_id: 1,
//					task_id: 2,
//					hours: 3,
//					notes: "four" } }
// turns into:
//	<time_entry><project_id>1</project_id>
//	<task_id>2</task_id>
//	<hours>3</hours>
//	<notes>four</notes>
//	</time_entry>
var makeTagStructure = function (opts) {
	var r = "";
	var t;
	for (t in opts)
	{
		r += '<' + t + '>';
		if (typeof(opts[t]) == "object")	r += makeTagStructure(opts[t]);
		else								r += opts[t];
		r += '</' + t + '>\n';
	}
	return r;
};

//
// Fill in the skeleton of an XML request for 'method', creating
// individual tags with value for each member of 'opts'.
ns.Request = function(method, opts) {
	var r;

	r  = '<?xml version="1.0" encoding="utf-8"?>\n' +
		 '<request method="' + method + '">\n';
	r += makeTagStructure(opts);
	r += '</request>';
	
	if (ns.debug) alert(r);
	return r;
}

//
// Returns an XMLHttpRequest for use with the API.
// Just set your handler (if applicable), and call .open().
ns.GetXMLHttpRequest = function(name, token, async) {
	var r = new XMLHttpRequest();
	var target = "https://"+name+".freshbooks.com/api/2.1/xml-in";

	r.open("POST", target, async, token, "x");
	r.setRequestHeader("X-User-Agent", ns.UA + " (FreshBooks2.1.js)");
	
	if (ns.debug) alert(target);
	return r;
}

//
// Get a full list of some type.
// You have to provide your name and token, just as for GetXMLHttpRequest.
// Also what type of list it is, e.g. "item" or "project"
// And any arguments you have for the list, e.g. to limit by project_id
// And a callback function where you can be reached.
// State is generally to be considered internal.  Just leave it out.  :)
// Returns the XMLHttpRequest so you can abort it later!
ns.fetchFullList = function (
		name,
		token,
		type,
		args,
		timeout,
		callback,
		state) {
	if (ns.debug) alert("fetchFullList:"+ns.print_r([name,token,type,args,timeout,callback,state]));
	
	var r = ns.GetXMLHttpRequest(name, token, true);
	
	args = args || {};
	state = state || {page:1,per_page:ns.debug?5:100,list:{}};
	
	var loadTimeout = setTimeout( function () {
		r.abort();
		loadTimeout = null;
		callback({status: {ok: false, text: "Timeout"}});
	}, timeout );

	// If something went wrong, let the caller know.
	function err(text) {
		callback({status: {ok: false, text: text}});
	}
	
	r.onreadystatechange = function () {
		if (r.readyState < 4) {
			// Not ready, don't care.
			return;
		} else if (r.readyState == 4 && r.status == 200) {
			// Check the response code
			if (ns.getResponseStatus(r.responseXML) != "ok") {
				err($("error",r.responseXML).text());
				return;
			}

			// Extract the data
			var list = (ns[type+"List"])(r.responseXML);
			
			// Merge it with what we have already
			state.list = ns.mergeLists(state.list,list);
			
			// If we need to go again, loop
			if (parseInt(list.pagination.page) < parseInt(list.pagination.pages)) {
				// MAGIC!
				state.page++;
				ns.fetchFullList(name, token, type, args, timeout, callback, state);
			} else {
				// We're done, so hit up the callback.
				callback(list);
			}
		} else {
			// Error!  How do we return this?  Callback!
			err("HTTP status "+r.status);
		}

		// We were ready and have run the callback, so timeouts can't
		// happen any more.  This shouldn't conflict with another
		// timeout set by the next iteration.
		if (loadTimeout)
		{
			clearTimeout(loadTimeout);
			loadTimeout = null;
		}
	};
	
	args.page = state.page;
	args.per_page = state.per_page;
	r.send(ns.Request(type+".list", args));
	return r;
};

//
// Pure utility function that should have been part of the language spec. ;)
ns.print_r = function (o,indent) {
	indent = indent || "  ";
	var str = "{\n";
	var pre = indent;
	for (x in o) {
		str += pre + x + ":" +
			(typeof(o[x]) == "object" ? ns.print_r(o[x],indent+"  ") : o[x]);
		pre = ",\n"+indent;
	}
	str += "\n"+indent+"}";
	return str;
};

})();
