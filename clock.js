"use strict";


/* Date and time clock module */

(function() {
	var timeTextNode = document.createTextNode("");
	var dateTextNode = document.createTextNode("");
	document.getElementById("clock-time").appendChild(timeTextNode);
	document.getElementById("clock-date").appendChild(dateTextNode);
	var DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	var prevDateText = "";
	
	function updateClock() {
		var d = new Date();
		var s = (d.getHours() < 10 ? "0" : "") + d.getHours() + ":";
		s += (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() + ":";
		s += (d.getSeconds() < 10 ? "0" : "") + d.getSeconds();
		timeTextNode.data = s;
		s = d.getFullYear() + "-";
		s += (d.getMonth() + 1 < 10 ? "0" : "") + (d.getMonth() + 1) + "-";
		s += (d.getDate() < 10 ? "0" : "") + d.getDate() + "-";
		s += DAYS_OF_WEEK[d.getDay()];
		if (prevDateText != s) {
			dateTextNode.data = s;
			prevDateText = s;
		}
		setTimeout(updateClock, 1000 - d.getTime() % 1000 + 20);
	}
	
	updateClock();
})();


/* Weather module */

(function() {
	var weatherTextNode    = document.createTextNode("");
	var sunrisesetTextNode = document.createTextNode("");
	document.getElementById("clock-weather"   ).appendChild(weatherTextNode);
	document.getElementById("clock-sunriseset").appendChild(sunrisesetTextNode);
	var weatherTextIsSet;
	
	function updateWeather() {
		// Set delayed placeholder text
		weatherTextIsSet = false;
		setTimeout(function() {
			if (!weatherTextIsSet) {
				weatherTextNode.data = "(Weather loading...)";
				sunrisesetTextNode.data = ""; }}, 3000);
		
		// Fire off AJAX request
		var xhr = new XMLHttpRequest();
		xhr.onload = function() {
			var data = JSON.parse(xhr.response);
			if (typeof data != "object") {
				weatherTextNode.data = "(Weather: Data error)";
				sunrisesetTextNode.data = "";
			} else {
				var text = data["condition"] + "\u00A0\u00A0";
				text += Math.round(parseFloat(data["temperature"])).toString().replace("-", "\u2212") + "\u00B0C";
				weatherTextNode.data = text;
				sunrisesetTextNode.data = "\u263C " + data["sunrise"] + " ~ " + data["sunset"] + " \u263D";
			}
			weatherTextIsSet = true;
		};
		xhr.ontimeout = function() {
			weatherTextNode.data = "(Weather: Timeout)";
			weatherTextIsSet = true;
		}
		xhr.open("GET", "/weather.json", true);
		xhr.responseType = "text";
		xhr.timeout = 10000;
		xhr.send();
		
		// Schedule next update at about 5 minutes past the hour
		var now = new Date();
		var next = new Date(now.getTime());
		next.setMinutes(4);
		next.setSeconds(0);
		next.setMilliseconds(Math.random() * 2 * 60 * 1000);  // Deliberate jitter of 2 minutes
		if (next.getTime() < now.getTime())
			next.setHours(next.getHours() + 1);
		var delay = next.getTime() - now.getTime();
		if (delay <= 0)  // Shouldn't happen, but just in case
			delay = 60 * 60 * 1000;
		setTimeout(updateWeather, delay);
	}
	
	updateWeather();
})();
