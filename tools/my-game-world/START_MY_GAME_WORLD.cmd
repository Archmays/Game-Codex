@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_MY_GAME_WORLD.ps1" %*
set "exit_code=%ERRORLEVEL%"
endlocal & exit /b %exit_code%
