#!/usr/bin/env pwsh
# scripts/audit-theme-lock.ps1
# Theme Lock Audit - Detects inline colors, unauthorized gradients, and violations

param(
    [switch]$Fix = $false,
    [switch]$Verbose = $false
)

Write-Host "Theme Lock Audit Starting..." -ForegroundColor Cyan

$violations = @()

# Define patterns
$suspiciousHex = '#[0-9a-fA-F]{6}'
$unauthorizedGradient = 'linear-gradient|radial-gradient|conic-gradient'

# Define allowed Scout files (where gradients are OK)
$allowedScoutFiles = @('ScoutInput', 'scout', 'Scout')

# Define allowed files for inline colors (component-specific)
$allowedColorFiles = @('Icons', 'Logo', 'Theme')

Write-Host "`nScanning components..." -ForegroundColor Gray

# Scan TSX files
$tsxFiles = Get-ChildItem -Path "client/src" -Recurse -Include "*.tsx" -ErrorAction SilentlyContinue

foreach ($file in $tsxFiles) {
    $content = Get-Content $file.FullName -Raw
    $shortPath = $file.FullName -replace [regex]::Escape("$PWD\"), ""
    $relativePath = $shortPath -replace "\\", "/"

    # Path-based allowlist for safe experimentation/test surfaces
    # Allow hex colors in clearly non-production surfaces like test-page, demo, sandbox
    $allowHexByPath = $false
    if ($relativePath -match '(?i)test-page' -or
        $relativePath -match '(?i)/demo/' -or
        $relativePath -match '(?i)/sandbox/') {
        $allowHexByPath = $true
    }
    
    # Skip files that are allowed exceptions
    $isAllowedFile = $false
    foreach ($allowed in $allowedColorFiles + $allowedScoutFiles) {
        if ($file.Name -like "*${allowed}*") {
            $isAllowedFile = $true
            break
        }
    }
    
    if ($isAllowedFile) { continue }
    
    # Check for inline hex colors
    # - Allow only when hex is used as a fallback in a CSS variable, e.g. var(--user-primary, #f97316)
    # - Allow hex in explicitly safe test/demo/sandbox surfaces (handled via $allowHexByPath)
    if (-not $allowHexByPath) {
        $hexFindings = Select-String -Path $file.FullName -Pattern $suspiciousHex -AllMatches
        foreach ($hit in $hexFindings) {
            $line = $hit.Line

            # Strip out CSS variable fallback segments like var(--user-primary, #f97316)
            $lineWithoutVarFallbacks = [regex]::Replace(
                $line,
                'var\(\s*--[^,]+,\s*#[0-9a-fA-F]{6}\s*\)',
                '',
                'IgnoreCase'
            )

            # If any hex remains after removing var() fallbacks, treat as a real violation
            if ($lineWithoutVarFallbacks -match $suspiciousHex) {
                $violations += @{
                    File = $shortPath
                    Line = $hit.LineNumber
                    Type = "Inline hex color"
                    Content = $hit.Line.Trim()
                }
            }
        }
    }
    
    # Check for unauthorized gradients
    $isScoutFile = $false
    foreach ($scout in $allowedScoutFiles) {
        if ($file.Name -like "*${scout}*") {
            $isScoutFile = $true
            break
        }
    }
    
    if (-not $isScoutFile) {
        $gradientFindings = Select-String -Path $file.FullName -Pattern "background:\s*($unauthorizedGradient)|backgroundImage:\s*($unauthorizedGradient)" -AllMatches
        foreach ($hit in $gradientFindings) {
            $violations += @{
                File = $shortPath
                Line = $hit.LineNumber
                Type = "Unauthorized gradient"
                Content = $hit.Line.Trim()
            }
        }
    }
}

Write-Host "`nScanning CSS files..." -ForegroundColor Gray

# Scan CSS files
$cssFiles = Get-ChildItem -Path "client/src" -Recurse -Include "*.css" -ErrorAction SilentlyContinue

foreach ($file in $cssFiles) {
    $content = Get-Content $file.FullName -Raw
    $shortPath = $file.FullName -replace [regex]::Escape("$PWD\"), ""
    
    # Skip scout-shell (allowed gradient)
    if ($content -like "*.scout-shell*" -or $content -like "*.scout-gradient*") { continue }
    
    # Check for unauthorized gradients
    $cssGradientFindings = Select-String -Path $file.FullName -Pattern "background:\s*($unauthorizedGradient)|background-image:\s*($unauthorizedGradient)" -AllMatches
    foreach ($hit in $cssGradientFindings) {
        $violations += @{
            File = $shortPath
            Line = $hit.LineNumber
            Type = "Unauthorized gradient in CSS"
            Content = $hit.Line.Trim()
        }
    }
}

# Report violations
Write-Host "`n" -ForegroundColor Gray
if ($violations.Count -eq 0) {
    Write-Host "Theme Lock Audit PASSED" -ForegroundColor Green
    Write-Host "   No violations found in $($tsxFiles.Count + $cssFiles.Count) files" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Theme Lock Audit FAILED" -ForegroundColor Red
    Write-Host "   Found $($violations.Count) violations:`n" -ForegroundColor Red
    
    foreach ($violation in $violations) {
        Write-Host "   Warning: $($violation.File):$($violation.Line)" -ForegroundColor Yellow
        Write-Host "      Type: $($violation.Type)" -ForegroundColor Gray
        Write-Host "      Code: $($violation.Content)" -ForegroundColor DarkGray
        Write-Host ""
    }
    
    if ($Verbose) {
        Write-Host "`nRemediation Guide:" -ForegroundColor Cyan
        Write-Host "   1. Open each file listed above" -ForegroundColor Gray
        Write-Host "   2. Replace hardcoded hex with CSS variable:" -ForegroundColor Gray
        Write-Host "      backgroundColor: '#1a2230'  ->  backgroundColor: 'var(--surface-card)'" -ForegroundColor DarkGray
        Write-Host "   3. Remove gradients (Scout only exception):" -ForegroundColor Gray
        Write-Host "      Use solid surface colors instead" -ForegroundColor DarkGray
    }
    
    exit 1
}
