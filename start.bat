@echo off
title Finance Web Server (Real-time database.json)
cd /d "%~dp0"
echo =======================================================
echo   Finance Money Manager - Mahalliy Baza Serveri
echo =======================================================
echo.
echo Server ishga tushirilmoqda (Python)...
python local_server.py
if %errorlevel% neq 0 (
    py local_server.py
)
pause
