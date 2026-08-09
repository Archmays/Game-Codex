@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_STEP_02_REVIEW.ps1" %*
set "exit_code=%ERRORLEVEL%"
endlocal & exit /b %exit_code%
