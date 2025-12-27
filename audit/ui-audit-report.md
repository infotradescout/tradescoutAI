# TradeScout UI Audit Report
Generated: 2025-12-27T04:16:22.219Z

## Totals
- Files scanned: 629
- Hardcoded HEX refs: 398
- Hardcoded RGB/RGBA refs: 71
- Tailwind color utility refs: 10894
- Tailwind blue/sky/indigo refs: 808
- Theme var usage refs: 0
- Theme CSS declarations refs: 1

## Top hardcoded color offenders (HEX/RGB)
| file | hex | rgb | themeVar | bytes |
| --- | --- | --- | --- | --- |
| client/src/index.css | 34 | 52 | 0 | 33778 |
| client/src/lib/themes.ts | 69 | 0 | 0 | 8997 |
| shared/colorPresets.ts | 54 | 0 | 0 | 4920 |
| client/src/pages/PublicProfileView.tsx | 25 | 0 | 0 | 29357 |
| client/src/pages/nationwide-expansion.tsx | 19 | 0 | 0 | 28367 |
| client/src/components/layout/navigation.tsx | 16 | 0 | 0 | 27091 |
| client/src/lib/floatingNotes.ts | 16 | 0 | 0 | 6505 |
| client/src/pages/about.tsx | 9 | 0 | 0 | 14148 |
| client/src/pages/ad-creator.tsx | 9 | 0 | 0 | 15473 |
| client/src/pages/leaderboard.tsx | 9 | 0 | 0 | 15577 |
| client/src/pages/SimpleLanding.tsx | 9 | 0 | 0 | 28026 |
| client/src/pages/conversations.tsx | 8 | 0 | 0 | 18613 |
| client/src/components/TradeScoutIcons.tsx | 2 | 5 | 0 | 6298 |
| client/src/pages/verification.tsx | 7 | 0 | 0 | 17904 |
| client/src/App.tsx | 5 | 1 | 0 | 53822 |
| client/src/components/onboarding/OnboardingTour.tsx | 0 | 6 | 0 | 10641 |
| client/src/pages/admin-panel.tsx | 6 | 0 | 0 | 67444 |
| client/src/pages/background-check.tsx | 6 | 0 | 0 | 13860 |
| client/src/components/layout/AppShell.tsx | 5 | 0 | 0 | 15854 |
| client/src/components/tutorial/TutorialOverlay.tsx | 1 | 4 | 0 | 9457 |
| client/src/components/ui/chart.tsx | 5 | 0 | 0 | 10480 |
| client/src/pages/address-verification.tsx | 5 | 0 | 0 | 17828 |
| client/src/pages/contact.tsx | 5 | 0 | 0 | 14949 |
| server/notification-service.ts | 5 | 0 | 0 | 27723 |
| client/src/pages/admin-error-reports.tsx | 4 | 0 | 0 | 16578 |
| client/src/pages/checkout.tsx | 4 | 0 | 0 | 13690 |
| client/src/pages/CommunityProfile.tsx | 4 | 0 | 0 | 7464 |
| client/src/pages/group-detail.tsx | 4 | 0 | 0 | 11256 |
| client/src/pages/test-page.tsx | 4 | 0 | 0 | 4583 |
| client/src/components/ConstructionEmblem.tsx | 3 | 0 | 0 | 16448 |
| client/src/pages/admin-create-account.tsx | 3 | 0 | 0 | 14277 |
| client/src/pages/CommunityOsLanding.tsx | 3 | 0 | 0 | 8372 |
| client/src/pages/handmade-marketplace.tsx | 3 | 0 | 0 | 12957 |
| client/src/pages/insurance-agent-dashboard.tsx | 3 | 0 | 0 | 9759 |
| client/src/pages/license-verification.tsx | 3 | 0 | 0 | 13480 |
| client/src/pages/RoleDirectory.tsx | 3 | 0 | 0 | 11623 |
| client/src/pages/settings.tsx | 3 | 0 | 0 | 57035 |
| client/src/pages/admin-address-verifications.tsx | 2 | 0 | 0 | 18112 |
| client/src/pages/admin-users.tsx | 2 | 0 | 0 | 23111 |
| client/src/pages/application-tracker.tsx | 2 | 0 | 0 | 15161 |

