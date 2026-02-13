$ErrorActionPreference = "Stop"

$sensitiveFilePatterns = @(
  "secrets/db_password.txt",
  "secrets/gemini_api_key.txt",
  "secrets/session_secret.txt",
  "ssl/fullchain.pem",
  "ssl/privkey.pem"
)

try {
  $objects = git rev-list --objects --all 2>$null
  if ($LASTEXITCODE -ne 0) {
    throw "git rev-list failed with exit code $LASTEXITCODE"
  }
} catch {
  Write-Host "[secrets-history] failed to inspect git history"
  Write-Host $_
  exit 1
}

$hits = @()
foreach ($pattern in $sensitiveFilePatterns) {
  if ($objects | Select-String -SimpleMatch $pattern -Quiet) {
    $hits += $pattern
  }
}

if ($hits.Count -gt 0) {
  Write-Host "[secrets-history] sensitive files detected in git history:"
  foreach ($hit in $hits) {
    Write-Host "  - $hit"
  }
  Write-Host ""
  Write-Host "Required remediation: rewrite history to remove secret-bearing files, rotate all exposed credentials, and force-push all refs."
  exit 1
}

Write-Output "[secrets-history] no known sensitive files found in git history"

