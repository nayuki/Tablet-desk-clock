/* 
 * Tablet desk clock
 * 
 * Copyright (c) Project Nayuki
 * All rights reserved. Contact Nayuki for licensing.
 * https://www.nayuki.io/page/tablet-desk-clock
 */

"use strict";


namespace util {
	
	export let configPromise: Promise<XMLHttpRequest> = doXhr("config.json", "json", 60000);
	
	
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
		let imgElem = util.getElem("clock-status-no-time-sync");
		let consecutiveFailures: number = 0;
		while (true) {
			let sleepTime: number;
			try {  // Update the time correction
				const remoteTime = (await util.doXhr("/time/" + server.join("/"), "json", 3000)).response;
				if (typeof remoteTime != "number")
					throw "Invalid data";
				timeCorrection = remoteTime - Date.now();
				imgElem.style.display = "none";
				sleepTime = 60 * 60 * 1000;  // An hour
				consecutiveFailures = 0;
			} catch (e) {
				imgElem.style.removeProperty("display");
				// 10, 30, 100, 300, 1000, 3000 seconds
				sleepTime = Math.pow(10, (Math.min(consecutiveFailures, 5) + 8) / 2);
				consecutiveFailures++;
			}
			await util.sleep((0.9 + Math.random() * 0.2) * sleepTime);
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
	
	export let sunRiseSet: Array<number>|null = null;  // 4-tuple in UTC
	let eraseWeatherTimeout: number = -1;
	
	
	async function main(): Promise<void> {
		const url: string = (await util.configPromise).response["weather-canada-url"];
		while (true) {
			updateWeather(url);  // Don't wait
			
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
	
	
	async function updateWeather(url: string): Promise<void> {
		if (eraseWeatherTimeout != -1)
			clearTimeout(eraseWeatherTimeout);
		eraseWeatherTimeout = setTimeout(eraseWeather, 30000);
		
		for (let i = 0; i < 5; i++) {
			try {
				await tryUpdateWeather(url);
				clearTimeout(eraseWeatherTimeout);
				eraseWeatherTimeout = -1;
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
		util.getElem("clock-weather-temperature").textContent = Math.round(parseFloat(temperStr)).toString().replace(/-/, MINUS) + " " + DEGREE + "C";
		
		sunRiseSet = [
			"siteData > riseSet > dateTime[zone=UTC][name=sunrise] > hour"  ,
			"siteData > riseSet > dateTime[zone=UTC][name=sunrise] > minute",
			"siteData > riseSet > dateTime[zone=UTC][name=sunset ] > hour"  ,
			"siteData > riseSet > dateTime[zone=UTC][name=sunset ] > minute",
		].map(q => parseInt(getText(q), 10));
		daylight.update();
	}
	
	
	function eraseWeather(): void {
		util.getElem("clock-weather-description").textContent = "";
		util.getElem("clock-weather-temperature").textContent = "";
		eraseWeatherTimeout = -1;
	}
	
	
	const DEGREE = "\u00B0";
	const MINUS = "\u2212";
	
	main();
	
}



namespace daylight {
	
	let svg = document.getElementById("clock-daylight") as Element;
	
	
	async function main(): Promise<void> {
		while (true) {
			update();
			await util.sleep(60000);
		}
	}
	
	
	export function update(): void {
		// For the current whole day in the local time zone, calculate the key moments as linear UTC timestamps
		if (weather.sunRiseSet === null)
			return;
		const now = time.correctedDate();
		const dayStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 0).getTime();
		const dayEndTime   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
		let sunriseTime = Math.floor(dayStartTime / MILLIS_PER_DAY) * MILLIS_PER_DAY +
			weather.sunRiseSet[0] * MILLIS_PER_HOUR + weather.sunRiseSet[1] * MILLIS_PER_MINUTE;
		if (sunriseTime < dayStartTime)
			sunriseTime += MILLIS_PER_DAY;
		let sunsetTime = Math.floor(sunriseTime / MILLIS_PER_DAY) * MILLIS_PER_DAY +
			weather.sunRiseSet[2] * MILLIS_PER_HOUR + weather.sunRiseSet[3] * MILLIS_PER_MINUTE;
		if (sunsetTime < sunriseTime)
			sunsetTime += MILLIS_PER_DAY;
		
		const imgWidth = 10000;
		const imgHeight = 300;
		while (svg.firstChild !== null)
			svg.removeChild(svg.firstChild);
		(svg as HTMLElement).style.removeProperty("display");
		setAttr(svg, "viewBox", `0 ${-imgHeight / 2} ${imgWidth} ${imgHeight}`);
		
		// Draw day and night bars
		const scale = imgWidth / (dayEndTime - dayStartTime);  // Image units per millisecond
		{
			function addBar(start: number, end: number, final: boolean, clazz: string): void {
				const barHeight = 170;
				let path = addElem("path");
				let pathD = `M ${start} ${-barHeight / 2}`;
				pathD += ` H ${end}`;
				if (final)
					pathD += ` v ${barHeight}`;
				else {
					pathD += ` l 50 ${barHeight / 2}`;
					pathD += ` l -50 ${barHeight / 2}`;
				}
				pathD += ` H ${start}`;
				pathD += ` z`;
				setAttr(path, "d", pathD);
				setAttr(path, "class", "bar " + clazz);
			}
			
			const sunrise = (sunriseTime - dayStartTime) * scale;
			const sunset  = (sunsetTime  - dayStartTime) * scale;
			addBar(0, sunrise, false, "night");
			addBar(sunrise, sunset, false, "day");
			addBar(sunset, imgWidth, true, "night");
		}
		
		function getDaylightClass(time: number): string {
			return (sunriseTime <= time && time <= sunsetTime) ? "day" : "night";
		}
		
		// Draw hour tick marks
		for (let t = dayStartTime + MILLIS_PER_HOUR; t < dayEndTime; t += MILLIS_PER_HOUR) {
			const x = (t - dayStartTime) * scale;
			if (new Date(t).getHours() % 6 == 0) {
				const rectWidth = 70;
				const rectHeight = 135;
				const concavity = 40;
				let path = addElem("path");
				let pathD = `M ${x} 0`;
				pathD += ` m ${-rectWidth / 2} ${-rectHeight / 2}`;
				pathD += ` q ${concavity} ${rectHeight / 2} 0 ${rectHeight}`;
				pathD += ` h ${rectWidth}`;
				pathD += ` q ${-concavity} ${-rectHeight / 2} 0 ${-rectHeight}`;
				pathD += ` z`;
				setAttr(path, "d", pathD);
				setAttr(path, "class", "major-hour " + getDaylightClass(t));
			} else {
				const circRadius = 30;
				let circ = addElem("circle");
				setAttr(circ, "cx", x);
				setAttr(circ, "cy", 0);
				setAttr(circ, "r", circRadius);
				setAttr(circ, "class", "minor-hour " + getDaylightClass(t));
			}
		}
		
		// Draw current time arrow
		{
			const arrowWidth = 100;
			const arrowHeight = imgHeight;
			let path = addElem("path");
			let pathD = `M ${(now.getTime() - dayStartTime) * scale} 0`;
			pathD += ` m ${-arrowWidth / 2} ${-arrowHeight / 2}`;
			pathD += ` h ${arrowWidth}`;
			pathD += ` l ${-arrowWidth} ${arrowHeight}`;
			pathD += ` h ${arrowWidth}`;
			pathD += ` z`;
			setAttr(path, "d", pathD);
			setAttr(path, "class", "current-time " + getDaylightClass(now.getTime()));
		}
	}
	
	
	function addElem(tag: string): Element {
		return svg.appendChild(
			document.createElementNS(svg.namespaceURI, tag));
	}
	
	
	function setAttr(elem: Element, key: string, val: string|number): void {
		elem.setAttribute(key, val.toString());
	}
	
	
	const MILLIS_PER_MINUTE = 60 * 1000;
	const MILLIS_PER_HOUR = 60 * MILLIS_PER_MINUTE;
	const MILLIS_PER_DAY = 24 * MILLIS_PER_HOUR;
	
	
	main();
	
}



namespace network {
	
	async function main(): Promise<void> {
		const config = (await util.configPromise).response;
		while (true) {
			updateInternetStatus(config["network-http-test-hosts"]);  // Don't wait
			updateComputerStatuses(config["network-computer-tests"]);
			await util.sleep((4.5 + 1 * Math.random()) * 60 * 1000);  // Recheck about every 5 minutes
		}
	}
	
	
	async function updateInternetStatus(hosts: Array<string>): Promise<void> {
		let statusNoInternet = util.getElem("clock-status-no-internet");
		for (let i = 0; i < 3; i++) {
			let host = hosts[Math.floor(Math.random() * hosts.length)];
			try {
				let alive = (await util.doXhr(`/tcping/${host}/80`, "json", 10000)).response;
				if (typeof alive == "boolean" && alive) {
					statusNoInternet.style.display = "none";
					return;
				}
			} catch (e) {}
		}
		statusNoInternet.style.removeProperty("display");
	}
	
	
	function updateComputerStatuses(data: {[key:string]:Array<[string,number]>}): void {
		for (const [type, hosts] of Object.entries(data)) {
			hosts.forEach(([host, port], index) =>
				updateComputerStatus(type, index, host, port));  // Don't wait
		}
	}
	
	
	async function updateComputerStatus(type: string, index: number, host: string, port: number): Promise<void> {
		const id = `network-computer-${type}-${index}`;
		let img = document.getElementById(id) as (HTMLImageElement|null);
		if (img === null) {
			let container = document.getElementById("clock-status-box");
			if (container === null)
				throw "Assertion error";
			img = container.appendChild(document.createElement("img"));
			img.src = `icon/network-computer-${type}.svg`;
			img.id = id;
			img.style.display = "none";
		}
		
		// Ignore exceptions because the caller isn't waiting
		let alive = (await util.doXhr(`/tcping/${host}/${port}`, "json", 10000)).response;
		if (typeof alive == "boolean" && alive)
			img.style.removeProperty("display");
		else
			img.style.display = "none";
	}
	
	
	main();
	
}
