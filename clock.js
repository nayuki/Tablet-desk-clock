"use strict";


/* Shared definitions */

// Useful Unicode characters
var DEGREE_CHAR      = "\u00B0";
var QUARTER_EM_SPACE = "\u2005";
var EN_SPACE         = "\u2002";
var EN_DASH          = "\u2013";
var MINUS_CHAR       = "\u2212";
var SUN_CHAR         = "\u263C";
var MOON_CHAR        = "\u263D";


/* Date and time clock module */

(function() {
	var timeTextNode    = getChildTextNode("clock-time");
	var secondsTextNode = getChildTextNode("clock-seconds");
	var dateTextNode    = getChildTextNode("clock-date");
	var utcTextNode     = getChildTextNode("clock-utc");
	var DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	var prevMinuteText = "";
	var prevDateText   = "";
	var prevUtcText    = "";
	var timeOffset = 0;
	
	function updateClock() {
		var d = new Date(Date.now() + timeOffset);
		// Local time: "14:32:19"
		var s = twoDigits(d.getHours()) + ":" + twoDigits(d.getMinutes());
		if (s != prevMinuteText) {
			timeTextNode.data = s;
			prevMinuteText = s;
		}
		secondsTextNode.data = twoDigits(d.getSeconds());
		// Local date: "2015-05-15-Fri"
		s = d.getFullYear() + EN_DASH + twoDigits(d.getMonth() + 1) + EN_DASH + twoDigits(d.getDate()) + EN_DASH + DAYS_OF_WEEK[d.getDay()];
		if (s != prevDateText) {
			dateTextNode.data = s;
			prevDateText = s;
		}
		// UTC date/time: "15-Fri 18:32 UTC"
		s = twoDigits(d.getUTCDate()) + "-" + DAYS_OF_WEEK[d.getUTCDay()] + EN_SPACE + twoDigits(d.getUTCHours()) + ":" + twoDigits(d.getUTCMinutes()) + EN_SPACE + "UTC";
		if (s != prevUtcText) {
			utcTextNode.data = s;
			prevUtcText = s;
		}
		setTimeout(updateClock, 1000 - d.getTime() % 1000 + 20);
	}
	
	function updateWallpaper() {
		// Fire off AJAX request
		function doWallpaperRequest(retryCount) {
			var xhr = new XMLHttpRequest();
			xhr.onload = function() {
				var data = JSON.parse(xhr.response);
				if (typeof data == "string") {
					var clockElem = document.getElementById("clock");
					clockElem.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.65),rgba(0,0,0,0.65)),url('wallpapers/" + data + "')"
				}
			};
			xhr.ontimeout = function() {
				if (retryCount < 10)
					setTimeout(function() { doWallpaperRequest(retryCount + 1); }, retryCount * 1000);
			}
			xhr.open("GET", "/random-wallpaper.json", true);
			xhr.responseType = "text";
			xhr.timeout = 10000;
			xhr.send();
		}
		doWallpaperRequest(0);
		
		// Schedule next update at 05:00 local time
		var now = new Date();
		var next = new Date(now.getTime());
		next.setHours(5);
		next.setMinutes(0);
		next.setSeconds(0);
		next.setMilliseconds(0);
		if (next.getTime() < now.getTime() + 60000)  // Compensate for possible early wake-up
			next.setDate(next.getDate() + 1);
		var delay = next.getTime() - now.getTime();
		if (delay <= 0)  // Shouldn't happen, but just in case
			delay = 24 * 60 * 60 * 1000;
		setTimeout(updateWallpaper, delay);
	}
	
	function updateTimeOffset() {
		// Fire off AJAX request
		function doTimeRequest(retryCount) {
			var xhr = new XMLHttpRequest();
			xhr.onload = function() {
				var data = JSON.parse(xhr.response);
				if (typeof data == "number")
					timeOffset = data - Date.now();
			};
			xhr.ontimeout = function() {
				if (retryCount < 10)
					setTimeout(function() { doTimeRequest(retryCount + 1); }, retryCount * 1000);
			}
			xhr.open("GET", "/time.json", true);
			xhr.responseType = "text";
			xhr.timeout = 1000;
			xhr.send();
		}
		doTimeRequest(0);
	}
	
	updateClock();
	updateWallpaper();
	updateTimeOffset();
})();


/* Admin module */

function toggleAdmin() {
	var elem = document.getElementById("admin-content");
	elem.style.display = elem.style.display == "none" ? "block" : "none";
}


function reloadWeather() {
	getChildTextNode("morning-sunriseset").data = "";
	getChildTextNode("clock-weather-condition").data = "";
	getChildTextNode("clock-weather-temperature").data = "(Weather loading...)";
	doWeatherRequest(0);
}


var doWeatherRequest;


/* Weather module */

