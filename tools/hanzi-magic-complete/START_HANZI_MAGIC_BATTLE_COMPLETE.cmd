@echo off
chcp 65001 >nul
setlocal
title Hanzi Magic Battle V3.0.0 - Complete Ink Forest
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_HANZI_MAGIC_BATTLE_COMPLETE.ps1" %*
set "exit_code=%ERRORLEVEL%"
if not "%exit_code%"=="0" pause
endlocal & exit /b %exit_code%
