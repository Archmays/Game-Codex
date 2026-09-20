@echo off
setlocal
cd /d "%~dp0"
call "%~dp0tools\my-game-world\START_MY_GAME_WORLD.cmd" %*
if errorlevel 1 (
  echo The local game hub could not start. See the message above.
  pause
  exit /b 1
)
endlocal
