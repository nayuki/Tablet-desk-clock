# 
# Tablet desk clock web server
# 
# Copyright (c) Project Nayuki
# All rights reserved. Contact Nayuki for licensing.
# https://www.nayuki.io/page/tablet-desk-clock
# 


# ---- Prelude ----

import bottle, main

if __name__ == "__main__":
	raise AssertionError()



# ---- Time ----

import contextlib, socket, struct, time

@bottle.route("/time/<protocol>/<host>/<port:int>")
def get_time(protocol, host, port):
	if protocol != "ntp":
		raise ValueError()
	
	with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_DGRAM)) as sock:
		sock.bind(("0.0.0.0", 0))
		sock.settimeout(1.0)
		target = socket.getaddrinfo(host, port)[0][4]
		
		localstart = time.time()
		sock.sendto(bytes([0x1B] + [0] * 47), target)
		packet = sock.recv(100)
		localend = time.time()
		
		fields = struct.unpack(">BBBBIIIQQQQ", packet)
		header = fields[0]
		leap = header >> 6
		version = (header >> 3) & 7
		mode = header & 7
		if leap == 3 or version != 3 or mode != 4:
			raise ValueError("Response contains invalid data")
		remotereceive = fields[9]
		remotetransmit = fields[10]
		networkdelay = ((localend - localstart) - (remotetransmit - remotereceive)) / 2.0
		rawresult = remotetransmit + networkdelay
		result = rawresult * 1000 // 2**32 - 2208988800000  # Convert to Unix milliseconds
		return main.json_response(result)




# ---- Wallpaper ----

import contextlib, datetime, os, random, sqlite3

# Yields a file name or null, which a wallpaper that changes only once a day (history kept on the server side).
@bottle.route("/wallpaper-daily.json")
def wallpaper_daily():
	candidates = set(wallpaper_candidates())
	if len(candidates) == 0:
		return main.json_response(None)
	
	with contextlib.closing(sqlite3.connect("wallpaper-history.sqlite")) as con:
		# Ensure there is a table
		cur = con.cursor()
		cur.execute(
"""CREATE TABLE IF NOT EXISTS wallpaper_history(
	date VARCHAR NOT NULL PRIMARY KEY,
	filename VARCHAR NOT NULL
)""")
		con.commit()
		
		# See if there's already an entry for today
		today = datetime.date.today().strftime("%Y%m%d")
		cur.execute("SELECT filename FROM wallpaper_history WHERE date=?", (today,))
		data = cur.fetchone()
		if data is not None:
			return main.json_response(data[0])
		
		# Get all known history of wallpapers
		cur.execute("SELECT date, filename FROM wallpaper_history ORDER BY date DESC")
		history = cur.fetchall()
		
		# Remove recently used wallpapers from candidates
		maxremove = min(round(len(candidates) * 0.67), max(len(candidates) - 3, 0))
		candidates.difference_update(row[1] for row in history[ : maxremove])
		
		# Purge old history of wallpapers to save space
		maxhistory = 1000
		if len(history) > maxhistory:
			cur.execute("DELETE FROM wallpaper_history WHERE date <= ?", (history[maxhistory][0],))
		
		# Choose today's wallpaper and save it
		result = random.choice(list(candidates))
		cur.execute("INSERT INTO wallpaper_history VALUES(?, ?)", (today, result))
		con.commit()
		return main.json_response(result)


def wallpaper_candidates():
	dir = os.path.join(main.WEB_ROOT_DIR, "wallpaper")
	if not os.path.isdir(dir):
		return []
	return [name for name in os.listdir(dir) if
		os.path.isfile(os.path.join(dir, name)) and name.endswith((".jpg", ".png"))]



# ---- Network ----

import socket

@bottle.route("/tcping/<host>/<port:int>")
def tcping(host, port):
	try:
		sock = socket.create_connection((host, port), timeout=1.0)
		sock.close()
		return main.json_response(True)
	except:
		return main.json_response(False)
