# Category Routing Charter
## Human Intent → System Action (Invisible Orchestration)

### Core Philosophy

**Users think in outcomes, not systems.**

When someone posts "I need help fixing my fence", they're not thinking:
- "I should start a Direct Connect request"
- "This needs to go to the marketplace"
- "Scout should analyze this"

They're thinking: **"I hope someone can help me"**

TradeScout's job is to translate human intent into the right system actions—**without exposing internal machinery**.

---

## Category Intent Mapping

### 1. **General** → Community Chat
**User thinks**: "Just sharing what's on my mind"

**System does**: 
- Standard community feed post
- No special routing
- Visible to neighbors based on scope

**User sees**: Post appears in feed, neighbors can comment

---

### 2. **Question** → Scout + Community Intelligence
**User thinks**: "I want to know something"

**System does**:
- Queue for Scout AI analysis
- Scout can either:
  - Answer directly if confident
  - Route to human experts if uncertain
  - Surface relevant existing tips/recommendations
- Notify users with matching expertise

**User sees**: 
- Helpful answer (source invisible)
- "X neighbors might know about this"
- Links to related tips

**Never**: "Scout vs Human expert" decision exposed

---

### 3. **Recommendation** → Profile & Reputation System
**User thinks**: "I want to vouch for someone good"

**System does**:
- Extract mentioned businesses/contractors from content
- Create automatic profile links
- Boost reputation scores for mentioned entities
- Add to user's "Trusted Network"
- Make recommendation searchable for others

**User sees**:
- "Thanks for the recommendation!"
- "X people recommended [Business]"
- Profile badges updated

**Never**: "Profile boost algorithm" or reputation mechanics

---

### 4. **Event** → Calendar Integration
**User thinks**: "People should know about this happening"

**System does**:
- Parse date/time from post content
- Add to community calendar automatically
- Generate "Add to my calendar" one-tap action
- Send notifications to users who care about event type
- Create event reminder queue

**User sees**:
- "Event added to community calendar"
- "53 neighbors interested"
- "Add to my calendar" button

**Never**: Calendar sync mechanics or notification queue details

---

### 5. **Tip** → Scout Learning Pipeline
**User thinks**: "This might help someone else"

**System does**:
- Extract actionable knowledge from post
- Add to Scout's local knowledge base
- Tag with relevant topics (plumbing, gardening, etc.)
- Make available for Scout to reference in future conversations
- Surface similar tips to interested users

**User sees**:
- "Thanks for sharing! Scout learned something new"
- "X neighbors found this helpful"
- Tip appears in relevant Scout responses later

**Never**: Knowledge base structure or AI training details

---

### 6. **Need Help** (Request) → Direct Connect Opportunity
**User thinks**: "I need someone to do work for me"

**System does**:
- Analyze content for contractor keywords (fence, plumbing, electrical, HVAC, etc.)
- If matched to a trade:
  - Create silent Direct Connect opportunity
  - Notify qualified contractors in area
  - Enable contractor bidding/response flow
- If not matched:
  - Still visible in community feed
  - Scout can help clarify what they need

**User sees**:
- "Your request is live"
- "X local pros are looking at this"
- Direct messages from interested contractors
- "Get more help" → Opens conversation with Scout

**Never**: "Direct Connect request created" or matching algorithm details

---

### 7. **Alert** → Priority Notification System
**User thinks**: "Everyone needs to know about this NOW"

**System does**:
- Determine notification scope (county, state, nearby users)
- Send push notifications to all affected users
- Pin to top of community feed
- Add urgent visual treatment (red border, alert icon)
- Track acknowledgments ("X neighbors have seen this")

**User sees**:
- "Alert sent to 1,243 neighbors"
- "892 people have seen this"
- Alert badge on post

**Never**: Notification queue mechanics or delivery system

---

### 8. **For Sale** → Marketplace Listing
**User thinks**: "I want to sell something locally"

**System does**:
- Extract item details (price, condition, photos)
- Auto-create marketplace listing
- Add to relevant category (tools, vehicles, property, services)
- Enable instant messaging with interested buyers
- Track views and inquiries

