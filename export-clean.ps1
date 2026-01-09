# TradeScout Clean Export Script
# Excludes node_modules, .git, dist, and other build artifacts

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outputFile = "TradeScout_FULL_$timestamp.zip"
$rootPath = $PSScriptRoot

Write-Host "Creating clean TradeScout export..." -ForegroundColor Cyan
Write-Host "Output: $outputFile" -ForegroundColor Green

# Get all items recursively, excluding problematic directories
$excludePatterns = @(
    "node_modules",
    ".git",
    "dist",
    ".next",
    ".DS_Store",
    ".vite",
    ".vite-temp",
    ".playwright",
    "playwright-report",
    "test-results",
    "*.log",
    "*.zip",
    "*.rar",
    "*.tar.gz"
)

# Create temp directory for staging
$tempDir = Join-Path $env:TEMP "TradeScoutExport_$timestamp"
$exportDir = Join-Path $tempDir "TradeScoutPro"
New-Item -ItemType Directory -Path $exportDir -Force | Out-Null

Write-Host "Staging files..." -ForegroundColor Yellow

# Copy files with exclusions
Get-ChildItem -Path $rootPath -Recurse -File | Where-Object {
    $file = $_
    $relativePath = $file.FullName.Substring($rootPath.Length + 1)
    
    # Check if file matches any exclude pattern
    $exclude = $false
    foreach ($pattern in $excludePatterns) {
        if ($relativePath -like "*$pattern*") {
            $exclude = $true
            break
        }
    }
    
    # Skip .env files except .env.example
    if ($file.Name -match "^\.env" -and $file.Name -ne ".env.example") {
        $exclude = $true
    }
    
    -not $exclude
} | ForEach-Object {
    $targetPath = Join-Path $exportDir ($_.FullName.Substring($rootPath.Length + 1))
    $targetDir = Split-Path $targetPath -Parent
    
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    
    Copy-Item $_.FullName -Destination $targetPath -Force
}

Write-Host "Creating ZIP archive..." -ForegroundColor Yellow

# Create the final ZIP
Compress-Archive -Path "$exportDir\*" -DestinationPath (Join-Path $rootPath $outputFile) -Force

# Cleanup temp directory
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "`n Export complete!" -ForegroundColor Green
Write-Host "File: $outputFile" -ForegroundColor Cyan
Write-Host "Size: $([math]::Round((Get-Item $outputFile).Length / 1MB, 2)) MB" -ForegroundColor Cyan

# Verify critical files are present
Write-Host "`nVerifying critical files..." -ForegroundColor Yellow
$criticalFiles = @(
    "package.json",
    "package-lock.json",
    "server/index.ts",
    "shared/schema.ts",
    "client/package.json",
    "drizzle.config.ts"
)

$tempExtract = Join-Path $env:TEMP "verify_$timestamp"
Expand-Archive -Path $outputFile -DestinationPath $tempExtract -Force

$missingFiles = @()
foreach ($file in $criticalFiles) {
    $fullPath = Join-Path $tempExtract $file
    if (-not (Test-Path $fullPath)) {
        $missingFiles += $file
    } else {
        Write-Host "  OK $file" -ForegroundColor Green
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "`n WARNING: Missing critical files:" -ForegroundColor Red
    $missingFiles | ForEach-Object { Write-Host "  X $_" -ForegroundColor Red }
} else {
    Write-Host "`n All critical files verified!" -ForegroundColor Green
}

Remove-Item -Path $tempExtract -Recurse -Force

Write-Host "`nReady to upload: $outputFile" -ForegroundColor Cyan
