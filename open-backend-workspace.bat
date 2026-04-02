@echo off
setlocal
cd /d "%~dp0"
if not exist "exports\workspaces\backend" (
  echo Backend workspace not found. Running split first...
  call npm run split:workspaces
  if errorlevel 1 exit /b 1
)
start "" "%~dp0exports\workspaces\backend"
endlocal
