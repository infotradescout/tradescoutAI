# Scout Implementation Guide

## Overview

This guide documents the improvements made to the Scout AI assistant in tradescoutAI to enable:

1. **OpenAI Integration** — Primary LLM provider with fallback to Gemini
2. **Real-Time Web Search** — Using OpenAI's Responses API with web_search tool
3. **Smart Knowledge Integration** — Building codes, material prices, trade guides
4. **Trust-First UI** — Clear source attribution and confidence indicators

---

## Changes Made

### 1. Enhanced Web Search Service

**File:** `server/services/webSearchService.ts`

**What Changed:**
- Added `webSearchWithOpenAI()` function that uses the OpenAI Responses API with the built-in `web_search` tool
- Implemented intelligent fallback: tries OpenAI first, falls back to Gemini if OpenAI fails or is not configured
- Added proper source attribution in response objects

**Key Features:**
- Real-time web search (not just model training data)
- Returns structured results with source information
- Handles errors gracefully with fallback logic

**Usage:**
```typescript
import { webSearch } from "./services/webSearchService";

const result = await webSearch("roofing costs Austin Texas", 5);
if (result.success) {
  console.log(result.content);  // Search results
  console.log(result.provider); // "openai-web-search" or "gemini:..."
}
```

### 2. OpenAI Provider Implementation

**File:** `server/services/llmProvider.ts`

**What Changed:**
- `OpenAIResponsesProvider` class is already implemented (lines 78-131)
- Supports structured JSON output via JSON Schema
- Handles reasoning effort configuration for advanced models
- Integrates with the existing failover system

**Key Features:**
- Supports multiple OpenAI models (gpt-5, gpt-5.4-mini, etc.)
- Configurable via environment variables:
  - `SCOUT_OPENAI_MODEL_DEFAULT` — Standard model
  - `SCOUT_OPENAI_MODEL_FAST` — Fast/cheap model
  - `SCOUT_OPENAI_MODEL_REASONING` — Reasoning model
  - `SCOUT_OPENAI_TIMEOUT_MS` — Request timeout
  - `SCOUT_OPENAI_MAX_OUTPUT_TOKENS` — Max output length
  - `SCOUT_OPENAI_SERVICE_TIER` — Priority tier (auto, default, flex, scale, priority)

**Provider Order:**
- Configured via `SCOUT_LLM_PROVIDER_ORDER` environment variable
- Default: `openai,vertex,gemini`
- Each provider is tried in order until one succeeds

### 3. Knowledge Integration Service

**File:** `server/services/scoutKnowledgeIntegration.ts`

**What Changed:**
- Created new service to detect code-related and pricing-related queries
- Provides `buildEnrichedPrompt()` function to inject knowledge context into prompts
- Extracts relevant knowledge from the knowledge base

**Key Features:**
- Detects building code queries (permit, inspection, zoning, etc.)
- Detects pricing queries (cost, estimate, budget, etc.)
- Builds system prompts that include relevant knowledge context
- Tracks data sources for attribution

**Usage:**
```typescript
import { buildEnrichedPrompt, isCodeRelatedQuery } from "./services/scoutKnowledgeIntegration";

const enriched = buildEnrichedPrompt(
  "Do I need a permit for a deck?",
  { query: "...", county: "Travis", state: "TX", trade: "carpentry" },
  { codes: "Texas deck building code requirements...", guides: "..." }
);

// enriched.systemPrompt now includes the knowledge context
// enriched.sources = ["TradeScout Building Codes Database", ...]
```

---

## Integration Points

### Backend Route: `server/routes/scout.ts`

**Current Flow:**
1. User sends message to `/api/scout`
2. Decision pipeline classifies intent
3. Knowledge service retrieves relevant data
4. LLM provider generates response
5. Response is returned to frontend

