# 🔍 Production Validation Script

# Test production deployment end-to-end
# Usage: .\validate-production.ps1 -BaseUrl "https://your-app.railway.app"

param(
    [Parameter(Mandatory=$true)]
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
    
    Write-Host "`n🧪 Testing: $Name" -ForegroundColor Cyan
    Write-Host "   URL: $Url" -ForegroundColor Gray
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        $statusCode = $response.StatusCode
        
        if ($Validator) {
            $content = $response.Content | ConvertFrom-Json
            $validationResult = & $Validator $content $response
            
            if ($validationResult) {
                Write-Host "   ✅ PASS - $Name" -ForegroundColor Green
                $script:SuccessCount++
                $script:Results += [PSCustomObject]@{
                    Test = $Name
                    Status = "PASS"
                    StatusCode = $statusCode
                    Details = $validationResult
                }
            } else {
                Write-Host "   ❌ FAIL - Validation failed" -ForegroundColor Red
                $script:FailCount++
                $script:Results += [PSCustomObject]@{
                    Test = $Name
                    Status = "FAIL"
                    StatusCode = $statusCode
                    Details = "Validation check failed"
                }
            }
        } else {
            if ($statusCode -ge 200 -and $statusCode -lt 300) {
                Write-Host "   ✅ PASS - $Name ($statusCode)" -ForegroundColor Green
                $script:SuccessCount++
                $script:Results += [PSCustomObject]@{
                    Test = $Name
                    Status = "PASS"
                    StatusCode = $statusCode
                    Details = "OK"
                }
            } else {
                Write-Host "   ⚠️  WARN - Unexpected status $statusCode" -ForegroundColor Yellow
            }
        }
    } catch {
        $errorMsg = $_.Exception.Message
        Write-Host "   ❌ FAIL - $errorMsg" -ForegroundColor Red
        $script:FailCount++
        $script:Results += [PSCustomObject]@{
            Test = $Name
            Status = "FAIL"
            StatusCode = "N/A"
            Details = $errorMsg
        }
    }
}

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║   TradeScout Production Validation      ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Magenta
Write-Host "`nBase URL: $BaseUrl" -ForegroundColor White
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray

# ============================================
# 1. Health & Infrastructure
# ============================================
Write-Host "`n═══ 1. Health & Infrastructure ═══" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Health Check" `
    -Url "$BaseUrl/api/health" `
    -Validator { 
        param($content) 
        return $content.status -eq "ok"
    }

Test-Endpoint `
    -Name "Frontend Home Page" `
    -Url "$BaseUrl/"

Test-Endpoint `
    -Name "API Base Endpoint" `
    -Url "$BaseUrl/api"

# ============================================
# 2. Authentication (Unauthenticated)
# ============================================
Write-Host "`n═══ 2. Authentication Tests ═══" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Auth User (Unauthenticated)" `
    -Url "$BaseUrl/api/auth/user" `
    -Validator {
        param($content, $response)
        # Should return 401 when not authenticated
        return $response.StatusCode -eq 401 -or $content.message -match "Not authenticated"
    }

Test-Endpoint `
    -Name "Setup Status Check" `
    -Url "$BaseUrl/api/auth/setup-status" `
    -Validator {
        param($content)
        return $null -ne $content.needsSetup
    }

# ============================================
# 3. Public API Endpoints (No Auth)
# ============================================
Write-Host "`n═══ 3. Public API Endpoints ═══" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Marketplace Listings (Empty)" `
    -Url "$BaseUrl/api/marketplace/listings" `
    -Validator {
        param($content)
        return $content -is [Array]
    }

Test-Endpoint `
    -Name "Marketplace Categories" `
    -Url "$BaseUrl/api/marketplace/categories" `
    -Validator {
        param($content)
        return $content -is [Array]
    }

# ============================================
# 4. Protected Endpoints (Should Fail)
# ============================================
Write-Host "`n═══ 4. Protected Endpoints (Auth Required) ═══" -ForegroundColor Magenta

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

