# Overview

TradeScout is a full-stack contractor marketplace platform connecting homeowners with verified local contractors. It features county-centric contractor boards, estimate calculators, recommendation systems, and comprehensive admin tools. The platform includes public-facing features for homeowners and private dashboards for contractors and administrators. The business vision is to provide comprehensive geographic coverage for locality-based contractor matching nationwide, supporting a free platform model through revenue optimization systems.

# User Preferences

Preferred communication style: Simple, everyday language.
Marketplace language preference: Avoid explicit "investment" or "asset" terminology - let users naturally discover the value-building potential through subtle language and quality indicators.

## Recent Changes (August 11, 2025)
- ✅ **Authentication System Overhaul**: Completely replaced OpenID Connect with comprehensive passport-local authentication
- ✅ **Master Admin Setup**: Implemented secure initial platform setup system at `/setup` route
- ✅ **Session Management**: PostgreSQL-backed sessions with secure cookies and role-based permissions
- ✅ **Frontend Auth Components**: Created LoginForm, RegisterForm, and MasterAdminSetup with proper validation
- ✅ **Database Integration**: Full user management with password hashing and role-based access control
- ✅ **Navigation Cleanup**: Removed Role Directory - roles are assigned during account creation, not through separate interface

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