@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
rem Prefer a complete portable Node distribution inside this project folder.
for /d %%D in ("%~dp0node-v24*-win-x64") do if exist "%%~fD\npm.cmd" set "PATH=%%~fD;%PATH%"
where npm.cmd >nul 2>nul
if errorlevel 1 (
 echo Complete Node.js 24 is required. A single node.exe is not sufficient.
 echo Extract node-v24.22.1-win-x64.zip and place its folder next to this file.
 echo See WINDOWS-PORTABLE.txt for instructions.
 pause
 exit /b 1
)
set "DESKTOP_DATA_DIR=%LOCALAPPDATA%\BaihuaIntelligence"
if not exist "%DESKTOP_DATA_DIR%" mkdir "%DESKTOP_DATA_DIR%"
if not exist node_modules (
 call npm.cmd ci
 if errorlevel 1 goto failed
)
call npm.cmd run db:migrate
if errorlevel 1 goto failed
echo Open http://localhost:3000/intelligence after Ready appears.
echo Keep this window open while using the application.
call npm.cmd run dev
if errorlevel 1 goto failed
pause
exit /b
:failed
echo Startup failed. Please send a screenshot of this window.
pause
exit /b 1
