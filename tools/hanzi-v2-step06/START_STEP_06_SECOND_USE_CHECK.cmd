@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_STEP_06_SECOND_USE_CHECK.ps1" %*
exit /b %ERRORLEVEL%
