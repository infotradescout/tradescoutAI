 $ErrorActionPreference = "Stop"

 function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
 }

 function Invoke-Health($url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
    return $r.StatusCode
  } catch {
    return -1
  }
 }

 Write-Step "Environment checks"
 node -v
 npm -v

 Write-Step "Install dependencies (deterministic)"
 npm ci

 Write-Step "Build"
 npm run build

 Write-Step "UI contract gate (fails if non-allowlisted root violations exist)"
 npm run audit:ui:enforce

 Write-Step "Start built server"
 $serverOut = "server_run.stdout.log"
 $serverErr = "server_run.stderr.log"

 # Start server in background
 $proc = Start-Process -FilePath "node" -ArgumentList "dist/index.js" -NoNewWindow -PassThru `
  -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr

 # Wait for health
 $healthOk = $false
 for ($i=0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  $code = Invoke-Health "http://localhost:5000/health"
  if ($code -eq 200) { $healthOk = $true; break }
 }

 if (-not $healthOk) {
  Write-Host "❌ /health did not return 200" -ForegroundColor Red
  Write-Host "STDERR (last 200 lines):" -ForegroundColor Yellow
  if (Test-Path $serverErr) { Get-Content $serverErr -Tail 200 }
  try { Stop-Process -Id $proc.Id -Force } catch {}
  exit 1
 }

 Write-Step "Probe /health and /api/scout/health"
 $h1 = Invoke-Health "http://localhost:5000/health"
 $h2 = Invoke-Health "http://localhost:5000/api/scout/health"
 Write-Host "/health => $h1"
 Write-Host "/api/scout/health => $h2"

 if ($h1 -ne 200 -or $h2 -ne 200) {
  Write-Host "❌ Health probes failed" -ForegroundColor Red
  Write-Host "STDERR (last 200 lines):" -ForegroundColor Yellow
  if (Test-Path $serverErr) { Get-Content $serverErr -Tail 200 }
  try { Stop-Process -Id $proc.Id -Force } catch {}
  exit 1
 }

 Write-Step "Stop server"
 try { Stop-Process -Id $proc.Id -Force } catch {}

 Write-Step "Docker check (optional)"
 $dockerOk = $true
 try {
  docker --version | Out-Null
 } catch {
  $dockerOk = $false
 }

 if ($dockerOk) {
  Write-Host "Docker detected; running docker compose up --build (Ctrl+C to stop when healthy)." -ForegroundColor Green
  docker compose up --build
 } else {
  Write-Host "Docker not available; skipping docker/nginx checks." -ForegroundColor Yellow
 }

 Write-Host ""
 Write-Host "✅ Go/No-Go PASSED (build + UI contract + health probes)" -ForegroundColor Green
