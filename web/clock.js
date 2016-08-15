/* 
 * Tablet desk clock
 * 
 * Copyright (c) 2016 Project Nayuki
 * All rights reserved. Contact Nayuki for licensing.
 * https://www.nayuki.io/page/tablet-desk-clock
 */

"use strict";


/*---- Shared constants and functions ----*/

// Useful Unicode characters
var DEGREE_CHAR      = "\u00B0";
var QUARTER_EM_SPACE = "\u2005";
var EN_SPACE         = "\u2002";
var EN_DASH          = "\u2013";
var MINUS_CHAR       = "\u2212";
var SUN_CHAR         = "\u263C";
var MOON_CHAR        = "\u263D";


// Returns a text node that should be the only child of the given DOM element.
// If the DOM element already has a text node child then it is returned; otherwise a new blank child is added and returned.
// The element must not have sub-elements or multiple text nodes.
function getChildTextNode(elemId) {
	var elem = document.getElementById(elemId);
	if (elem.firstChild == null || elem.firstChild.nodeType != Node.TEXT_NODE)
		elem.insertBefore(document.createTextNode(""), elem.firstChild);
	return elem.firstChild;
}


// Returns the given integer as an exactly two-digit string.
// e.g. twoDigits(0) -> "00", twoDigits(8) -> "08", twoDigits(52) -> "52".
function twoDigits(n) {
	if (typeof n != "number" || n < 0 || n >= 100 || Math.floor(n) != n)
		throw "Integer expected";
	return (n < 10 ? "0" : "") + n;
}

// Monkey patching
Date.prototype.clone = function() {
	return new Date(this.getTime());
};


// Performs an XHR on the given URL, and calls the given function with the parsed JSON data if data was successful obtained.
function getAndProcessJson(url, timeout, func, retryCount) {
	if (retryCount === undefined)
		retryCount = 0;
	var xhr = new XMLHttpRequest();
	xhr.onload = function() {
		func(JSON.parse(xhr.response));
	};
	xhr.ontimeout = function() {
		if (retryCount < 9)  // Exponential back-off
			setTimeout(function() { getAndProcessJson(url, timeout, func, retryCount + 1); }, Math.pow(2, retryCount) * 1000);
	};
	xhr.open("GET", url, true);
	xhr.responseType = "text";
	xhr.timeout = timeout;
	xhr.send();
}


/*---- Time module ----*/

var timeModule = new function() {
	var self = this;
	
	// Represents the best known correct time minus the web browser's time, in milliseconds.
	// The time source may be the web server itself or from NTP (passed through the web server).
	var timeOffset = 0;
	
	// Returns a new Date object represented the current date and time, with corrections applied based on the server's time.
	this.getCorrectedDatetime = function() {
		return new Date(Date.now() + timeOffset);
	};
	
	// Calls the given function at or after the given wakeup datetime (i.e. getCorrectedDatetime().getTime() >= wake.getTime()).
	// The given function may be called immediately synchronously or asynchronously later.
	this.scheduleCall = function(func, wake) {
		var delay = wake.getTime() - self.getCorrectedDatetime().getTime();
		if (delay <= 0)
			func();
		else
			setTimeout(function() { self.scheduleCall(func, wake); }, delay);
	};
	
	function autoUpdateTimeOffset() {
		getAndProcessJson("/get-time.json", 1000, function(data) {
			timeOffset = data[1] - Date.now();
			if (data[0] == "ntp")
				document.getElementById("clock-status-no-clock").style.display = "none";
			else if (data[0] == "server") {
				document.getElementById("clock-status-no-clock").style.removeProperty("display");
				if (Math.abs(timeOffset) < 50)  // Heuristic for detecting local server
					timeOffset = 0;  // Don't correct if source is local, because it's counter-productive
			}
		});
		setTimeout(autoUpdateTimeOffset, 60 * 60 * 1000 * (0.9 + 0.2 * Math.random()));
	}
	
	autoUpdateTimeOffset();
};


/*---- Clock module ----*/

