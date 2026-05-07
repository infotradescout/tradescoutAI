# Scout 2.0 Testing Guide

## Overview

Scout 2.0 is now live as an **admin-only feature** at `/api/scout-v2`. This guide shows you how to test and use it.

## Quick Start

### 1. Check Scout 2.0 Status

```bash
curl -X GET http://localhost:3000/api/scout-v2/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "version": "2.0",
  "status": "ready",
  "providers": [
    { "name": "OpenAI Responses", "configured": true },
    { "name": "Vertex Gemini", "configured": false },
    { "name": "Gemini API", "configured": true }
  ],
  "features": {
    "openaiIntegration": true,
    "webSearch": true,
    "buildingCodes": true,
    "pricing": true,
    "tradeGuides": true,
    "localData": true,
    "sourceAttribution": true,
    "confidenceIndicators": true
  },
  "adminOnly": true,
  "timestamp": "2026-05-07T..."
}
```

### 2. Test Building Code Query

```bash
curl -X POST http://localhost:3000/api/scout-v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "message": "Do I need a permit for a deck in Austin?",
    "county": "Travis",
    "state": "TX"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Yes, you need a permit for a deck in Texas if:\n\n• Deck is higher than 30 inches\n• Deck is larger than 200 sq ft\n• Deck is attached to the house\n\nPermit Requirements:\n- Posts must be on concrete footings below frost line\n- Railings required if deck is 30+ inches high\n- Railing spacing must not exceed 4 inches",
  "sources": [
    "TradeScout Building Codes Database",
    "Local Data (Travis, TX)"
  ],
  "confidence": "high",
  "provider": "openai",
  "includesWebSearch": false,
  "disclaimers": [
    "Always verify with your local building department before starting work",
    "Building codes vary by jurisdiction and may have been updated"
  ],
  "timestamp": "2026-05-07T...",
  "scoutVersion": "2.0",
  "adminOnly": true
}
```

### 3. Test Pricing Query

```bash
curl -X POST http://localhost:3000/api/scout-v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "message": "How much does a roof replacement cost?",
    "county": "Harris",
    "state": "TX"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Typical roof replacement in Texas costs $5,000-$25,000\n\nCost Breakdown:\n- Materials: $3,000-$8,000\n- Labor: $2,000-$15,000\n- Permits & Inspections: $500-$1,500\n\nFactors Affecting Cost:\n• Roof size (1,500-3,000 sq ft)\n• Material type (asphalt, metal, tile)\n• Labor rates ($50-$85/hour)\n• Removal of old roofing\n• Structural repairs needed",
  "sources": [
    "TradeScout Pricing Database",
    "Web Search (Real-time)"
  ],
  "confidence": "high",
  "provider": "openai",
  "includesWebSearch": true,
  "disclaimers": [
    "Pricing varies significantly by location and contractor",
    "Get quotes from multiple contractors for accurate estimates"
  ],
  "timestamp": "2026-05-07T...",
  "scoutVersion": "2.0",
  "adminOnly": true
}
```

### 4. Test Trade Guide Query

```bash
curl -X POST http://localhost:3000/api/scout-v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "message": "How do I build a deck?",
    "county": "Travis",
    "state": "TX"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Building a deck requires careful planning, proper materials, and adherence to local building codes.\n\nSteps:\n1. Plan and design (size, layout, materials)\n2. Obtain permits (local building department)\n3. Prepare site (clear area, mark layout)\n4. Install footings (below frost line, concrete)\n5. Build frame (posts, beams, joists)\n6. Add decking (boards and fasteners)\n7. Install railings (safety railings, balusters)\n8. Final touches (stairs, lighting, finishing)\n\nTools Needed:\n- Circular saw or miter saw\n- Power drill\n- Level and measuring tape\n- Post hole digger\n- Nail gun or screwdriver\n\nSafety Tips:\n- Always wear safety glasses and work gloves\n- Use fall protection if working at heights\n- Ensure proper ventilation under the deck\n- Keep work area clear of obstacles\n- Follow all local building codes",
  "sources": [
    "TradeScout Trade Guides",
    "TradeScout Building Codes Database",
    "Local Data (Travis, TX)"
  ],
  "confidence": "high",
  "provider": "openai",
  "includesWebSearch": false,
  "disclaimers": [
    "Always verify with your local building department before starting work"
  ],
  "timestamp": "2026-05-07T...",
  "scoutVersion": "2.0",
  "adminOnly": true
}
```

## Test Cases

### Test Case 1: Building Code Query (Code-Related)
- **Query:** "Do I need a permit for a deck?"
- **Expected:** Building codes + local data + disclaimers
- **Sources:** Building Codes Database, Local Data
- **Confidence:** High

### Test Case 2: Pricing Query (Pricing-Related)
- **Query:** "How much does a roof cost?"
- **Expected:** Pricing data + web search + disclaimers
- **Sources:** Pricing Database, Web Search
- **Confidence:** High

