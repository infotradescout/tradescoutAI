# Scout LLM User Personalization System

## Overview

The User Personalization System enables Scout to deliver role-specific, location-aware, and interaction-informed responses by:

1. **Parsing user types** from role field into semantic categories (contractor, homeowner, business, community, etc.)
2. **Building location context** with a 4-level hierarchy (city/county/state/unknown)
3. **Tracking recent interactions** from messaging history to understand user focus areas
4. **Generating language profiles** with formality levels and contextual guidance
5. **Injecting user context** into LLM prompts for personalized thought processes and responses

---

## Core Components

### 1. User Context Service (`server/services/userContextService.ts`)

**Purpose:** Build comprehensive user context from user ID and interaction history

**Key Exports:**
- `buildUserContext(userId?)` - Main entry point, returns complete UserContext
- `formatUserContextForPrompt(context)` - Format context for LLM injection
- `generateThinkingContext(context)` - Brief reasoning-friendly summary

**UserContext Structure:**
```typescript
{
  userId?: string;
  profile: UserProfile;
  userTypes: string[]; // ["contractor", "specialist", "business"]
  location: LocationContext; // { level, city?, county?, state?, zipcode? }
  recentInteractions: RecentInteraction[]; // Last 5 types: contractor/marketplace/community/builder
  preferences: UserPreferences; // Flags: isBusiness, isContractor, isHomowner, etc.
  languageProfile: LanguageProfile; // Formality, focusAreas, localTerms, hints
}
```

**User Type Parsing:**
Maps user role → semantic categories:
- `homeowner` → ["property_owner", "residential"]
- `contractor` → ["contractor", "service_provider"]
- `business_owner` → ["business", "commercial"]
- `community_builder` → ["community", "builder"]
- etc. (25+ role types supported)

**Location Context Levels:**
1. **City** - `${city} ${state}` (highest precision)
2. **County** - `${county} County ${state}`
3. **State** - State-level only
4. **Unknown** - No location data

**Recent Interactions Tracking:**
Analyzes last 20 messages for interaction types:
- `contractor` - Search/inquiry for service providers
- `marketplace` - Buying/selling/listing items
- `community` - Neighborhood/local/county engagement
- `builder` - Community Builder/fundraise/outreach

---

### 2. LLM Prompt Integration (`server/routes/scout.ts`)

**Updated synthesizeResponse function:**
- Now accepts optional `userContext` parameter
- Injects formatted context before knowledge synthesis
- Adds thinking context summary for LLM reasoning

**Prompt Injection Example:**
```markdown
## User Context: Personalized Guidance
**User Type:** contractor/specialist
**Location:** Houston, Texas
**Formality:** professional

### How to Respond:
- Use trade-specific terminology. Emphasize ROI and lead quality.
- Scout can help with project discovery and client outreach.

### Focus Areas:
- project leads
- client communication
- service coverage

### Recent Activity:
- contractor: Contractor search/inquiry (2h ago)
```

**Flow:**
1. Client sends message to `/api/scout`
2. Server extracts userId from request
3. `buildUserContext(userId)` → comprehensive profile
4. Context passed to `synthesizeResponse()`
5. LLM receives both system prompt + user context
6. Scout generates personalized response

---

### 3. Messaging Interaction Tracking (`server/messaging-service.ts`)

**New Feature:** Interaction signature extraction

When users send messages, Scout tracks:
- **Communication style:** emphatic, formal_polite, casual_friendly
- **Domain signals:** construction_domain, pricing_focused, time_sensitive, quality_conscious
- **Relationship signals:** community_engaged, business_service

**Metadata Enhancement:**
Messages stored with `_interactionSignature` array for future ML/analytics:
```json
{
  "metadata": {
    "_interactionSignature": ["emphatic", "time_sensitive", "contractor_domain"],
    "_messageType": "text",
    "_senderType": "homeowner"
  }
}
```

---

## Language Profile Customization

### Formality Levels
- **Casual** - General community members (default)
- **Professional** - Contractors, business owners (trade terminology)
- **Formal** - Specialists, finance roles (precise language)

### Focus Areas (User-Type Specific)

**Contractors:**
- Project leads, client communication, service coverage
- Hint: "Emphasize ROI and lead quality"

**Property Owners:**
- Contractor network, pricing context, service quality
- Hint: "Emphasize local expertise and hyperlocal pricing"

**Business Owners:**
- Growth opportunities, customer acquisition, local market insights
- Hint: "Highlight competitive advantages and market positioning"

**Community Members:**
- Neighborhood engagement, local resources, community building
- Hint: "Scout helps connect neighbors and build communities"

