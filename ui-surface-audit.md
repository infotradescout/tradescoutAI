# UI Surface Audit

Scanned files: **352**
Root violations (viewport-height + bg-*): **12**
Files claiming viewport height: **12**
Files with bg-* classes: **262**

## Top offenders
- 🚫 `client/src/pages/exchange/ExchangeListingDetail.tsx` — min-h-viewport (3) @ lines 343,351,381 | h-screen (3) @ lines 343,351,381 | bg-* (38) @ lines 142,149,155,343,351
- 🚫 `client/src/pages/offer-services.tsx` — min-h-viewport (1) @ lines 689 | h-screen (1) @ lines 689 | bg-* (39) @ lines 135,141,146,689,708 | gradient (1) @ lines 629
- 🚫 `client/src/pages/procurement/ProcurementPages.tsx` — min-h-viewport (1) @ lines 145 | h-screen (1) @ lines 145 | bg-* (40) @ lines 145,166,182,186,366
- 🚫 `client/src/pages/profile-sites/WholesalerProfileTheme.tsx` — min-h-viewport (1) @ lines 293 | h-screen (1) @ lines 293 | bg-* (36) @ lines 293,295,308,308,334
- 🚫 `client/src/pages/trade-up-for-trade-schools.tsx` — min-h-viewport (1) @ lines 68 | h-screen (1) @ lines 68 | bg-* (32) @ lines 68,69,73,81,81
- 🚫 `client/src/pages/exchange-rental-equipment.tsx` — min-h-viewport (1) @ lines 77 | h-screen (1) @ lines 77 | bg-* (21) @ lines 77,86,88,96,108
- 🚫 `client/src/pages/trade/TradeCountyPage.tsx` — min-h-viewport (1) @ lines 176 | h-screen (1) @ lines 176 | bg-* (19) @ lines 123,128,128,176,180
- 🚫 `client/src/pages/exchange-rental-property.tsx` — min-h-viewport (1) @ lines 62 | h-screen (1) @ lines 62 | bg-* (17) @ lines 62,71,73,78,89
- 🚫 `client/src/pages/profile-purchase-status.tsx` — min-h-viewport (1) @ lines 122 | h-screen (1) @ lines 122 | bg-* (16) @ lines 122,136,140,147,157
- 🚫 `client/src/pages/county-directory.tsx` — min-h-viewport (1) @ lines 124 | h-screen (1) @ lines 124 | bg-* (14) @ lines 124,135,146,196,197
- 🚫 `client/src/pages/TradePartnersHub.tsx` — min-h-viewport (1) @ lines 195 | h-screen (1) @ lines 195 | bg-* (12) @ lines 195,203,204,219,226
- 🚫 `client/src/pages/giveaway-rules.tsx` — min-h-viewport (1) @ lines 156 | h-screen (1) @ lines 156 | bg-* (6) @ lines 156,171,175,179,185
- • `client/src/pages/admin-live-stream.tsx` — bg-* (193) @ lines 254,255,256,257,261
- • `client/src/pages/direct-connect/DirectConnectShell.tsx` — bg-* (153) @ lines 201,786,789,792,794
- • `client/src/pages/exchange.tsx` — bg-* (139) @ lines 885,886,887,888,889 | gradient (2) @ lines 316,2147
- • `client/src/pages/settings.tsx` — bg-* (107) @ lines 762,780,784,791,798 | gradient (12) @ lines 762,762,762,906,906
- • `client/src/pages/marketplace.tsx` — bg-* (73) @ lines 427,436,443,450,457 | gradient (27) @ lines 427,427,427,427,532
- • `client/src/pages/admin-users.tsx` — bg-* (80) @ lines 102,108,114,120,126
- • `client/src/pages/affiliate.tsx` — bg-* (64) @ lines 337,363,531,542,552 | gradient (11) @ lines 337,337,337,337,363
- • `client/src/pages/accounting.tsx` — bg-* (74) @ lines 825,834,834,858,859
- • `client/src/pages/admin-observability.tsx` — bg-* (59) @ lines 365,367,369,371,391 | gradient (12) @ lines 515,515,515,515,631
- • `client/src/pages/helpers.tsx` — bg-* (69) @ lines 118,120,131,133,135
- • `client/src/pages/admin-provision-user.tsx` — bg-* (64) @ lines 333,358,370,382,391
- • `client/src/pages/foundation.tsx` — bg-* (59) @ lines 282,284,286,300,302 | gradient (4) @ lines 300,300,300,300
- • `client/src/pages/platform-analytics.tsx` — bg-* (54) @ lines 300,302,561,575,578 | gradient (3) @ lines 738,856,976
- • `client/src/pages/community-feed.tsx` — bg-* (55) @ lines 192,193,238,239,242
- • `client/src/pages/promotions.tsx` — bg-* (55) @ lines 87,87,88,88,89
- • `client/src/pages/contractor-signup.tsx` — bg-* (52) @ lines 193,200,208,218,218
- • `client/src/pages/tasks.tsx` — bg-* (52) @ lines 496,499,506,515,537
- • `client/src/pages/finances-invoices.tsx` — bg-* (51) @ lines 448,451,454,457,459
- • `client/src/pages/system-settings.tsx` — bg-* (51) @ lines 172,187,190,197,204
- • `client/src/pages/documentation.tsx` — bg-* (34) @ lines 113,119,125,131,141 | gradient (16) @ lines 113,113,113,119,119
- • `client/src/pages/api-integrations.tsx` — bg-* (49) @ lines 157,157,159,159,161
- • `client/src/pages/hoa-management.tsx` — bg-* (45) @ lines 543,550,550,564,575 | gradient (3) @ lines 564,564,564
- • `client/src/pages/admin-business-import.tsx` — bg-* (44) @ lines 635,655,661,661,701 | gradient (2) @ lines 240,296
- • `client/src/pages/referral-dashboard.tsx` — bg-* (46) @ lines 164,177,190,203,218
- • `client/src/pages/social-integration.tsx` — bg-* (46) @ lines 41,50,59,68,77
- • `client/src/pages/SimpleHome.tsx` — bg-* (45) @ lines 108,120,138,153,166
- • `client/src/pages/compliance.tsx` — bg-* (41) @ lines 57,59,61,63,90 | gradient (3) @ lines 68,82,286
- • `client/src/pages/worker-marketplace.tsx` — bg-* (44) @ lines 62,204,204,213,216
