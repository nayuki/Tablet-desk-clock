"use strict";


var timeTextElem = document.getElementById("timetext");
var dateTextElem = document.getElementById("datetext");
var timeTextNode = document.createTextNode("");
var dateTextNode = document.createTextNode("");
timeTextElem.appendChild(timeTextNode);
dateTextElem.appendChild(dateTextNode);
var curFontSize = 24;  // Do not change
var DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];


function updateClock() {
	var d = new Date();
	var s = (d.getHours  () < 10 ? "0" : "") + d.getHours  () + ":";
	s += (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() + ":";
	s += (d.getSeconds() < 10 ? "0" : "") + d.getSeconds();
	timeTextNode.data = s;
	s = d.getFullYear() + "-";
	s += (d.getMonth() + 1 < 10 ? "0" : "") + (d.getMonth() + 1) + "-";
	s += (d.getDate() < 10 ? "0" : "") + d.getDate() + "-";
	s += DAYS_OF_WEEK[d.getDay()];
	dateTextNode.data = s;
	setTimeout(updateClock, 1000 - d.getTime() % 1000 + 20);
}


function updateTextSize() {
	var containerElem = document.getElementById("container");
	var targetWidth = 0.9;  // Proportion of full screen width
	for (var i = 0; i < 3; i++) {  // Iterate for better better convergence
		var newFontSize = containerElem.offsetWidth * targetWidth / timeTextElem.offsetWidth * curFontSize;
		containerElem.style.fontSize = newFontSize.toFixed(3) + "pt";
		curFontSize = newFontSize;
	}
}


updateClock();
updateTextSize();
window.addEventListener("resize", updateTextSize);
