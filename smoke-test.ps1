#!/usr/bin/env pwsh
$ErrorActionPreference = "Continue"
$tests = @()

Write-Host "`n========== SMOKE TEST SUITE ==========" -ForegroundColor Cyan

# Test 1: Health Endpoint
Write-Host "`n[1] Health Endpoint (GET /api/health)" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -UseBasicParsing -TimeoutSec 3
    Write-Host "✅ Status: $($response.StatusCode)"
    $json = $response.Content | ConvertFrom-Json
    Write-Host "✅ Response: $($response.Content | ConvertFrom-Json | ConvertTo-Json -Compress)"
    $tests += @{ name = "Health"; status = "PASS" }
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)"
    $tests += @{ name = "Health"; status = "FAIL" }
}

# Test 2: Password Reset Request
Write-Host "`n[2] Password Reset Request (POST /api/auth/request-password-reset)" -ForegroundColor Green
try {
    $body = @{ email = "test@example.com" } | ConvertTo-Json
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/request-password-reset" `
        -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 3
    Write-Host "✅ Status: $($response.StatusCode)"
    Write-Host "✅ Response: $($response.Content)"
    $tests += @{ name = "Password Reset Request"; status = "PASS" }
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)"
    $tests += @{ name = "Password Reset Request"; status = "FAIL" }
}

# Test 3: Rate Limiter (6 login attempts)
Write-Host "`n[3] Rate Limiter (6 login attempts, expect 429 on 6th)" -ForegroundColor Green
$loginBody = @{ email = "user@example.com"; password = "test123" } | ConvertTo-Json
for ($i = 1; $i -le 6; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/api/auth/login" `
            -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
        Write-Host "  Attempt ${i}: Status $($response.StatusCode)"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        if ($statusCode -eq 429) {
            Write-Host "  Attempt ${i}: PASS Got expected 429 (Too Many Requests)"
            $tests += @{ name = "Rate Limiter"; status = "PASS" }
            break
        } else {
            Write-Host "  Attempt ${i}: Status $statusCode"
        }
    }
}

# Test 4: Upload Endpoint Auth Guard (unauthenticated should return 401)
Write-Host "`n[4] Upload Endpoint Auth Guard (expect 401 unauthenticated)" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/objects/upload" `
        -Method POST -UseBasicParsing -TimeoutSec 3 -ErrorAction SilentlyContinue
    Write-Host "❌ Got status $($response.StatusCode), expected 401"
    $tests += @{ name = "Upload Auth Guard"; status = "FAIL" }
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    if ($statusCode -eq 401) {
        Write-Host "✅ Got expected 401 (Unauthorized)"
        $tests += @{ name = "Upload Auth Guard"; status = "PASS" }
    } else {
        Write-Host "❌ Got status $statusCode, expected 401"
        $tests += @{ name = "Upload Auth Guard"; status = "FAIL" }
    }
}

# Test 5: CORS Headers
Write-Host "`n[5] CORS Headers (check Access-Control-Allow-Origin)" -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" `
        -Headers @{ "Origin" = "http://localhost:3000" } -UseBasicParsing -TimeoutSec 3
    $corsHeader = $response.Headers['Access-Control-Allow-Origin']
    if ($corsHeader) {
        Write-Host "✅ CORS Header present: $corsHeader"
        $tests += @{ name = "CORS Headers"; status = "PASS" }
    } else {
        Write-Host "⚠️  No CORS header found (might be okay depending on config)"
        $tests += @{ name = "CORS Headers"; status = "WARN" }
    }
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)"
    $tests += @{ name = "CORS Headers"; status = "FAIL" }
}

# Summary
Write-Host "`n========== TEST SUMMARY ==========" -ForegroundColor Cyan
foreach ($test in $tests) {
    $color = if ($test.status -eq "PASS") { "Green" } elseif ($test.status -eq "WARN") { "Yellow" } else { "Red" }
    Write-Host "$($test.name): $($test.status)" -ForegroundColor $color
}

$passCount = @($tests | Where-Object { $_.status -eq "PASS" }).Count
$totalCount = $tests.Count
Write-Host "`nPassed: $passCount/$totalCount" -ForegroundColor Cyan
