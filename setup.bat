@echo off
setlocal EnableDelayedExpansion

title Nexus Observe Collector Setup

echo ============================================================
echo   NEXUS OBSERVE — Local Collector Setup
echo   Privacy-First Observability
echo ============================================================
echo.

:: 1. Check for Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python was not found on your system.
    echo Please install Python 3.10 or higher from https://www.python.org/
    echo Make sure to check the box "Add python.exe to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [1/4] Checking Python environment...
python --version

:: 2. Create virtual environment if missing
if not exist .venv (
    echo [2/4] Creating virtual environment (.venv)...
    python -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
) else (
    echo [2/4] Virtual environment (.venv) already exists.
)

:: 3. Install requirements
echo [3/4] Installing required Python packages...
.\.venv\Scripts\python.exe -m pip install --quiet --upgrade pip
.\.venv\Scripts\python.exe -m pip install --quiet -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install packages from requirements.txt.
    pause
    exit /b 1
)
echo       Dependencies installed successfully.

:: 4. Prompt for configuration if .env does not exist or user wants to reconfigure
echo.
echo ============================================================
echo   Collector Configuration
echo   (Enter the values provided by your workspace administrator)
echo ============================================================

set "CONFIG_EXISTS=0"
if exist .env set "CONFIG_EXISTS=1"

if "%CONFIG_EXISTS%"=="1" (
    echo Existing .env configuration detected.
    set /p RECONF="Do you want to reconfigure your settings? (y/N): "
    if /i not "!RECONF!"=="y" (
        goto RUN_CHECK
    )
)

:PROMPT_CONFIG
echo.
set /p USER_TENANT="1. Enter Tenant ID (e.g. tenant_acme_demo): "
if "%USER_TENANT%"=="" (
    echo    Tenant ID cannot be empty.
    goto PROMPT_CONFIG
)

set /p USER_COLLECTOR="2. Enter Collector ID (e.g. col_laptop_01): "
if "%USER_COLLECTOR%"=="" (
    echo    Collector ID cannot be empty.
    goto PROMPT_CONFIG
)

:: Prompt for Collector Key securely using PowerShell without echoing to console
for /f "usebackq delims=" %%k in (`powershell -NoProfile -Command "$p = Read-Host -Prompt '3. Enter Collector Key (hidden)' -AsSecureString; $b = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($b)"`) do set "USER_KEY=%%k"
if "%USER_KEY%"=="" (
    echo    Collector Key cannot be empty.
    goto PROMPT_CONFIG
)

set /p USER_URL="4. Enter Ingest URL [Press Enter for default https://hackathon-2-09sm.onrender.com/v1/ingest]: "
if "%USER_URL%"=="" (
    set "USER_URL=https://hackathon-2-09sm.onrender.com/v1/ingest"
)

:: Write configuration to .env safely (never printing the key)
(
    echo # Nexus Observe Collector Configuration
    echo TENANT_ID=%USER_TENANT%
    echo COLLECTOR_ID=%USER_COLLECTOR%
    echo COLLECTOR_KEY=%USER_KEY%
    echo SAAS_INGEST_URL=%USER_URL%
    echo SOURCE_ROLE=employee_laptop
    echo SEND_INTERVAL_SECONDS=5
) > .env

echo.
echo [4/4] Configuration saved securely to .env

:RUN_CHECK
echo.
echo Running connection preflight test...
.\.venv\Scripts\python.exe -m collector.check
if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Preflight check did not succeed. Please check the error above.
    pause
    exit /b 1
)

echo.
echo Setup completed successfully!
echo To start streaming metrics, run: run_collector.bat
echo.
pause
