<#
  TradeScout Production Validation (PowerShell 5-friendly)

  Usage example:
    .\validate-production.ps1 -BaseUrl "https://tradescout.ai"
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$BaseUrl
)

$ErrorActionPreference = "Continue"
$SuccessCount = 0
$FailCount = 0
$Results = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [scriptblock]$Validator
    )

    Write-Host "" -ForegroundColor White
    Write-Host "[TEST] $Name" -ForegroundColor Cyan
    Write-Host "       URL: $Url" -ForegroundColor Gray

    try {
        $params = @{
            Uri             = $Url
            Method          = $Method
            Headers         = $Headers
            UseBasicParsing = $true
            ErrorAction     = "Stop"
        }

        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }

        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode

        if ($Validator) {
            $content = $null
            if ($response.Content) {
                try {
                    $content = $response.Content | ConvertFrom-Json
                } catch {
                    $content = $response.Content
                }
            }

            $validationResult = & $Validator $content $response

            if ($validationResult) {
                Write-Host "  PASS ($statusCode)" -ForegroundColor Green
                $script:SuccessCount++
                $script:Results += [PSCustomObject]@{
                    Test       = $Name
                    Status     = "PASS"
                    StatusCode = $statusCode
                    Details    = $validationResult
                }
            } else {
                Write-Host "  FAIL - validation failed ($statusCode)" -ForegroundColor Red
                $script:FailCount++
                $script:Results += [PSCustomObject]@{
                    Test       = $Name
                    Status     = "FAIL"
                    StatusCode = $statusCode
                    Details    = "Validation check failed"
                }
            }
        } else {
            if ($statusCode -ge 200 -and $statusCode -lt 300) {
                Write-Host "  PASS ($statusCode)" -ForegroundColor Green
                $script:SuccessCount++
                $script:Results += [PSCustomObject]@{
                    Test       = $Name
                    Status     = "PASS"
                    StatusCode = $statusCode
                    Details    = "OK"
                }
            } else {
                Write-Host "  WARN - unexpected status $statusCode" -ForegroundColor Yellow
            }
        }
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Host "  FAIL - $errorMsg" -ForegroundColor Red
        $script:FailCount++
        $script:Results += [PSCustomObject]@{
            Test       = $Name
            Status     = "FAIL"
            StatusCode = "N/A"
            Details    = $errorMsg
        }
    }
}

Write-Host "==============================================" -ForegroundColor Magenta
Write-Host " TradeScout Production Validation" -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta
Write-Host "Base URL : $BaseUrl" -ForegroundColor White
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# 1. Health & Infrastructure
Write-Host ""; Write-Host "[1] Health & Infrastructure" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Health Check" `
    -Url "$BaseUrl/api/health" `
    -Validator {
        param($content)
        if ($content -is [string]) { return $false }
        return $content.status -eq "ok" -or $content.status -eq "healthy"
    }

Test-Endpoint `
    -Name "Frontend Home Page" `
    -Url "$BaseUrl/"

Test-Endpoint `
    -Name "API Base Endpoint" `
    -Url "$BaseUrl/api"

# 2. Authentication (Unauthenticated)
Write-Host ""; Write-Host "[2] Authentication (unauthenticated)" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Auth User (Unauthenticated)" `
    -Url "$BaseUrl/api/auth/user" `
    -Validator {
        param($content, $response)
        return $response.StatusCode -eq 401 -or ($content.message -match "Not authenticated")
    }

Test-Endpoint `
    -Name "Setup Status Check" `
    -Url "$BaseUrl/api/auth/setup-status" `
    -Validator {
        param($content)
        return $null -ne $content.needsSetup
    }

# 3. Public API Endpoints (No Auth)
Write-Host ""; Write-Host "[3] Public API endpoints" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Marketplace Listings (Empty OK)" `
    -Url "$BaseUrl/api/marketplace/listings" `
    -Validator {
        param($content)
        if ($content -is [Array]) { return $true }
        if ($content.items -is [Array]) { return $true }
        return $false
    }

Test-Endpoint `
    -Name "Marketplace Categories" `
    -Url "$BaseUrl/api/marketplace/categories" `
    -Validator {
        param($content)
        return $content -is [Array]
    }

# 4. Protected Endpoints (Should Fail unauthenticated)
Write-Host ""; Write-Host "[4] Protected endpoints (expect 401)" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Notifications (Unauthenticated)" `
    -Url "$BaseUrl/api/notifications" `
    -Validator {
        param($content, $response)
        return $response.StatusCode -eq 401
    }

Test-Endpoint `
    -Name "Profile (Unauthenticated)" `
    -Url "$BaseUrl/api/auth/profile" `
    -Validator {
        param($content, $response)
        return $response.StatusCode -eq 401
    }

# 5. Login Flow (endpoint existence)
Write-Host ""; Write-Host "[5] Login flow (endpoint check)" -ForegroundColor Magenta

Write-Host "Manual login test is still required in a browser." -ForegroundColor Yellow

Test-Endpoint `
    -Name "Login Endpoint (POST)" `
    -Url "$BaseUrl/api/auth/login" `
    -Method "POST" `
    -Body '{"email":"test@example.com","password":"test"}' `
    -Validator {
        param($content, $response)
        return $response.StatusCode -eq 401 -or ($content.message -match "Login failed|Invalid")
    }

# 6. Static Assets
Write-Host ""; Write-Host "[6] Static assets" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Favicon" `
    -Url "$BaseUrl/favicon.ico"

# 7. CORS & Security Headers
Write-Host ""; Write-Host "[7] Security headers" -ForegroundColor Magenta

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing
    $headers = $response.Headers

    Write-Host "Response headers:" -ForegroundColor Cyan

    if ($headers["Access-Control-Allow-Origin"]) {
        Write-Host "  CORS: $($headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    } else {
        Write-Host "  CORS header missing (may be intentional)" -ForegroundColor Yellow
    }

    if ($headers["X-Frame-Options"]) {
        Write-Host "  X-Frame-Options: $($headers['X-Frame-Options'])" -ForegroundColor Green
    }

    if ($headers["Content-Security-Policy"]) {
        Write-Host "  CSP: present" -ForegroundColor Green
    } else {
        Write-Host "  CSP not set (optional)" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Could not check headers: $($_.Exception.Message)" -ForegroundColor Red
}

# 8. Database Connection (Indirect via categories)
Write-Host ""; Write-Host "[8] Database connection (via categories)" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Categories (DB Query)" `
    -Url "$BaseUrl/api/marketplace/categories" `
    -Validator {
        param($content)
        return $content -is [Array]
    }

# Summary
Write-Host ""; Write-Host "==============================================" -ForegroundColor Magenta
Write-Host " Validation Summary" -ForegroundColor Magenta
Write-Host "==============================================" -ForegroundColor Magenta

Write-Host "Passed : $SuccessCount" -ForegroundColor Green
Write-Host "Failed : $FailCount" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Red" })
Write-Host "Total  : $($SuccessCount + $FailCount)" -ForegroundColor White

if ($FailCount -eq 0) {
    Write-Host "All tests passed. Production deployment looks healthy." -ForegroundColor Green
} else {
    Write-Host "Some tests failed. Review details above." -ForegroundColor Yellow
}

# Export results to JSON
$resultsFile = "validation-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$Results | ConvertTo-Json -Depth 10 | Out-File $resultsFile
Write-Host "Results saved to: $resultsFile" -ForegroundColor Gray
