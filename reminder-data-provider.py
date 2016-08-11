# 
# A background process that polls the journal every late night and sends relevant data to the clock server.
# Designed to run on my desktop PC. For Python 3+.
# 

import sys
if sys.version_info[ : 3] < (3, 0, 0):
	raise RuntimeError("Requires Python 3+")
import datetime, json, os, re, time, urllib.request


def main():
	file_path = "./reminder-data-provider.ini"
	with open(file_path, "r", encoding="UTF-8", newline=None) as f:
		journal_path = f.readline().rstrip("\n")
		server_url = f.readline().rstrip("\n")
	
	while True:
		# Sleep until the next 10:00 UTC
		now = datetime.datetime.utcnow()
		next = datetime.datetime(now.year, now.month, now.day, 10)
		if next < now:
			next += datetime.timedelta(days=1)
		time.sleep((next - now).total_seconds())
		
		try:
			run_once(journal_path, server_url)
		except:
			pass
		time.sleep(6 * 3600)  # Safety delay


def run_once(journal_path, server_url):
	with open(journal_path, "r", encoding="UTF-8", newline=None) as f:
		lines = f.read().split("\n")
	
	data = {}  # Looks like {"20150515":["Alpha","Beta","Gamma"], "20150516":["One","Two",]}
	today = datetime.date.today()
	datekey = None
	for line in lines:
		if DATE_REGEX.match(line) is not None:
			date = datetime.date(int(line[0:4]), int(line[5:7]), int(line[8:10]))
			if 0 <= (date - today).days <= 2:
				datekey = date.strftime("%Y%m%d")
				data[datekey] = []
			else:
				datekey = None
		elif datekey is not None and line.startswith("* "):
			data[datekey].append(line[2 : ])
	
	# HTTP POST request
	stream = urllib.request.urlopen(server_url, data=json.dumps(data).encode("UTF-8"))
	stream.read()  # Discard
	stream.close()


DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}-[A-Z][a-z]{2}$")


if __name__ == "__main__":
	main()
