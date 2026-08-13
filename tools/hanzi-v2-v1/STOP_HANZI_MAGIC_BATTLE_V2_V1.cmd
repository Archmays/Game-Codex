@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0STOP_HANZI_MAGIC_BATTLE_V2_V1.ps1" %*
set "exit_code=%ERRORLEVEL%"
endlocal & exit /b %exit_code%
