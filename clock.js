"use strict";


var timeTextNode = document.createTextNode("");
var dateTextNode = document.createTextNode("");
document.getElementById("timetext").appendChild(timeTextNode);
document.getElementById("datetext").appendChild(dateTextNode);
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


updateClock();
