# For Python 2.x

import bottle


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


if __name__ == "__main__":
	bottle.run(host="localhost", port=51367, reloader=True)
