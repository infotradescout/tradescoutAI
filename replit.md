# Overview

TradeScout is a social platform connecting homeowners with contractors, characterized by multi-role user accounts, county-centric community hubs, and an affiliate-driven growth model. It supports universal signup with role switching, robust verification systems, and aims to develop into a comprehensive marketplace ecosystem. 

**CRITICAL: The platform is 100% FREE for ALL users - there are NO subscriptions, NO membership fees, NO usage charges. The ONLY paid features are marketplace promotions and platform advertisements (optional). Revenue is generated solely through these optional promotional services, NOT through user subscriptions or access fees.** The platform commits to donating 10% of profits to charitable causes.

# User Preferences

Preferred communication style: Simple, everyday language.
Marketplace language preference: Avoid explicit "investment" or "asset" terminology - let users naturally discover the value-building potential through subtle language and quality indicators.
Lead generation preference: **NEVER use "lead/leads" terminology anywhere** - use "projects", "opportunities", "requests", "connections" instead. Focus on showcasing contractor businesses, building reputation, and connecting with homeowners naturally.

# System Architecture

## UI/UX Decisions
The platform utilizes React with TypeScript (Vite) for the frontend, styled with Tailwind CSS and custom TradeScout brand colors. UI components are built using Radix UI primitives and shadcn/ui. The design incorporates a clear distinction in signup flows and visual themes for homeowners (blue) and professionals (orange). A core principle is an adaptive navigation system with intelligent priority-based layouts.

## Technical Implementations
The backend is built with Node.js and Express.js in TypeScript. PostgreSQL with Neon serverless is used for the database, managed with Drizzle ORM. Authentication is handled via Passport-local and Facebook OAuth, with sessions stored in PostgreSQL. Google Cloud Storage manages file uploads, facilitated by Uppy.js. The platform features dual chat systems (contractor-homeowner, marketplace buyer-seller) and a comprehensive notification system.

## Feature Specifications
Key features include a county-centric design leveraging FIPS codes, a social media-style community feed with real-time interactions, a multi-category marketplace, and a robust role-based access control system supporting 23 user roles. It incorporates an estimate calculator with regional pricing, performance-weighted lead routing (using "projects," "opportunities," "requests"), and a detailed contractor verification system. Advanced features like HOA management, groups, and a nationwide dashboard are implemented with graceful fallbacks. Comprehensive SEO, an internal CRM, and an interactive county map system are also integrated.

## System Design Choices
The architecture emphasizes a "community-first" advertising approach and a "no profile boosting for contractors" policy (only deal promotions). Every user is automatically an affiliate, earning 10% commission on marketplace promotions and ads. Security features include CSRF protection, secure session cookies, and trusted device authentication for admins. Address verification is mandatory within 14 days of registration.

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL
- **File Storage**: Google Cloud Storage
- **Session Store**: PostgreSQL session storage (connect-pg-simple)

## Payment Processing
- **Stripe**: For accelerator memberships and premium features
- **Stripe React**: Client-side payment form components

## Third-Party Services
- **Email Integration**: SendGrid (optional)
- **Formspree**: For bug reporting
- **Analytics**: Event tracking system
- **CSV Processing**: Server-side parsing

# Recent Changes (November 2025)

