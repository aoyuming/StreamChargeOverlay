@echo off
setlocal

chcp 65001 >nul
title StreamCharge Local Server

cd /d "%~dp0"

echo ========================================
echo   StreamCharge Local Server
echo ========================================
echo.

if not exist "package.json" (
  echo This file must be placed in the StreamCharge project folder.
  echo package.json was not found.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Please install Node.js first.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Dependencies are not installed yet.
  echo Run this command first:
  echo.
  echo   npm.cmd install
  echo.
  pause
  exit /b 1
)

echo Server URLs after startup:
echo   Admin:   http://localhost:3000/admin.html
echo   Overlay: http://localhost:3000/overlay.html
echo   Display: http://localhost:3000/display.html
echo.
echo Log file:
echo   data\server.log
echo.
echo Starting server...
echo Press Ctrl+C to stop.
echo.

call npm.cmd run dev

echo.
echo Server stopped.
pause
