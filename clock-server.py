# 
# Clock app web server
# Run server with no arguments. For Python 2 and 3.
# Client shall visit http://localhost:51367/
# 


# ---- Prelude ----

import bottle, datetime, json, sys, time, xml.etree.ElementTree
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
	else:
		bottle.abort(404)

AUTHORIZED_STATIC_FILES = ["clock.css", "clock.html", "clock.js", "swiss-721-bt-bold.ttf", "swiss-721-bt-bold-round.ttf", "swiss-721-bt-light.ttf", "swiss-721-bt-medium.ttf", "swiss-721-bt-normal.ttf", "swiss-721-bt-thin.ttf"]
MIME_TYPES = {"html":"application/xhtml+xml", "ttf":"application/x-font-ttf"}


# ---- Weather module ----

@bottle.route("/weather.json")
def weather():
	global weather_cache
	if weather_cache is None or time.time() > weather_cache[1]:
		# Data provided by Environment Canada. Documentation:
		# - http://dd.meteo.gc.ca/about_dd_apropos.txt
		# - http://dd.weather.gc.ca/citypage_weather/docs/README_citypage_weather.txt
		url = "http://dd.weatheroffice.ec.gc.ca/citypage_weather/xml/ON/s0000458_e.xml"  # Toronto, Ontario
		xmlstr = (urllib.request if python_version == 3 else urllib2).urlopen(url=url, timeout=60).read()
		root = xml.etree.ElementTree.fromstring(xmlstr)
		sunrise = "?"
		sunset = "?"
		for elem in root.findall("./riseSet/dateTime"):
			if elem.get("zone") != "UTC":
				s = elem.findtext("./hour") + ":" + elem.findtext("./minute")
				if elem.get("name") == "sunrise":
					sunrise = s
				elif elem.get("name") == "sunset":
					sunset = s
		result = {
			"condition"  : root.findtext("./currentConditions/condition"),
			"temperature": root.findtext("./currentConditions/temperature"),
			"sunrise": sunrise,
			"sunset" : sunset,
		}
		weather_cache = (json.dumps(result), (time.time() + 3 * 60) // 3600 * 3600 - 3 * 60)  # Expires at 3 minutes past the hour
	bottle.response.content_type = "application/json"
	bottle.response.set_header("Cache-Control", "no-cache")
	return weather_cache[0]

weather_cache = None  # Either None or a tuple of (JSON string, expiration time)


# ---- Morning module ----

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
		for key in data:
			morning_reminders[key] = data[key]
		return "Success"

morning_reminders = {}


# ---- Server initialization ----

if __name__ == "__main__":
	bottle.run(host="0.0.0.0", port=51367, reloader=True)