(function() {
	var sunrisesetTextNode  = getChildTextNode("morning-sunriseset");  // Cross-module
	var conditionTextNode   = getChildTextNode("clock-weather-condition");
	var temperatureTextNode = getChildTextNode("clock-weather-temperature");
	var weatherTextIsSet;
	
	function updateWeather() {
		// Set delayed placeholder text
		weatherTextIsSet = false;
		setTimeout(function() {
			if (!weatherTextIsSet) {
				sunrisesetTextNode.data = "";
				temperatureTextNode.data = "";
				conditionTextNode.data = "(Weather loading...)"; }}, 3000);
		
		// Fire off AJAX request
		doWeatherRequest = function(retryCount) {
			var xhr = new XMLHttpRequest();
			xhr.onload = function() {
				var data = JSON.parse(xhr.response);
				if (typeof data != "object") {
					sunrisesetTextNode.data = "";
					temperatureTextNode.data = "";
					conditionTextNode.data = "(Weather: Data error)";
				} else {
					sunrisesetTextNode.data = SUN_CHAR + " " + data["sunrise"] + " ~ " + data["sunset"] + " " + MOON_CHAR;
					conditionTextNode.data = data["condition"];
					temperatureTextNode.data = Math.round(parseFloat(data["temperature"])).toString().replace("-", MINUS_CHAR) + QUARTER_EM_SPACE + DEGREE_CHAR + "C";
					var d = new Date();
					getChildTextNode("admin-last-weather").data = twoDigits(d.getHours()) + ":" + twoDigits(d.getMinutes());
				}
				weatherTextIsSet = true;
			};
			xhr.ontimeout = function() {
				sunrisesetTextNode.data = "";
				temperatureTextNode.data = "";
				conditionTextNode.data = "(Weather: Timeout)";
				weatherTextIsSet = true;
				if (retryCount < 10)
					setTimeout(function() { doWeatherRequest(retryCount + 1); }, retryCount * 1000);
			}
			xhr.open("GET", "/weather.json", true);
			xhr.responseType = "text";
			xhr.timeout = 10000;
			xhr.send();
		}
		doWeatherRequest(0);
		
		// Schedule next update at about 5 minutes past the hour
		var now = new Date();
		var next = new Date(now.getTime());
		next.setMinutes(4);
		next.setSeconds(0);
		next.setMilliseconds(Math.random() * 2 * 60 * 1000);  // Deliberate jitter of 2 minutes
		if (next.getTime() < now.getTime() || next.getHours() == now.getHours() && now.getMinutes() >= 4)
			next.setHours(next.getHours() + 1);
		var delay = next.getTime() - now.getTime();
		if (delay <= 0)  // Shouldn't happen, but just in case
			delay = 60 * 60 * 1000;
		setTimeout(updateWeather, delay);
	}
	
	updateWeather();
})();


/* Morning module */

(function() {
	var morningElem = document.getElementById("morning");
	var greetingSpans = morningElem.getElementsByTagName("h1")[0].getElementsByTagName("span");
	var remindersElem = document.getElementById("morning-reminders");
	
	function showMorning() {
		var msgIndex = Math.floor(Math.random() * greetingSpans.length);
		for (var i = 0; i < greetingSpans.length; i++)
			greetingSpans[i].style.display = i == msgIndex ? "inline" : "none";
		
		clearMessages();
		addMessage("(Loading...)");
		doMorningRequest(0);
		
		morningElem.style.display = "table";
		scheduleNextMorning();
		setTimeout(hideMorning, 5 * 3600 * 1000);
	}
	
	function hideMorning() {
		morningElem.style.display = "none";
		clearMessages();
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
	
	function doMorningRequest(retryCount) {
		var xhr = new XMLHttpRequest();
		xhr.onload = function() {
			var data = JSON.parse(xhr.response);
			if (typeof data != "object") {
				clearMessages();
				addMessage("(Error)");
			} else {
				clearMessages();
				var d = new Date();
				var key = d.getFullYear() + (d.getMonth() + 1 < 10 ? "0" : "") + (d.getMonth() + 1) + (d.getDate() < 10 ? "0" : "") + d.getDate();
				if (key in data) {
					var msgs = data[key];
					if (msgs.length == 0)
						addMessage("(None)");
					else {
						for (var i = 0; i < msgs.length; i++)
							addMessage(msgs[i]);
					}
				} else
					addMessage("(Data missing)");
			}
		};
		xhr.ontimeout = function() {
			if (retryCount < 10)
				setTimeout(function() { doMorningRequest(retryCount + 1); }, retryCount * 1000);
		}
		xhr.open("GET", "/morning-reminders.json", true);
		xhr.responseType = "text";
		xhr.timeout = 10000;
		xhr.send();
	}
	
	function scheduleNextMorning() {
		var now = new Date();
		var next = new Date(now.getTime());
		next.setHours(7);
		next.setMinutes(0);
		next.setSeconds(0);
		next.setMilliseconds(0);
		if (next.getTime() < now.getTime() + 60000)  // Compensate for possible early wake-up
			next.setDate(next.getDate() + 1);
		var delay = next.getTime() - now.getTime();
		if (delay <= 0)  // Shouldn't happen, but just in case
			delay = 6 * 3600 * 1000;
		setTimeout(showMorning, delay);
	}
	
	morningElem.onclick = hideMorning;
	scheduleNextMorning();
})();


/* Miscellaneous utilities */

function getChildTextNode(elemId) {
	var elem = document.getElementById(elemId);
	if (elem.firstChild != null && elem.firstChild.nodeType == Node.TEXT_NODE)
		return elem.firstChild;
	else {
		var result = document.createTextNode("");
		elem.appendChild(result);
		return result;
	}
}
	
	
function twoDigits(n) {
	if (n < 0 || n >= 100 || Math.floor(n) != n)
		throw "Integer expected";
	return (n < 10 ? "0" : "") + n;
}
