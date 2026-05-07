# UI Surface Audit

Scanned files: **325**
Root violations (viewport-height + bg-*): **5**
Files claiming viewport height: **5**
Files with bg-* classes: **275**

## Top offenders
- 🚫 `client/src/pages/exchange/ExchangeListingDetail.tsx` — min-h-viewport (3) @ lines 305,313,342 | h-screen (3) @ lines 305,313,342 | bg-* (34) @ lines 115,122,128,305,313
- 🚫 `client/src/pages/exchange-rental-equipment.tsx` — min-h-viewport (1) @ lines 77 | h-screen (1) @ lines 77 | bg-* (21) @ lines 77,86,88,96,108
- 🚫 `client/src/pages/exchange-rental-property.tsx` — min-h-viewport (1) @ lines 62 | h-screen (1) @ lines 62 | bg-* (17) @ lines 62,71,73,78,89
- 🚫 `client/src/pages/offer-services.tsx` — min-h-viewport (1) @ lines 226 | h-screen (1) @ lines 226 | bg-* (14) @ lines 62,68,73,226,249
- 🚫 `client/src/pages/TradePartnersHub.tsx` — min-h-viewport (1) @ lines 195 | h-screen (1) @ lines 195 | bg-* (12) @ lines 195,203,204,219,226
- • `client/src/pages/admin-live-stream.tsx` — bg-* (193) @ lines 254,255,256,257,261
- • `client/src/pages/SimpleLanding.tsx` — bg-* (69) @ lines 58,59,60,88,88 | gradient (115) @ lines 58,58,58,58,99
- • `client/src/pages/exchange.tsx` — bg-* (139) @ lines 883,884,885,886,887 | gradient (2) @ lines 314,2128
- • `client/src/pages/direct-connect/DirectConnectShell.tsx` — bg-* (122) @ lines 195,198,201,203,382
- • `client/src/pages/settings.tsx` — bg-* (107) @ lines 762,780,784,791,798 | gradient (12) @ lines 762,762,762,906,906
- • `client/src/pages/marketplace.tsx` — bg-* (73) @ lines 427,436,443,450,457 | gradient (27) @ lines 427,427,427,427,532
- • `client/src/pages/admin-users.tsx` — bg-* (80) @ lines 102,108,114,120,126
- • `client/src/pages/affiliate.tsx` — bg-* (64) @ lines 337,363,531,542,552 | gradient (11) @ lines 337,337,337,337,363
- • `client/src/pages/admin-observability.tsx` — bg-* (58) @ lines 347,349,351,353,373 | gradient (12) @ lines 505,505,505,505,621
- • `client/src/pages/helpers.tsx` — bg-* (69) @ lines 118,120,131,133,135
- • `client/src/pages/accounting.tsx` — bg-* (67) @ lines 657,666,666,690,691
- • `client/src/pages/admin-provision-user.tsx` — bg-* (64) @ lines 333,358,370,382,391
- • `client/src/pages/foundation.tsx` — bg-* (59) @ lines 282,284,286,300,302 | gradient (4) @ lines 300,300,300,300
- • `client/src/pages/tasks.tsx` — bg-* (57) @ lines 510,513,520,529,551
- • `client/src/pages/community-feed.tsx` — bg-* (56) @ lines 232,233,278,279,282
- • `client/src/pages/promotions.tsx` — bg-* (55) @ lines 87,87,88,88,89
- • `client/src/pages/admin-workspace.tsx` — bg-* (54) @ lines 201,208,216,223,231
- • `client/src/pages/contractor-signup.tsx` — bg-* (52) @ lines 193,200,208,218,218
- • `client/src/pages/finances-invoices.tsx` — bg-* (51) @ lines 448,451,454,457,459
- • `client/src/pages/system-settings.tsx` — bg-* (51) @ lines 172,187,190,197,204
- • `client/src/pages/documentation.tsx` — bg-* (34) @ lines 113,119,125,131,141 | gradient (16) @ lines 113,113,113,119,119
- • `client/src/pages/api-integrations.tsx` — bg-* (49) @ lines 157,157,159,159,161
- • `client/src/pages/hoa-management.tsx` — bg-* (45) @ lines 544,551,551,565,576 | gradient (3) @ lines 565,565,565
- • `client/src/pages/platform-analytics.tsx` — bg-* (46) @ lines 235,237,496,511,514 | gradient (2) @ lines 639,759
- • `client/src/pages/admin-business-import.tsx` — bg-* (44) @ lines 635,655,661,661,701 | gradient (2) @ lines 240,296
- • `client/src/pages/referral-dashboard.tsx` — bg-* (46) @ lines 164,177,190,203,218
- • `client/src/pages/social-integration.tsx` — bg-* (46) @ lines 41,50,59,68,77
- • `client/src/pages/SimpleHome.tsx` — bg-* (45) @ lines 109,121,143,158,171
- • `client/src/pages/compliance.tsx` — bg-* (41) @ lines 57,59,61,63,90 | gradient (3) @ lines 68,82,286
- • `client/src/pages/worker-marketplace.tsx` — bg-* (44) @ lines 72,214,214,223,226
- • `client/src/pages/maps.tsx` — bg-* (43) @ lines 66,67,72,73,78
- • `client/src/pages/analytics.tsx` — bg-* (42) @ lines 104,106,108,110,112
- • `client/src/pages/commercial-directory.tsx` — bg-* (35) @ lines 292,294,302,306,310 | gradient (7) @ lines 294,294,294,294,341
- • `client/src/pages/dealer-dashboard.tsx` — bg-* (42) @ lines 53,64,77,88,99
- • `client/src/pages/groups.tsx` — bg-* (23) @ lines 215,229,229,266,279 | gradient (19) @ lines 266,266,266,338,338
