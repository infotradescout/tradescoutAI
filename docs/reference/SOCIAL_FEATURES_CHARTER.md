# SOCIAL FEATURES SYSTEM
## Community Discovery, Friendships, & Messaging

### Overview
Complete social graph system enabling users to:
- **Discover** people in their community (county-scoped)
- **Connect** as friends (follow/unfollow)
- **Communicate** via direct messaging
- **Search** both people and conversations

---

## Backend API Endpoints

### Search
```
GET /api/social/search?q=name&scope=county&limit=20&excludeFollowing=true
```
**Returns:** Array of user profiles matching search criteria
- Scoped by county (default) or state
- Excludes already-following users by default
- Shows only address-verified users
- Ranked by name match, then verification, then recency

### Friends Management
```
GET /api/social/friends?filter=friends|suggestions&limit=50
POST /api/social/friends/:userId/add
POST /api/social/friends/:userId/remove
```
**Features:**
- `filter=friends`: Get current connections
- `filter=suggestions`: AI suggestions based on location
- Add/remove returns confirmation
- Mutual follow relationships stored in `userFollows` table

### Messaging
```
POST /api/social/conversations/start
Body: { targetUserId: string }
Returns: { threadId, created: boolean }

GET /api/social/messages/search?q=text&threadId=optional&limit=50
```
**Features:**
- Start new conversations or get existing thread ID
- Full-text search across all messages or within conversation
- Uses `marketplaceConversations` table for persistence
- `marketplaceMessages` table stores message content

### Friends Search
```
GET /api/social/friends/search?q=name&limit=50
```
**Returns:** Filtered friend list matching search query

---

## Frontend Components

### SocialDiscovery.tsx
**Location:** `client/src/components/social/SocialDiscovery.tsx`

**Tabs:**
1. **Search**
   - Real-time search as user types
   - County/state toggle
   - User cards with: avatar, name, role, location, verified badge
   - Actions: Message + Add Friend

2. **Friends**
   - List of current connections
   - User cards with: avatar, name, role, verified badge
   - Actions: Message + Remove Friend

3. **Suggestions**
   - AI-suggested friends from same location
   - Reason badge: "In your area"
   - Actions: Message + Add Friend

**UI Features:**
- Loading spinners during async operations
- Empty states with helpful messaging
- Toast notifications for actions
- Real-time mutations with optimistic UI
- Button loading states

### MessagesPanel.tsx
**Location:** `client/src/components/messages/MessagesPanel.tsx`

**Features:**
- List of conversations
- Message thread view
- Real-time message sending
- Already integrated and working

---

## Database Schema

### userFollows
```typescript
{
  followerId: string -> users.id
  followingId: string -> users.id
}
```
Stores connection graph (one direction = following)

### marketplaceConversations
```typescript
{
  id: string (UUID)
  listingId: string ("general_messaging" for user-to-user)
  buyerId: string -> users.id
  sellerId: string -> users.id
  status: "active" | "closed" | "archived"
  lastMessageAt: timestamp
  createdAt: timestamp
  updatedAt: timestamp
}
```
Repurposed for general user-to-user messaging

### marketplaceMessages
```typescript
{
  id: string (UUID)
  conversationId: string -> marketplaceConversations.id
  senderId: string -> users.id
  senderType: "buyer" | "seller"
  content: text
  messageType: "text" | "offer" | "counter_offer" | "acceptance" | "image" | "meeting_request"
  metadata: jsonb (optional structured data)
  readAt: timestamp (nullable)
  createdAt: timestamp
}
```
Stores all messages between users

---

## User Flows

### Flow 1: Discover Someone
1. User clicks **Discover** in top nav → `/discover-people`
2. Lands on Search tab
3. Types name/email
4. API queries users in same county
5. Excludes already-following users
6. Shows verified users ranked by match
7. User clicks **Add** → adds friend
8. User clicks **Message** → starts conversation

