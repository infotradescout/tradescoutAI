# TradeScout Data Storage Guide

## Overview
Your TradeScout application stores and retrieves data from multiple sources with a comprehensive, production-ready architecture.

## Primary Data Storage

### 1. PostgreSQL Database (Neon)
**Location**: Hosted on Neon serverless PostgreSQL
**Connection**: Via `DATABASE_URL` environment variable
**Purpose**: All primary application data

#### Core Tables:
- **users**: User accounts, authentication, roles (23 different user types)
- **contractors**: Contractor profiles, verification status, service areas  
- **helpers**: Worker/helper profiles, skills, availability
- **counties**: 3,112 US counties with geographic data
- **trades**: Construction trade categories and specializations
- **leads**: Customer requests and lead distribution
- **recommendations**: Contractor ratings and feedback
- **conversations**: Chat messages and communication
- **marketplace_listings**: Equipment, materials, services for sale
- **address_verifications**: Nextdoor-style address verification system
- **trusted_devices**: 1-year device authentication
- **sessions**: PostgreSQL-backed user sessions
- **crm_contacts**: Internal CRM system data
- **moderation_reports**: Community moderation system
- **error_reports**: Application error tracking

### 2. Session Storage
**Location**: PostgreSQL sessions table
**Purpose**: User authentication, login persistence
**Duration**: 1 week sessions, 1 year trusted device authentication

### 3. File Storage (Google Cloud Storage)
**Location**: Google Cloud Storage buckets
**Purpose**: User uploads, documents, images
**Structure**:
- `public/`: Public assets, logos, marketing materials
- `.private/`: User uploaded files, verification documents

## Authentication Data Flow

### 1. Email/Password Authentication
- **Storage**: Users table with bcrypt-hashed passwords
- **Session**: PostgreSQL-backed sessions with secure cookies
- **Device Trust**: Trusted devices table for 1-year authentication

### 2. OAuth Authentication (When Configured)
- **Facebook**: Uses Facebook Graph API for profile data
- **Google**: Uses Google OAuth 2.0 for profile data  
- **Linking**: Social IDs stored in users table alongside local accounts

## Geographic Data System

### County-Centric Architecture
- **3,112 Counties**: Complete US coverage (99.0% national coverage)
- **FIPS Codes**: Federal data integration compatibility
- **Service Areas**: Contractor coverage mapping
- **Lead Routing**: Geographic lead distribution

## Real-Time Data

### WebSocket Connections
- **Chat System**: Real-time messaging between users
- **Notifications**: Live updates for leads, messages, ratings
- **Activity Tracking**: User interaction monitoring

## Business Logic Data

### Lead Management
- **Performance-weighted routing**: Top contractors get priority
- **Capacity management**: Contractor workload balancing
- **Geographic matching**: County-based lead distribution

### Verification Systems
- **Address Verification**: 14-day grace period enforcement
- **ID Verification**: Document storage and approval workflow
- **Contractor Verification**: Multi-step approval process

## API Endpoints for Data Access

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration  
- `GET /api/auth/user` - Current user data
- `GET /api/auth/oauth-status` - OAuth configuration status

### User Management
- `GET /api/user/profile` - User profile data
- `PUT /api/user/profile` - Update profile
- `GET /api/contractors` - Contractor listings
- `GET /api/helpers` - Helper/worker listings

### Geographic Data
- `GET /api/counties` - County information
- `GET /api/trades` - Trade categories
- `GET /api/counties/:id/contractors` - County-specific contractors

### Business Operations
- `GET /api/leads` - Lead management
- `POST /api/recommendations` - Rating system
- `GET /api/marketplace` - Marketplace listings
- `GET /api/conversations` - Chat messages

## Data Security & Compliance

### GDPR Compliance
- **Data Export**: Full user data export capability
- **Data Deletion**: Complete account removal
- **Audit Trails**: User action logging
- **Privacy Controls**: Granular privacy settings

### Security Measures
- **Password Hashing**: bcrypt with 12 salt rounds
- **Session Security**: HTTP-only, secure cookies
- **CSRF Protection**: Built-in request validation
- **Role-based Access**: 23-level hierarchical permissions

## Environment Variables

### Required for Full Functionality
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Session encryption key
- `GOOGLE_CLOUD_STORAGE_BUCKET`: File storage bucket
- `STRIPE_SECRET_KEY`: Payment processing (optional)
- `FACEBOOK_APP_ID`: Facebook OAuth (optional)  
- `FACEBOOK_APP_SECRET`: Facebook OAuth (optional)
- `GOOGLE_CLIENT_ID`: Google OAuth (optional)
- `GOOGLE_CLIENT_SECRET`: Google OAuth (optional)

## Monitoring & Analytics

### Built-in Tracking
- **User Interactions**: Page views, button clicks, geographic activity
- **Performance Metrics**: API response times, error rates
- **Business Metrics**: Lead conversion, contractor performance
- **Geographic Analytics**: County-level activity heatmaps

## Backup & Recovery
- **Automatic Backups**: Neon PostgreSQL automated backups
- **Point-in-time Recovery**: Database restoration capabilities
- **File Backups**: Google Cloud Storage redundancy
- **Session Recovery**: Persistent session management

---

**Current Status**: All primary data systems operational and deployment-ready.