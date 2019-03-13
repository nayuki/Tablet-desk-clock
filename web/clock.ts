/* 
 * Tablet desk clock
 * 
 * Copyright (c) Project Nayuki
 * All rights reserved. Contact Nayuki for licensing.
 * https://www.nayuki.io/page/tablet-desk-clock
 */

"use strict";


namespace clock {
	
	let prevUpdate: number = NaN;  // In Unix seconds
	
	
	function autoUpdateClockDisplay(): void {
		const d = new Date();
		const curUpdate: number = Math.floor(d.getTime() / 1000);
		if (curUpdate != prevUpdate) {
			prevUpdate = curUpdate;
			setText("clock-hour"  , twoDigits(d.getHours  ()));
			setText("clock-minute", twoDigits(d.getMinutes()));
			setText("clock-second", twoDigits(d.getSeconds()));
			setText("clock-date",  // Local date: "2018-12-31-Mon"
				d.getFullYear() + EN_DASH + twoDigits(d.getMonth() + 1) + EN_DASH +
				twoDigits(d.getDate()) + EN_DASH + DAYS_OF_WEEK[d.getDay()]);
			setText("clock-utc",  // UTC date/time: "01-Tue 17:49 UTC"
				twoDigits(d.getUTCDate()) + "-" + DAYS_OF_WEEK[d.getUTCDay()] + EN_SPACE +
				twoDigits(d.getUTCHours()) + ":" + twoDigits(d.getUTCMinutes()) + EN_SPACE + "UTC");
		}
		setTimeout(autoUpdateClockDisplay, 1000 - Date.now() % 1000);
	}
	
	
	function setText(elemId: string, text: string): void {
		let elem = util.getElem(elemId);
		if (elem.textContent != text)
			elem.textContent = text;
	}
	
	
	function twoDigits(x: number): string {
		return x.toString().padStart(2, "0");
	}
	
	
	const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	
	const EN_SPACE = "\u2002";
	const EN_DASH  = "\u2013";
	
	
	setTimeout(autoUpdateClockDisplay, 0);
	
}



namespace util {
	
	export function getElem(id: string): HTMLElement {
		const result = document.getElementById(id);
		if (result instanceof HTMLElement)
			return result;
		throw "Assertion error";
	}
	
}
