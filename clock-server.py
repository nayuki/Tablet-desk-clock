# 
# Tablet desk clock
# 
# Copyright (c) 2015 Project Nayuki
# All rights reserved. Contact Nayuki for licensing.
# http://www.nayuki.io/page/tablet-desk-clock
# 
# Run this web server script with no arguments. For Python 2 and 3.
# Open web browser and visit: http://localhost:51367/
# 


# ---- Prelude ----

import bottle, datetime, json, os, random, re, sqlite3, sys, time, xml.etree.ElementTree
if sys.version_info.major == 2:
    python_version = 2
    import urllib2
else:
	python_version = 3
	import urllib.request


# ---- Static file serving ----

@bottle.route("/")
def index():
	bottle.redirect("clock.html", 301)

@bottle.route("/<path:path>")
def static_file(path):
	if path in AUTHORIZED_STATIC_FILES:
		mime = "auto"
		for ext in MIME_TYPES:
			if path.endswith("." + ext):
				mime = MIME_TYPES[ext]
				break
		return bottle.static_file(path, root=".", mimetype=mime)
	# Wallpaper file names must be 1 to 80 characters of {A-Z, a-z, 0-9, hyphen, underscore}, with a .png or .jpg lowercase extension
	elif re.match(r"wallpapers/[A-Za-z0-9_-]{1,80}\.(jpg|png)", path) is not None:
		return bottle.static_file(path, root=".")
	else:
		bottle.abort(404)

AUTHORIZED_STATIC_FILES = [
	"clock.css", "clock.html", "clock.js",
	"gear-icon.svg", "picture-icon.svg", "reload-icon.svg", "weather-icon.svg",
	"swiss-721-bt-bold.ttf", "swiss-721-bt-bold-round.ttf", "swiss-721-bt-light.ttf", "swiss-721-bt-medium.ttf", "swiss-721-bt-normal.ttf", "swiss-721-bt-thin.ttf",
]
MIME_TYPES = {"html":"application/xhtml+xml", "svg":"image/svg+xml", "ttf":"application/x-font-ttf"}


# ---- Clock module ----

# Yields the current Unix millisecond time as a number, e.g.: 1433185355946
@bottle.route("/time.json")
def gettime():
	bottle.response.content_type = "application/json"
	bottle.response.set_header("Cache-Control", "no-cache")
	return str(round(time.time() * 1000))


# Yields {a random file name in the wallpapers directory} as a string or null if unavailable, e.g.: "sample2.png"
@bottle.route("/random-wallpaper.json")
def random_wallpaper():
	bottle.response.content_type = "application/json"
	bottle.response.set_header("Cache-Control", "no-cache")
	candidates = get_wallpaper_candidates()
	if len(candidates) == 0:
		return "null"
	else:
		return '"' + random.choice(candidates) + '"'


# Yields a file name or null, a wallpaper that changes only once a day (history kept on the server side).
@bottle.route("/get-wallpaper.json")
def get_wallpaper():
	bottle.response.content_type = "application/json"
	bottle.response.set_header("Cache-Control", "no-cache")
	candidates = set(get_wallpaper_candidates())
	if len(candidates) == 0:
		return "null"
	
	try:
		con = sqlite3.connect("wallpaper-history.sqlite")
		cur = con.cursor()
		cur.execute("CREATE TABLE IF NOT EXISTS wallpaper_history(date VARCHAR NOT NULL, filename VARCHAR NOT NULL)")
		con.commit()
		
		today = datetime.date.today().strftime("%Y%m%d")
		cur.execute("SELECT filename FROM wallpaper_history WHERE date=?", (today,))
		data = cur.fetchone()
		if data is not None:
			return '"' + data[0] + '"'
		
		cur.execute("SELECT date, filename FROM wallpaper_history ORDER BY date DESC")
		history = cur.fetchall()
		maxremove = min(round(len(candidates) * 0.67), len(candidates) - 3)
		for row in history[ : maxremove]:
			candidates.discard(row[1])
		maxhistory = 300
		if len(history) > maxhistory:
			cur.execute("DELETE FROM wallpaper_history WHERE date <= ?", (history[maxhistory][0],))
		result = random.choice(list(candidates))
		cur.execute("INSERT INTO wallpaper_history VALUES(?, ?)", (today, result))
		con.commit()
		return '"' + result + '"'
		
	finally:
		cur.close()
		con.close()


def get_wallpaper_candidates():
	dir = "wallpapers"
	if not os.path.isdir(dir):
		return []
	cond = lambda name: os.path.isfile(os.path.join(dir, name)) and name.endswith((".jpg", ".png"))
	items = filter(cond, os.listdir(dir))
	if python_version == 3:
		items = list(items)
	return items


# ---- Weather module ----

# Yields an object containing weather and sunrise data, e.g.:
# {"condition":"Mostly Cloudy", "temperature":"-2.5", "sunrise":"07:30", "sunset":"18:42"}
@bottle.route("/weather.json")
def weather():
	global weather_cache
	if weather_cache is None or time.time() > weather_cache[1]:
		# Data provided by Environment Canada. Documentation:
		# - http://dd.meteo.gc.ca/about_dd_apropos.txt
		# - http://dd.weather.gc.ca/citypage_weather/docs/README_citypage_weather.txt
		url = "http://dd.weatheroffice.ec.gc.ca/citypage_weather/xml/ON/s0000458_e.xml"  # Toronto, Ontario
		stream = (urllib.request if python_version == 3 else urllib2).urlopen(url=url, timeout=60)
		xmlstr = stream.read()
		stream.close()
		
		# Parse data and build result
		root = xml.etree.ElementTree.fromstring(xmlstr)
		result = {
			"condition"  : root.findtext("./currentConditions/condition"),
			"temperature": root.findtext("./currentConditions/temperature"),
		}
		for elem in root.findall("./riseSet/dateTime"):
			if elem.get("zone") != "UTC":
				s = elem.findtext("./hour") + ":" + elem.findtext("./minute")
				name = elem.get("name")
				if name in ("sunrise", "sunset"):
					result[name] = s
		
		# Expiration and caching
		now = time.time()
		expire = ((now - 3*60) // 3600 + 1) * 3600 + 3*60  # 3 minutes past the next hour
		expire = min(now + 20 * 60, expire)  # Or 20 minutes, whichever is earlier
		weather_cache = (json.dumps(result), expire)
	bottle.response.content_type = "application/json"
	bottle.response.set_header("Cache-Control", "no-cache")
	return weather_cache[0]

weather_cache = None  # Either None or a tuple of (JSON string, expiration time)


# ---- Morning module ----

# Stores or yields an object containing morning reminders, e.g.:
# {"20150531": ["Hello world", "Entry two"], "20150601": []}
@bottle.route("/morning-reminders.json", method=("GET","POST"))
def morning_reminders():
	if bottle.request.method == "GET":
		today = datetime.date.today()
		todelete = []
		for key in morning_reminders:
			d = datetime.date(int(key[0:4]), int(key[4:6]), int(key[6:8]))
			if not (0 <= (d - today).days <= 1):
				todelete.append(key)
		for key in todelete:
			del morning_reminders[key]
		bottle.response.content_type = "application/json"
		bottle.response.set_header("Cache-Control", "no-cache")
		return json.dumps(morning_reminders)
	elif bottle.request.method == "POST":
		data = bottle.request.body.read()
		if python_version == 3:
			data = data.decode("UTF-8")
		data = json.loads(data)
		morning_reminders.update(data)
		return "Success"

morning_reminders = {}


# ---- Server initialization ----

if __name__ == "__main__":
	bottle.run(host="0.0.0.0", port=51367, reloader=True)
