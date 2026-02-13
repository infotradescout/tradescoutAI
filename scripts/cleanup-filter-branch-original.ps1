$ErrorActionPreference = "Stop"

# Removes refs created by git filter-branch under refs/original/* so history scans
# (e.g. secrets-history audits) don't keep seeing pre-rewrite commits.

$refs = git for-each-ref --format="%(refname)" refs/original 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[cleanup] failed to list refs/original (git exit $LASTEXITCODE)"
  exit 1
}

if (-not $refs -or $refs.Count -eq 0) {
  Write-Host "[cleanup] no refs/original/* found"
  exit 0
}

foreach ($ref in $refs) {
  if ([string]::IsNullOrWhiteSpace($ref)) { continue }
  git update-ref -d $ref 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[cleanup] failed to delete $ref (git exit $LASTEXITCODE)"
    exit 1
  }
}

Write-Host ("[cleanup] deleted {0} refs under refs/original" -f $refs.Count)

