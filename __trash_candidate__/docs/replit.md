# Overview

TradeScout is a social platform designed to connect homeowners with contractors. It features multi-role user accounts, county-centric community hubs, and an affiliate-driven growth model, aiming to evolve into a comprehensive marketplace ecosystem. The platform is entirely free for all users, generating revenue solely through optional marketplace promotions and platform advertisements. TradeScout is committed to donating 10% of its profits to charitable causes.

# User Preferences

Preferred communication style: Simple, everyday language.
Marketplace language preference: Avoid explicit "investment" or "asset" terminology - let users naturally discover the value-building potential through subtle language and quality indicators.
Lead generation preference: **NEVER use "lead/leads" terminology anywhere** - use "projects", "opportunities", "requests", "connections" instead. Focus on showcasing contractor businesses, building reputation, and connecting with homeowners naturally.

# System Architecture

## UI/UX Decisions
The frontend is built with React and TypeScript (Vite), styled using Tailwind CSS with custom TradeScout brand colors, Radix UI primitives, and shadcn/ui components. The design employs adaptive navigation with priority-based layouts and distinct visual themes (blue for homeowners, orange for professionals) for signup flows. The UI has been redesigned to resemble familiar social platforms like Facebook/Nextdoor, featuring a clear top navigation, left sidebar for quick links, a central feed for posts, and a right sidebar for trending topics. Users can also customize themes with a selection of presets and individual color adjustments.

## Technical Implementations
The backend uses Node.js and Express.js with TypeScript. PostgreSQL (Neon serverless) is the database, managed by Drizzle ORM. Authentication is handled via Passport-local and Facebook OAuth, with sessions stored in PostgreSQL. Google Cloud Storage is used for file uploads, facilitated by Uppy.js. The platform supports dual chat systems, a comprehensive notification system, and features a robust role-based access control system for its 23 user roles. A dynamic dashboard system intelligently routes users to role-specific views and provides personalized content.

## Feature Specifications
Key features include county-centric design using FIPS codes, a social media-style community feed, a multi-category marketplace, and an estimate calculator with regional pricing. It incorporates performance-weighted "project," "opportunity," and "request" routing, a detailed contractor verification system, and advanced features like HOA management and groups. Comprehensive SEO, an internal CRM, and an interactive county map system are integrated. Users can manage multiple roles from their settings, dynamically altering their dashboard experience and available features.

## System Design Choices
The architecture promotes a "community-first" advertising model and prohibits profile boosting for contractors, allowing only deal promotions. Every user is automatically an affiliate, earning a 10% commission on marketplace promotions and ads. Security features include CSRF protection, secure session cookies, and trusted device authentication for admins. Address verification is mandatory within 14 days of registration. The platform separates "Home" (personalized dashboard) and "Community" (full feed) pages for a tailored user experience.

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL
- **File Storage**: Google Cloud Storage
- **Session Store**: PostgreSQL session storage (connect-pg-simple)

## Payment Processing
- **Stripe**: For accelerator memberships and premium features
- **Stripe React**: Client-side payment form components

## Third-Party Services
- **Email Integration**: SendGrid
- **Formspree**: For bug reporting
- **Analytics**: Event tracking system
- **CSV Processing**: Server-side parsing