## Top Tailwind color utility offenders
| file | twColors | twBlue | themeVar | bytes |
| --- | --- | --- | --- | --- |
| client/src/pages/accounting.tsx | 310 | 5 | 0 | 82297 |
| client/src/pages/marketplace.tsx | 255 | 27 | 0 | 59127 |
| client/src/pages/exchange.tsx | 161 | 16 | 0 | 55955 |
| client/src/pages/SimpleLanding.tsx | 152 | 20 | 0 | 28026 |
| client/src/pages/nationwide-expansion.tsx | 145 | 15 | 0 | 28367 |
| client/src/pages/foundation.tsx | 143 | 4 | 0 | 30894 |
| client/src/pages/settings.tsx | 134 | 0 | 0 | 57035 |
| client/src/pages/admin-panel.tsx | 133 | 3 | 0 | 67444 |
| client/src/components/dashboard/DashboardWidgets.tsx | 129 | 5 | 0 | 20917 |
| client/src/pages/affiliate.tsx | 129 | 8 | 0 | 26031 |
| client/src/pages/hoa-management.tsx | 124 | 6 | 0 | 33594 |
| client/src/pages/helpers.tsx | 123 | 3 | 0 | 34493 |
| client/src/pages/admin-workspace.tsx | 122 | 6 | 0 | 34783 |
| client/src/pages/analytics.tsx | 113 | 7 | 0 | 20506 |
| client/src/pages/community-feed.tsx | 105 | 4 | 0 | 44295 |
| client/src/pages/verification.tsx | 105 | 12 | 0 | 17904 |
| client/src/pages/promotions.tsx | 101 | 3 | 0 | 18868 |
| client/src/pages/contractor-accelerator.tsx | 94 | 0 | 0 | 20546 |
| client/src/pages/SimpleHome.tsx | 86 | 1 | 0 | 25882 |
| client/src/components/auth/OnboardingFlow.tsx | 85 | 9 | 0 | 17802 |
| client/src/pages/application-tracker.tsx | 83 | 13 | 0 | 15161 |
| client/src/pages/documentation.tsx | 82 | 3 | 0 | 17639 |
| client/src/pages/training-center.tsx | 82 | 8 | 0 | 24743 |
| client/src/components/InteractiveCountyMap.tsx | 81 | 10 | 0 | 21343 |
| client/src/components/layout/navigation.tsx | 81 | 3 | 0 | 27091 |
| client/src/pages/accelerator.tsx | 79 | 0 | 0 | 10967 |
| client/src/pages/referral-dashboard.tsx | 79 | 4 | 0 | 25036 |
| client/src/pages/api-integrations.tsx | 78 | 1 | 0 | 24053 |
| client/src/pages/dealer-dashboard.tsx | 75 | 5 | 0 | 21619 |
| client/src/pages/groups.tsx | 73 | 8 | 0 | 21150 |
| client/src/pages/wallet.tsx | 73 | 0 | 0 | 21915 |
| client/src/lib/colors.ts | 70 | 9 | 0 | 3452 |
| client/src/pages/Dashboard.tsx | 70 | 1 | 0 | 20892 |
| client/src/pages/ad-creator.tsx | 69 | 7 | 0 | 15473 |
| client/src/pages/admin-professional-verification.tsx | 69 | 8 | 0 | 27110 |
| client/src/pages/license-verification.tsx | 68 | 8 | 0 | 13480 |
| client/src/pages/admin-create-account.tsx | 67 | 0 | 0 | 14277 |
| client/src/pages/contractors.tsx | 67 | 6 | 0 | 11553 |
| client/src/pages/leaderboard.tsx | 65 | 0 | 0 | 15577 |
| client/src/components/auth/RoleSelection.tsx | 64 | 13 | 0 | 13960 |

