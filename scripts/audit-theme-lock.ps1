#!/usr/bin/env pwsh
# scripts/audit-theme-lock.ps1
# Theme Lock Audit - Detects inline colors, unauthorized gradients, and violations

param(
    [switch]$Fix = $false,
    [switch]$Verbose = $false
)

Write-Host "🔍 Theme Lock Audit Starting..." -ForegroundColor Cyan

$violations = @()
$fixedCount = 0

# Define patterns
$suspiciousHex = '#[0-9a-fA-F]{6}'
$unauthorizedGradient = 'linear-gradient|radial-gradient|conic-gradient'

# Define allowed Scout files (where gradients are OK)
$allowedScoutFiles = @('ScoutInput', 'scout', 'Scout')

# Define allowed files for inline colors (component-specific)
$allowedColorFiles = @('Icons', 'Logo', 'Theme')

Write-Host "`n📋 Scanning components..." -ForegroundColor Gray

# Scan TSX files
$tsxFiles = Get-ChildItem -Path "client/src" -Recurse -Include "*.tsx" -ErrorAction SilentlyContinue

foreach ($file in $tsxFiles) {
    $content = Get-Content $file.FullName -Raw
    $shortPath = $file.FullName -replace [regex]::Escape("$PWD\"), ""
    
    # Skip files that are allowed exceptions
    $isAllowedFile = $false
    foreach ($allowed in $allowedColorFiles + $allowedScoutFiles) {
        if ($file.Name -match $allowed) {
            $isAllowedFile = $true
            break
        }
    }
    
    if ($isAllowedFile) { continue }
    
    # Check for inline hex colors
    if ($content -match "backgroundColor:\s*['\`]($suspiciousHex)" -or
        $content -match "borderColor:\s*['\`]($suspiciousHex)" -or
        $content -match "color:\s*['\`]($suspiciousHex)" -or
        $content -match "'background':\s*['\`]($suspiciousHex)" -or
        $content -match "'backgroundColor':\s*['\`]($suspiciousHex)") {
        
        $matches = [regex]::Matches($content, ".*($suspiciousHex).*")
        foreach ($match in $matches) {
            $lineNum = ($content.Substring(0, $match.Index) -split "`n").Count
            $violations += @{
                File = $shortPath
                Line = $lineNum
                Type = "Inline hex color"
                Content = $match.Value.Trim()
            }
        }
    }
    
    # Check for unauthorized gradients
    $isScoutFile = $false
    foreach ($scout in $allowedScoutFiles) {
        if ($file.Name -match $scout) {
            $isScoutFile = $true
            break
        }
    }
    
    if (-not $isScoutFile) {
        if ($content -match "background:\s*($unauthorizedGradient)" -or
            $content -match "backgroundImage:\s*($unauthorizedGradient)") {
            
            $matches = [regex]::Matches($content, ".*($unauthorizedGradient).*")
            foreach ($match in $matches) {
                $lineNum = ($content.Substring(0, $match.Index) -split "`n").Count
                $violations += @{
                    File = $shortPath
                    Line = $lineNum
                    Type = "Unauthorized gradient"
                    Content = $match.Value.Trim()
                }
            }
        }
    }
}

Write-Host "`n📋 Scanning CSS files..." -ForegroundColor Gray

# Scan CSS files
$cssFiles = Get-ChildItem -Path "client/src" -Recurse -Include "*.css" -ErrorAction SilentlyContinue

foreach ($file in $cssFiles) {
    $content = Get-Content $file.FullName -Raw
    $shortPath = $file.FullName -replace [regex]::Escape("$PWD\"), ""
    
    # Skip scout-shell (allowed gradient)
    if ($content -match "\.scout-shell|\.scout-gradient") { continue }
    
    # Check for unauthorized gradients
    if ($content -match "background:\s*($unauthorizedGradient)" -or
        $content -match "background-image:\s*($unauthorizedGradient)") {
        
        $matches = [regex]::Matches($content, "(?m)^.*($unauthorizedGradient).*$")
        foreach ($match in $matches) {
            $lineNum = ($content.Substring(0, $match.Index) -split "`n").Count
            $violations += @{
                File = $shortPath
                Line = $lineNum
                Type = "Unauthorized gradient in CSS"
                Content = $match.Value.Trim()
            }
        }
    }
}

# Report violations
Write-Host "`n" -ForegroundColor Gray
if ($violations.Count -eq 0) {
    Write-Host "✅ Theme Lock Audit PASSED" -ForegroundColor Green
    Write-Host "   No violations found in $($tsxFiles.Count + $cssFiles.Count) files" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Theme Lock Audit FAILED" -ForegroundColor Red
    Write-Host "   Found $($violations.Count) violations:`n" -ForegroundColor Red
    
    foreach ($violation in $violations) {
        Write-Host "   ⚠️  $($violation.File):$($violation.Line)" -ForegroundColor Yellow
        Write-Host "      Type: $($violation.Type)" -ForegroundColor Gray
        Write-Host "      Code: $($violation.Content)" -ForegroundColor DarkGray
        Write-Host ""
    }
    
    if ($Verbose) {
        Write-Host "`n📚 Remediation Guide:" -ForegroundColor Cyan
        Write-Host "   1. Open each file listed above" -ForegroundColor Gray
        Write-Host "   2. Replace hardcoded hex with CSS variable:" -ForegroundColor Gray
        Write-Host "      backgroundColor: '#1a2230'  →  backgroundColor: 'var(--surface-card)'" -ForegroundColor DarkGray
        Write-Host "   3. Remove gradients (Scout only exception):" -ForegroundColor Gray
        Write-Host "      Use solid surface colors instead" -ForegroundColor DarkGray
    }
    
    exit 1
}