**To Integrate Knowledge:**
```typescript
// In server/routes/scout.ts, around line 3306:

import { buildEnrichedPrompt, extractRelevantKnowledge } from "../services/scoutKnowledgeIntegration";

// After resolving knowledge:
const trade = extractTradeFromIntent(request.intent); // Implement based on intent
const relevantKnowledge = extractRelevantKnowledge(request.message, trade);

// Build enriched prompt with knowledge context
const enriched = buildEnrichedPrompt(
  request.message,
  {
    query: request.message,
    county: countyCode,
    state: stateCode,
    trade: trade,
    intent: request.intent,
  },
  relevantKnowledge
);

// Use enriched.systemPrompt when calling the LLM
const response = await generateWithFallback(enriched.systemPrompt, providers, options);
```

### Frontend: `client/src/scout/ScoutOS.tsx`

**Current Structure:**
- `ScoutThread` component displays messages
- `ScoutInputRow` handles user input
- `ScoutActionRouter` executes actions

**To Add Source Attribution:**
1. Modify `ScoutThread` to display source badges
2. Add confidence indicator (high/medium/low)
3. Show "Based on [source]" labels for each answer

**Example UI Enhancement:**
```tsx
// In ScoutThread component, render source attribution:
<div className="text-xs text-gray-400 mt-2">
  {message.sources?.map(source => (
    <span key={source} className="mr-2">
      📍 {source}
    </span>
  ))}
</div>
```

---

## Environment Configuration

### Required Environment Variables

```bash
# OpenAI API
export OPENAI_API_KEY=sk-...

# LLM Provider Configuration
export SCOUT_LLM_PROVIDER_ORDER=openai,vertex,gemini
export SCOUT_OPENAI_MODEL_DEFAULT=gpt-5.4-mini
export SCOUT_OPENAI_MODEL_FAST=gpt-5.4-nano
export SCOUT_OPENAI_MODEL_REASONING=gpt-5.5
export SCOUT_OPENAI_TIMEOUT_MS=20000
export SCOUT_OPENAI_MAX_OUTPUT_TOKENS=900
export SCOUT_OPENAI_SERVICE_TIER=auto

# Fallover Configuration
export SCOUT_LLM_PROVIDER_FAILURE_THRESHOLD=3
export SCOUT_LLM_PROVIDER_COOLDOWN_MS=120000
```

### Optional: Gemini Fallback

```bash
export GEMINI_API_KEY=...
export GOOGLE_PROJECT_ID=...
export GOOGLE_VERTEX_LOCATION=...
```

---

## Data Flow: Building Codes Example

**User Query:** "Do I need a permit for a deck in Austin?"

**Flow:**
1. Frontend sends to `/api/scout`
2. Backend detects `isCodeRelatedQuery()` → true
3. Extracts trade: "carpentry" or "deck building"
4. Loads relevant knowledge from `data/TradeScout Brain/40_KNOWLEDGE/41_BUILDING_CODES/`
5. Builds enriched prompt with code context
6. OpenAI generates response with code references
7. Response includes source: "TradeScout Building Codes Database"
8. Frontend displays with badge: "📍 Based on Texas Building Code"

---

## Data Flow: Pricing Example

**User Query:** "How much does a roof replacement cost?"

**Flow:**
1. Frontend sends to `/api/scout`
2. Backend detects `isPricingRelatedQuery()` → true
3. Loads pricing data from `data/TradeScout Brain/40_KNOWLEDGE/43_MARKETS_PRICING/`
4. If pricing is outdated, triggers web search for current material prices
5. Builds enriched prompt with pricing ranges
6. OpenAI generates response with price ranges and factors
7. Response includes sources: "TradeScout Pricing Database" + "Web Search (current market prices)"
8. Frontend displays with timestamp: "Last updated: [date]"

---

## Data Flow: Web Search Fallback

**User Query:** "What are the new electrical codes for 2025?"

**Flow:**
1. Frontend sends to `/api/scout`
2. Backend detects code-related query
3. Checks local knowledge base → data is from 2024
4. Triggers `webSearch("electrical codes 2025")` via OpenAI
5. OpenAI's web_search tool returns current results
6. Builds response combining local knowledge + web results
7. Response clearly indicates: "Local data is from 2024. For 2025 updates, I searched the web and found..."
8. Frontend displays with clear source separation

