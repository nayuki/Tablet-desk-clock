# For Python 2.x

import bottle, json, time, urllib2, xml.etree.ElementTree


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

AUTHORIZED_STATIC_FILES = ["clock.css", "clock.html", "clock.js", "swiss-721-bt-medium.ttf", "swiss-721-bt-normal.ttf"]
MIME_TYPES = {"html":"application/xhtml+xml", "ttf":"application/x-font-ttf"}


@bottle.route("/weather.json")
def weather():
	global weather_cache
	if weather_cache is None or time.time() > weather_cache[1]:
		url = "http://dd.weatheroffice.ec.gc.ca/citypage_weather/xml/ON/s0000458_e.xml"  # Environment Canada - Ontario - Toronto
		expiration = 20 * 60  # In seconds
		xmlstr = urllib2.urlopen(url=url, timeout=60).read()
		root = xml.etree.ElementTree.fromstring(xmlstr)
		result = {
			"condition"  : root.findtext("./currentConditions/condition"),
			"temperature": root.findtext("./currentConditions/temperature"),
		}
		weather_cache = (json.dumps(result), time.time() + expiration)
	bottle.response.content_type = "application/json"
	return weather_cache[0]

weather_cache = None


if __name__ == "__main__":
	bottle.run(host="localhost", port=51367, reloader=True)
