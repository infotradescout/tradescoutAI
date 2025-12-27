# TradeScout Media Progress Audit

Generated: 2025-12-27T04:34:06.210Z

Root: `C:/Users/FlavorGood/Documents/AAATraderCorner/TradeScout/TradeScoutPro`


## High-level signal counts

| signal | total |
| --- | --- |
| AWS SDK | 3 |
| S3-compatible | 13 |
| Cloudflare R2 | 2 |
| Presigned URL | 5 |
| Multer/FormData | 50 |
| Sharp/image processing | 3 |
| Image mime validation | 7 |
| media_assets table mention | 4 |
| avatar field mention | 116 |
| cover photo mention | 58 |
| gallery mention | 14 |
| post image mention | 6 |
| media API route | 0 |
| profile upload route | 0 |
| exchange image route | 0 |
| community image route | 0 |
| Bucket env vars | 10 |


## Top files by media-related signals

| file | total |
| --- | --- |
| scripts/media_audit.mjs | 51 |
| package-lock.json | 16 |
| client/src/pages/community-feed.tsx | 15 |
| assets/index-CfDzoXo3.js | 15 |
| .config/.semgrep/semgrep_rules.json | 13 |
| .config/replit/.semgrep/semgrep_rules.json | 13 |
| services/db.ts | 9 |
| client/src/pages/manage-users.tsx | 6 |
| server/routes.ts | 6 |
| client/src/agent/tools/connections.ts | 5 |
| client/src/pages/CommunityProfile.tsx | 5 |
| client/src/pages/support-tickets.tsx | 5 |
| client/src/components/community/CommunityPostCard.tsx | 5 |
| client/package-lock.json | 4 |
| client/src/components/LoadingSkeleton.tsx | 4 |
| client/src/pages/community.tsx | 4 |
| client/src/pages/content-moderation.tsx | 4 |
| __trash_candidate__/docs/PREEXISTING_DEFECTS_LIST.md | 4 |
| client/src/pages/admin-panel.tsx | 4 |
| components/ContractorCard.tsx | 4 |
| client/src/pages/Dashboard.tsx | 4 |
| client/src/pages/resource-center.tsx | 3 |
| client/src/pages/saved-contractors.tsx | 3 |
| components/AdminDashboard.tsx | 3 |
| package.json | 3 |
| client/src/components/community/CommunityComposerInline.tsx | 3 |
| __trash_candidate__/docs/IMPLEMENTATION_GAP_ANALYSIS.md | 2 |
| client/src/components/admin/UserManagement.tsx | 2 |
| client/src/components/auth/RoleSelection.tsx | 2 |
| client/src/components/EnhancedAdSystem.tsx | 2 |
| client/src/pages/exchange.tsx | 2 |
| client/src/pages/file-management.tsx | 2 |
| client/src/pages/training-center.tsx | 2 |
| components/Header.tsx | 2 |
| legacy/App-legacy.tsx | 2 |
| server/storage.ts | 2 |
| types.ts | 2 |
| client/src/components/BugReportTool.tsx | 2 |
| client/src/components/HelperProfileModal.tsx | 2 |
| client/src/components/social/PostCard.tsx | 2 |


## Likely schema/migration files

| file |
| --- |
| drizzle.config.ts |
| migrations/0000_wild_saracen.sql |
| migrations/0001_community_builder.sql |
| migrations/0002_add_user_badges.sql |
| migrations/0003_business_profiles.sql |
| migrations/0004_profiles.sql |
| migrations/0005_documents.sql |
| migrations/0006_extend_documents_types.sql |
| migrations/0007_add_geo_to_marketplace_listings.sql |
| migrations/0008_add_location_visibility_to_marketplace_listings.sql |
| migrations/0009_capability_bundles_on_users.sql |
| migrations/meta/0000_snapshot.json |
| migrations/meta/_journal.json |
| migrations/_all_neon_setup.sql |
| shared/schema.ts |
| shared/tutorial-schema.ts |
| src/db/drizzle-mock.ts |
| __trash_candidate__/docs/NO_MOCK_DATA_MIGRATION.md |


## Likely route files

| file |
| --- |
| client/src/lib/routes.ts |
| client/src/scout/api.ts |
| server/crm-routes.ts |
| server/routes/admin-community-builder-routes.ts |
| server/routes/analytics-routes.ts |
| server/routes/community-builder-routes.ts |
| server/routes/community-causes-routes.ts |
| server/routes/community-vault-routes.ts |
| server/routes/notification-routes.ts |
| server/routes/platform-support-routes.ts |
| server/routes.ts |
| server/social-routes.ts |


## Likely profile/media UI files

| file |
| --- |
| client/src/pages/CommunityProfile.tsx |
| client/src/pages/PublicProfileView.tsx |


## Route line hits (where media endpoints may already exist)

_None found._


## Storage line hits (S3/R2/presign/multer/sharp clues)

