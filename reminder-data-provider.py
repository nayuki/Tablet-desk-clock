# 
# A background process that polls the journal every late night and sends relevant data to the clock server.
# Designed to run on my desktop PC. For Python 2.7.
# 

import datetime, json, re, time, urllib2


journal_path = None
server_url = None


def main():
	global journal_path, server_url
	with open("./reminder-data-provider.ini", "r") as f:
		journal_path = f.readline().rstrip("\r\n").decode("UTF-8")
		server_url = f.readline().rstrip("\r\n").decode("UTF-8")
	
	while True:
		# Sleep until the next 10:00 UTC
		now = datetime.datetime.utcnow()
		next = datetime.datetime(now.year, now.month, now.day, 10)
		if next < now:
			next += datetime.timedelta(days=1)
		time.sleep((next - now).total_seconds())
		
		try:
			run_once()
		except:
			pass
		time.sleep(6 * 3600)  # Safety delay


def run_once():
	with open(journal_path, "r") as f:
		text = f.read().decode("UTF-8")
	
	data = {}  # Looks like {"20150515":["Alpha","Beta","Gamma"], "20150516":["One","Two",]}
	today = datetime.date.today()
	datekey = None
	for line in text.split("\n"):
		if DATE_REGEX.match(line) is not None:
			date = datetime.date(int(line[0:4]), int(line[5:7]), int(line[8:10]))
			if 0 <= (date - today).days <= 2:
				datekey = date.strftime("%Y%m%d")
				data[datekey] = []
			else:
				lastdate = None
		elif datekey is not None and line.startswith("* "):
			data[datekey].append(line[2 : ])
	
	stream = urllib2.urlopen(server_url, data=json.dumps(data))  # HTTP POST request
	stream.read()  # Discard
	stream.close()


DATE_REGEX = re.compile(r"^\d{4}-\d{2}-\d{2}-[A-Z][a-z]{2}$")


if __name__ == "__main__":
	main()
