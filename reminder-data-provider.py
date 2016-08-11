# 
# Morning reminder data provider for tablet desk clock
# 
# Copyright (c) 2016 Project Nayuki
# All rights reserved. Contact Nayuki for licensing.
# https://www.nayuki.io/page/tablet-desk-clock
# 
# This is a background program reads a text journal periodically. Whenever its contents change, the
# file is parsed and the relevant sections of data are sent to the tablet clock server. For Python 3+.
# 
# The configuration file has a format that looks like this (without leading spaces):
#   /home/user/journal.txt
#   http://localhost:51367/morning-reminders.json
# 
# The journal file has a format that looks like this (without leading spaces):
#   2016-01-01-Fri
#   miscellaneous text
#   * This is a morning reminder, starting with asterisk+space
#   2016-01-02-Sat
#   * Another reminder note
#   * More than one in a single day
#   - A piece of non-reminder text
# 

import sys
if sys.version_info[ : 3] < (3, 0, 0):
	raise RuntimeError("Requires Python 3+")
import datetime, json, os, re, time, urllib.request


def main():
	# Read configuration file
	config_file = "reminder-data-provider.ini"
	with open(config_file, "r", encoding="UTF-8", newline=None) as f:
		journal_path = f.readline().rstrip("\n")
		server_url = f.readline().rstrip("\n")
	
	# Poll the journal file periodically
	lastmod = None
	while True:
		if os.path.getmtime(journal_path) != lastmod:
			try:
				lastmod = os.path.getmtime(journal_path)
				run_once(journal_path, server_url)
			except:
				pass
		time.sleep(10 * 60)


def run_once(journal_path, server_url):
	with open(journal_path, "r", encoding="UTF-8", newline=None) as f:
		lines = f.read().split("\n")
	
	data = {}  # Will be populated with values like {"20150515":["Alpha","Beta","Gamma"], "20150516":["One","Two"]}
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
