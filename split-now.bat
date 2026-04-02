@echo off
setlocal
cd /d "%~dp0"
echo Splitting project into frontend and backend folders...
call npm run split:workspaces
if errorlevel 1 (
  echo.
  echo Split failed. Check the error above.
  exit /b 1
)
echo.
echo Done.
echo Frontend: exports\workspaces\frontend
echo Backend:  exports\workspaces\backend
endlocal
