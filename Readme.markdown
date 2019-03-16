Tablet desk clock
=================

This project is a fancy full-screen clock that runs in a web browser. A Python web server (usually run locally on the same device) provides the other part of the functionality.

The web part of the software can run in {Firefox, Chrome, Safari, but not Internet Explorer} on {Windows, Linux, macOS, Android, iOS}. The server part requires a platform that supports Python, such as Windows x86/x64 (not WinRT), Linux, or macOS.

Note: Viewing the static HTML file on disk will show the basic clock but not support functionality such as wallpaper randomization and network I/O. It is necessary to run the Python server to get all the features.


## Instructions

0. Ensure your system has Python 3+ installed.
0. Open a command line and run: `python clock-server.py`
0. Open a web browser and visit: http://localhost:51367/

---

Home page: https://www.nayuki.io/page/tablet-desk-clock  
Copyright © 2019 Project Nayuki. All rights reserved. No warranty.
