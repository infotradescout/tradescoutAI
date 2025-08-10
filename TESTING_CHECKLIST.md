# Trade Scout Testing Checklist

## Core Platform Features

### 🏠 **Landing & Registration**
- [ ] Landing page loads with construction emblem rotation (every 8 seconds)
- [ ] User registration with Contractor vs Homeowner profile selection
- [ ] Profile setup flow redirects properly based on user type
- [ ] Social login integration (if configured)

### 🔍 **Contractor Discovery**
- [ ] County-based contractor board at `/contractors/board`
- [ ] Filter by trade, location, and sort options
- [ ] Contractor profiles with verification badges
- [ ] Lead routing and contact functionality

### 💰 **Estimate Calculator**
- [ ] Comprehensive project types (60+ options across 6 categories)
- [ ] Square footage, timeline, and location inputs
- [ ] Dynamic pricing calculations
- [ ] "Get 3 Free Quotes" lead generation

### 💼 **Worker Marketplace** (NEW)
- [ ] Two-sided marketplace at `/workers`
- [ ] **Find Workers tab**: Browse ID-verified workers with skills, ratings, hourly rates
- [ ] **Find Tasks tab**: Browse posted tasks with requirements and pay details
- [ ] 18 task categories from general labor to specialized services
- [ ] Location and skill-based filtering

## User Dashboards

### 🏡 **Homeowner Dashboard**
- [ ] Project management interface
- [ ] Saved contractors and estimates
- [ ] Chat conversations with contractors
- [ ] Task posting for worker marketplace

### 🔨 **Contractor Dashboard**
- [ ] Lead management and pipeline
- [ ] Growth Pack downloads
- [ ] Accelerator program enrollment
- [ ] Worker hiring interface

### 👷 **Worker Profiles** (NEW)
- [ ] ID verification status and requirements
- [ ] Background check completion
- [ ] Skills and availability settings
- [ ] Job history and earnings tracking

## Communication System

### 💬 **Chat Interface**
- [ ] Real-time messaging between homeowners and contractors
- [ ] Quote sending and acceptance
- [ ] Schedule proposals
- [ ] **Collaborative Material Lists**: Home Depot-style shopping cart with suggestion workflow
- [ ] Rating system after project completion

### 📧 **Notification System**
- [ ] Bell icon with unread counts
- [ ] Saved ad reminders (3 days, then daily)
- [ ] Email notifications for important updates

## Admin Features

### 🛡️ **Admin Panel** (`/admin/panel`)
- [ ] Prize configuration for golden emblems (0.2% chance)
- [ ] Advertisement management with location targeting
- [ ] Site settings and contractor configurations
- [ ] Content management system

### 👥 **User Management** (`/admin/users`)
- [ ] Hierarchical admin system (head_admin > moderator > user)
- [ ] Role updates and permission enforcement
- [ ] User search and filtering

### 🎯 **Advertisement System**
- [ ] Location-aware ads based on user's county
- [ ] "Save for Later" functionality with periodic reminders
- [ ] Affiliate link tracking and analytics

## Verification & Compliance

### 🆔 **ID Verification System**
- [ ] Document upload for drivers license, passport
- [ ] Background check integration
- [ ] Reference verification process
- [ ] Admin review and approval workflow

### ⚖️ **Legal Compliance**
- [ ] All task workers must complete ID verification
- [ ] Document retention and management
- [ ] Verification status tracking and expiration

## Gamification Features

### 🏆 **Construction Emblem System**
- [ ] 20 authentic construction tool emblems rotate automatically
- [ ] No user control (admin-only configuration)
- [ ] Rare golden emblems (0.2% probability)
- [ ] Prize redemption system

### 💎 **Rewards System**
- [ ] Admin-configurable prizes (gift cards, discounts)
- [ ] Prize terms and expiration tracking
- [ ] User prize history and redemption

## Navigation & UI

### 📱 **Responsive Design**
- [ ] Mobile-first navigation with hamburger menu
- [ ] All pages responsive across devices
- [ ] Touch-friendly interfaces

### 🎨 **Brand Consistency**
- [ ] Navy background with orange accent colors
- [ ] Trade Scout branding and terminology
- [ ] Construction-themed iconography

## Data & Performance

### 📊 **Data Management**
- [ ] CSV import for county pricing data
- [ ] Real-time data updates
- [ ] Search functionality across all content

### 🚀 **Performance**
- [ ] Page load times under 3 seconds
- [ ] Smooth navigation transitions
- [ ] Emblem rotation performance

## Integration Testing

### 🔗 **Third-Party Services**
- [ ] Google Cloud Storage for file uploads
- [ ] SendGrid email delivery (if configured)
- [ ] Stripe payment processing (if configured)
- [ ] Database connectivity and queries

### 🌐 **API Endpoints**
- [ ] All CRUD operations functional
- [ ] Proper error handling and responses
- [ ] Authentication and authorization checks

---

## Testing Priority Levels

### 🔴 **Critical (Must Work)**
- User registration and profile setup
- Contractor discovery and contact
- Estimate calculator functionality
- Worker marketplace core features
- ID verification system
- Admin user management

### 🟡 **Important (Should Work)**
- Chat system and material lists
- Notification system
- Advertisement system
- Emblem rotation and prizes
- Mobile responsiveness

### 🟢 **Nice to Have (Test if Time)**
- Advanced filtering options
- Analytics and tracking
- Performance optimizations
- Edge case scenarios

---

## Bug Reporting Template

**Feature**: [Which feature/page]
**Issue**: [Brief description]
**Steps**: [How to reproduce]
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Browser**: [Chrome, Safari, etc.]
**Device**: [Desktop, Mobile, Tablet]

---

## Quick Access URLs

- Landing: `/`
- Contractor Board: `/contractors/board`
- Worker Marketplace: `/workers`
- Estimate Calculator: `/quote`
- Growth Pack: `/growth-pack`
- Admin Panel: `/admin/panel`
- Admin Users: `/admin/users`
- Chat: `/chat`