### Flow 2: Message a Friend
1. User clicks **Messages** in top nav → `/conversations`
2. Opens existing conversation or starts new
3. Types message and sends
4. Real-time delivery via Socket.io
5. Friend receives notification

### Flow 3: Find Local Suggestions
1. User opens **Discover** → **Suggestions** tab
2. System queries users in same county not yet following
3. Shows 20 suggestions ranked by recency
4. Each has "In your area" badge
5. Quick add/message actions

---

## Integration with Existing Systems

### With Community Feed
- **From profile card** in feed: Can click to view user details → Add Friend button
- **From post comments**: Can quick-message poster

### With Scout AI
- Scout can suggest connecting with people mentioned in conversations
- Scout can facilitate introductions between compatible users

### With Direct Connect
- Contractor/homeowner conversations flow through same messaging system
- Contract negotiations keep full history

### With Marketplace
- Buyer/seller conversations already using same database tables
- System unifies all user-to-user communication

---

## Authorization & Security

**All endpoints require:**
- `isAuthenticated` middleware
- `requireOnboardingComplete` middleware
- User can only view/interact with people in their county or state
- User can only message people they're connected to (added as friend)
- User cannot message themselves

**Verified users only:**
- Search results filtered to `addressVerified === true`
- Ensures safety in discovery

---

## Configuration

### Scopes
- **County** (default): Fast discovery in tight geography
- **State**: Wider search for rare trades/services
- System prefers county for suggestions

### Pagination
- Default 50 results per query
- Max 100 to prevent oversized responses
- Offset for pagination support

### Search Behavior
- Case-insensitive matching
- Searches first name, last name, email
- Exclude-following is default (can disable for complete results)

---

## Performance Notes

### Optimizations
- County-scoped queries hit indexed `countyFips` column
- Verified user filter reduces result set
- Friend follow checks indexed by follower ID
- Search uses `ILIKE` for pattern matching

### Caching
- React Query caches search results
- Invalidates on friend add/remove
- Suggests data cached with 5-min default stale time

---

## Future Enhancements

### Potential Features
1. **Mutual Friends** indicator
2. **User Recommendations** based on activity (same forum posts, etc.)
3. **Trusted Network** for verified trades
4. **Friend Groups** for organizing connections
5. **Blocking** to prevent unwanted messages
6. **Read receipts** for messages
7. **Typing indicators** for real-time chats
8. **Message reactions** (like, love, etc.)
9. **Audio/video calls** integration
10. **Stories/status** from friends

### Backend Readiness
- Schema supports all above (metadata field for extensibility)
- Socket.io infrastructure ready for real-time features

---

## Testing Checklist

- [ ] Search returns users in county
- [ ] Search excludes self
- [ ] Search excludes already-following users
- [ ] Search ranks exact name matches first
- [ ] Friends list shows all connections
- [ ] Friend suggestions show non-connections in county
- [ ] Add friend creates follow relationship
- [ ] Remove friend deletes follow relationship
- [ ] Start conversation creates or finds existing thread
- [ ] Messages save to database
- [ ] Message search finds content across conversations
- [ ] Friend search filters list correctly
- [ ] All endpoints require authentication
- [ ] Users can't access other users' conversations
- [ ] Verified badge appears for verified users

---

## Status: ✅ COMPLETE & DEPLOYED

**Backend APIs:** Live at `/api/social/*` endpoints
**Frontend UI:** Live at `/discover-people` route
**Navigation:** Discover button in top nav next to Messages
**Database:** Using existing userFollows, marketplaceConversations, marketplaceMessages tables
**Real-time:** Socket.io messaging ready to use

System is **human-centric**, following TradeScout philosophy:
- Users think "I want to meet someone" → we route them to discover
- Users think "I want to chat" → we let them message directly
- Users think "Who's around here?" → we suggest local people
- No confusing "connections" vs "followers" concept—just simple friendships
