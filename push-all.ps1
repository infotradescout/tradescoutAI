Remove-Module PSReadLine -ErrorAction SilentlyContinue
cd C:\Users\FlavorGood\Documents\AAATraderCorner\TradeScout\TradeScoutPro
git add -A
git commit -m "feat: Community Snapshot card system + Direct Connect routing + super admin controls"
git push
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
