# 🔗 Phase 1.5: Messaging Integration Guide

**Status:** Ready for Integration  
**Estimated Time:** 4-8 hours  
**Complexity:** Medium  
**Priority:** High (critical path for MVP)

---

## 🎯 Integration Objectives

After Phase 1 is deployed, integrate real-time messaging with:
1. Marketplace (buyer-seller messaging)
2. Contractor system (homeowner-contractor messaging)
3. Notification system (unread message badges)
4. User profiles (conversation history)

---

## 📋 Integration Checklist

### **Step 1: Marketplace Integration (2-3 hours)**

#### **Goal:** Allow buyers and sellers to message about listings

**1A. Add "Contact Seller" Button to Listing Detail**

```tsx
// File: client/src/pages/marketplace-item.tsx
import { MessagingPanel } from '@/components/MessagingPanel';
import { useNavigate } from 'wouter';

export default function MarketplaceItem({ id }: { id: string }) {
  const navigate = useNavigate();
  const { listing, seller } = useListingDetail(id);

  const handleContactSeller = async () => {
    try {
      // Create or get existing conversation
      const response = await fetch('/api/marketplace/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: listing.id,
          sellerId: seller.id,
        }),
      });
      
      const { conversationId } = await response.json();
      navigate(`/messages?conversationId=${conversationId}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  return (
    <div>
      {/* ... listing details ... */}
      <button
        onClick={handleContactSeller}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Contact Seller
      </button>
    </div>
  );
}
```

**1B. Add API Endpoint for Marketplace Conversations**

```typescript
// File: server/routes.ts
// Add after existing /api/conversations endpoints (around line 2900)

// Create or get marketplace conversation
app.post("/api/marketplace/conversations", isAuthenticated, async (req: any, res: any) => {
  try {
    const { listingId, sellerId } = req.body;
    const buyerId = req.user.id;

    // Verify listing exists
    const listing = await db
      .select()
      .from(marketplaceListings)
      .where(eq(marketplaceListings.id, listingId))
      .limit(1);

    if (!listing || listing.length === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    // Verify seller is listing owner
    if (listing[0].userId !== sellerId) {
      return res.status(403).json({ message: "Invalid seller" });
    }

    // Check if conversation already exists
    const existing = await db
      .select()
      .from(marketplaceConversations)
      .where(
        and(
          eq(marketplaceConversations.listingId, listingId),
          eq(marketplaceConversations.buyerId, buyerId),
          eq(marketplaceConversations.sellerId, sellerId)
        )
      )
      .limit(1);

    if (existing && existing.length > 0) {
      return res.json({ conversationId: existing[0].id });
    }

    // Create new conversation
    const id = uuidv4();
    await db.insert(marketplaceConversations).values({
      id,
      listingId,
      buyerId,
      sellerId,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    res.json({ conversationId: id });
  } catch (error) {
    console.error("Error creating marketplace conversation:", error);
    res.status(500).json({ message: "Failed to create conversation" });
  }
});

// Get user's marketplace conversations
app.get("/api/marketplace/conversations", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.id;

    const conversations = await db
      .select({
        id: marketplaceConversations.id,
        listingId: marketplaceConversations.listingId,
        buyerId: marketplaceConversations.buyerId,
        sellerId: marketplaceConversations.sellerId,
        status: marketplaceConversations.status,
        lastMessageAt: marketplaceConversations.lastMessageAt,
        listing: marketplaceListings.title,
        otherUserId: sql`CASE 
          WHEN ${marketplaceConversations.buyerId} = ${userId} THEN ${marketplaceConversations.sellerId}
          ELSE ${marketplaceConversations.buyerId}
        END`,
      })
      .from(marketplaceConversations)
      .leftJoin(
        marketplaceListings,
        eq(marketplaceConversations.listingId, marketplaceListings.id)
      )
      .where(
        or(
          eq(marketplaceConversations.buyerId, userId),
          eq(marketplaceConversations.sellerId, userId)
        )
      )
      .orderBy(desc(marketplaceConversations.lastMessageAt));

    res.json(conversations);
  } catch (error) {
    console.error("Error fetching marketplace conversations:", error);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});
```

**1C. Update MessagingPanel for Marketplace Context**

```tsx
// File: client/src/components/MessagingPanel.tsx
// Modify header to show listing info for marketplace

interface MessagingPanelProps {
  userId: string;
  conversationId?: string;
  listingTitle?: string;  // Add this
  onClose?: () => void;
}

export function MessagingPanel({
  userId,
  conversationId,
  listingTitle,  // Add this
  onClose,
}: MessagingPanelProps) {
  // ... existing code ...

  return (
    <div className="h-full flex gap-4">
      {/* ... */}
      <div className="flex-1 border rounded-lg flex flex-col bg-white">
        {currentConversation ? (
          <>
            {/* Chat Header - UPDATE THIS */}
            <div className="p-4 border-b flex justify-between items-center">
              <div>
                <h3 className="font-semibold">
                  {getOtherParticipant(
                    conversations.find((c) => c.id === currentConversation)!
                  )}
                </h3>
                {listingTitle && (
                  <p className="text-xs text-gray-500 mt-1">
                    About: {listingTitle}
                  </p>
                )}
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>
            {/* ... rest of component ... */}
          </>
        ) : (
          // ...
        )}
      </div>
    </div>
  );
}
```

---

### **Step 2: Contractor Integration (2-3 hours)**

#### **Goal:** Allow homeowners to message contractors about quotes

**2A. Add "Request Quote" Button to Contractor Profile**

```tsx
// File: client/src/pages/contractor-profile.tsx
import { useNavigate } from 'wouter';

export default function ContractorProfile({ slug }: { slug: string }) {
  const navigate = useNavigate();
  const { contractor } = useContractorProfile(slug);
  const { user } = useAuth();

  const handleRequestQuote = async () => {
    try {
      // Create conversation
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractorId: contractor.id,
        }),
      });

      const { conversationId } = await response.json();
      navigate(`/messages?conversationId=${conversationId}`);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  return (
    <div>
      {/* ... contractor details ... */}
      {user?.id !== contractor.userId && (
        <button
          onClick={handleRequestQuote}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Request Quote
        </button>
      )}
    </div>
  );
}
```

**2B. Update Conversation API to Support Contractor Messages**

The existing `/api/conversations` endpoints already support this! Just ensure:

```typescript
// In server/routes.ts - verify this exists:

app.post("/api/conversations", isAuthenticated, async (req: any, res: any) => {
  try {
    const { contractorId } = req.body;
    const homeownerId = req.user.id;

    // Get contractor info
    const contractor = await db
      .select()
      .from(contractors)
      .where(eq(contractors.id, contractorId))
      .limit(1);

    // ... rest of endpoint
  } catch (error) {
    // ...
  }
});
```

---

### **Step 3: Notification Badge Integration (1-2 hours)**

#### **Goal:** Show unread message count in navbar

**3A. Create Unread Messages Hook**

```tsx
// File: client/src/hooks/useUnreadMessages.ts
import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { getMessagingService } from '@/services/messaging-client';

export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const messagingService = getMessagingService();
    
    // Listen for new messages
    messagingService.on('new_message', (message) => {
      if (message.senderId !== user.id && !message.readAt) {
        setUnreadCount(prev => prev + 1);
      }
    });

    // Listen for read receipts
    messagingService.on('message_read', (data) => {
      setUnreadCount(prev => Math.max(0, prev - 1));
    });

    return () => {
      messagingService.off('new_message');
      messagingService.off('message_read');
    };
  }, [user]);

  return unreadCount;
}
```

**3B. Add Badge to Navigation**

```tsx
// File: client/src/components/Navigation.tsx
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { Bell } from 'lucide-react';

export function Navigation() {
  const unreadMessages = useUnreadMessages();

  return (
    <nav>
      {/* ... other nav items ... */}
      <a href="/messages" className="relative">
        <MessageCircle className="w-6 h-6" />
        {unreadMessages > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadMessages > 9 ? '9+' : unreadMessages}
          </span>
        )}
      </a>
    </nav>
  );
}
```

---

### **Step 4: User Profile Integration (1-2 hours)**

#### **Goal:** Show conversation history in user profiles

**4A. Add Conversation History to Profile Page**

```tsx
// File: client/src/pages/profile.tsx
import { MessagingPanel } from '@/components/MessagingPanel';
import { useState } from 'react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [showMessages, setShowMessages] = useState(false);

  return (
    <div>
      {/* ... existing profile info ... */}

      {/* Messaging Section */}
      <section className="mt-8 border-t pt-8">
        <h2 className="text-2xl font-bold mb-4">Conversations</h2>
        {showMessages ? (
          <div className="h-96">
            <MessagingPanel 
              userId={user.id}
              onClose={() => setShowMessages(false)}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowMessages(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Open Messages
          </button>
        )}
      </section>
    </div>
  );
}
```

---

### **Step 5: Notification Center Integration (1-2 hours)**

#### **Goal:** Show message notifications in notification center

**5A. Update Notification Service**

```typescript
// File: server/notification-service.ts
// Add this method to NotificationService class

async sendMessageNotification(userId: string, message: string, conversationId: string) {
  try {
    const notification = await db.insert(notifications).values({
      id: uuidv4(),
      userId,
      type: 'new_message',
      title: 'New Message',
      message,
      metadata: {
        conversationId,
        actionUrl: `/messages?conversationId=${conversationId}`,
      } as any,
      createdAt: new Date(),
    } as any);

    return notification;
  } catch (error) {
    console.error('Error sending message notification:', error);
  }
}
```

**5B. Update Messaging Service to Trigger Notifications**

```typescript
// File: server/messaging-service.ts
// In the send_message handler, add:

