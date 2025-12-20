<#
  Quick Deploy Helper for TradeScout

  This script previously invoked a specific third-party hosting CLI.
  Deployment is now expected to be handled by your chosen hosting
  platform (for example, via its dashboard or CI pipeline), so this
  helper just reminds you of the standard build + deploy steps.
 #>

Write-Host "🚀 TradeScout deployment helper" -ForegroundColor Cyan
Write-Host "" 
Write-Host "1) From the project root, run:" -ForegroundColor Yellow
Write-Host "   npm run build" -ForegroundColor Gray
Write-Host "" 
Write-Host "2) Configure your hosting provider to:" -ForegroundColor Yellow
Write-Host "   - Serve the Node server from dist/index.js" -ForegroundColor Gray
Write-Host "   - Expose the PORT environment variable (default 5000)" -ForegroundColor Gray
Write-Host "   - Point your domain (e.g. thetradescout.com) at that service" -ForegroundColor Gray
Write-Host "" 
Write-Host "3) Set required environment variables on your host:" -ForegroundColor Yellow
Write-Host "   - DATABASE_URL" -ForegroundColor Gray
Write-Host "   - SESSION_SECRET" -ForegroundColor Gray
Write-Host "   - Any other keys documented in DEPLOYMENT_README.md" -ForegroundColor Gray
Write-Host "" 
Write-Host "When those steps are complete, your site should be live at your configured domain." -ForegroundColor Green