### Location-Specific Language
Automatically includes relevant location terms:
- User in Houston, TX → References to Houston market, Texas-specific data
- User in Prince George's County → County-level context and resources
- State-only users → State-level guides and statistics

### Contextual Hints
Dynamically added based on recent activity:
- Recent contractor search → "User recently searched for contractors - emphasize contractor network"
- Marketplace activity → "Highlight listing and discovery features"
- Builder engagement → "Emphasize community reach and fundraising"

---

## Response Personalization Examples

### Example 1: Contractor User
**Input:** "How do I find more project leads?"

**Injected Context:**
- User Type: contractor/specialist
- Location: Dallas, TX
- Formality: professional
- Focus: project leads, client communication, service coverage
- Recent: Contractor search 1h ago

**Scout Response Structure:**
- ✅ Uses industry jargon naturally
- ✅ Emphasizes lead quality and ROI
- ✅ References Dallas market data
- ✅ Focuses on customer acquisition vs. product features
- ✅ Suggests Scout's contractor discovery tools

### Example 2: Homeowner User
**Input:** "I need a roofer. What's a fair price?"

**Injected Context:**
- User Type: property_owner/residential
- Location: Austin, TX
- Formality: casual
- Focus: contractor network, pricing context
- Recent: Contractor search 30m ago

**Scout Response Structure:**
- ✅ Friendly, accessible tone
- ✅ Provides Austin-specific roofing pricing
- ✅ Emphasizes contractor verification/reviews
- ✅ Highlights trusted local network
- ✅ Offers transparent pricing context

### Example 3: Community Builder
**Input:** "How do I launch a fundraiser for my HOA?"

**Injected Context:**
- User Type: community/builder
- Location: Phoenix, Arizona
- Formality: professional
- Focus: neighborhood engagement, community reach, fundraising
- Recent: Builder activity 2h ago

**Scout Response Structure:**
- ✅ Emphasizes community-building aspects
- ✅ References Community Builder tools specifically
- ✅ Highlights fundraising features and reach
- ✅ Includes local HOA best practices
- ✅ Suggests neighborhood outreach strategies

---

## Database Integration

### Messages Table
Enhanced with interaction signature metadata:
```typescript
{
  id: "msg-xyz",
  conversationId: "conv-abc",
  senderId: "user-123",
  senderType: "homeowner" | "contractor",
  content: "Looking for roofing contractors",
  metadata: {
    _interactionSignature: ["contractor_domain", "quality_conscious"],
    _messageType: "text",
    _senderType: "homeowner"
  },
  createdAt: 2025-12-08T...
}
```

### Recent Interactions Query
- Fetches last 20 messages from user
- Filters to last 30 days (createdAt)
- Deduplicates by interaction type
- Returns top 3-5 recent focus areas

---

## Error Handling

All user context operations are wrapped in try-catch:
- ✅ Missing userId → Returns guest context (no personalization)
- ✅ User not found → Returns default context
- ✅ Database errors → Logs error, returns empty interactions
- ✅ Type parsing errors → Graceful fallback to default type

---

## Future Enhancements

### Phase 2: Behavioral Learning
- Track which response types get positive engagement (via reactions/follow-ups)
- Adjust formality and focus areas based on user patterns
- A/B test different language styles per user type

### Phase 3: Skill Matching
- For contractors: Match with projects aligned to specialties
- For homeowners: Recommend contractors matching past ratings/preferences
- Community context: Suggest relevant builders based on neighborhood activity

### Phase 4: Dynamic Focus Areas
- Real-time adjustment based on current conversation flow
- Seasonal adjustments (roofing in storm season, etc.)
- Market sentiment analysis (recession-aware messaging)

---

## Testing & Verification

### Current Status
✅ All TypeScript errors resolved  
✅ Dev server running cleanly  
✅ User context service integrated into Scout route  
✅ Messaging service tracking interactions  
✅ Changes committed to main branch  

### How to Test
1. Create a test user with role `contractor`
2. Add location (city, county, state)
3. Send messages to Scout (e.g., "Find me project leads")
4. Observe response - should use trade-specific language, emphasize lead generation
5. Try as different user types (homeowner, business_owner, community_builder)
6. Response language and focus areas should shift accordingly

---

## Summary

This system ensures Scout responses are:
- **Role-Aware** - Language matches user type (contractor vs. homeowner vs. builder)
- **Location-Intelligent** - References local market data and regional context
- **Interaction-Informed** - Understands recent user focus areas and adjusts guidance
- **Contextually-Rich** - LLM has full user profile for nuanced reasoning
- **Gracefully-Degrading** - Works for guests (no personalization) and authenticated users alike

Every Scout response now arrives with rich user context, enabling truly personalized guidance that speaks directly to the user's needs, expertise level, and current goals.
