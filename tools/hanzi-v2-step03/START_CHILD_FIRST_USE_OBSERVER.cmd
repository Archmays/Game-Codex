@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_CHILD_FIRST_USE_OBSERVER.ps1" %*
set "exit_code=%ERRORLEVEL%"
endlocal & exit /b %exit_code%
