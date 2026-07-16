@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-env.ps1"
if errorlevel 1 (
  echo Setup failed.
  pause
  exit /b 1
)
pause
endlocal
