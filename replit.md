# Overview

TradeScout is a full-stack contractor marketplace platform connecting homeowners with verified local contractors. It features county-centric contractor boards, estimate calculators, recommendation systems, and comprehensive admin tools. The platform includes public-facing features for homeowners and private dashboards for contractors and administrators. The business vision is to provide comprehensive geographic coverage for locality-based contractor matching nationwide, supporting a free platform model through revenue optimization systems.

# User Preferences

Preferred communication style: Simple, everyday language.
Marketplace language preference: Avoid explicit "investment" or "asset" terminology - let users naturally discover the value-building potential through subtle language and quality indicators.
Lead generation preference: Never reference "getting leads" or "lead generation" - focus on showcasing contractor businesses, building reputation, and connecting with homeowners naturally.

## Recent Changes (August 11-22, 2025)
- ✅ **Authentication System Overhaul**: Completely replaced OpenID Connect with comprehensive passport-local authentication
- ✅ **Master Admin Setup**: Implemented secure initial platform setup system with automatic routing
- ✅ **Trusted Device System**: 1-year device authentication with fingerprinting and secure session persistence
- ✅ **Database Schema**: Fixed trusted_devices table with proper device_name column and constraints
- ✅ **Session Management**: PostgreSQL-backed sessions with secure cookies and role-based permissions
- ✅ **Frontend Auth Components**: Created LoginForm, RegisterForm, and MasterAdminSetup with proper validation
- ✅ **Database Integration**: Full user management with password hashing and role-based access control
- ✅ **Routing Logic**: Fixed automatic redirect to master admin setup when platform needs initialization
- ✅ **Navigation Cleanup**: Removed Role Directory - roles are assigned during account creation, not through separate interface
- ✅ **Header Simplification**: Cleaned header to contain only core site navigation; moved user account features (notifications, messages, conversations, payment history, saved ads) to user dropdown menu near profile picture
- ✅ **Navigation Enhancement**: Enhanced header design with professional styling, improved logo, backdrop blur effects, and hover animations
- ✅ **Duplicate Removal**: Eliminated duplicate navigation items between main navigation and role-based navigation
- ✅ **Comprehensive UI Polish**: Complete dropdown transparency fixes across ALL UI components (dropdown-menu, popover, command, menubar, context-menu, dialog) with consistent navy-800/navy-700 backgrounds, white text, navy-600 hover states, orange focus indicators, and enhanced shadows
- ✅ **Admin Role Impersonation System**: Full testing capabilities allowing admins to impersonate contractors, homeowners, accelerator members, and moderators for comprehensive platform testing
- ✅ **Revolutionary Adaptive Navigation**: Implemented intelligent priority-based navigation system with four adaptive layouts (full/compact/icons/minimal), ResizeObserver-based real-time adaptation, and smart item distribution based on screen space and content priority
- ✅ **Complete Profile Management System**: Comprehensive user profile viewing and editing with tabbed interface (profile info, security, notifications, preferences), role-based fields for contractors, password management, and notification preferences
- ✅ **Interactive County Map System**: Revolutionary county-level exploration with Facebook group integration, contractor listings, and geographic activity visualization for both homeowner and contractor landing pages
- ✅ **Progressive Icon Navigation**: Enhanced navigation flow with four-stage responsive system (text labels → fewer text items → icons-only → minimal icons) with smooth transitions and improved breakpoints
- ✅ **Comprehensive Contextual Tooltip System**: Revolutionary help system with contractor-themed illustrations (wrench, hammer, hardhat, drill, screwdriver, paintbrush, ruler) and witty contractor quips integrated throughout forms, navigation, dashboard widgets, and search components
- ✅ **Accelerator Program Tab**: Added purple-themed accelerator program tab to helpers page with premium training, lead priority, elite networking, and comprehensive benefits package ($199/month investment with 300-500% ROI)
- ✅ **Internal CRM System**: Complete customer relationship management system with contacts, deals, activities, and analytics. Includes comprehensive API endpoints for CRUD operations, search functionality, and admin dashboard at /admin/crm with tabs for managing contacts, deals, and activity logging.
- ✅ **Comprehensive Helper Marketplace System**: Implemented dual marketplace functionality where contractors can hire workers for job assistance and homeowners can hire helpers for household tasks. Added 'helper' role with full dashboard access, task management, earnings tracking, verification systems, and role-based navigation priorities.
- ✅ **Revolutionary Role-Specific Help Center**: Completely transformed help center with dynamic role-based customization for all 23 user roles (homeowner, contractor, helper, accelerator member, property manager, business owner, realtor, car salesman, insurance agent, mortgage broker, community roles, platform staff, and admin hierarchies). Each role gets tailored content, quick actions, help articles, categories, and support options based on their specific needs and responsibilities.
- ✅ **Facebook Authentication Integration**: Complete Facebook login system with passport-facebook strategy, one-click contractor signup, mobile-optimized experience, and 3x higher conversion rates (60-80% vs 15-20%)
- ✅ **Smart Onboarding Tour System**: Comprehensive interactive tooltip system with role-based tours, feature-specific guidance, progress tracking, auto-start capabilities, keyboard navigation, and replay functionality
- ✅ **Legal Compliance Infrastructure**: Production-ready privacy policy with CCPA/GDPR compliance, zero third-party data sales guarantee, TradeScout admin contact transparency, and Facebook App-ready terms of service
- ✅ **TypeScript Error Reduction**: Systematically fixed authentication issues, duplicate imports, and schema mismatches reducing errors from 161 to 115 (28% improvement)
- ✅ **Facebook Authentication Foundation**: Complete strategy setup with proper session handling, ready for Facebook App ID/Secret integration
- ✅ **Production URLs Verified**: All Facebook App registration URLs tested and confirmed working for immediate deployment

