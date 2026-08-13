@echo off
chcp 65001 >nul
setlocal
title Hanzi Magic Battle V2.0.0 - Ink Forest Chapter One
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_HANZI_MAGIC_BATTLE_V2_CHAPTER_ONE.ps1" %*
set "exit_code=%ERRORLEVEL%"
if not "%exit_code%"=="0" pause
endlocal & exit /b %exit_code%
