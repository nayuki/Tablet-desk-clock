/* 
 * Tablet desk clock
 * 
 * Copyright (c) Project Nayuki
 * All rights reserved. Contact Nayuki for licensing.
 * https://www.nayuki.io/page/tablet-desk-clock
 */

"use strict";


namespace util {
	
	export let configPromise: Promise<any> = doXhr("config.json", "json", 60000);
	
	
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
	
}



namespace clock {
	
	let prevUpdate: number = NaN;  // In Unix seconds
	
	
	function main(): void {
		const d = time.correctedDate();
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
		setTimeout(main, 1000 - time.correctedDate().getTime() % 1000);
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
	
	
	setTimeout(main, 0);
	
}



namespace time {
	
	let timeCorrection: number = 0;  // Milliseconds late
	
	
	export function correctedDate(): Date {
		return new Date(Date.now() + timeCorrection);
	}
	
	
	async function main(): Promise<void> {
		const server: Array<string> = (await util.configPromise).response["time-server"];
		let statusNoTimeSync = util.getElem("clock-status-no-time-sync");
		while (true) {
			try {
				const path: string = server.join("/");
				const remoteTime = (await util.doXhr("/time/" + path, "json", 3000)).response;
				if (typeof remoteTime != "number")
					throw "Invalid data";
				timeCorrection = remoteTime - Date.now();
				statusNoTimeSync.style.display = "none";
			} catch (e) {
				statusNoTimeSync.style.removeProperty("display");
			}
			
			await util.sleep(60 * 60 * 1000);  // Resynchronize every hour
		}
	}
	
	
	main();
	
}



namespace wallpaper {
	
	async function main(): Promise<void> {
		while (true) {
			try {
				const url = (await util.doXhr("/wallpaper-daily.json", "json", 10000)).response;
				if (typeof url != "string")
					throw "Invalid data";
				document.documentElement.style.backgroundImage =
					`url('wallpaper/${encodeURIComponent(url)}')`;
			} catch (e) {}
			
			// Schedule next update at 05:00 local time
			const now = time.correctedDate();
			let next = new Date(now.getTime());
			next.setHours(5);
			next.setMinutes(0);
			next.setSeconds(0);
			next.setMilliseconds(0);
			while (next.getTime() <= now.getTime())
				next.setDate(next.getDate() + 1);
			await util.sleep(next.getTime() - now.getTime());
		}
	}
	
	
	main();
	
}



namespace weather {
	
	let eraseWeather: number = -1;
	
	
	async function main(): Promise<void> {
		const url: string = (await util.configPromise).response["weather-canada-url"];
		while (true) {
			updateWeatherOnce(url);  // Do not wait for it
			
			// Schedule next update at 7~10 minutes past the hour
			const now = time.correctedDate();
			let next = new Date(now.getTime());
			next.setMinutes(7);
			next.setSeconds(0);
			next.setMilliseconds(Math.random() * 3 * 60 * 1000);  // Jitter 3 minutes
			while (next.getTime() < now.getTime() + 1 * 60 * 1000)
				next.setTime(next.getTime() + 60 * 60 * 1000);
			await util.sleep(next.getTime() - now.getTime());
		}
	}
	
	
	async function updateWeatherOnce(url: string): Promise<void> {
		if (eraseWeather != -1)
			clearTimeout(eraseWeather);
		eraseWeather = setTimeout(() => {
				util.getElem("clock-weather-description").textContent = "";
				util.getElem("clock-weather-temperature").textContent = "";
				eraseWeather = -1;
			}, 30000);
		
		for (let i = 0; i < 5; i++) {
			try {
				await tryUpdateWeather(url);
				clearTimeout(eraseWeather);
				eraseWeather = -1;
				break;
			} catch (e) {
				await util.sleep(Math.pow(4, i + 1) * 1000);
			}
		}
	}
	
	
	async function tryUpdateWeather(url: string): Promise<void> {
		const xhr = await util.doXhr("/proxy/" + encodeURIComponent(url), "document", 15000);
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
	
	main();
	
}



namespace network {
	
	async function main(): Promise<void> {
		const hosts = (await util.configPromise).response["network-http-test-hosts"];
		while (true) {
			updateInternetStatus(hosts);  // Do not wait for it
			await util.sleep(5 * 60 * 1000);
		}
	}
	
	
	async function updateInternetStatus(hosts: Array<string>): Promise<void> {
		let statusNoInternet = util.getElem("clock-status-no-internet");
		for (let i = 0; i < 3; i++) {
			let host = hosts[Math.floor(Math.random() * hosts.length)];
			let alive = (await util.doXhr(`/tcping/${host}/80`, "json", 10000)).response;
			if (typeof alive == "boolean" && alive) {
				statusNoInternet.style.display = "none";
				return;
			}
		}
		statusNoInternet.style.removeProperty("display");
	}
	
	
	main();
	
}
