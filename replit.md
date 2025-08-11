# Overview

Trade Scout is a full-stack contractor marketplace platform built with React, Node.js/Express, and PostgreSQL. The application connects homeowners with verified local contractors, featuring county-centric contractor boards, estimate calculators, recommendation systems, and comprehensive admin tools. The platform includes both public-facing features for homeowners seeking contractors and private dashboards for contractors and administrators.

## Recent Changes (August 2025)
- ✅ **Restored Missing Pages**: Added contractor application page (/contractors/apply) and Accelerator program page (/contractors/accelerator)
- ✅ **Enhanced Navigation**: Created comprehensive navigation component with role-based menu items
- ✅ **Simplified Estimate Calculator**: Streamlined to core fields (Project Type, Square Footage, Timeline) for better UX
- ✅ **Fixed Routing**: Connected Growth Pack and contractor dashboard links to proper application/accelerator pages
- ✅ **Added API Endpoints**: Implemented contractor application submission and Accelerator enrollment endpoints
- ✅ **Terminology Updates**: Changed "Quote" to "Estimate" throughout platform while preserving key phrases like "Get 3 Free Quotes"
- ✅ **Enhanced Material Lists**: Implemented collaborative "Home Depot shopping cart" style material lists with customer suggestion and contractor approval workflow
- ✅ **Collaborative Features**: Added suggestion status tracking (pending, approved, denied), denial reasons, and role-based approval buttons
- ✅ **Database Schema Updates**: Enhanced material list items to support suggestion metadata, user roles, and approval workflow
- ✅ **Construction Emblem System**: Created rotating system with 20 authentic construction tool emblems (hard hat, hammer, wrench, etc.)
- ✅ **Rare Golden Emblem**: Reduced probability to 0.2% chance for rare golden variants with admin-configurable prizes
- ✅ **Enhanced Chat Materials**: Integrated MaterialListBuilder into chat interface with collaborative status displays and approval workflow
- ✅ **Comprehensive Admin Panel**: Full admin interface at /admin/panel for managing prizes, advertisements, site settings, and contractor configurations
- ✅ **Admin-Editable Prizes**: Prize system now fully configurable through admin panel with probability weights and terms
- ✅ **Automated Random Rotation**: Emblems rotate every 8 seconds with random selection (no user control, admin-only configuration)
- ✅ **Enhanced Ad System**: Complete "Save for Later" functionality with database storage and user authentication
- ✅ **Periodic Notification System**: Automated reminder system for saved ads with email and in-app notifications
- ✅ **NotificationBell Component**: Real-time notification center with unread counts and interactive management
- ✅ **Intelligent Reminder Logic**: First reminder after 3 days, then daily reminders (max 3 total) with progressive messaging
- ✅ **Profile Selection System**: Critical Contractor vs Homeowner role selection during registration for targeted user experience
- ✅ **Head Admin Hierarchy**: Implemented hierarchical admin system with head_admin powers to manage moderators and all users
- ✅ **User Management Interface**: Complete admin user management at /admin/users with role updates and permissions enforcement
- ✅ **Profile Setup Flow**: Comprehensive onboarding system with role-specific fields and automatic dashboard routing
- ✅ **Comprehensive Trades System**: Expanded trades list to include 75+ contractor specialties across all categories (construction, exterior, interior, maintenance, specialty services)
- ✅ **Enhanced Project Types**: Quote calculator now supports comprehensive project selection with categorized trade mapping for accurate contractor matching
- ✅ **Helpers Marketplace System**: Two-sided marketplace connecting contractors with helpers AND homeowners with task helpers (renamed from "Worker Marketplace")
- ✅ **ID Verification Framework**: Comprehensive vetting system with ID verification, background checks, and document management for legal compliance
- ✅ **Task Categories System**: 18 task categories from general labor to specialized services with skill-based matching
- ✅ **Fixed SelectItem Error**: Resolved React error caused by empty string value in SelectItem components in Helpers marketplace
- ✅ **For Contractors Page**: Created comprehensive contractors hub at /contractors consolidating Growth Pack, Accelerator, and all contractor-focused features
- ✅ **Critical API Fixes**: Fixed contractors API SQL syntax error, implemented database-backed error reporting, restored authentication systems
- ✅ **Dropdown Styling Improvements**: Fixed SelectContent background styling issues with proper navy theme colors and readable text throughout platform
- ✅ **Expanded Trade Options**: Added 50+ additional trade specialties including emergency services, restoration, and specialty contractors for comprehensive coverage
- ✅ **Comprehensive SEO Implementation**: Complete SEO and LLM optimization with structured data, meta tags, breadcrumbs, and AI-friendly content
- ✅ **Advanced Structured Data**: Implemented LocalBusiness, Service, Organization, and geographic structured data for better search visibility
- ✅ **LLM-Optimized Components**: Created AIOptimizedContent components for better AI model understanding and content extraction
- ✅ **Geographic SEO System**: Location-based SEO optimization for state and county-specific contractor searches
- ✅ **Technical SEO Foundation**: Added robots.txt, sitemap.xml, canonical URLs, Open Graph tags, and Twitter Card optimization
- ✅ **Revenue Optimization System**: Enhanced ad system, affiliate integration, and accelerator program promotion for free platform sustainability
- ✅ **Strategic Ad Placements**: Context-aware advertising system optimizing revenue while maintaining excellent user experience
- ✅ **Affiliate Partnership Integration**: Smart product recommendations and partnership deals supporting the free platform model
- ✅ **Complete Geographic Coverage**: Comprehensive database of all 50 US states and their counties/parishes/boroughs with FIPS codes for nationwide contractor matching (2,293 counties total)
- ✅ **National County Database**: Achieved complete US geographic coverage with all 50 states + DC, enabling locality-based tracking for every homeowner and contractor interaction nationwide
- ✅ **User Activity Heatmap**: Comprehensive geographic visualization system in admin panel showing user interaction patterns across US counties with color-coded activity levels, user breakdowns (contractors vs homeowners), and timeframe filtering

