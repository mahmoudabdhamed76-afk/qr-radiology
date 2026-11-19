@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 22 or newer is required: https://nodejs.org & pause & exit /b 1)
for /f "tokens=1 delims=." %%v in ('node -v') do set NV=%%v
set NV=%NV:v=%
if %NV% LSS 22 (echo Node.js 22 or newer is required - you have %NV% & pause & exit /b 1)
chcp 65001 >nul
start "" /b cmd /c "timeout /t 3 >nul & start http://localhost:3450/"
node server.js
pause
