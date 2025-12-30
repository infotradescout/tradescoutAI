@echo off
cd /d "C:\Users\FlavorGood\Documents\AAATraderCorner\TradeScout\TradeScoutPro"
git commit -m "refactor: Community Snapshot card system + Direct Connect routing" -m "Community Snapshot: composable card-based hero surface" -m "- SnapshotCard types: trade_deal, local_stats, starter_invitation, community_post" -m "- Cards now 280-300px for visual impact" -m "- Smart composition: deals first, stats when sparse, invitations for empty" -m "- Psychological reframing: early access vs apology" -m "- Single authority: no parent fallback logic" -m "" -m "Direct Connect routing fix:" -m "- Added base /direct-connect route for CTA navigation" -m "- Preserves wildcard route for sub-paths"
git push
pause
