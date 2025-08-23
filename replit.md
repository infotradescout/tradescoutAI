# Overview

TradeScout is a comprehensive social platform connecting homeowners with contractors, featuring multi-role user accounts, county-centric community hubs, and affiliate-driven growth. The platform supports universal signup with role switching, verification systems, and includes plans for HOA management, charitable giving (Mike Rowe Works Foundation), and a complete marketplace ecosystem. Current implementation includes master admin controls, Facebook authentication, and foundational infrastructure for the LOCKED roadmap specification (see ROADMAP_COMMITMENT.md).

# User Preferences

Preferred communication style: Simple, everyday language.
Marketplace language preference: Avoid explicit "investment" or "asset" terminology - let users naturally discover the value-building potential through subtle language and quality indicators.
Lead generation preference: Never reference "getting leads" or "lead generation" - focus on showcasing contractor businesses, building reputation, and connecting with homeowners naturally.

# Full Specification Alignment - LOCKED ROADMAP

**IMMUTABLE SPECIFICATION**: The TradeScout roadmap stored in TRADESCOUT_FULL_SPECIFICATION.md is the permanent, unchanging specification for this platform. No deviations without explicit user authorization.

**Current Status**: 70% aligned with full TradeScout specification
**Full Specification**: Stored in TRADESCOUT_FULL_SPECIFICATION.md (LOCKED)
**Alignment Analysis**: Detailed in ALIGNMENT_ANALYSIS.md
**Key Missing Features**: Affiliate system, HOA management, advanced marketplace features, charitable engine
**Implementation Priority**: Phase 1 focuses on completing role alignment and basic affiliate system

**ROADMAP COMMITMENT**:
- Phase 1: Contractors, Helpers, daily deal feeds
- Phase 2: Realtors + Dealers with boosts
- Phase 3: Groups + in-app social
- Phase 4: HOA suite (finances, vendors, voting)
- Phase 5: Nationwide rollout
- Phase 6: Foundation + Coffee scaling → impact flywheel

**CORE PRINCIPLES (NON-NEGOTIABLE)**:
- Universal signup with multi-role support
- County-centric organization (3,000+ hubs)
- 10% profit donation (50% Mike Rowe Works Foundation, 50% local communities)
- Every user is an affiliate (10% commission standard)
- Verification-only feedback system
- No profile boosting for contractors (only deal promotions)
- Community-first advertising approach

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
- **Authentication**: Passport-local authentication
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful JSON endpoints

## Database Architecture
- **Database**: PostgreSQL with Neon serverless
- **Schema Management**: Drizzle Kit
- **Core Entities**: Users (role-based), Contractors (verification, service areas), Counties, Trades, Recommendations, Ratings, Pricing data, Marketplace conversations and messages.
- **Geographic Coverage**: 3,112 counties across all 50 states, DC, and 5 territories with FIPS integration.
- **Dual Conversation Systems**: Separate chat systems for contractor-homeowner and marketplace buyer-seller.

## Authentication & Authorization
- **Authentication System**: Dual authentication with Passport-local and Facebook OAuth, secure initial master admin setup and trusted device system (1-year device authentication, fingerprinting, secure session persistence).
- **Session Storage**: PostgreSQL-backed.
- **Role-Based Access**: Hierarchical user roles (homeowner, contractor_user, accelerator_member, moderator, ops_admin, head_admin), with critical role selection during registration.
- **Admin Hierarchy**: Head admin manages all users; moderators manage non-head admins.
- **Address Verification**: Platform-wide address verification required within 14 days, with multiple methods (postcard, document upload) and middleware enforcement.
- **Security**: CSRF protection, secure session cookies, role-based route protection.
- **Admin Role Impersonation**: Allows admins to impersonate other roles for testing.
- **Facebook Authentication**: Fully operational with App ID/Secret configured and OAuth redirect URIs properly set up. One-click contractor and homeowner signup working in production.

## File Upload & Storage
- **Cloud Storage**: Google Cloud Storage.
- **Upload Interface**: Uppy.js (drag-and-drop).
- **S3 Compatibility**: AWS S3 adapter support.

## Business Logic Features
- **County-Centric Design**: Comprehensive geographical organization with FIPS codes for federal data integration.
- **Estimate Calculator**: Regional pricing data with CSV import.
- **Lead Routing**: Performance-weighted round-robin distribution with capacity management.
- **Verification System**: Document upload and status tracking for contractors.
- **Collaborative Material Lists**: Shopping cart style system with customer suggestions and contractor approval.
- **Chat Integration**: Full-featured chat with quote requests, scheduling, and material lists.
- **Construction Emblem System**: Automated rotation of construction tool emblems, with rare golden emblems triggering prize systems.
- **Comprehensive Admin Panel**: CMS for prizes, advertisements, site settings, contractor configurations, and geographic user activity visualization.
- **Smart Advertisement System**: Location-aware ads with "Save for Later" and periodic reminders.
- **Notification Center**: Real-time system with email integration.
- **Geographic Analytics Dashboard**: User heatmap visualization across US counties.
- **Helpers Marketplace System**: Two-sided marketplace for contractors to hire workers and homeowners to hire task helpers.
- **ID Verification Framework**: Vetting system with ID verification, background checks, and document management.
- **Comprehensive SEO Implementation**: Structured data, meta tags, breadcrumbs, and LLM-optimized content.
- **Contractor Recommendations Leaderboard System**: Monthly and lifetime contractor ranking based on customer recommendations.
- **Comprehensive Legal Compliance Infrastructure**: Privacy policy (CCPA/GDPR), terms of service, cookie policy, and compliance dashboard covering federal, state, and local regulations.
- **Internal CRM System**: Contacts, deals, activities, and analytics with API endpoints and admin dashboard.
- **Adaptive Navigation**: Intelligent priority-based navigation system with four adaptive layouts and real-time adaptation.
- **Comprehensive Profile Management**: User profile viewing and editing with tabbed interface, role-based fields, password management, and notification preferences.
- **Interactive County Map System**: County-level exploration with Facebook group integration and contractor listings.
- **Comprehensive Contextual Tooltip System**: Help system with contractor-themed illustrations and witty quips integrated throughout the platform.
- **Subtle Onboarding System**: Gentle hint cards providing role-based guidance.
- **Accelerator Program Tab**: Premium training, lead priority, and networking benefits.
- **Role-Specific Help Center**: Dynamic role-based customization for all 23 user roles.
- **Smart Onboarding Tour System**: Interactive tooltip system with role-based tours and progress tracking.
- **1-Click Bug Report Tool**: Automatic screenshot capture with Formspree integration.

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL
- **File Storage**: Google Cloud Storage
- **Session Store**: PostgreSQL session storage (connect-pg-simple)

## Payment Processing
- **Stripe**: For accelerator memberships and premium features.
- **Stripe React**: Client-side payment form components.

## Third-Party Services
- **CSV Processing**: Server-side parsing for county pricing data.
- **Email Integration**: For transactional emails and notifications.
- **Analytics**: Event tracking system for KPI monitoring.
- **Formspree**: For bug reporting.