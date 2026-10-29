@echo off
rem ============================================================
rem  BOSTON — PRINT STATION launcher (printer PC)
rem
rem  Run this INSTEAD of opening the browser on the PC that is
rem  wired to the receipt printer.
rem
rem  It starts Chrome/Edge with --kiosk-printing, which makes
rem  window.print() send the job straight to the Windows DEFAULT
rem  printer with NO print dialog and NO clicking on this PC.
rem
rem  SETUP (once, on this PC):
rem    1. Windows Settings > Bluetooth ^& devices > Printers ^& scanners
rem       > set the RECEIPT PRINTER as the "Windows default printer".
rem    2. Log in to the hotel system in this window (keeps socket alive).
rem    3. Leave this window open. Use the taskbar icon to reopen it.
rem
rem  NOTE: if STATION_URL or PORT differs, edit line 13 below.
rem ============================================================
setlocal
set "STATION_URL=http://localhost:4000/print-station.html"

set "BROWSER=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "%BROWSER%" goto launch
set "BROWSER=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%BROWSER%" goto launch
set "BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if exist "%BROWSER%" goto launch
set "BROWSER=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if exist "%BROWSER%" goto launch
set "BROWSER=C:\Program Files\Microsoft\Edge\Application\msedge.exe"
if exist "%BROWSER%" goto launch

echo.
echo   Google Chrome / Microsoft Edge not found on this PC.
echo   Install Google Chrome, then run this file again.
echo.
pause
exit /b 1

:launch
start "" "%BROWSER%" --kiosk-printing --new-window --app=%STATION_URL%
endlocal
