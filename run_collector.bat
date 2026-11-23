@echo off
title Nexus Observe Collector Agent

if not exist .venv\Scripts\python.exe (
    echo [ERROR] Virtual environment not found.
    echo Please run setup.bat first to configure the collector.
    echo.
    pause
    exit /b 1
)

if not exist .env (
    echo [ERROR] Configuration file .env not found.
    echo Please run setup.bat first to set your Tenant ID, Collector ID, and Key.
    echo.
    pause
    exit /b 1
)

echo ============================================================
echo   NEXUS OBSERVE — Local Collector Agent
echo   Status: Active (Streaming privacy-safe telemetry)
echo   Press Ctrl+C to pause or stop.
echo ============================================================
echo.

.\.venv\Scripts\python.exe -m collector.collector %*

if %ERRORLEVEL% neq 0 (
    echo.
    echo Collector stopped with exit code %ERRORLEVEL%.
    pause
)
