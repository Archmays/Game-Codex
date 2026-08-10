@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_STEP_07_REAL_SECOND_USE.ps1" %*
exit /b %ERRORLEVEL%