var clockModule = new function() {
	// Private variables
	var hourTextNode   = new MemoizingTextNode("clock-hour"  );
	var minuteTextNode = new MemoizingTextNode("clock-minute");
	var secondTextNode = new MemoizingTextNode("clock-second");
	var utcTextNode    = new MemoizingTextNode("clock-utcbox");
	var dateTextNode   = new MemoizingTextNode("clock-date"  );
	var DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	var prevClockUpdate = null;  // In Unix seconds
	
	// Updates the date and time texts every second.
	function autoUpdateClockDisplay() {
		var d = timeModule.getCorrectedDatetime();
		var curClockUpdate = Math.floor(d.getTime() / 1000);
		if (prevClockUpdate == null || curClockUpdate != prevClockUpdate) {
			hourTextNode  .setText(twoDigits(d.getHours  ()));  // Local hour  : "14"
			minuteTextNode.setText(twoDigits(d.getMinutes()));  // Local minute: "32"
			secondTextNode.setText(twoDigits(d.getSeconds()));  // Local second: "19"
			utcTextNode.setText(  // UTC date/time: "15-Fri 18:32 UTC"
				twoDigits(d.getUTCDate()) + "-" + DAYS_OF_WEEK[d.getUTCDay()] + EN_SPACE +
				twoDigits(d.getUTCHours()) + ":" + twoDigits(d.getUTCMinutes()) + EN_SPACE + "UTC");
			dateTextNode.setText(  // Local date: "2015-05-15-Fri"
				d.getFullYear() + EN_DASH + twoDigits(d.getMonth() + 1) + EN_DASH +
				twoDigits(d.getDate()) + EN_DASH + DAYS_OF_WEEK[d.getDay()]);
			prevClockUpdate = curClockUpdate;
		}
		setTimeout(autoUpdateClockDisplay, 1000 - timeModule.getCorrectedDatetime().getTime() % 1000);
	}
	
	// Updates the clock wallpaper once. Type is either "get" or "random".
	var changeWallpaper = this.changeWallpaper = function(type) {
		getAndProcessJson("/" + type + "-wallpaper.json", 3000, function(data) {
			if (typeof data == "string") {
				var clockElem = document.getElementById("clock");
				clockElem.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.65),rgba(0,0,0,0.65)),url('wallpaper/" + data + "')";
			}
		});
	};
	
	// Updates the clock wallpaper at startup and thereafter every day at 05:00.
	function autoUpdateWallpaper() {
		changeWallpaper("get");
		
		// Schedule next update at 05:00 local time
		var now = timeModule.getCorrectedDatetime();
		var next = now.clone();
		next.setHours(5);
		next.setMinutes(0);
		next.setSeconds(0);
		next.setMilliseconds(0);
		if (next.getTime() <= now.getTime())
			next.setDate(next.getDate() + 1);
		timeModule.scheduleCall(autoUpdateWallpaper, next);
	}
	
	function autoUpdateNetworkStatus() {
		getAndProcessJson("/network-status.json", 60000, function(data) {
			if (data[0] === true)
				document.getElementById("clock-status-no-internet").style.display = "none";
			else if (data[0] === false)
				document.getElementById("clock-status-no-internet").style.removeProperty("display");
			
			var containerElem = document.getElementById("clock-status-computers");
			while (containerElem.firstChild != null)
				containerElem.removeChild(containerElem.firstChild);
			data.forEach(function(val, i) {
				if (i >= 1) {
					var imgElem = document.createElement("img");
					imgElem.src = "icon/" + val + "-computer.svg";
					containerElem.appendChild(imgElem);
				}
			});
		});
		setTimeout(autoUpdateNetworkStatus, 10 * 60 * 1000 * (0.9 + 0.2 * Math.random()));
	}
	
	// A wrapper class around a DOM text node to avoid pushing unnecessary value updates to the DOM.
	function MemoizingTextNode(elemId) {
		var textNode = getChildTextNode(elemId);
		var value = textNode.data;
		this.setText = function(str) {
			if (str != value) {
				textNode.data = str;
				value = str;
			}
		};
	}
	
	// Initialization
	autoUpdateClockDisplay();
	autoUpdateWallpaper();
	setTimeout(autoUpdateNetworkStatus, 5000);
};


/*---- Admin module ----*/

var adminModule = new function() {
	var adminContentElem = document.getElementById("admin-content");
	var isAnimating = false;
	
	// Toggles whether the admin pane is shown or hidden.
	function togglePane() {
		if (isAnimating)
			return;
		isAnimating = true;
		if (adminContentElem.style.display == "none") {
			adminContentElem.className = "showing";
			adminContentElem.style.display = "block";
			setTimeout(function() {
				adminContentElem.className = "";
				isAnimating = false; }, 150);  // Must be a bit larger than the number declared in CSS
		} else {
			adminContentElem.className = "hiding";
			setTimeout(function() {
				adminContentElem.style.display = "none";
				adminContentElem.className = "";
				isAnimating = false; }, 350);  // Must be a bit larger than the number declared in CSS
		}
	}
	
	document.getElementById("admin-gear").onclick = togglePane;
	
	// For clicking outside the admin box
	adminContentElem.onclick = function(e) {
		if (e.target == adminContentElem)
			togglePane();  // Hiding
	};
	
	document.getElementById("admin-reload-page-button").onclick = function() {
		window.location.reload(true);
	};
	
	document.getElementById("admin-refresh-weather-button").onclick = function() {
		weatherModule.sunrisesetTextNode .data = "";
		weatherModule.conditionTextNode  .data = "";
		weatherModule.temperatureTextNode.data = "(Weather loading...)";
		weatherModule.doWeatherRequest();
	};
	
	document.getElementById("admin-change-wallpaper-button").onclick = function() {
		clockModule.changeWallpaper("random");
		togglePane();
	};
};


/*---- Weather module ----*/