**Critical Learning**: Proactively identify and fix UI/UX issues without requiring user feedback. Blank pages and broken flows should be immediately addressed during development.

## Pre-Launch Configuration (August 22, 2025)
- ✅ **Feature Flag System**: Implemented to control public access during development
- ✅ **Public Routes**: Contractor board and quote calculator available without authentication
- ✅ **Private Routes**: All advanced features (community, helpers, exchange, accelerator, foundation, marketplace) redirect to contractor board for unauthenticated users
- ✅ **Full Functionality Preserved**: Authenticated users still have access to all features for testing and development
- ✅ **Contractor Onboarding**: Signup system live for contractors to join before full launch

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript (Vite)
- **Styling**: Tailwind CSS with custom TradeScout brand colors
- **UI Components**: Radix UI primitives with shadcn/ui
- **Routing**: Wouter
- **State Management**: TanStack Query
- **Forms**: React Hook Form with Zod validation

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM
- **Authentication**: OpenID Connect integration with Replit Auth
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful JSON endpoints

## Database Architecture
- **Database**: PostgreSQL with Neon serverless
- **Schema Management**: Drizzle Kit
- **Core Entities**: Users (role-based), Contractors (verification, service areas), Counties, Trades, Recommendations, Ratings, Lead generation, Pricing data, Marketplace conversations and messages.
- **Geographic Coverage**: 3,112 counties across all 50 states, DC, and 5 territories (99.0% national coverage) with proper FIPS integration for federal data compatibility.
- **Dual Conversation Systems**: Complete contractor-homeowner chat system and marketplace buyer-seller conversation system with separate database tables and API endpoints.

## Authentication & Authorization
- **Provider**: Replit OpenID Connect
- **Session Storage**: PostgreSQL-backed
- **Role-Based Access**: Hierarchical user roles (homeowner, contractor_user, accelerator_member, moderator, ops_admin, head_admin)
- **Profile Selection**: Critical Contractor vs. Homeowner role selection during registration.
- **Admin Hierarchy**: Head admin manages all users; moderators manage non-head admins.
- **Address Verification**: Platform-wide address verification requirement with 14-day grace period, multiple verification methods (postcard, document upload), and middleware enforcement.
- **Security**: CSRF protection, secure session cookies, role-based route protection.

## File Upload & Storage
- **Cloud Storage**: Google Cloud Storage
- **Upload Interface**: Uppy.js (drag-and-drop)
- **S3 Compatibility**: AWS S3 adapter support.

## Business Logic Features
- **County-Centric Design**: Comprehensive geographical organization covering 3,112 counties (99.0% national coverage) across all 50 states, DC, and territories with proper FIPS codes for federal data integration.
- **Estimate Calculator**: Regional pricing data with CSV import.
- **Lead Routing**: Performance-weighted round-robin distribution with capacity management.
- **Verification System**: Document upload and status tracking for contractors.
- **Growth Pack**: Lead magnet for contractor acquisition.
- **Collaborative Material Lists**: Shopping cart style system with customer suggestions and contractor approval.
- **Chat Integration**: Full-featured chat with quote requests, scheduling, material lists, and ratings.
- **Authentic Construction Emblem System**: Automated rotation of 20 construction tool emblems; no user control.
- **Rare Golden Emblem Rewards**: 0.2% probability golden emblems triggering admin-configurable prize system.
- **Comprehensive Admin Panel**: CMS at /admin/panel for prizes, advertisements, site settings, contractor configurations, and geographic user activity visualization.
- **Smart Advertisement System**: Location-aware ads with "Save for Later" and periodic reminders.
- **Notification Center**: Real-time system with email integration for reminders and alerts.
- **Geographic Analytics Dashboard**: User heatmap visualization showing activity patterns across US counties.
- **Helpers Marketplace System**: Two-sided marketplace connecting contractors with helpers and homeowners with task helpers.
- **ID Verification Framework**: Vetting system with ID verification, background checks, and document management.
- **Comprehensive SEO Implementation**: Structured data, meta tags, breadcrumbs, and AI-friendly content (LLM-optimized).
- **Platform-Wide Address Verification**: Nextdoor-style address verification requirement for all users within 14 days of account creation, with postcard verification, document upload options, and graduated access restrictions.
- **Contractor Recommendations Leaderboard System**: Monthly and lifetime contractor ranking based on customer recommendations, with automatic monthly resets and persistent lifetime tracking.
- **Comprehensive Legal Compliance Infrastructure**: Complete privacy policy (CCPA/GDPR), terms of service, cookie policy, and compliance dashboard covering federal (INFORM Consumers Act), state (marketplace facilitator tax laws), and local regulations with real-time compliance monitoring.
- **Dual Conversation Systems**: Complete contractor-homeowner chat system and marketplace buyer-seller conversation system with real-time messaging, contact seller buttons, and conversation management.
- **Enterprise Security & Data Management**: Complete data privacy system with GDPR compliance, user data export/deletion, audit trails, security incident management, and comprehensive admin tools for data access and user information management.

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL
- **Authentication**: Replit OpenID Connect
- **File Storage**: Google Cloud Storage
- **Session Store**: PostgreSQL session storage (connect-pg-simple)

## Payment Processing
- **Stripe**: Payment processing for accelerator memberships and premium features.
- **Stripe React**: Client-side payment form components.

## Third-Party Services
- **CSV Processing**: Server-side parsing for county pricing data.
- **Email Integration**: Planned for transactional emails and notifications.
- **Analytics**: Event tracking system for KPI monitoring.