# TradeScout Folder Contents

## `/client/src/experiments/`

**Purpose:** Experimental/prototype components that are NOT currently used in production.

### Files:
- **scout-landing-lite.tsx** - Alternative Scout chat interface prototype
  - Experimental landing page for Scout feature
  - Has hardcoded slate colors (should update if putting in production)
  - Can be safely ignored or removed if not needed

## `/client/src/scout/`

**Purpose:** Core Scout AI assistant implementation - THE CHAT CONTROLLER for the entire site.

### Core Files:

#### **index.tsx**
- Main entry point for Scout feature
- Exports ScoutOS (the main Scout app)
- This is where Scout is integrated into the main app

#### **ScoutOS.tsx**
- The core Scout operating system component
- Handles the overall Scout experience layout
- Coordinates all Scout sub-components

#### **ScoutHeader.tsx**
- Header/toolbar for Scout interface
- Shows Scout branding and controls

#### **ScoutInput.tsx** + **ScoutInputRow.tsx**
- User message input area
- Input processing and submission
- Text area with hints/suggestions

#### **ScoutThread.tsx**
- Renders the conversation thread/message history
- Displays user messages and Scout responses
- Message formatting and layout

#### **ScoutSuggestions.tsx**
- Suggested actions/queries below the input
- Quick-action buttons for common tasks
- Contextual suggestions

#### **ScoutToolsDrawer.tsx**
- Side drawer with Scout tools and options
- Access to Scout capabilities and settings

#### **ScoutTrending.tsx**
- Shows trending topics or recent activities
- Displays what's happening in the community

#### **ScoutActionRouter.ts**
- Routes Scout actions to appropriate handlers
- Handles tool calls and navigation
- Core logic for executing Scout intents

#### **api.ts**
- API calls to Scout backend
- Message sending, context retrieval
- Integration with backend services

#### **state.ts**
- Scout state management
- Conversation state, user context
- Global Scout state

## Key Points:

1. **Scout is the PRIMARY CONTROLLER** of the entire site (per copilot-instructions.md)
2. All Scout components now use the **Charcoal system** by default
3. Scout components have text-slate colors that should be updated if needed
4. The experiments folder can be cleaned up or used for future prototypes

## Recent Updates:

✅ Made **Charcoal the universal default theme** for all pages
✅ Simplified theme system in `/client/src/lib/themes.ts`
✅ Applied charcoal to:
  - RightToolsPanel
  - AppShell layout
  - MobileAppBar
  - Legal footer
  - All CSS variables

Users can now switch themes while charcoal remains the default.
