@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Please install Node.js 24 LTS, then double-click this file again.
 pause
 exit /b 1
)
set "DESKTOP_DATA_DIR=%LOCALAPPDATA%\BaihuaIntelligence"
if not exist "%DESKTOP_DATA_DIR%" mkdir "%DESKTOP_DATA_DIR%"
if not exist node_modules (
 call npm ci
 if errorlevel 1 goto failed
)
call npm run db:migrate
if errorlevel 1 goto failed
echo Open your browser at http://localhost:3000/intelligence after Ready appears.
echo Keep this window open while using the application.
call npm run dev
if errorlevel 1 goto failed
pause
exit /b
:failed
echo Startup failed. Copy the error message and ask for help.
pause
exit /b 1
