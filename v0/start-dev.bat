@echo off
echo Starting RunSmart Development Server...
echo.

cd /d "%~dp0"

echo Installing dependencies...
npm install

echo.
echo Starting development server...
npm run dev

echo.
echo Server should be running at http://localhost:3000
echo Press Ctrl+C to stop the server
pause 