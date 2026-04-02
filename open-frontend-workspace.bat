@echo off
setlocal
cd /d "%~dp0"
if not exist "exports\workspaces\frontend" (
  echo Frontend workspace not found. Running split first...
  call npm run split:workspaces
  if errorlevel 1 exit /b 1
)
start "" "%~dp0exports\workspaces\frontend"
endlocal
