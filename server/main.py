# 
# Tablet desk clock web server
# 
# Copyright (c) 2019 Project Nayuki
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
import bottle, json, os, socketserver, threading, wsgiref.simple_server



# ---- Constants ----

WEB_ROOT_DIR = os.path.join("..", "web")

MEDIA_TYPES = {
	"html": "application/xhtml+xml",
	"svg" : "image/svg+xml",
	"ttf" : "application/x-font-ttf",
}



# ---- Static file serving ----

# Simple redirect for the root path.
@bottle.route("/")
def index():
	bottle.redirect("clock.html", 301)


authorized_static_files = set()  # Automatically populated with data
authorized_static_files_lock = threading.RLock()

# Serves all static files, such as HTML, CSS, JavaScript, images, fonts.
@bottle.route("/<path:path>")
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



# ---- Initialization ----

# Read config file and launch web server app
if __name__ == "__main__":
	with open("config.json", "rt", encoding="UTF-8") as fin:
		configuration = json.load(fin)
	class ThreadingWSGIServer(socketserver.ThreadingMixIn, wsgiref.simple_server.WSGIServer):
		daemon_threads = True
	server = wsgiref.simple_server.make_server(
		"0.0.0.0", configuration["web-server-port"], bottle.default_app(), ThreadingWSGIServer)
	server.serve_forever()
