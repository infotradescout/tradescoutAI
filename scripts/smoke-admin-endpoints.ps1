param(
  [string]$BaseUrl = "https://www.thetradescout.com"
)

$ErrorActionPreference = "Stop"

function Invoke-SmokeRequest {
  param(
    [string]$Method,
    [string]$Url,
    [int[]]$ExpectedStatus
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -Method $Method -MaximumRedirection 0
    $status = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode.value__
    } else {
      Write-Output "[FAIL] $Method $Url -> transport error: $($_.Exception.Message)"
      return $false
    }
  }

  if ($ExpectedStatus -contains $status) {
    Write-Output "[PASS] $Method $Url -> $status"
    return $true
  }

  Write-Output "[FAIL] $Method $Url -> $status (expected: $($ExpectedStatus -join ', '))"
  return $false
}

$checks = @(
  @{ Method = "GET"; Path = "/api/scout/health"; Expected = @(200) },
  @{ Method = "GET"; Path = "/api/admin/authority/decision-card-metrics"; Expected = @(401, 403) },
  @{ Method = "GET"; Path = "/api/admin/prompt-admin"; Expected = @(401, 403) },
  @{ Method = "GET"; Path = "/api/prompt-admin"; Expected = @(401, 403) },
  @{ Method = "POST"; Path = "/api/admin/user-controls/verify/00000000-0000-0000-0000-000000000000"; Expected = @(401, 403) }
)

$passed = 0
$failed = 0

Write-Output "Running admin smoke checks against $BaseUrl"
Write-Output "----------------------------------------"

foreach ($check in $checks) {
  $url = "$BaseUrl$($check.Path)"
  $ok = Invoke-SmokeRequest -Method $check.Method -Url $url -ExpectedStatus $check.Expected
  if ($ok) { $passed++ } else { $failed++ }
}

Write-Output "----------------------------------------"
Write-Output "Smoke summary: $passed passed, $failed failed"

if ($failed -gt 0) {
  exit 1
}

exit 0
