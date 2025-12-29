# UI Surface Audit

Scanned files: **506**
Root violations (min-h-screen + bg-*): **120**
Files with min-h-screen: **123**
Files with bg-* classes: **369**

## Top offenders
- 🚫 `client/src/pages/landing.tsx` — min-h-screen (2) @ lines 70,82 | h-screen (2) @ lines 70,82 | bg-* (1001) @ lines 91,113,122,123,123 | gradient (6) @ lines 717,717,717,745,745
- 🚫 `client/src/pages/SimpleLanding.tsx` — min-h-screen (2) @ lines 53,55 | h-screen (2) @ lines 53,55 | bg-* (69) @ lines 58,59,60,88,88 | gradient (114) @ lines 58,58,58,58,97
- 🚫 `client/src/pages/contractor-signup.tsx` — min-h-screen (2) @ lines 178,214 | h-screen (2) @ lines 178,214 | bg-* (52) @ lines 178,184,191,202,202
- 🚫 `client/src/pages/help.tsx` — min-h-screen (1) @ lines 1254 | h-screen (1) @ lines 1254 | bg-* (53) @ lines 156,272,388,504,588 | gradient (1) @ lines 1268
- 🚫 `client/src/pages/system-settings.tsx` — min-h-screen (1) @ lines 55 | h-screen (1) @ lines 55 | bg-* (51) @ lines 55,70,71,75,79
- 🚫 `client/src/pages/training-center.tsx` — min-h-screen (1) @ lines 171 | h-screen (1) @ lines 171 | bg-* (51) @ lines 160,160,162,162,164
- 🚫 `client/src/pages/api-integrations.tsx` — min-h-screen (1) @ lines 164 | h-screen (1) @ lines 164 | bg-* (49) @ lines 145,145,147,147,149
- 🚫 `client/src/pages/dealer-dashboard.tsx` — min-h-screen (1) @ lines 39 | h-screen (1) @ lines 39 | bg-* (44) @ lines 39,44,56,67,80 | gradient (3) @ lines 39,39,39
- 🚫 `client/src/pages/referral-dashboard.tsx` — min-h-screen (1) @ lines 150 | h-screen (1) @ lines 150 | bg-* (46) @ lines 165,178,191,204,219
- 🚫 `client/src/pages/SimpleHome.tsx` — min-h-screen (1) @ lines 74 | h-screen (1) @ lines 74 | bg-* (46) @ lines 74,91,103,117,132
- 🚫 `client/src/pages/social-integration.tsx` — min-h-screen (1) @ lines 109 | h-screen (1) @ lines 109 | bg-* (46) @ lines 23,32,41,50,59
- 🚫 `client/src/pages/compliance.tsx` — min-h-screen (1) @ lines 76 | h-screen (1) @ lines 76 | bg-* (41) @ lines 46,47,48,49,76 | gradient (3) @ lines 54,68,250
- 🚫 `client/src/pages/Dashboard.tsx` — min-h-screen (4) @ lines 210,231,238,245 | h-screen (4) @ lines 210,231,238,245 | bg-* (38) @ lines 210,238,238,245,245
- 🚫 `client/src/pages/payment-processing.tsx` — min-h-screen (1) @ lines 142 | h-screen (1) @ lines 142 | bg-* (41) @ lines 142,155,156,157,158
- 🚫 `client/src/pages/platform-analytics.tsx` — min-h-screen (1) @ lines 172 | h-screen (1) @ lines 172 | bg-* (39) @ lines 172,185,200,201,202 | gradient (2) @ lines 287,386
- 🚫 `client/src/pages/event-management.tsx` — min-h-screen (1) @ lines 194 | h-screen (1) @ lines 194 | bg-* (38) @ lines 105,105,107,107,109
- 🚫 `client/src/pages/apply-accelerator.tsx` — min-h-screen (1) @ lines 454 | h-screen (1) @ lines 454 | bg-* (37) @ lines 101,110,120,130,139
- 🚫 `client/src/pages/nationwide-expansion.tsx` — min-h-screen (2) @ lines 84,96 | h-screen (2) @ lines 84,96 | bg-* (29) @ lines 101,119,135,151,167 | gradient (6) @ lines 101,101,101,485,485
- 🚫 `client/src/pages/request-quote.tsx` — min-h-screen (2) @ lines 134,182 | h-screen (2) @ lines 134,182 | bg-* (32) @ lines 134,137,140,152,152 | gradient (3) @ lines 188,188,188
- 🚫 `client/src/pages/car-sales-follow-up.tsx` — min-h-screen (1) @ lines 99 | h-screen (1) @ lines 99 | bg-* (32) @ lines 81,82,83,84,90 | gradient (4) @ lines 99,99,99,99
- 🚫 `client/src/components/auth/MasterAdminSetup.tsx` — min-h-screen (1) @ lines 79 | h-screen (1) @ lines 79 | bg-* (19) @ lines 79,81,81,83,86 | gradient (16) @ lines 79,79,79,79,79
- 🚫 `client/src/pages/membership-portal.tsx` — min-h-screen (1) @ lines 104 | h-screen (1) @ lines 104 | bg-* (35) @ lines 118,119,120,121,127
- 🚫 `client/src/pages/resource-center.tsx` — min-h-screen (1) @ lines 147 | h-screen (1) @ lines 147 | bg-* (35) @ lines 136,136,138,138,140
- 🚫 `client/src/pages/ad-creator.tsx` — min-h-screen (1) @ lines 65 | h-screen (1) @ lines 65 | bg-* (17) @ lines 21,27,33,39,83 | gradient (16) @ lines 21,21,21,27,27
- 🚫 `client/src/pages/coffee-company.tsx` — min-h-screen (1) @ lines 10 | h-screen (1) @ lines 10 | bg-* (27) @ lines 14,24,24,27,27 | gradient (6) @ lines 14,14,14,270,270
- 🚫 `client/src/pages/admin-users.tsx` — min-h-screen (2) @ lines 227,238 | h-screen (2) @ lines 227,238 | bg-* (29) @ lines 49,50,51,52,53
- 🚫 `client/src/pages/profile.tsx` — min-h-screen (1) @ lines 100 | h-screen (1) @ lines 100 | bg-* (25) @ lines 100,104,116,120,137 | gradient (6) @ lines 104,104,104,120,120
- 🚫 `client/src/pages/realtor-contacts.tsx` — min-h-screen (1) @ lines 115 | h-screen (1) @ lines 115 | bg-* (27) @ lines 83,84,85,86,87 | gradient (4) @ lines 115,115,115,115
- 🚫 `client/src/pages/admin-error-reports.tsx` — min-h-screen (2) @ lines 153,166 | h-screen (2) @ lines 153,166 | bg-* (28) @ lines 67,68,69,70,71
- 🚫 `client/src/pages/wallet.tsx` — min-h-screen (2) @ lines 151,204 | h-screen (2) @ lines 151,204 | bg-* (19) @ lines 153,219,234,261,282 | gradient (9) @ lines 153,153,153,153,219
- 🚫 `client/src/pages/contractors.tsx` — min-h-screen (1) @ lines 42 | h-screen (1) @ lines 42 | bg-* (23) @ lines 42,53,69,76,107 | gradient (6) @ lines 116,116,116,230,230
- 🚫 `client/src/pages/daily-deals-enhanced.tsx` — min-h-screen (2) @ lines 102,115 | h-screen (2) @ lines 102,115 | bg-* (16) @ lines 106,154,158,199,199 | gradient (11) @ lines 154,154,154,298,298
- 🚫 `client/src/pages/realtor-connections.tsx` — min-h-screen (1) @ lines 129 | h-screen (1) @ lines 129 | bg-* (25) @ lines 110,112,113,114,115 | gradient (4) @ lines 129,129,129,129
- 🚫 `client/src/pages/support-tickets.tsx` — min-h-screen (1) @ lines 115 | h-screen (1) @ lines 115 | bg-* (29) @ lines 115,127,127,136,148
- 🚫 `client/src/pages/file-management.tsx` — min-h-screen (1) @ lines 162 | h-screen (1) @ lines 162 | bg-* (28) @ lines 112,114,116,118,162
- 🚫 `client/src/components/auth/RoleSelection.tsx` — min-h-screen (3) @ lines 77,169,240 | h-screen (3) @ lines 77,169,240 | bg-* (23) @ lines 77,90,90,99,128
- 🚫 `client/src/pages/realtor-appointments.tsx` — min-h-screen (1) @ lines 105 | h-screen (1) @ lines 105 | bg-* (23) @ lines 85,86,87,88,89 | gradient (4) @ lines 105,105,105,105
- 🚫 `client/src/pages/car-sales-appointments.tsx` — min-h-screen (1) @ lines 102 | h-screen (1) @ lines 102 | bg-* (22) @ lines 85,86,87,88,102 | gradient (4) @ lines 102,102,102,102
- 🚫 `client/src/pages/profile-setup.tsx` — min-h-screen (2) @ lines 119,126 | h-screen (2) @ lines 119,126 | bg-* (24) @ lines 119,126,136,140,159
- 🚫 `client/src/components/auth/OnboardingFlow.tsx` — min-h-screen (1) @ lines 58 | h-screen (1) @ lines 58 | bg-* (25) @ lines 58,81,99,109,121