# ============================================
# 5. Login Flow Test
# ============================================
Write-Host "`n═══ 5. Login Flow Test ═══" -ForegroundColor Magenta

Write-Host "`n⚠️  Note: Full login test requires valid credentials." -ForegroundColor Yellow
Write-Host "   Manual test steps:" -ForegroundColor Gray
Write-Host "   1. Open $BaseUrl in browser" -ForegroundColor Gray
Write-Host "   2. Sign up with new email" -ForegroundColor Gray
Write-Host "   3. Verify session persists on refresh" -ForegroundColor Gray
Write-Host "   4. Logout and confirm redirect" -ForegroundColor Gray

# Test login endpoint exists
Test-Endpoint `
    -Name "Login Endpoint (POST)" `
    -Url "$BaseUrl/api/auth/login" `
    -Method "POST" `
    -Body '{"email":"test@example.com","password":"test"}' `
    -Validator {
        param($content, $response)
        # Should fail with invalid credentials, but endpoint exists
        return $response.StatusCode -eq 401 -or $content.message -match "Login failed|Invalid"
    }

# ============================================
# 6. Static Assets
# ============================================
Write-Host "`n═══ 6. Static Assets ═══" -ForegroundColor Magenta

Test-Endpoint `
    -Name "Favicon" `
    -Url "$BaseUrl/favicon.ico"

# ============================================
# 7. CORS & Security Headers
# ============================================
Write-Host "`n═══ 7. Security Headers ═══" -ForegroundColor Magenta

try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing
    $headers = $response.Headers
    
    Write-Host "`n📋 Response Headers:" -ForegroundColor Cyan
    
    if ($headers["Access-Control-Allow-Origin"]) {
        Write-Host "   ✅ CORS Enabled: $($headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  No CORS header (may need configuration)" -ForegroundColor Yellow
    }
    
    if ($headers["X-Frame-Options"]) {
        Write-Host "   ✅ X-Frame-Options: $($headers['X-Frame-Options'])" -ForegroundColor Green
    }
    
    if ($headers["Content-Security-Policy"]) {
        Write-Host "   ✅ CSP: Present" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  CSP: Not set (optional)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ❌ Could not check headers" -ForegroundColor Red
}

# ============================================
# 8. Database Connection (Indirect)
# ============================================
Write-Host "`n═══ 8. Database Connection Test ═══" -ForegroundColor Magenta

Write-Host "   Testing database via API calls..." -ForegroundColor Gray

Test-Endpoint `
    -Name "Categories (DB Query)" `
    -Url "$BaseUrl/api/marketplace/categories" `
    -Validator {
        param($content)
        # If returns array, DB connection works
        return $content -is [Array]
    }

# ============================================
# Summary
# ============================================
Write-Host "`n" -NoNewline
Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Magenta
Write-Host "║          Validation Summary              ║" -ForegroundColor Magenta
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Magenta

Write-Host "`n✅ Passed: $SuccessCount tests" -ForegroundColor Green
Write-Host "❌ Failed: $FailCount tests" -ForegroundColor $(if ($FailCount -eq 0) { "Green" } else { "Red" })
Write-Host "`nTotal Tests: $($SuccessCount + $FailCount)" -ForegroundColor White

if ($FailCount -eq 0) {
    Write-Host "`n🎉 All tests passed! Production deployment is healthy." -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Cyan
    Write-Host "  1. Sign up for a test account" -ForegroundColor Gray
    Write-Host "  2. Test full user flow (signup → login → logout)" -ForegroundColor Gray
    Write-Host "  3. Create a marketplace listing" -ForegroundColor Gray
    Write-Host "  4. Test session persistence across tabs" -ForegroundColor Gray
} else {
    Write-Host "`n⚠️  Some tests failed. Review errors above." -ForegroundColor Yellow
}

# Export results to JSON
$resultsFile = "validation-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
$Results | ConvertTo-Json -Depth 10 | Out-File $resultsFile
Write-Host "`n📄 Full results saved to: $resultsFile" -ForegroundColor Gray

Write-Host "`n═══════════════════════════════════════════`n" -ForegroundColor Magenta
