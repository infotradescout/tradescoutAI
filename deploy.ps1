# Quick Deploy to thetradescout.com
# Run this after setting up your hosting provider

Write-Host "🚀 Deploying TradeScout to thetradescout.com..." -ForegroundColor Cyan

# Check if Vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue

if ($vercelInstalled) {
    Write-Host "✓ Vercel CLI found" -ForegroundColor Green
    Write-Host "Deploying to Vercel..." -ForegroundColor Yellow
    vercel --prod
} else {
    Write-Host "⚠ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host "✓ Vercel CLI installed. Please run this script again." -ForegroundColor Green
    exit
}

Write-Host ""
Write-Host "🎉 Deployment complete!" -ForegroundColor Green
Write-Host "Your site should be live at: https://thetradescout.com" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Go to vercel.com/dashboard"
Write-Host "2. Add your custom domain: thetradescout.com"
Write-Host "3. Update DNS records at your domain registrar"
Write-Host "4. Set environment variables in Vercel dashboard"
Write-Host ""
Write-Host "See DEPLOYMENT_GUIDE.md for detailed instructions" -ForegroundColor Gray