var weatherModule = new function() {
	var sunrisesetTextNode  = this.sunrisesetTextNode  = getChildTextNode("morning-sunriseset");
	var conditionTextNode   = this.conditionTextNode   = getChildTextNode("clock-weather-condition");
	var temperatureTextNode = this.temperatureTextNode = getChildTextNode("clock-weather-temperature");
	var weatherTextIsSet;
	
	// Updates the weather display once.
	var doWeatherRequest = this.doWeatherRequest = function() {
		getAndProcessJson("/weather.json", 10000, function(data) {
			if (typeof data != "object") {
				sunrisesetTextNode.data = "";
				temperatureTextNode.data = "";
				conditionTextNode.data = "(Weather: Data error)";
			} else {
				document.getElementById("clock-weatherbox").title = data["location"];
				sunrisesetTextNode.data = SUN_CHAR + " " + data["sunrise"] + " ~ " + data["sunset"] + " " + MOON_CHAR;
				conditionTextNode.data = data["condition"];
				temperatureTextNode.data = Math.round(parseFloat(data["temperature"])).toString().replace("-", MINUS_CHAR) + QUARTER_EM_SPACE + DEGREE_CHAR + "C";
				var d = timeModule.getCorrectedDatetime();
				getChildTextNode("admin-last-weather").data = twoDigits(d.getHours()) + ":" + twoDigits(d.getMinutes());
			}
			weatherTextIsSet = true;
		});
	};
	
	// Updates the weather and sunrise displays at startup and thereafter at around 4 minutes past each hour
	function autoUpdateWeather() {
		// Set delayed placeholder text
		weatherTextIsSet = false;
		setTimeout(function() {
			if (!weatherTextIsSet) {
				sunrisesetTextNode.data = "";
				temperatureTextNode.data = "";
				conditionTextNode.data = "(Weather loading...)"; }}, 3000);
		doWeatherRequest();
		
		// Schedule next update at about 5 minutes past the hour
		var now = timeModule.getCorrectedDatetime();
		var next = now.clone();
		next.setMinutes(4);
		next.setSeconds(0);
		next.setMilliseconds(Math.random() * 2 * 60 * 1000);  // Deliberate jitter of 2 minutes
		if (next.getTime() < now.getTime() || next.getHours() == now.getHours() && now.getMinutes() >= 4)
			next.setHours(next.getHours() + 1);
		timeModule.scheduleCall(autoUpdateWeather, next);
	}
	
	// Initialization
	autoUpdateWeather();
};


/*---- Morning module ----*/

var morningModule = new function() {
	var morningElem = document.getElementById("morning");
	var remindersElem = document.getElementById("morning-reminders");
	
	function showMorning() {
		var greetingSpans = document.querySelectorAll("#morning h1 span");
		var msgIndex = Math.floor(Math.random() * greetingSpans.length);
		for (var i = 0; i < greetingSpans.length; i++)
			greetingSpans[i].style.display = i == msgIndex ? "inline" : "none";
		
		clearMessages();
		addMessage("(Loading...)");
		doMorningRequest();
		
		morningElem.style.removeProperty("display");
		scheduleNextMorning();
		setTimeout(hideMorning, 5 * 3600 * 1000);
	}
	
	function hideMorning() {
		morningElem.className = "hiding";
		setTimeout(function() {
			morningElem.style.display = "none";
			morningElem.className = "";
			clearMessages(); }, 600);  // Must be a bit larger than the number declared in CSS
	}
	
	function addMessage(text) {
		var li = document.createElement("li");
		li.appendChild(document.createTextNode(text));
		remindersElem.appendChild(li);
	}
	
	function clearMessages() {
		while (remindersElem.firstChild != null)
			remindersElem.removeChild(remindersElem.firstChild);
	}
	
	function doMorningRequest() {
		getAndProcessJson("/morning-reminders.json", 3000, function(data) {
			clearMessages();
			if (typeof data != "object")
				addMessage("(Error)");
			else {
				// For example, key = "20151231"
				var d = timeModule.getCorrectedDatetime();
				var key = d.getFullYear() + (d.getMonth() + 1 < 10 ? "0" : "") +
					(d.getMonth() + 1) + (d.getDate() < 10 ? "0" : "") + d.getDate();
				if (key in data) {
					var msgs = data[key];
					if (msgs.length == 0)
						addMessage("(None)");
					msgs.forEach(addMessage);
				} else
					addMessage("(Data missing)");
			}
		});
	}
	
	// Shows the morning data every day at 07:00
	function scheduleNextMorning() {
		var now = timeModule.getCorrectedDatetime();
		var next = now.clone();
		next.setHours(7);
		next.setMinutes(0);
		next.setSeconds(0);
		next.setMilliseconds(0);
		if (next.getTime() < now.getTime())
			next.setDate(next.getDate() + 1);
		timeModule.scheduleCall(showMorning, next);
	}
	
	// Initialization
	morningElem.onclick = hideMorning;
	scheduleNextMorning();
};