### Test Case 3: Trade Guide Query
- **Query:** "How do I build a deck?"
- **Expected:** Step-by-step guide + tools + safety tips
- **Sources:** Trade Guides, Building Codes, Local Data
- **Confidence:** High

### Test Case 4: General Question
- **Query:** "What is TradeScout?"
- **Expected:** General information
- **Sources:** May vary
- **Confidence:** Medium

### Test Case 5: Fallback Behavior
- **Query:** "Something very specific that's not in the knowledge base"
- **Expected:** Web search results + honest disclaimer
- **Sources:** Web Search
- **Confidence:** Medium

## Testing Checklist

### Functionality
- [ ] Status endpoint returns correct provider configuration
- [ ] Building code queries include jurisdiction-specific data
- [ ] Pricing queries include cost breakdowns
- [ ] Trade guide queries include step-by-step instructions
- [ ] Web search is triggered for pricing/code queries
- [ ] Disclaimers are added automatically
- [ ] Source attribution is included in all responses

### Error Handling
- [ ] Non-admin users get 403 Forbidden
- [ ] Invalid requests get 400 Bad Request
- [ ] Missing OpenAI key falls back to Gemini
- [ ] Network errors are handled gracefully
- [ ] Rate limiting is respected

### Performance
- [ ] Building code queries respond in < 2 seconds
- [ ] Pricing queries with web search respond in < 5 seconds
- [ ] Trade guide queries respond in < 3 seconds
- [ ] No memory leaks after 100+ requests

### Data Quality
- [ ] Building codes are accurate and jurisdiction-specific
- [ ] Pricing data is realistic and regional
- [ ] Trade guides are complete and safe
- [ ] Local data is relevant to the county
- [ ] Web search results are current

## Troubleshooting

### 403 Forbidden Error
**Problem:** "Scout 2.0 is currently available to admin users only"

**Solution:**
1. Verify your user account has admin role
2. Check that your auth token is valid
3. Ensure you're passing the Authorization header

### 500 Internal Server Error
**Problem:** Scout 2.0 returns an error

**Check:**
1. OpenAI API key is set: `echo $OPENAI_API_KEY`
2. OpenAI API is reachable: `curl https://api.openai.com/v1/models`
3. Server logs for detailed error: `tail -f server.log`

**Debug:**
```bash
# Check Scout 2.0 status
curl -X GET http://localhost:3000/api/scout-v2/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Empty or Incomplete Responses
**Problem:** Scout 2.0 returns incomplete answers

**Check:**
1. Query is specific enough (not too vague)
2. County and state are provided for local data
3. LLM provider is configured correctly
4. No rate limiting from OpenAI

**Debug:**
```bash
# Test with a simple query
curl -X POST http://localhost:3000/api/scout-v2 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "message": "What is TradeScout?"
  }'
```

## Integration with Frontend

### Example React Hook

```tsx
import { useState } from "react";

export function useScoutV2() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = async (message: string, county?: string, state?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/scout-v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          county,
          state,
        }),
      });

      if (!response.ok) {
        throw new Error(`Scout 2.0 error: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMsg = (err as Error).message;
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { query, loading, error };
}
```

### Example Component

```tsx
import { useScoutV2 } from "./useScoutV2";
import { ScoutAnswerCard } from "./ScoutSourceAttribution";

export function ScoutV2Demo() {
  const { query, loading } = useScoutV2();
  const [response, setResponse] = useState(null);

  const handleQuery = async (message: string) => {
    const result = await query(message, "Travis", "TX");
    setResponse(result);
  };

  return (
    <div>
      <input
        type="text"
        placeholder="Ask Scout 2.0 a question..."
        onKeyPress={(e) => {
          if (e.key === "Enter") {
            handleQuery((e.target as HTMLInputElement).value);
          }
        }}
      />

      {loading && <p>Scout is thinking...</p>}

      {response && (
        <ScoutAnswerCard
          sources={response.sources}
          confidence={response.confidence}
          disclaimers={response.disclaimers}
        >
          {response.message}
        </ScoutAnswerCard>
      )}
    </div>
  );
}
```

## Next Steps

1. **Test thoroughly** — Try different queries and edge cases
2. **Gather feedback** — Note what works well and what needs improvement
3. **Refine knowledge** — Update mock data based on real-world usage
4. **Optimize performance** — Monitor response times and optimize as needed
5. **Plan rollout** — Decide when to make Scout 2.0 available to all users

## Support

For issues or questions:
1. Check this guide for troubleshooting
2. Review server logs for detailed errors
3. Check OpenAI API status
4. Contact the development team

---

**Scout 2.0 Status:** ✅ Ready for Admin Testing  
**Last Updated:** 2026-05-07  
**Version:** 1.0
