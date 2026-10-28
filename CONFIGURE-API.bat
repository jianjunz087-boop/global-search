@echo off
setlocal
cd /d "%~dp0"
for /d %%D in ("%~dp0node-v24*-win-x64") do if exist "%%~fD\node.exe" set "PATH=%%~fD;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
 echo Node runtime not found. Keep the complete portable Node folder next to this file.
 pause
 exit /b 1
)
node scripts\configure-env.cjs
if errorlevel 1 (
 pause
 exit /b 1
)
echo Put your own key after SERPAPI_API_KEY= in the editor.
echo Optional YANDEX_SERPAPI_KEY is a separate SerpAPI credential; leave empty to reuse the existing key.
echo Save. Close and restart START-WINDOWS.bat afterwards.
echo Do not send your key to anyone or commit .env.local to Git.
notepad "%~dp0.env.local"
