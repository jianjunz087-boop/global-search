@echo off
setlocal
cd /d "%~dp0"
if not exist ".env.local" type nul > ".env.local"
findstr /R /C:"^SERPAPI_API_KEY=" ".env.local" >nul 2>nul
if errorlevel 1 (
 echo.>> ".env.local"
 echo SERPAPI_API_KEY=>> ".env.local"
)
echo Put your own API key after SERPAPI_API_KEY= in the editor.
echo Save the file. Close and restart START-WINDOWS.bat afterwards.
echo Do not send your key to anyone or commit .env.local to Git.
notepad "%~dp0.env.local"
