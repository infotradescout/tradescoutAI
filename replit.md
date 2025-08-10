# Overview

Trade Scout is a full-stack contractor marketplace platform built with React, Node.js/Express, and PostgreSQL. The application connects homeowners with verified local contractors, featuring county-centric contractor boards, quote calculators, recommendation systems, and comprehensive admin tools. The platform includes both public-facing features for homeowners seeking contractors and private dashboards for contractors and administrators.

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
- **Role-Based Access**: Multi-tier user roles with granular permissions
- **Security**: CSRF protection, secure session cookies, and role-based route protection

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