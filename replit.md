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