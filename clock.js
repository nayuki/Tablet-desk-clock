"use strict";


var textElem = document.getElementById("clocktext");
var textNode = document.createTextNode("");
textElem.appendChild(textNode);
var curFontSize = 24;  // Do not change


function updateClock() {
	var d = new Date();
	var s = "";
	s += (d.getHours  () < 10 ? "0" : "") + d.getHours  () + ":";
	s += (d.getMinutes() < 10 ? "0" : "") + d.getMinutes() + ":";
	s += (d.getSeconds() < 10 ? "0" : "") + d.getSeconds();
	textNode.data = s;
	setTimeout(updateClock, 1000 - d.getTime() % 1000 + 20);
}


function updateTextSize() {
	var targetWidth = 0.9;  // Proportion of full screen width
	for (var i = 0; i < 3; i++) {  // Iterate for better better convergence
		var newFontSize = textElem.parentNode.offsetWidth * targetWidth / textElem.offsetWidth * curFontSize;
		textElem.style.fontSize = newFontSize.toFixed(3) + "pt";
		curFontSize = newFontSize;
	}
}


updateClock();
updateTextSize();
window.addEventListener("resize", updateTextSize);