**User sees**:
- "Your item is now for sale"
- "X people viewed your listing"
- Direct messages from interested buyers
- "Mark as sold" button

**Never**: "Marketplace listing created" or listing optimization details

---

## Implementation Rules

### 1. **Silent System Orchestration**
All category routing happens **after** post creation, invisibly.

```typescript
// ✅ CORRECT: System works silently
if (category === 'request') {
  // Queue Direct Connect matching in background
  // User just sees "Your request is live"
}

// ❌ WRONG: Exposing system names
if (category === 'request') {
  return { message: "Direct Connect request created" }
}
```

### 2. **Human-Centric Confirmations**
Feedback should reflect **user intent**, not system actions.

```typescript
// ✅ CORRECT: Outcome-focused
"Your request is live. Local pros are looking at this."

// ❌ WRONG: System-focused
"Direct Connect request created and sent to contractor matching queue"
```

### 3. **Progressive Disclosure**
Only show system details when user **explicitly asks** or **needs to troubleshoot**.

```typescript
// ✅ CORRECT: Simple default, details on demand
"3 contractors interested"
→ Click for details: "Direct Connect matches based on location and trade"

// ❌ WRONG: Front-loading system logic
"3 contractors matched via Direct Connect algorithm (score: 0.87, distance: 5mi, rating: 4.2)"
```

### 4. **Intent Preservation**
When routing fails or needs clarification, **preserve user's original intent**.

```typescript
// ✅ CORRECT: Scout helps clarify without system jargon
User: "Need help with something in my yard"
Scout: "I can help with that! Is it landscaping, fence repair, or something else?"

// ❌ WRONG: Asking user to navigate system
Scout: "Please select a category: Landscaping / Fence Repair / Other"
```

---

## Scout's Role in Category Routing

Scout should:
- **Guide without gatekeeping**: "What do you need help with?" not "Select a request type"
- **Translate intent to action**: User says "fence broken" → Scout creates Request post automatically
- **Surface connections invisibly**: Scout knows Request posts → Direct Connect, but user just sees "I found 3 local pros"
- **Provide outcome, not process**: "I notified nearby contractors" not "I created a Direct Connect opportunity"

Scout should **never**:
- Ask user to choose between "community post" vs "Direct Connect request"
- Explain internal routing logic unless explicitly asked
- Use system names (Direct Connect, Exchange, Marketplace) as decision points
- Force users to understand our architecture to get help

---

## Success Metrics

### Good Signal (What We Want)
- **High category adoption**: Users naturally select categories that match their intent
- **Low Scout clarification needed**: Categories are clear enough users pick correctly
- **High cross-system engagement**: Request posts → contractor responses, For Sale → buyer messages
- **Outcome satisfaction**: "I got what I needed" regardless of which system helped

### Bad Signal (What to Avoid)
- **Generic category overuse**: Everyone picks "General" because others are confusing
- **Scout translation burden**: Scout constantly asking "Did you mean to create a Direct Connect request?"
- **System exposure**: Users asking "What's Direct Connect?" or "How does routing work?"
- **Abandoned flows**: Users create Request posts but don't respond to contractors (intent mismatch)

---

## Future Evolution

As TradeScout grows, categories should:
1. **Stay human-centric**: Never add "Create MCP Server Request" or "HOA Vote Initiative"—translate to user intent
2. **Merge when possible**: If "Question" and "Need Help" are used interchangeably, Scout should handle both the same way
3. **Remove friction**: If users constantly pick wrong category, routing should auto-correct based on content, not force re-selection
4. **Preserve simplicity**: More backend sophistication = simpler frontend choices

The goal: **Users think in outcomes, TradeScout handles the how.**

---

## Lock Status

🔒 **Philosophy Locked**: Categories map human intent → system actions silently

✅ **Implementation Started**: Frontend categories + backend routing stubs in place

🚧 **TODO**: Build actual routing handlers for each category type

This charter governs **all** category-related development. Any changes to category behavior must preserve human-centric language and invisible system orchestration.