## Top blue/sky/indigo offenders
| file | twBlue | twColors | bytes |
| --- | --- | --- | --- |
| client/src/pages/marketplace.tsx | 27 | 255 | 59127 |
| client/src/pages/realtor-application.tsx | 21 | 38 | 18286 |
| client/src/pages/SimpleLanding.tsx | 20 | 152 | 28026 |
| client/src/pages/exchange.tsx | 16 | 161 | 55955 |
| client/src/pages/realtor-appointments.tsx | 16 | 34 | 12322 |
| client/src/pages/nationwide-expansion.tsx | 15 | 145 | 28367 |
| client/src/components/auth/RoleSelection.tsx | 13 | 64 | 13960 |
| client/src/pages/application-tracker.tsx | 13 | 83 | 15161 |
| client/src/components/professional-badges.tsx | 12 | 31 | 3855 |
| client/src/pages/address-verification.tsx | 12 | 52 | 17828 |
| client/src/pages/community-vaults.tsx | 12 | 54 | 12041 |
| client/src/pages/verification.tsx | 12 | 105 | 17904 |
| client/src/pages/community-builder/dashboard.tsx | 11 | 56 | 13557 |
| client/src/components/auth/MasterAdminSetup.tsx | 10 | 50 | 9248 |
| client/src/components/InteractiveCountyMap.tsx | 10 | 81 | 21343 |
| client/src/components/social/ReportModal.tsx | 10 | 10 | 11512 |
| client/src/components/AddressVerificationBanner.tsx | 9 | 27 | 4555 |
| client/src/components/auth/OnboardingFlow.tsx | 9 | 85 | 17802 |
| client/src/components/floating-help-button.tsx | 9 | 22 | 6075 |
| client/src/lib/colors.ts | 9 | 70 | 3452 |
| client/src/pages/car-sales-customers.tsx | 9 | 33 | 11844 |
| client/src/pages/realtor-calculator.tsx | 9 | 39 | 15465 |
| client/src/pages/admin-professional-verification.tsx | 8 | 69 | 27110 |
| client/src/pages/affiliate.tsx | 8 | 129 | 26031 |
| client/src/pages/daily-deals-enhanced.tsx | 8 | 53 | 13152 |
| client/src/pages/groups.tsx | 8 | 73 | 21150 |
| client/src/pages/insurance-verification.tsx | 8 | 52 | 10128 |
| client/src/pages/license-verification.tsx | 8 | 68 | 13480 |
| client/src/pages/training-center.tsx | 8 | 82 | 24743 |
| client/src/components/auth/FacebookSignup.tsx | 7 | 43 | 7198 |
| client/src/components/ui/help-bubble.tsx | 7 | 19 | 4568 |
| client/src/pages/ad-creator.tsx | 7 | 69 | 15473 |
| client/src/pages/admin/community-builder-admin.tsx | 7 | 22 | 11689 |
| client/src/pages/analytics.tsx | 7 | 113 | 20506 |
| client/src/pages/checkout.tsx | 7 | 21 | 13690 |
| client/src/pages/contact.tsx | 7 | 62 | 14949 |
| client/src/pages/contractor-leads.tsx | 7 | 44 | 10719 |
| client/src/pages/group-detail.tsx | 7 | 37 | 11256 |
| client/src/pages/handmade-marketplace.tsx | 7 | 20 | 12957 |
| client/src/pages/property-manager-dashboard.tsx | 7 | 62 | 18136 |