---

## Testing the Implementation

### 1. Test OpenAI Provider

```bash
# In server/routes/scout.ts, add a test endpoint:
app.post("/api/scout/test-openai", async (req, res) => {
  const providers = buildScoutLlmProviders();
  const result = await generateWithFallback(
    "What is TradeScout?",
    providers
  );
  res.json(result);
});
```

### 2. Test Web Search

```bash
# Test endpoint:
app.post("/api/scout/test-web-search", async (req, res) => {
  const result = await webSearch(req.body.query, 5);
  res.json(result);
});
```

### 3. Test Knowledge Integration

```bash
# Test endpoint:
app.post("/api/scout/test-knowledge", async (req, res) => {
  const enriched = buildEnrichedPrompt(
    req.body.query,
    req.body.context,
    req.body.knowledge
  );
  res.json(enriched);
});
```

---

## Next Steps

### Phase 1: Complete (Done)
- ✅ OpenAI provider implementation
- ✅ Web search service enhancement
- ✅ Knowledge integration service

### Phase 2: Integration (In Progress)
- [ ] Wire knowledge integration into scout route
- [ ] Add source attribution to frontend
- [ ] Test end-to-end with sample queries

### Phase 3: Optimization (Future)
- [ ] Load and parse .docx files from knowledge base
- [ ] Implement vector embeddings for semantic search
- [ ] Add caching for frequently asked questions
- [ ] Implement confidence scoring

### Phase 4: UI/UX (Future)
- [ ] Design source attribution badges
- [ ] Add confidence indicators
- [ ] Mobile-first responsive layout
- [ ] Trust signals (verified data, last updated, etc.)

---

## Troubleshooting

### OpenAI Provider Not Being Used

**Check:**
1. `OPENAI_API_KEY` is set and valid
2. `SCOUT_LLM_PROVIDER_ORDER` includes "openai"
3. Check server logs for provider failures
4. Verify `buildScoutLlmProviders()` is creating OpenAI provider

**Debug:**
```typescript
const providers = buildScoutLlmProviders();
console.log(providers.map(p => ({ name: p.name, id: p.id, configured: p.isConfigured() })));
```

### Web Search Returning Empty Results

**Check:**
1. OpenAI API key is valid
2. Query is specific enough
3. Check for rate limiting (429 errors)
4. Verify Gemini fallback is working

**Debug:**
```typescript
const result = await webSearch("test query", 5);
console.log(result);
```

### Knowledge Not Being Injected

**Check:**
1. `isCodeRelatedQuery()` or `isPricingRelatedQuery()` is detecting the query
2. Knowledge files exist in `data/TradeScout Brain/40_KNOWLEDGE/`
3. `extractRelevantKnowledge()` is returning data

**Debug:**
```typescript
console.log(isCodeRelatedQuery("Do I need a permit?"));
console.log(extractRelevantKnowledge("Do I need a permit?", "carpentry"));
```

---

## Files Modified/Created

| File | Status | Purpose |
|------|--------|---------|
| `server/services/webSearchService.ts` | Modified | Enhanced web search with OpenAI support |
| `server/services/llmProvider.ts` | Reviewed | OpenAI provider already implemented |
| `server/services/scoutKnowledgeIntegration.ts` | Created | Knowledge detection and enrichment |
| `server/routes/scout.ts` | Needs Integration | Wire up knowledge integration |
| `client/src/scout/ScoutOS.tsx` | Needs Enhancement | Add source attribution UI |
| `SCOUT_IMPLEMENTATION_GUIDE.md` | Created | This document |

---

## References

- [OpenAI Responses API Documentation](https://platform.openai.com/docs/api-reference/responses)
- [OpenAI Web Search Tool](https://platform.openai.com/docs/guides/web-search)
- [TradeScout System Prompt](server/cache/manual/system_prompt.md)
- [Knowledge Base Structure](data/TradeScout%20Brain/40_KNOWLEDGE/)

---

**Last Updated:** 2026-05-07  
**Version:** 1.0  
**Status:** Implementation Guide Ready for Integration
