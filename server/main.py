# 
# Tablet desk clock web server
# 
# Copyright (c) Project Nayuki
# All rights reserved. Contact Nayuki for licensing.
# https://www.nayuki.io/page/tablet-desk-clock
# 
# Run this web server script with no arguments. For Python 3+.
# Open web browser and visit: http://localhost:51367/
# 


# ---- Prelude ----

import sys
if sys.version_info[ : 3] < (3, 0, 0):
	raise RuntimeError("Requires Python 3+")
import bottle, json, modules, os, socketserver, threading, urllib.error, urllib.request, wsgiref.simple_server



# ---- Constants ----

CONFIG_FILE = os.path.join("config.json")

WEB_ROOT_DIR = os.path.join("..", "web")

MEDIA_TYPES = {
	"html": "application/xhtml+xml",
	"svg" : "image/svg+xml",
	"ttf" : "application/x-font-ttf",
}



# ---- Special routes ----

# Simple redirect for the root path.
@bottle.route("/")
def index():
	bottle.redirect("/file/clock.html", 301)


# Special static file.
@bottle.route("/file/config.json")
def config_json():
	bottle.response.content_type = "application/json"
	return open(CONFIG_FILE, "rb")


# For bypassing CORS.
@bottle.route("/proxy/<path:path>")
def proxy(path):
	try:
		with urllib.request.urlopen(path, timeout=30) as fin:
			data = fin.read()
			temp = [val for (key, val) in fin.getheaders() if key == "Content-Type"]
			if len(temp) == 1:
				bottle.response.content_type = temp[0]
			return data
	except urllib.error.URLError:
		bottle.abort(500)



# ---- Static files ----

authorized_static_files = set()  # Automatically populated with data
authorized_static_files_lock = threading.RLock()

# Serves all static files, such as HTML, CSS, JavaScript, images, fonts.
@bottle.route("/file/<path:path>")
def static_file(path):
	
	# Recursively scans the given local file/directory, and populates the set 'authorized_static_files'.
	def scan_files(fspath, webpath):
		if os.path.isfile(fspath):
			authorized_static_files.add(webpath)
		elif os.path.isdir(fspath):
			if webpath != "":
				webpath += "/"
			for name in os.listdir(fspath):
				scan_files(os.path.join(fspath, name), webpath + name)
	
	with authorized_static_files_lock:
		if path not in authorized_static_files:
			authorized_static_files.clear()
			scan_files(WEB_ROOT_DIR, "")
		found = path in authorized_static_files
	
	if found:
		mime = "auto"
		for (ext, type) in MEDIA_TYPES.items():
			if path.endswith("." + ext):
				mime = type
		return bottle.static_file(path, root=WEB_ROOT_DIR, mimetype=mime)
	else:
		bottle.abort(404)



# ---- Utilities ----

def json_response(data):
	bottle.response.content_type = "application/json"
	bottle.response.set_header("Cache-Control", "no-cache")
	return json.dumps(data)



# ---- Initialization ----

# Read config file and launch web server app
if __name__ == "__main__":
	with open(CONFIG_FILE, "rt", encoding="UTF-8") as fin:
		configuration = json.load(fin)
	class ThreadingWSGIServer(socketserver.ThreadingMixIn, wsgiref.simple_server.WSGIServer):
		daemon_threads = True
	server = wsgiref.simple_server.make_server(
		"0.0.0.0", configuration["web-server-port"], bottle.default_app(), ThreadingWSGIServer)
	server.serve_forever()