| file | line | text |
| --- | --- | --- |
| .config/.semgrep/semgrep_rules.json | 9520 |         "csharp", |
| .config/.semgrep/semgrep_rules.json | 51448 |       "id": "replit-rules.javascript.multer.security.audit.multer-vulnerable-version-check", |
| .config/.semgrep/semgrep_rules.json | 51467 |           "https://github.com/expressjs/multer/issues/1233", |
| .config/.semgrep/semgrep_rules.json | 51468 |           "https://github.com/expressjs/multer/pull/1256", |
| .config/.semgrep/semgrep_rules.json | 51475 |           "multer", |
| .config/.semgrep/semgrep_rules.json | 51490 |               "pattern-regex": "\"multer\"\\s*:\\s*\"[\\^~]?[01]\\.\\d+\\.\\d+(-\\w+\\.\\d+)?\"" |
| .config/.semgrep/semgrep_rules.json | 51493 |               "pattern-regex": "\"multer\"\\s*:\\s*\"[\\^~]?2\\.0\\.0\"" |
| .config/.semgrep/semgrep_rules.json | 51496 |               "pattern-regex": "\"multer\"\\s*:\\s*\"(latest|\\*)\"" |
| .config/.semgrep/semgrep_rules.json | 51499 |               "pattern-regex": "\"multer\"\\s*:\\s*\">=?\\s*[01]\\.\\d+\"" |
| .config/.semgrep/semgrep_rules.json | 51502 |               "pattern-regex": "\"multer\"\\s*:\\s*\">=?\\s*2\\.0\\.0\"" |
| .config/replit/.semgrep/semgrep_rules.json | 9520 |         "csharp", |
| .config/replit/.semgrep/semgrep_rules.json | 51448 |       "id": "replit-rules.javascript.multer.security.audit.multer-vulnerable-version-check", |
| .config/replit/.semgrep/semgrep_rules.json | 51467 |           "https://github.com/expressjs/multer/issues/1233", |
| .config/replit/.semgrep/semgrep_rules.json | 51468 |           "https://github.com/expressjs/multer/pull/1256", |
| .config/replit/.semgrep/semgrep_rules.json | 51475 |           "multer", |
| .config/replit/.semgrep/semgrep_rules.json | 51490 |               "pattern-regex": "\"multer\"\\s*:\\s*\"[\\^~]?[01]\\.\\d+\\.\\d+(-\\w+\\.\\d+)?\"" |
| .config/replit/.semgrep/semgrep_rules.json | 51493 |               "pattern-regex": "\"multer\"\\s*:\\s*\"[\\^~]?2\\.0\\.0\"" |
| .config/replit/.semgrep/semgrep_rules.json | 51496 |               "pattern-regex": "\"multer\"\\s*:\\s*\"(latest|\\*)\"" |
| .config/replit/.semgrep/semgrep_rules.json | 51499 |               "pattern-regex": "\"multer\"\\s*:\\s*\">=?\\s*[01]\\.\\d+\"" |
| .config/replit/.semgrep/semgrep_rules.json | 51502 |               "pattern-regex": "\"multer\"\\s*:\\s*\">=?\\s*2\\.0\\.0\"" |
| assets/index-CfDzoXo3.js | 43 | `,oU="∄",sU="∄",lU="𝔑",aU="𝔫",cU="≧̸",uU="≱",fU="≱",dU="≧̸",hU="⩾̸",pU="⩾̸",gU="⋙̸",mU="≵",vU="≫⃒",yU="≯",bU="≯",wU="≫̸",xU="↮",kU="⇎",SU="⫲",_U="∋",TU="⋼",CU="⋺",EU="∋",AU="Њ",LU="њ",MU="↚",NU="⇍", |
| client/src/components/ui/contextual-tooltip.tsx | 76 |     content: "These tools are sharper than your favorite chisel and twice as useful.", |
| package-lock.json | 91 |         "multer": "^2.0.2", |
| package-lock.json | 132 |         "@types/multer": "^1.4.11", |
| package-lock.json | 4429 |     "node_modules/@types/multer": { |
| package-lock.json | 4431 |       "resolved": "https://registry.npmjs.org/@types/multer/-/multer-1.4.13.tgz", |
| package-lock.json | 7074 |         "@aws-sdk/client-rds-data": ">=3", |
| package-lock.json | 7104 |         "@aws-sdk/client-rds-data": { |
| package-lock.json | 10012 |     "node_modules/multer": { |
| package-lock.json | 10014 |       "resolved": "https://registry.npmjs.org/multer/-/multer-2.0.2.tgz", |
| package.json | 104 |     "multer": "^2.0.2", |
| package.json | 145 |     "@types/multer": "^1.4.11", |
| scripts/media_audit.mjs | 122 |   { name: "AWS SDK", re: /\b(@aws-sdk\/|AWS\.S3|new S3\b|s3Client\b)\b/g }, |
| scripts/media_audit.mjs | 123 |   { name: "S3-compatible", re: /\bS3_ENDPOINT\b|\bR2\b|\bBackblaze\b|\bB2\b|\bMINIO\b/g }, |
| scripts/media_audit.mjs | 124 |   { name: "Cloudflare R2", re: /\bcloudflare\b.*\br2\b|\bR2_BUCKET\b/g }, |
| scripts/media_audit.mjs | 125 |   { name: "Presigned URL", re: /\bpresign(ed)?\b|\bgetSignedUrl\b|\bcreatePresignedPost\b/g }, |
| scripts/media_audit.mjs | 126 |   { name: "Multer/FormData", re: /\bmulter\b|\bformidable\b|\bbusboy\b|\bFormData\b/g }, |
| scripts/media_audit.mjs | 127 |   { name: "Sharp/image processing", re: /\bsharp\b|\bimage\/(resize|thumbnail)\b/g }, |
| scripts/media_audit.mjs | 144 |   { name: "Bucket env vars", re: /\b(S3_BUCKET|R2_BUCKET|BUCKET_NAME|AWS_REGION|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|S3_ENDPOINT)\b/g }, |
| scripts/media_audit.mjs | 157 |   /(getSignedUrl|presign|createPresignedPost|new S3|@aws-sdk\/|multer|sharp|R2_BUCKET|S3_BUCKET|S3_ENDPOINT)/, |
| scripts/media_audit.mjs | 233 | out.push(section("Storage line hits (S3/R2/presign/multer/sharp clues)")); |
| scripts/media_audit.mjs | 246 | console.log(`Tip: open MEDIA_AUDIT_REPORT.md and search for 'presign', 'media_assets', 'avatar', 'cover', 'gallery'.`); |
| server/routes.ts | 6066 |       const multer = (await import("multer")).default; |
| server/routes.ts | 6070 |       const upload = multer({ dest: uploadDir }).array("files", 50); |


## Schema line hits (tables/fields: avatar/cover/gallery/media_assets)

| file | line | text |
| --- | --- | --- |
| .config/.semgrep/semgrep_rules.json | 3311 |             "regex": "(?!(?i).*(client|endpoint|vpn|_ec2_|aws_|authorize|author|define|config|credential|setting|sample|xxxxxx|000000|buffer|delete|aaaaaa|fewfwef|getenv|env_|system|example|ecdsa|sha2 |
| .config/.semgrep/semgrep_rules.json | 23466 |       "message": "The call to 'createDecipheriv' with the Galois Counter Mode (GCM) mode of operation is missing an expected authentication tag length. If the expected authentication tag length is not |
| .config/.semgrep/semgrep_rules.json | 28095 |       "message": "The Django secret key is used as salt in HashIDs. The HashID mechanism is not secure. By observing sufficient HashIDs, the salt used to construct them can be recovered. This means th |
| .config/.semgrep/semgrep_rules.json | 28200 |           "https://blog.bitdiscovery.com/2021/12/python-nan-injection/" |
| .config/.semgrep/semgrep_rules.json | 35052 |       "message": "The Flask secret key is used as salt in HashIDs. The HashID mechanism is not secure. By observing sufficient HashIDs, the salt used to construct them can be recovered. This means the |
| .config/.semgrep/semgrep_rules.json | 36326 |           "https://blog.bitdiscovery.com/2021/12/python-nan-injection/" |
| .config/.semgrep/semgrep_rules.json | 51540 |       "message": "Detected a hardcoded authentication bypass mechanism. This code checks request headers against\nhardcoded string literals that appear to bypass normal authentication flows. This crea |
| .config/replit/.semgrep/semgrep_rules.json | 3311 |             "regex": "(?!(?i).*(client|endpoint|vpn|_ec2_|aws_|authorize|author|define|config|credential|setting|sample|xxxxxx|000000|buffer|delete|aaaaaa|fewfwef|getenv|env_|system|example|ecdsa|sha2 |
| .config/replit/.semgrep/semgrep_rules.json | 23466 |       "message": "The call to 'createDecipheriv' with the Galois Counter Mode (GCM) mode of operation is missing an expected authentication tag length. If the expected authentication tag length is not |
| .config/replit/.semgrep/semgrep_rules.json | 28095 |       "message": "The Django secret key is used as salt in HashIDs. The HashID mechanism is not secure. By observing sufficient HashIDs, the salt used to construct them can be recovered. This means th |
| .config/replit/.semgrep/semgrep_rules.json | 28200 |           "https://blog.bitdiscovery.com/2021/12/python-nan-injection/" |
| .config/replit/.semgrep/semgrep_rules.json | 35052 |       "message": "The Flask secret key is used as salt in HashIDs. The HashID mechanism is not secure. By observing sufficient HashIDs, the salt used to construct them can be recovered. This means the |
| .config/replit/.semgrep/semgrep_rules.json | 36326 |           "https://blog.bitdiscovery.com/2021/12/python-nan-injection/" |
| .config/replit/.semgrep/semgrep_rules.json | 51540 |       "message": "Detected a hardcoded authentication bypass mechanism. This code checks request headers against\nhardcoded string literals that appear to bypass normal authentication flows. This crea |
| assets/index-CfDzoXo3.js | 19 | `).map(t=>yA(t)).filter(Rw)}class kA{_encoded;_decoded;_decodedMemo;url;version;names=[];resolvedSources;constructor(t,r){this.map=t;const{mappings:o,names:s,sources:c}=t;this.version=t.version,this.n |
| assets/index-CfDzoXo3.js | 23 | `?(we=H.appendChild(k("span",oe[0]=="\r"?"␍":"␤","cm-invalidchar")),we.setAttribute("cm-text",oe[0]),n.col+=1):(we=n.cm.options.specialCharPlaceholder(oe[0]),we.setAttribute("cm-text",oe[0]),h&&p<9?H. |
| assets/index-CfDzoXo3.js | 28 |                          left: `+i.left+"px; width: "+Math.max(2,i.right-i.left)+"px;");n.display.lineSpace.appendChild(y),y.scrollIntoView(u),n.display.lineSpace.removeChild(y)}}}function Sk(n,i,a,l) |
| assets/index-CfDzoXo3.js | 30 | `,"start")},toggleOverwrite:function(n){return n.toggleOverwrite()}};function km(n,i){var a=qe(n.doc,i),l=Sr(a);return l!=a&&(i=A(l)),td(!0,n,l,i,1)}function cS(n,i){var a=qe(n.doc,i),l=V1(a);return l |
| assets/index-CfDzoXo3.js | 44 | In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}var B=!0,ae=!1,be;return{s:function(){C=C.call(L)},n:function(){var He=C.next();return B=He.done,He},e:function(He) |
| assets/index-CfDzoXo3.js | 49 | In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function fye(e){var t;return typeof e=="function"?t={callback:e}:t=e,t}function dye(e,t){var r=arguments.length>2&& |
| assets/index-DlhE0rqZ.css | 1 | .CodeMirror-simplescroll-horizontal div,.CodeMirror-simplescroll-vertical div{position:absolute;background:#ccc;-moz-box-sizing:border-box;box-sizing:border-box;border:1px solid #bbb;border-radius:2px |
| client/package-lock.json | 12 |         "@radix-ui/react-avatar": "^1.1.11", |
| client/package-lock.json | 941 |     "node_modules/@radix-ui/react-avatar": { |
| client/package-lock.json | 943 |       "resolved": "https://registry.npmjs.org/@radix-ui/react-avatar/-/react-avatar-1.1.11.tgz", |
| client/package.json | 13 |     "@radix-ui/react-avatar": "^1.1.11", |
| client/src/agent/tools/connections.ts | 5 | 	avatarUrl?: string | null; |
| client/src/agent/tools/connections.ts | 61 | 		avatarUrl: item.avatarUrl ?? null, |
| client/src/agent/tools/connections.ts | 86 | 		avatarUrl: item.avatarUrl ?? null, |
| client/src/components/AdDisplay.tsx | 162 |                 className="w-full h-32 object-cover rounded-lg" |
| client/src/components/admin/UserManagement.tsx | 236 |                               className="w-8 h-8 rounded-full object-cover" |
| client/src/components/admin/UserManagement.tsx | 334 |                     className="w-12 h-12 rounded-full object-cover" |
| client/src/components/AffiliateIntegration.tsx | 112 |                     className="w-full h-full object-cover" |
| client/src/components/auth/RoleSelection.tsx | 183 |                     className="w-8 h-8 rounded-full object-cover" |
| client/src/components/auth/RoleSelection.tsx | 254 |                   className="w-8 h-8 rounded-full object-cover" |
| client/src/components/community/CommunityComposerInline.tsx | 4 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/community/CommunityComposerInline.tsx | 13 |   userAvatarUrl?: string; |
| client/src/components/community/CommunityComposerInline.tsx | 35 |   userAvatarUrl, |
| client/src/components/community/CommunityComposerInline.tsx | 92 |       <Avatar className="h-11 w-11 sm:h-12 sm:w-12 ring-2 ring-orange-500/40"> |
| client/src/components/community/CommunityComposerInline.tsx | 93 |         <AvatarImage src={userAvatarUrl} /> |
| client/src/components/community/CommunityComposerInline.tsx | 94 |         <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-lg font-semibold"> |
| client/src/components/community/CommunityComposerInline.tsx | 96 |         </AvatarFallback> |
| client/src/components/community/CommunityComposerInline.tsx | 97 |       </Avatar> |
| client/src/components/community/CommunityComposerInline.tsx | 147 |                   className="w-full h-full object-cover" |
| client/src/components/community/CommunityPostCard.tsx | 2 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/community/CommunityPostCard.tsx | 31 |   avatar?: string; |
| client/src/components/community/CommunityPostCard.tsx | 277 |                 <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-orange-500/40 group-hover:ring-orange-400/70"> |
| client/src/components/community/CommunityPostCard.tsx | 278 |                   <AvatarImage src={post.author.avatar} /> |
| client/src/components/community/CommunityPostCard.tsx | 279 |                   <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold"> |
| client/src/components/community/CommunityPostCard.tsx | 281 |                   </AvatarFallback> |
| client/src/components/community/CommunityPostCard.tsx | 282 |                 </Avatar> |
| client/src/components/community/CommunityPostCard.tsx | 315 |                 <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-orange-500/40"> |
| client/src/components/community/CommunityPostCard.tsx | 316 |                   <AvatarImage src={post.author?.avatar} /> |
| client/src/components/community/CommunityPostCard.tsx | 317 |                   <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold"> |
| client/src/components/community/CommunityPostCard.tsx | 319 |                   </AvatarFallback> |
| client/src/components/community/CommunityPostCard.tsx | 320 |                 </Avatar> |
| client/src/components/contractor-card-skeleton.tsx | 8 |           {/* Avatar skeleton */} |
| client/src/components/contractor-card.tsx | 34 |   // Generate company initials for avatar |
| client/src/components/contractor-card.tsx | 47 |         {/* Company Avatar + Rating */} |
| client/src/components/dashboard/DashboardWidgets.tsx | 4 | import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; |
| client/src/components/dashboard/DashboardWidgets.tsx | 157 |               <Avatar className="h-10 w-10"> |
| client/src/components/dashboard/DashboardWidgets.tsx | 158 |                 <AvatarFallback className="bg-orange-500 text-white text-xs"> |
| client/src/components/dashboard/DashboardWidgets.tsx | 160 |                 </AvatarFallback> |
| client/src/components/dashboard/DashboardWidgets.tsx | 161 |               </Avatar> |
| client/src/components/EnhancedAdSystem.tsx | 179 |             <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" /> |
| client/src/components/EnhancedAdSystem.tsx | 208 |               <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" /> |
| client/src/components/EnhancedAdSystem.tsx | 298 |       description: 'Get comprehensive contractor insurance coverage starting at $49/month', |
| client/src/components/floating-help-button.tsx | 41 |       description: 'Discover how to save with daily deals', |
| client/src/components/GeographicSEO.tsx | 152 |  * Service area coverage component for contractors |
| client/src/components/HelperProfileModal.tsx | 6 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/HelperProfileModal.tsx | 110 |             <Avatar className="h-20 w-20"> |
| client/src/components/HelperProfileModal.tsx | 111 |               <AvatarImage src={helper.profileImageUrl} /> |
| client/src/components/HelperProfileModal.tsx | 112 |               <AvatarFallback className="bg-accent text-accent-foreground text-lg"> |
| client/src/components/HelperProfileModal.tsx | 114 |               </AvatarFallback> |
| client/src/components/HelperProfileModal.tsx | 115 |             </Avatar> |
| client/src/components/HelperProfileModal.tsx | 424 |                           className="w-full h-48 object-cover rounded-lg mb-3" |
| client/src/components/InteractiveCountyMap.tsx | 152 |               {variant === 'general' && "Discover active communities across the United States"} |
| client/src/components/layout/CommunityShell.tsx | 26 |   const avatarUrl: string | null = (user as any)?.profileImageUrl ?? null; |
| client/src/components/layout/NextGenNavigation.tsx | 368 |                     className="w-7 h-7 rounded-full object-cover border border-slate-600" |
| client/src/components/layout/SimpleNavigation.tsx | 10 | import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; |
| client/src/components/layout/SimpleNavigation.tsx | 114 |                       <Avatar className="w-9 h-9"> |
| client/src/components/layout/SimpleNavigation.tsx | 115 |                         <AvatarImage src={user?.profileImageUrl} /> |
| client/src/components/layout/SimpleNavigation.tsx | 116 |                         <AvatarFallback className="bg-orange-500 text-white text-sm"> |
| client/src/components/layout/SimpleNavigation.tsx | 118 |                         </AvatarFallback> |
| client/src/components/layout/SimpleNavigation.tsx | 119 |                       </Avatar> |
| client/src/components/LoadingSkeleton.tsx | 5 |   variant?: 'default' | 'card' | 'text' | 'avatar' | 'button'; |
| client/src/components/LoadingSkeleton.tsx | 20 |     avatar: "h-10 w-10 rounded-full", |
| client/src/components/LoadingSkeleton.tsx | 51 |         <LoadingSkeleton variant="avatar" /> |
| client/src/components/LoadingSkeleton.tsx | 71 |         <LoadingSkeleton variant="avatar" className="h-8 w-8" /> |
| client/src/components/RevenueOptimization.tsx | 99 |           description: 'Home warranty coverage for all contractor work', |
| client/src/components/social/CommentsSection.tsx | 9 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/social/CommentsSection.tsx | 167 |         <Avatar className="h-8 w-8"> |
| client/src/components/social/CommentsSection.tsx | 168 |           <AvatarImage src={comment.author.profileImageUrl} /> |
| client/src/components/social/CommentsSection.tsx | 169 |           <AvatarFallback className="bg-primary/10 text-primary text-xs"> |
| client/src/components/social/CommentsSection.tsx | 171 |           </AvatarFallback> |
| client/src/components/social/CommentsSection.tsx | 172 |         </Avatar> |
| client/src/components/social/CommentsSection.tsx | 263 |                           <Avatar className="h-6 w-6"> |
| client/src/components/social/CommentsSection.tsx | 264 |                             <AvatarImage src={user?.profileImageUrl} /> |
| client/src/components/social/CommentsSection.tsx | 265 |                             <AvatarFallback className="bg-primary/10 text-primary text-xs"> |
| client/src/components/social/CommentsSection.tsx | 267 |                             </AvatarFallback> |
| client/src/components/social/CommentsSection.tsx | 268 |                           </Avatar> |
| client/src/components/social/CommentsSection.tsx | 409 |                       <Avatar className="h-8 w-8"> |
| client/src/components/social/CreatePostModal.tsx | 33 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/social/CreatePostModal.tsx | 170 |               <Avatar className="h-10 w-10"> |
| client/src/components/social/CreatePostModal.tsx | 171 |                 <AvatarImage src={user?.profileImageUrl} /> |
| client/src/components/social/CreatePostModal.tsx | 172 |                 <AvatarFallback className="bg-primary/10 text-primary"> |
| client/src/components/social/CreatePostModal.tsx | 174 |                 </AvatarFallback> |
| client/src/components/social/CreatePostModal.tsx | 175 |               </Avatar> |
| client/src/components/social/CreatePostModal.tsx | 335 |                       <Avatar className="h-8 w-8"> |
| client/src/components/social/CreatePostModal.tsx | 336 |                         <AvatarImage src={user?.profileImageUrl} /> |
| client/src/components/social/CreatePostModal.tsx | 337 |                         <AvatarFallback className="bg-primary/10 text-primary text-xs"> |
| client/src/components/social/CreatePostModal.tsx | 339 |                         </AvatarFallback> |
| client/src/components/social/CreatePostModal.tsx | 340 |                       </Avatar> |
| client/src/components/social/PostCard.tsx | 5 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/social/PostCard.tsx | 176 |             <Avatar className="h-10 w-10"> |
| client/src/components/social/PostCard.tsx | 177 |               <AvatarImage src={post.author.profileImageUrl} /> |
| client/src/components/social/PostCard.tsx | 178 |               <AvatarFallback className="bg-primary/10 text-primary"> |
| client/src/components/social/PostCard.tsx | 180 |               </AvatarFallback> |
| client/src/components/social/PostCard.tsx | 181 |             </Avatar> |
| client/src/components/social/PostCard.tsx | 260 |                   className="w-full h-48 object-cover rounded-lg" |
| client/src/components/social/ShareModal.tsx | 14 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/social/ShareModal.tsx | 129 |                 <Avatar className="h-8 w-8"> |
| client/src/components/social/ShareModal.tsx | 130 |                   <AvatarImage src={post.author.profileImageUrl} /> |
| client/src/components/social/ShareModal.tsx | 131 |                   <AvatarFallback className="bg-primary/10 text-primary text-xs"> |
| client/src/components/social/ShareModal.tsx | 133 |                   </AvatarFallback> |
| client/src/components/social/ShareModal.tsx | 134 |                 </Avatar> |
| client/src/components/TestingErrorReportButton.tsx | 424 |                         className="max-w-full h-32 object-cover rounded border border-navy-600" |
| client/src/components/TradeScoutIcons.tsx | 30 |       className={`${sizeClass} rounded-full ${className} object-cover`} |
| client/src/components/ui/avatar.tsx | 4 | import * as AvatarPrimitive from "@radix-ui/react-avatar" |
| client/src/components/ui/avatar.tsx | 8 | const Avatar = React.forwardRef< |
| client/src/components/ui/avatar.tsx | 9 |   React.ElementRef<typeof AvatarPrimitive.Root>, |
| client/src/components/ui/avatar.tsx | 10 |   React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> |
| client/src/components/ui/avatar.tsx | 12 |   <AvatarPrimitive.Root |
| client/src/components/ui/avatar.tsx | 21 | Avatar.displayName = AvatarPrimitive.Root.displayName |
| client/src/components/ui/avatar.tsx | 23 | const AvatarImage = React.forwardRef< |
| client/src/components/ui/avatar.tsx | 24 |   React.ElementRef<typeof AvatarPrimitive.Image>, |
| client/src/components/ui/avatar.tsx | 25 |   React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> |
| client/src/components/ui/avatar.tsx | 27 |   <AvatarPrimitive.Image |
| client/src/components/ui/avatar.tsx | 33 | AvatarImage.displayName = AvatarPrimitive.Image.displayName |
| client/src/components/ui/avatar.tsx | 35 | const AvatarFallback = React.forwardRef< |
| client/src/components/ui/contextual-tooltip.tsx | 28 |   "Just like measuring twice, cut once - we've got you covered.", |
| client/src/hooks/useAuth.ts | 18 |   avatar?: string; |
| client/src/hooks/useHelpSystem.ts | 101 |         content: 'Discover amazing deals from local contractors and suppliers. Earn LuckyBucks with every purchase!', |
| client/src/pages/about.tsx | 32 |     { number: '3,112', label: 'Counties Covered', description: 'Nationwide coverage across all 50 states' }, |
| client/src/pages/about.tsx | 47 |       description: 'Expanded to cover all 3,112 counties across the United States' |
| client/src/pages/admin-attachments.tsx | 168 |                                   className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-80" |
| client/src/pages/admin-pricing-analytics.tsx | 446 |                 <p className="text-gray-300 text-sm">Market Coverage</p> |
| client/src/pages/car-salesman-application.tsx | 431 |                   <p className="text-sm text-gray-400">Define your geographic coverage</p> |
| client/src/pages/coffee-company.tsx | 112 |                     className="w-full h-48 object-cover rounded-lg mb-4" |
| client/src/pages/community-feed.tsx | 8 | import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; |
| client/src/pages/community-feed.tsx | 30 |     avatar?: string | null; |
| client/src/pages/community-feed.tsx | 53 |     avatar?: string | null; |
| client/src/pages/community-feed.tsx | 130 |           <Avatar className="w-8 h-8"> |
| client/src/pages/community-feed.tsx | 131 |             <AvatarImage src={user?.avatar as string | undefined} /> |
| client/src/pages/community-feed.tsx | 132 |             <AvatarFallback> |
| client/src/pages/community-feed.tsx | 134 |             </AvatarFallback> |
| client/src/pages/community-feed.tsx | 135 |           </Avatar> |
| client/src/pages/community-feed.tsx | 176 |               <Avatar className="w-7 h-7"> |
| client/src/pages/community-feed.tsx | 177 |                 <AvatarImage src={comment.author?.avatar || undefined} /> |
| client/src/pages/community-feed.tsx | 178 |                 <AvatarFallback> |
| client/src/pages/community-feed.tsx | 180 |                 </AvatarFallback> |


## UI component hits (Uploaders/Avatar/Cover/Gallery keywords)

| file | line | text |
| --- | --- | --- |
| .config/.semgrep/semgrep_rules.json | 5727 |       "message": "A gitleaks Pypi Upload Token detected. Avoid hardcoding credentials directly in connection strings as this creates security risks. Instead, use environment variables to store and acc |
| .config/replit/.semgrep/semgrep_rules.json | 5727 |       "message": "A gitleaks Pypi Upload Token detected. Avoid hardcoding credentials directly in connection strings as this creates security risks. Instead, use environment variables to store and acc |
| assets/index-CfDzoXo3.js | 19 | `).map(t=>yA(t)).filter(Rw)}class kA{_encoded;_decoded;_decodedMemo;url;version;names=[];resolvedSources;constructor(t,r){this.map=t;const{mappings:o,names:s,sources:c}=t;this.version=t.version,this.n |
| assets/index-CfDzoXo3.js | 44 | In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}var B=!0,ae=!1,be;return{s:function(){C=C.call(L)},n:function(){var He=C.next();return B=He.done,He},e:function(He) |
| assets/index-CfDzoXo3.js | 49 | In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`)}function fye(e){var t;return typeof e=="function"?t={callback:e}:t=e,t}function dye(e,t){var r=arguments.length>2&& |
| client/src/components/auth/OnboardingFlow.tsx | 13 |   Upload,  |
| client/src/components/auth/OnboardingFlow.tsx | 287 |                         <li>• Upload portfolio photos</li> |
| client/src/components/community/CommunityComposerInline.tsx | 4 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/community/CommunityComposerInline.tsx | 8 | import { uploadObject } from "@/lib/objectUpload"; |
| client/src/components/community/CommunityComposerInline.tsx | 13 |   userAvatarUrl?: string; |
| client/src/components/community/CommunityComposerInline.tsx | 35 |   userAvatarUrl, |
| client/src/components/community/CommunityComposerInline.tsx | 92 |       <Avatar className="h-11 w-11 sm:h-12 sm:w-12 ring-2 ring-orange-500/40"> |
| client/src/components/community/CommunityComposerInline.tsx | 93 |         <AvatarImage src={userAvatarUrl} /> |
| client/src/components/community/CommunityComposerInline.tsx | 94 |         <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-lg font-semibold"> |
| client/src/components/community/CommunityComposerInline.tsx | 96 |         </AvatarFallback> |
| client/src/components/community/CommunityPostCard.tsx | 2 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/community/CommunityPostCard.tsx | 277 |                 <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-orange-500/40 group-hover:ring-orange-400/70"> |
| client/src/components/community/CommunityPostCard.tsx | 278 |                   <AvatarImage src={post.author.avatar} /> |
| client/src/components/community/CommunityPostCard.tsx | 279 |                   <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold"> |
| client/src/components/community/CommunityPostCard.tsx | 281 |                   </AvatarFallback> |
| client/src/components/community/CommunityPostCard.tsx | 282 |                 </Avatar> |
| client/src/components/community/CommunityPostCard.tsx | 315 |                 <Avatar className="h-12 w-12 sm:h-14 sm:w-14 ring-2 ring-orange-500/40"> |
| client/src/components/community/CommunityPostCard.tsx | 316 |                   <AvatarImage src={post.author?.avatar} /> |
| client/src/components/contractor-card-skeleton.tsx | 8 |           {/* Avatar skeleton */} |
| client/src/components/contractor-card.tsx | 47 |         {/* Company Avatar + Rating */} |
| client/src/components/dashboard/DashboardWidgets.tsx | 4 | import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; |
| client/src/components/dashboard/DashboardWidgets.tsx | 157 |               <Avatar className="h-10 w-10"> |
| client/src/components/dashboard/DashboardWidgets.tsx | 158 |                 <AvatarFallback className="bg-orange-500 text-white text-xs"> |
| client/src/components/dashboard/DashboardWidgets.tsx | 160 |                 </AvatarFallback> |
| client/src/components/dashboard/DashboardWidgets.tsx | 161 |               </Avatar> |
| client/src/components/help/HelpSystem.tsx | 46 |         'Upload your best work photos - show off those perfect miters and clean paint lines', |
| client/src/components/help/HelpSystem.tsx | 259 |                       Upload 8-12 high-quality photos - profiles with more photos get viewed 5x more. |
| client/src/components/HelperProfileModal.tsx | 6 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/HelperProfileModal.tsx | 110 |             <Avatar className="h-20 w-20"> |
| client/src/components/HelperProfileModal.tsx | 111 |               <AvatarImage src={helper.profileImageUrl} /> |
| client/src/components/HelperProfileModal.tsx | 112 |               <AvatarFallback className="bg-accent text-accent-foreground text-lg"> |
| client/src/components/HelperProfileModal.tsx | 114 |               </AvatarFallback> |
| client/src/components/HelperProfileModal.tsx | 115 |             </Avatar> |
| client/src/components/layout/SimpleNavigation.tsx | 10 | import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; |
| client/src/components/layout/SimpleNavigation.tsx | 114 |                       <Avatar className="w-9 h-9"> |
| client/src/components/layout/SimpleNavigation.tsx | 115 |                         <AvatarImage src={user?.profileImageUrl} /> |
| client/src/components/layout/SimpleNavigation.tsx | 116 |                         <AvatarFallback className="bg-orange-500 text-white text-sm"> |
| client/src/components/layout/SimpleNavigation.tsx | 118 |                         </AvatarFallback> |
| client/src/components/layout/SimpleNavigation.tsx | 119 |                       </Avatar> |
| client/src/components/social/CommentsSection.tsx | 9 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/social/CommentsSection.tsx | 167 |         <Avatar className="h-8 w-8"> |
| client/src/components/social/CommentsSection.tsx | 168 |           <AvatarImage src={comment.author.profileImageUrl} /> |
| client/src/components/social/CommentsSection.tsx | 169 |           <AvatarFallback className="bg-primary/10 text-primary text-xs"> |
| client/src/components/social/CommentsSection.tsx | 171 |           </AvatarFallback> |
| client/src/components/social/CommentsSection.tsx | 172 |         </Avatar> |
| client/src/components/social/CommentsSection.tsx | 263 |                           <Avatar className="h-6 w-6"> |
| client/src/components/social/CommentsSection.tsx | 264 |                             <AvatarImage src={user?.profileImageUrl} /> |
| client/src/components/social/CreatePostModal.tsx | 33 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/social/CreatePostModal.tsx | 170 |               <Avatar className="h-10 w-10"> |
| client/src/components/social/CreatePostModal.tsx | 171 |                 <AvatarImage src={user?.profileImageUrl} /> |
| client/src/components/social/CreatePostModal.tsx | 172 |                 <AvatarFallback className="bg-primary/10 text-primary"> |
| client/src/components/social/CreatePostModal.tsx | 174 |                 </AvatarFallback> |
| client/src/components/social/CreatePostModal.tsx | 175 |               </Avatar> |
| client/src/components/social/CreatePostModal.tsx | 335 |                       <Avatar className="h-8 w-8"> |
| client/src/components/social/CreatePostModal.tsx | 336 |                         <AvatarImage src={user?.profileImageUrl} /> |
| client/src/components/social/PostCard.tsx | 5 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/social/PostCard.tsx | 176 |             <Avatar className="h-10 w-10"> |
| client/src/components/social/PostCard.tsx | 177 |               <AvatarImage src={post.author.profileImageUrl} /> |
| client/src/components/social/PostCard.tsx | 178 |               <AvatarFallback className="bg-primary/10 text-primary"> |
| client/src/components/social/PostCard.tsx | 180 |               </AvatarFallback> |
| client/src/components/social/PostCard.tsx | 181 |             </Avatar> |
| client/src/components/social/ShareModal.tsx | 14 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/components/social/ShareModal.tsx | 129 |                 <Avatar className="h-8 w-8"> |
| client/src/components/social/ShareModal.tsx | 130 |                   <AvatarImage src={post.author.profileImageUrl} /> |
| client/src/components/social/ShareModal.tsx | 131 |                   <AvatarFallback className="bg-primary/10 text-primary text-xs"> |
| client/src/components/social/ShareModal.tsx | 133 |                   </AvatarFallback> |
| client/src/components/social/ShareModal.tsx | 134 |                 </Avatar> |
| client/src/components/TestingErrorReportButton.tsx | 2 | import { Bug, X, Send, TestTube, Zap, Camera, Upload, Image, Loader2 } from "lucide-react"; |
| client/src/components/TestingErrorReportButton.tsx | 3 | import { uploadObject } from "@/lib/objectUpload"; |
| client/src/components/TestingErrorReportButton.tsx | 32 |   const [uploadedFiles, setUploadedFiles] = useState<File[]>([]); |
| client/src/components/TestingErrorReportButton.tsx | 52 |       setUploadedFiles([]); |
| client/src/components/TestingErrorReportButton.tsx | 103 |   const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => { |
| client/src/components/TestingErrorReportButton.tsx | 118 |       setUploadedFiles(prev => [...prev, ...newFiles].slice(0, 3)); // Max 3 files |
| client/src/components/TestingErrorReportButton.tsx | 123 |     setUploadedFiles(prev => prev.filter((_, i) => i !== index)); |
| client/src/components/TestingErrorReportButton.tsx | 136 |           title: "Upload Failed", |
| client/src/components/ui/avatar.tsx | 4 | import * as AvatarPrimitive from "@radix-ui/react-avatar" |
| client/src/components/ui/avatar.tsx | 8 | const Avatar = React.forwardRef< |
| client/src/components/ui/avatar.tsx | 9 |   React.ElementRef<typeof AvatarPrimitive.Root>, |
| client/src/components/ui/avatar.tsx | 10 |   React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> |
| client/src/components/ui/avatar.tsx | 12 |   <AvatarPrimitive.Root |
| client/src/components/ui/avatar.tsx | 21 | Avatar.displayName = AvatarPrimitive.Root.displayName |
| client/src/components/ui/avatar.tsx | 23 | const AvatarImage = React.forwardRef< |
| client/src/components/ui/avatar.tsx | 24 |   React.ElementRef<typeof AvatarPrimitive.Image>, |
| client/src/lib/objectUpload.ts | 3 | export interface UploadResult { |
| client/src/lib/objectUpload.ts | 5 |   rawUploadUrl: string; |
| client/src/lib/objectUpload.ts | 8 | // Uploads a single File or data URL to object storage and returns a stable, public-facing URL. |
| client/src/lib/objectUpload.ts | 9 | export async function uploadObject(file: File | string): Promise<UploadResult> { |
| client/src/lib/objectUpload.ts | 40 |     throw new Error("Upload failed. Please try again."); |
| client/src/lib/objectUpload.ts | 46 |   return { publicUrl, rawUploadUrl: raw }; |
| client/src/pages/about.tsx | 32 |     { number: '3,112', label: 'Counties Covered', description: 'Nationwide coverage across all 50 states' }, |
| client/src/pages/ad-creator.tsx | 201 |                       <Label htmlFor="image-upload" className="text-gray-300">Upload Image</Label> |
| client/src/pages/ad-creator.tsx | 206 |                           Upload Image |
| client/src/pages/address-verification.tsx | 17 | import { CheckCircle, Clock, XCircle, Mail, Upload, Shield } from "lucide-react"; |
| client/src/pages/address-verification.tsx | 342 |                     <Upload className="w-5 h-5 text-gray-600 mt-1" /> |
| client/src/pages/address-verification.tsx | 344 |                       <h4 className="font-medium text-gray-900 dark:text-gray-100">Document Upload</h4> |
| client/src/pages/address-verification.tsx | 346 |                         Upload a document that shows your name and address (utility bill, bank statement, etc.). |
| client/src/pages/admin-panel.tsx | 35 | import { Plus, Edit, Trash2, Gift, Settings, Megaphone, Users, Bell, Map, CheckCircle, Bug, Image, BarChart3, DollarSign, Wrench, MapPin, Clock, Bot, Shield, AlertTriangle, Eye, Database, Lock, Crown, |
| client/src/pages/admin-panel.tsx | 400 |               <Upload className="w-4 h-4" /> |
| client/src/pages/admin-panel.tsx | 1110 |   const [uploadSummary, setUploadSummary] = useState<any>(null); |
| client/src/pages/admin-panel.tsx | 1143 |         throw new Error(err.error || "Upload failed"); |
| client/src/pages/admin-panel.tsx | 1148 |       setUploadSummary(data.summary || null); |
| client/src/pages/admin-panel.tsx | 1149 |       toast({ title: "Upload complete", description: "Files sorted into knowledge cache" }); |
| client/src/pages/admin-panel.tsx | 1152 |       toast({ title: "Upload failed", description: error.message, variant: "destructive" }); |
| client/src/pages/admin-panel.tsx | 1202 |           <CardTitle className="flex items-center gap-2 text-white"><Upload className="w-5 h-5 text-orange-500" /> Knowledge Upload</CardTitle> |
| client/src/pages/admin-pricing-analytics.tsx | 446 |                 <p className="text-gray-300 text-sm">Market Coverage</p> |
| client/src/pages/admin-workspace.tsx | 21 |   Upload, |
| client/src/pages/admin-workspace.tsx | 166 |             <Upload className="h-4 w-4 mr-2" /> |
| client/src/pages/admin-workspace.tsx | 610 |                     Upload CSV files with county FIPS codes, names, and population data. |
| client/src/pages/admin-workspace.tsx | 613 |                     <Upload className="h-8 w-8 text-gray-500 mx-auto mb-2" /> |
| client/src/pages/admin-workspace.tsx | 631 |                     Upload regional pricing data for quote calculators by service type. |
| client/src/pages/admin-workspace.tsx | 645 |                     <Upload className="h-8 w-8 text-gray-500 mx-auto mb-2" /> |
| client/src/pages/apply-accelerator.tsx | 2 | import { Rocket, Crown, CheckCircle2, AlertTriangle, FileText, Upload, Users2, TrendingUp } from 'lucide-react'; |
| client/src/pages/car-sales-new-listing.tsx | 19 |   Upload |
| client/src/pages/car-sales-new-listing.tsx | 221 |                   Photos |
| client/src/pages/car-sales-new-listing.tsx | 226 |                   <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" /> |
| client/src/pages/car-sales-new-listing.tsx | 228 |                   <p className="text-sm text-gray-500">Upload up to 20 high-quality images</p> |
| client/src/pages/car-sales-new-listing.tsx | 230 |                     <Upload className="h-4 w-4 mr-2" /> |
| client/src/pages/community-builder/contribution-detail.tsx | 19 |   Upload, |
| client/src/pages/community-builder/contribution-detail.tsx | 341 |                     <Upload className="w-4 h-4" /> |
| client/src/pages/community-feed.tsx | 8 | import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; |
| client/src/pages/community-feed.tsx | 130 |           <Avatar className="w-8 h-8"> |
| client/src/pages/community-feed.tsx | 131 |             <AvatarImage src={user?.avatar as string | undefined} /> |
| client/src/pages/community-feed.tsx | 132 |             <AvatarFallback> |
| client/src/pages/community-feed.tsx | 134 |             </AvatarFallback> |
| client/src/pages/community-feed.tsx | 135 |           </Avatar> |
| client/src/pages/community-feed.tsx | 176 |               <Avatar className="w-7 h-7"> |
| client/src/pages/community-feed.tsx | 177 |                 <AvatarImage src={comment.author?.avatar || undefined} /> |
| client/src/pages/community.tsx | 11 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/pages/community.tsx | 355 |                   userAvatarUrl={user?.profileImageUrl} |
| client/src/pages/CommunityFeed.tsx | 6 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/pages/CommunityFeed.tsx | 276 |                     <Avatar> |
| client/src/pages/CommunityFeed.tsx | 277 |                       <AvatarImage src={post.author.profileImageUrl} /> |
| client/src/pages/CommunityFeed.tsx | 278 |                       <AvatarFallback> |
| client/src/pages/CommunityFeed.tsx | 280 |                       </AvatarFallback> |
| client/src/pages/CommunityFeed.tsx | 281 |                     </Avatar> |
| client/src/pages/CommunityProfile.tsx | 6 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/pages/CommunityProfile.tsx | 112 |             <Avatar className="h-14 w-14 ring-2 ring-orange-500/40"> |
| client/src/pages/CommunityProfile.tsx | 113 |               <AvatarImage src={author?.avatar || undefined} /> |
| client/src/pages/CommunityProfile.tsx | 114 |               <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white font-semibold"> |
| client/src/pages/CommunityProfile.tsx | 116 |               </AvatarFallback> |
| client/src/pages/CommunityProfile.tsx | 117 |             </Avatar> |
| client/src/pages/compliance.tsx | 289 |                       <h3 className="font-semibold text-tsAccentSecondary mb-2">Insurance Coverage</h3> |
| client/src/pages/connections.tsx | 4 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
| client/src/pages/connections.tsx | 54 |               <Avatar className="h-9 w-9"> |
| client/src/pages/connections.tsx | 56 |                   <AvatarImage src={u.profileImageUrl} alt={displayName} /> |
| client/src/pages/connections.tsx | 58 |                   <AvatarFallback> |
| client/src/pages/connections.tsx | 60 |                   </AvatarFallback> |
| client/src/pages/connections.tsx | 62 |               </Avatar> |
| client/src/pages/content-moderation.tsx | 7 | import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'; |
| client/src/pages/content-moderation.tsx | 226 |                         <Avatar className="h-10 w-10"> |
| client/src/pages/content-moderation.tsx | 227 |                           <AvatarImage src={item.author.avatar} /> |
| client/src/pages/content-moderation.tsx | 228 |                           <AvatarFallback>{item.author.name[0]}</AvatarFallback> |
| client/src/pages/content-moderation.tsx | 229 |                         </Avatar> |
| client/src/pages/contractor-signup.tsx | 13 | import { Building, Shield, Star, CheckCircle, Upload, Phone, Mail, MapPin } from "lucide-react"; |
| client/src/pages/conversations.tsx | 10 | import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; |
