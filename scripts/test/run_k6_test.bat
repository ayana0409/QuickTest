@echo off
setlocal

:: Determine current directory
set "SCRIPT_DIR=%~dp0"
set "K6_EXE="

:: 1. Check in current directory (scripts\test\k6.exe)
if exist "%SCRIPT_DIR%k6.exe" (
    set "K6_EXE=%SCRIPT_DIR%k6.exe"
) else if exist "%SCRIPT_DIR%..\k6.exe" (
    set "K6_EXE=%SCRIPT_DIR%..\k6.exe"
) else if exist "%SCRIPT_DIR%..\..\k6.exe" (
    set "K6_EXE=%SCRIPT_DIR%..\..\k6.exe"
) else (
    where k6 >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "K6_EXE=k6"
    )
)

if "%K6_EXE%"=="" (
    echo [!] k6.exe was not found in %SCRIPT_DIR%, parent folders, or system PATH.
    echo Please copy k6.exe into this folder: %SCRIPT_DIR%
    echo Or install k6 via: winget install k6 --source winget
    pause
    exit /b 1
)

echo ==========================================================
echo  QuickTest Dynamic k6 Load Test Runner
echo  Using binary: %K6_EXE%
echo  Script      : %SCRIPT_DIR%k6_load_test.js
echo ==========================================================

:: Default 20 VUs for 30s, or pass arguments from command line
if "%~1"=="" (
    echo Running with default: 20 VUs for 30s (Auto-Discovery / Auto-Provisioning)
    echo (You can pass arguments, e.g: run_k6_test.bat --vus 50 --duration 1m -e ACCESS_CODE=EXAM01)
    "%K6_EXE%" run --vus 20 --duration 30s "%SCRIPT_DIR%k6_load_test.js"
) else (
    "%K6_EXE%" run %* "%SCRIPT_DIR%k6_load_test.js"
)

endlocal
