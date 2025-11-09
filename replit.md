# Overview

TradeScout is a social platform connecting homeowners with contractors, characterized by multi-role user accounts, county-centric community hubs, and an affiliate-driven growth model. It supports universal signup with role switching, robust verification systems, and aims to develop into a comprehensive marketplace ecosystem. The platform is designed to be 100% free for contractors, generating revenue solely through marketplace promotions and platform advertisements. It also commits to donating 10% of profits to charitable causes.

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