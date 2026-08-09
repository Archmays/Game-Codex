@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0FINISH_STEP_04_CHILD_FIRST_USE.ps1" %*
set "exit_code=%ERRORLEVEL%"
endlocal & exit /b %exit_code%
