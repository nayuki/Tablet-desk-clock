title Clock app server
:loop
python clock-server.py
python -c "import time; time.sleep(2)"
if %ERRORLEVEL% equ 0 goto loop