## Deployment & Admin Setup
- **Owner Control**: head_admin role provides ultimate platform authority and user management capabilities
- **Admin Hierarchy**: Three-tier system (Owner → Administrators → Moderators) with appropriate permission levels
- **Role-Based Access**: ops_admin handles daily operations, moderator manages content and user support
- **Comprehensive Guides**: Created admin-hierarchy-setup.md and moderator-setup.md for team management
- **Security Framework**: Clear permission matrix preventing unauthorized access escalation while enabling effective team operations

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite for build tooling
- **Styling**: Tailwind CSS with custom Trade Scout brand colors (navy backgrounds, orange accents)
- **UI Components**: Radix UI primitives with shadcn/ui component library for consistent design system
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state management and caching
- **Forms**: React Hook Form with Zod validation schemas

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database ORM**: Drizzle ORM for type-safe database interactions
- **Authentication**: OpenID Connect integration with Replit Auth system
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful endpoints with consistent JSON responses

## Database Architecture
- **Database**: PostgreSQL with Neon serverless database
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Core Entities**:
  - Users with role-based access control (homeowner, contractor_user, accelerator_member, admin roles)
  - Contractors with verification status and service areas
  - Counties and trades for geographical and service categorization
  - Recommendations and ratings system
  - Lead generation and assignment workflows
  - Pricing data for quote calculations

## Authentication & Authorization
- **Provider**: Replit OpenID Connect for secure authentication
- **Session Storage**: PostgreSQL-backed session storage for scalability
- **Role-Based Access**: Hierarchical user roles (homeowner, contractor_user, accelerator_member, moderator, ops_admin, head_admin)
- **Profile Selection**: Critical Contractor vs Homeowner role selection during registration for targeted user experience
- **Admin Hierarchy**: Head admin has ultimate authority to manage all users including moderators; moderators can manage all except head admins
- **Security**: CSRF protection, secure session cookies, and role-based route protection with profile setup flow

## File Upload & Storage
- **Cloud Storage**: Google Cloud Storage integration for contractor documents and media
- **Upload Interface**: Uppy.js for advanced file upload with drag-and-drop support
- **S3 Compatibility**: AWS S3 adapter support for flexible storage options

## Business Logic Features
- **County-Centric Design**: Geographical organization by county FIPS codes for targeted contractor discovery
- **Quote Calculator**: Regional pricing data with CSV import capabilities for dynamic calculations
- **Lead Routing**: Performance-weighted round-robin lead distribution with contractor capacity management
- **Verification System**: Document upload and status tracking for contractor verification workflows
- **Growth Pack**: Lead magnet system for contractor acquisition with gated content delivery
- **Collaborative Material Lists**: Home Depot-style shopping cart system with customer suggestions and contractor approval workflow
- **Chat Integration**: Full-featured chat system with quote requests, scheduling, material list creation, and rating capabilities
- **Authentic Construction Emblem System**: Automated rotation of 20 construction tool emblems (hard hat, hammer, wrench, drill, etc.) with no user control
- **Rare Golden Emblem Rewards**: 0.2% probability golden emblems that trigger admin-configurable prize system with gift cards and affiliate deals
- **Comprehensive Admin Panel**: Full content management system at /admin/panel for prizes, advertisements, site settings, contractor configurations, and geographic user activity visualization
- **Smart Advertisement System**: Location-aware ads with "Save for Later" functionality and periodic reminder notifications
- **Notification Center**: Real-time notification system with email integration via SendGrid for saved ad reminders and system alerts
- **Geographic Analytics Dashboard**: Advanced user heatmap visualization showing activity patterns, interaction density, and user distribution across all US counties with real-time filtering capabilities

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL serverless database
- **Authentication**: Replit OpenID Connect service
- **File Storage**: Google Cloud Storage for document and media storage
- **Session Store**: PostgreSQL session storage via connect-pg-simple

## Payment Processing
- **Stripe**: Payment processing for accelerator memberships and premium features
- **Stripe React**: Client-side payment form components and checkout flows

## Third-Party Services
- **CSV Processing**: Server-side parsing for county pricing data imports
- **Email Integration**: Planned integration for transactional emails and notifications
- **Analytics**: Event tracking system for KPI monitoring and user behavior analysis

## Development Tools
- **Replit Integration**: Development environment with hot reloading and error overlays
- **Build Tools**: Vite for frontend bundling, esbuild for backend compilation
- **Type Safety**: TypeScript throughout the entire stack with shared schema definitions