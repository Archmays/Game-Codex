@echo off
setlocal
title STEP 05 Parent Review
echo [STEP 05] Checking identity and opening the local review. Please wait...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0START_STEP_05_REVIEW.ps1" %*
set "exit_code=%ERRORLEVEL%"
if not "%exit_code%"=="0" (
  echo.
  echo [STEP 05] START failed. Keep this window open and share the error shown above.
  pause
)
endlocal & exit /b %exit_code%