import { notificationService } from './notification-service';

// After broadcasting message
await notificationService.sendMessageNotification(
  otherUserId,
  `New message from ${senderType}`,
  conversationId
);
```

---

## 🧪 Integration Testing Checklist

### **Marketplace Integration Tests**

```
Test Suite: Marketplace Messaging
✓ Can click "Contact Seller" on listing
✓ Conversation is created
✓ Redirects to /messages with conversationId
✓ Message history loads
✓ Can send message to seller
✓ Seller receives message in real-time
✓ Seller can reply
✓ Listing title shown in conversation header
✓ Multiple conversations don't interfere
✓ Read receipts work across marketplace
```

### **Contractor Integration Tests**

```
Test Suite: Contractor Messaging
✓ Can click "Request Quote" on contractor profile
✓ Conversation is created (homeowner-contractor)
✓ Redirects to /messages
✓ Contractor can see homeowner messages
✓ Contractor can reply with quote
✓ Quote metadata can be attached
✓ Multiple quote conversations work
```

### **Notification Tests**

```
Test Suite: Message Notifications
✓ Unread badge shows on /messages link
✓ Badge count increases with new messages
✓ Badge count decreases when messages read
✓ Notifications appear in notification center
✓ Notification has action link to conversation
```

### **Performance Tests**

```
Test Suite: Performance
✓ Loading 50 conversations doesn't lag
✓ Sending 10 messages doesn't slow UI
✓ Switching conversations is instant
✓ Typing indicators don't cause jank
✓ Read receipts broadcast instantly
```

---

## 🚀 Deployment Steps

### **Prerequisites**
- Phase 1 deployed to production
- Database migrations run
- Socket.io server running
- Frontend serving at production URL

### **Integration Deployment**

1. **Update Routes**
   - Add marketplace conversation endpoint
   - Add contractor message endpoint
   - Merge all into production build

2. **Update Components**
   - Add "Contact Seller" buttons
   - Add "Request Quote" buttons
   - Update navigation with unread badge

3. **Run Migrations** (if needed)
   - No new database changes needed
   - Existing tables sufficient

4. **Build & Deploy**
   ```bash
   npm run build
   railway up
   # or deploy to Vercel (frontend)
   ```

5. **Smoke Tests**
   ```bash
   # 1. Visit /messages → page loads
   # 2. Visit marketplace → see Contact Seller button
   # 3. Click button → creates conversation
   # 4. Send message → appears in real-time
   # 5. Refresh → message persists
   # 6. Check nav badge → shows unread count
   ```

---

## ⏱️ Estimated Timeline

| Task | Time | Priority |
|------|------|----------|
| Marketplace Integration | 2-3h | HIGH |
| Contractor Integration | 2-3h | HIGH |
| Notification Badge | 1-2h | MEDIUM |
| Profile Integration | 1-2h | MEDIUM |
| Testing & Debugging | 2-3h | HIGH |
| **Total** | **8-13h** | |

---

## 📞 Common Integration Issues

### **Issue: Conversations Don't Appear in List**
- Solution: Verify `lastMessageAt` is updated after message insert
- Check: Database query includes correct user filter

### **Issue: Messages Sent but Not Received**
- Solution: Verify WebSocket connection active
- Check: Socket rooms configured correctly with `conversation:${id}`

### **Issue: Read Receipts Not Updating**
- Solution: Verify `markAsRead` event triggered when message viewed
- Check: `readAt` field updated in database

### **Issue: Unread Badge Not Showing**
- Solution: Verify `useUnreadMessages` hook properly tracking
- Check: Message socket events properly emitted

---

## 🎯 Success Criteria

**Integration is complete when:**
- ✅ Users can message from marketplace listings
- ✅ Users can message contractors
- ✅ Unread message count shows in navbar
- ✅ Messages persist across page reloads
- ✅ Read receipts work correctly
- ✅ No performance degradation
- ✅ All tests pass
- ✅ Smoke tests pass on production

---

## 📊 Next Phases (After Integration)

### **Phase 2: Advanced Messaging (3 weeks)**
- Image upload in messages
- Message search
- Conversation archiving
- Message reactions
- Group messaging

### **Phase 3: Notification System (2 weeks)**
- Email notifications for messages
- SMS notifications
- Push notifications (mobile)
- Notification preferences

### **Phase 4: Video Calls (3 weeks)**
- WebRTC implementation
- In-app video calls
- Call history
- Recording (optional)

---

## 📝 Notes

- All existing endpoints already exist, minimal new code needed
- Socket.io integration handles real-time automatically
- Database schema supports all features
- No breaking changes to existing systems
- Fully backward compatible

---

**Integration Readiness:** ✅ READY  
**Start Date:** After Phase 1 Deployment  
**Estimated Completion:** 1-2 weeks  
**Impact:** Critical path to MVP (messaging essential feature)