## User-Customizable Themes (November 9, 2025)
- ✅ **Theme Customization System** - Full color scheme personalization
  - Created 6 preset themes: Default (TradeScout Orange), Ocean Blue, Forest Green, Purple Haze, Sunset Orange, Monochrome
  - **Theme Library** (`client/src/lib/themes.ts`): Centralized theme definitions with color presets
  - **Theme Context Provider** (`client/src/contexts/ThemeContext.tsx`): Global theme management with automatic CSS variable updates
  - **Dynamic CSS Application**: Theme colors applied via CSS custom properties across entire platform
  - **Database Storage**: `themePreference` (preset ID) and `customThemeColors` (JSON) fields in users table
  - **Settings Integration**: New "Appearance" tab in Settings with visual theme selector
  - **API Endpoint**: PATCH `/api/user/theme` for saving theme preferences
  - **User Experience**: Theme persists across sessions, applies immediately on selection
  - **Theme Properties**: Primary background, secondary background (cards), accent colors, text colors, border colors
  - **Consistent Branding**: Default theme maintains TradeScout brand colors (dark navy #0f1419, orange accents)
  - Addresses user feedback about color inconsistencies - now users can choose preferred themes

## Personalized Dashboard System (November 9, 2025)
- ✅ **Role-Based Dashboard Router** - Smart routing to appropriate dashboards based on user role
  - Created `RoleDashboardRouter.tsx` component that routes users to role-specific dashboards
  - Supports 20+ different user roles with intelligent fallbacks
  - Contractor, Realtor, Car Salesman, Dealer, Insurance Agent, Mortgage Broker dashboards
  - Property Manager, HOA Management, Business Owner, Helper dashboards
  - Admin, Staff, and Homeowner views with appropriate permissions
  - Seamless lazy loading for optimal performance
  
- ✅ **Comprehensive Navigation Menu** - Complete platform feature accessibility
  - Created `ComprehensiveNav.tsx` with organized access to ALL 150+ platform features
  - Role-based permission filtering shows only relevant features per user type
  - Organized into logical categories: Core Platform, Contractors, Marketplace, Exchange, Professional Tools, HOA, Business, Helper, Affiliate, Foundation, Moderation, Admin
  - Desktop navigation with dropdown menus for feature categories
  - Mobile-friendly navigation with collapsible sections
  - "All Features" mega menu for complete platform overview
  - Permission-aware display respecting user roles and capabilities

- ✅ **Personalized Homepage Dashboard** - Custom user experience based on role and activity
  - Homepage (`/dashboard` or `/home`) shows personalized snapshot of user's platform activity
  - **Role-specific content**:
    - Contractors: Active projects, ratings, project requests, quotes created, conversations
    - Realtors: Property listings, views, performance metrics
    - Homeowners: Home projects, saved contractors, quote requests, received quotes, active conversations
    - All users: Marketplace listings, saved items, recent activity
  - **Quick stats grid**: Real-time metrics specific to user type (projects, listings, views, ratings)
  - **Quick actions panel**: Context-aware shortcuts (Find Contractors, Browse Marketplace, Community Feed)
  - **Community preview widget**: Community feed accessible but not the main focus
  - **Customizable experience**: Users see only relevant content for their role
  - Replaces generic community feed with personalized data dashboard

- ✅ **Project Management Integration** - Full contractor-homeowner planning system integrated into dashboard
  - **API Endpoint**: `/api/dashboard` fetches real user data (projects, quotes, conversations, listings)
  - **Contractor Dashboard Features**:
    - Active project requests (leads) with status tracking
    - Quotes created with status badges (draft, sent, accepted, declined)
    - Active conversations with homeowners
    - Quick access to project management tools
  - **Homeowner Dashboard Features**:
    - Project requests submitted with urgency and status
    - Received quotes from contractors with pricing details
    - Active conversations for project planning
    - Saved contractors quick access
  - **Planning & Estimation Tools**:
    - Quote management system (labor cost, material cost, total cost)
    - Conversation threads for project discussions
    - Material lists for project planning
    - Schedule coordination capabilities
  - **Real-time Data**: Dashboard pulls from actual database tables (leads, quotes, conversations, listings)
  - **Smart Routing**: Projects link to appropriate management pages based on user role

## Real-Time Platform Statistics (November 9, 2025)
- ✅ **Live Statistics System** - Dynamic platform metrics from real database data
  - API endpoint `/api/stats/platform` fetching real-time data
  - Statistics displayed on landing page: contractors count, homeowners count, project value, success rate
  - Auto-refresh every 60 seconds to show latest numbers
  - Graceful fallbacks for new platforms with no data yet
  - Statistics pull from: verified contractors (approved status), homeowner users, completed leads
  - Success rate calculated from completed vs. cancelled projects

## Navigation Structure (November 9, 2025)
- ✅ **Separated Home and Community Pages**
  - **Home** (`/dashboard`): Personalized dashboard showing user-relevant community activity, saved contractors, quick actions
  - **Community** (`/community`): Full ecosystem overview with categories, events, filtering, search, and trending topics
  - **Mobile Nav**: 5-icon bottom bar with separate Home and Community buttons
  - **Desktop Nav**: Top navigation bar with distinct Home and Community tabs
  - **Groups Integration**: Groups accessible from Community section
  - **HOA Access**: HOA Management visible for HOA board members and managers (role-based)
  - **Profile Dropdown**: Includes "My Groups" and "HOA Management" for quick access

## Customizable Dashboard (November 9, 2025)
- ✅ **User-Configurable Dashboard** - Personalized widget system
  - Dashboard preferences stored in user settings (JSON field)
  - Toggleable widgets: Activity Stats, Recent Posts, Saved Contractors, Quick Actions, Notifications, Top Contractors
  - Dashboard Settings page for customization
  - Responsive layout adapts to enabled widgets

## UI/UX Redesign (November 9, 2025)
- ✅ **Complete Facebook/Nextdoor-Style Interface** - Redesigned entire UI for familiar, intuitive experience
  - **Top Navigation**: Clean Facebook-style bar with logo, icon navigation, search, and profile dropdown
  - **Left Sidebar**: Simplified Nextdoor-style quick links with community section
  - **Center Feed**: Facebook-style "What's on your mind?" post creation with clean card-based posts
  - **Right Sidebar**: Trending topics and top contractors (like Facebook suggestions)
  - **Mobile Navigation**: Bottom navigation bar with 5 key icons (matches Facebook mobile app)
  - **Color Scheme**: Light/white background with subtle shadows (Facebook/Nextdoor aesthetic)
  - **Post Actions**: Familiar Like/Comment/Share buttons in horizontal layout

## Signup Flow Enhancement (November 9, 2025)
- ✅ **Seamless Professional/Homeowner Separation**
  - Landing page CTAs: Clear "I'm a Homeowner" vs "I'm a Professional" buttons
  - Expanded professional roles: Contractor, Realtor, Car Dealer, Insurance Agent, Property Manager, Mortgage Broker
  - Query parameter routing: /signup?type=homeowner or /signup?type=professional
  - Three-tier flow: Account type → Role selection → Onboarding
  - Visual distinction: Blue (homeowners) vs Orange (professionals)
  - Clear "100% FREE - No fees" messaging for professionals

## Community Posts Enhancement (November 9, 2025)
- ✅ **Author Information Display** - Posts now show proper author details
  - Database query updated to JOIN with users table
  - Posts display: author name, avatar, email, role, verification status
  - Graceful fallback to "Anonymous" for posts without author data
  - Privacy-aware display (respects isPrivateProfile setting)
- ✅ **TradeScout Branding** - Removed all Facebook group references
  - County hub pages now reference "TradeScout Community Groups"
  - Analytics changed from "Facebook Groups" to "Community Groups"
  - Interactive county map updated to use TradeScout branding
  - Consistent orange brand color for community CTAs

## Multi-Role Management System (November 9, 2025)
- ✅ **Role Management in Settings** - Users can add/remove multiple roles from their profile
  - **Roles Tab**: New dedicated tab in settings for role management
  - **Visual Role Selection**: Interactive role cards with icons, descriptions, and colors
  - **Available Roles**: Homeowner, Contractor, Realtor, Car Salesman, Insurance Agent, Mortgage Broker, Property Manager, Business Owner, Helper/Worker, Vehicle Dealer, HOA Admin
  - **Multi-Role Support**: Users can select multiple roles simultaneously
  - **Automatic Experience Updates**: Dashboard and features adapt based on selected roles
  - **Smart Validation**: Prevents removing all roles (minimum 1 required)
  - **API Endpoint**: PATCH `/api/user/roles` for updating user roles
  - **Auto-Refresh**: Page reloads after saving to reflect new role configuration
  - **Theme Consistency**: Settings page uses dark navy background (#0f1419) and dark cards (#1a2332) with orange accents
  - **Database Support**: Uses `roles` array field in users table + `role` field for primary role