## Largest files (often UI complexity hotspots)
| file | bytes | lines | twColors | hex | themeVar |
| --- | --- | --- | --- | --- | --- |
| client/src/pages/landing.tsx | 91733 | 780 | 27 | 0 | 0 |
| client/src/pages/accounting.tsx | 82297 | 1821 | 310 | 0 | 0 |
| client/src/scout/ScoutOS.tsx | 75511 | 2055 | 3 | 0 | 0 |
| client/src/pages/admin-panel.tsx | 67444 | 1617 | 133 | 6 | 0 |
| client/src/pages/help.tsx | 59509 | 1568 | 59 | 2 | 0 |
| client/src/pages/marketplace.tsx | 59127 | 1365 | 255 | 0 | 0 |
| client/src/pages/settings.tsx | 57035 | 1178 | 134 | 3 | 0 |
| client/src/pages/exchange.tsx | 55955 | 1228 | 161 | 0 | 0 |
| client/src/App.tsx | 53822 | 1023 | 3 | 5 | 0 |
| client/src/pages/community-feed.tsx | 44295 | 1014 | 105 | 0 | 0 |
| client/src/pages/admin-workspace.tsx | 34783 | 773 | 122 | 0 | 0 |
| client/src/pages/helpers.tsx | 34493 | 728 | 123 | 0 | 0 |
| client/src/pages/CrmDashboard.tsx | 33797 | 794 | 5 | 0 | 0 |
| client/src/index.css | 33778 | 1503 | 40 | 34 | 0 |
| client/src/pages/hoa-management.tsx | 33594 | 768 | 124 | 0 | 0 |
| client/src/components/RecommendationGenerator.tsx | 32311 | 802 | 55 | 0 | 0 |
| client/src/pages/worker-marketplace.tsx | 32267 | 780 | 61 | 1 | 0 |
| client/src/pages/foundation.tsx | 30894 | 696 | 143 | 0 | 0 |
| client/src/pages/contractor-signup.tsx | 30259 | 675 | 46 | 0 | 0 |
| client/src/pages/finances-invoices.tsx | 29357 | 719 | 7 | 0 | 0 |
| client/src/pages/PublicProfileView.tsx | 29357 | 772 | 0 | 25 | 0 |
| client/src/components/jobs/DealRoomPanel.tsx | 28622 | 771 | 63 | 0 | 0 |
| client/src/pages/nationwide-expansion.tsx | 28367 | 531 | 145 | 19 | 0 |
| client/src/pages/SimpleLanding.tsx | 28026 | 447 | 152 | 9 | 0 |
| server/notification-service.ts | 27723 | 823 | 0 | 5 | 0 |
| client/src/pages/business-listing.tsx | 27406 | 701 | 22 | 0 | 0 |
| client/src/pages/admin-professional-verification.tsx | 27110 | 602 | 69 | 0 | 0 |
| client/src/components/layout/navigation.tsx | 27091 | 534 | 81 | 16 | 0 |
| client/src/pages/affiliate.tsx | 26031 | 583 | 129 | 0 | 0 |
| client/src/pages/profile-setup.tsx | 25905 | 572 | 45 | 1 | 0 |
| client/src/pages/SimpleHome.tsx | 25882 | 578 | 86 | 0 | 0 |
| client/src/pages/referral-dashboard.tsx | 25036 | 571 | 79 | 0 | 0 |
| client/src/pages/training-center.tsx | 24743 | 542 | 82 | 0 | 0 |
| client/src/pages/contractor-apply.tsx | 24469 | 533 | 55 | 0 | 0 |
| client/src/pages/api-integrations.tsx | 24053 | 540 | 78 | 0 | 0 |
| client/src/pages/chat.tsx | 23972 | 615 | 37 | 0 | 0 |
| client/src/pages/system-settings.tsx | 23214 | 492 | 45 | 0 | 0 |
| client/src/pages/admin-users.tsx | 23111 | 502 | 48 | 2 | 0 |
| client/src/pages/create-account.tsx | 22993 | 563 | 13 | 0 | 0 |
| client/src/pages/ProfilePage.tsx | 22830 | 556 | 13 | 0 | 0 |

## How to use this report
- Start with **Top blue offenders** and remove hardcoded Tailwind blues in favor of theme tokens / CSS vars.
- Then eliminate **hardcoded HEX/RGB** in components/pages (convert to theme vars).
- Finally, standardize shared shells (e.g., CommunityShell usage) and shared components (buttons/cards/tabs).
