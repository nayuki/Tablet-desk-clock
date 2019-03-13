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



namespace weather {
	
	let initialized: boolean = false;
	let eraseWeather: number = -1;
	
	
	export async function initialize(): Promise<void> {
		if (initialized)
			throw "Assertion error";
		initialized = true;
		
		while (true) {
			await updateWeatherOnce();
			
			// Schedule next update at about 5 minutes past the hour
			const now = new Date();
			let next = new Date(now.getTime());
			next.setMinutes(4);
			next.setSeconds(0);
			next.setMilliseconds(Math.random() * 2 * 60 * 1000);  // Jitter 2 minutes
			while (next.getTime() < now.getTime() + 5 * 60 * 1000)
				next.setTime(next.getTime() + 60 * 60 * 1000);
			await util.sleep(next.getTime() - now.getTime());
		}
	}
	
	
	async function updateWeatherOnce(): Promise<void> {
		if (eraseWeather != -1)
			clearTimeout(eraseWeather);
		eraseWeather = setTimeout(() => {
				util.getElem("clock-weather-description").textContent = "";
				util.getElem("clock-weather-temperature").textContent = "";
				eraseWeather = -1;
			}, 30000);
		
		for (let i = 0; i < 5; i++) {
			try {
				await tryUpdateWeather();
				clearTimeout(eraseWeather);
				eraseWeather = -1;
				break;
			} catch (e) {
				await util.sleep(Math.pow(4, i + 1) * 1000);
			}
		}
	}
	
	
	async function tryUpdateWeather(): Promise<void> {
		if (util.configuration === null)
			throw "Configuration missing";
		const xhr = await util.doXhr("/proxy/" + encodeURIComponent(util.configuration["weather-canada-url"]), "document", 15000);
		if (xhr.status != 200)
			throw "Invalid status";
		let data = xhr.response;
		if (!(data instanceof Document))
			throw "Invalid type";
		
		function getText(selector: string): string {
			const node: Element|null = data.querySelector(selector);
			if (node === null)
				throw "Node missing";
			const text: string|null = node.textContent;
			if (text === null)
				throw "Text missing";
			return text;
		}
		
		util.getElem("clock-weather-description").textContent = getText("siteData > currentConditions > condition");
		const temperStr = getText("siteData > currentConditions > temperature");
		util.getElem("clock-weather-temperature").textContent = Math.round(parseFloat(temperStr)) + " " + DEGREE + "C";
	}
	
	
	const DEGREE = "\u00B0";
	
}



namespace util {
	
	export let configuration: any = null;
	
	
	export function doXhr(url: string, type: XMLHttpRequestResponseType, timeout: number): Promise<XMLHttpRequest> {
		return new Promise((resolve, reject) => {
			let xhr = new XMLHttpRequest();
			xhr.onload = () => resolve(xhr);
			xhr.ontimeout = () => reject("XHR timeout");
			xhr.onerror = () => reject("XHR error");
			xhr.open("GET", url, true);
			xhr.responseType = type;
			xhr.timeout = timeout;
			xhr.send();
		});
	}
	
	
	export function getElem(id: string): HTMLElement {
		const result = document.getElementById(id);
		if (result instanceof HTMLElement)
			return result;
		throw "Assertion error";
	}
	
	
	export function sleep(millis: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, millis));
	}
	
	
	async function initialize() {
		configuration = (await doXhr("config.json", "json", 60000)).response;
		weather.initialize();
	}
	
	
	initialize();
	
}
