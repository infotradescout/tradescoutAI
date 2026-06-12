# TradeScout Knowledge Base Structure

This folder (`data/TradeScout Brain/`) is the **canonical source of truth** for Scout's knowledge and memory.

## Directory Structure

- **`00_CORE/`** - Core system knowledge
  - `specs/` - Canonical specifications Scout should know about
    - `TRADESCOUT_FULL_SPECIFICATION.md` - Complete system spec
    - `USER_FEATURES_SUMMARY.md` - Feature summary for users
  - System prompts, architecture notes, core concepts
  
- **`10_BRAND/`** - Brand voice, messaging, tone
  - Marketing copy, brand guidelines, value propositions
  
- **`20_OFFERS/`** - Product offerings and pricing
  - Service tiers, pricing, package descriptions
  
- **`30_SOPS/`** - Standard operating procedures
  - How Scout should handle common requests
  - Escalation paths, compliance notes
  
- **`40_KNOWLEDGE/`** - Domain knowledge
  - County-specific guides, industry info
  - Services, trades, best practices
  
- **`50_FAQ/`** - Frequently asked questions
  - Common user questions and Scout's answers
  
- **`60_TECH/`** - Technical documentation
  - API docs, system architecture, deployment info
  
- **`70_FINANCE/`** - Financial information
  - Pricing structures, payment info, economics
  
- **`80_LEGAL/`** - Legal and compliance
  - Terms, privacy, disclaimers

## How Scout Uses This

1. **Ingest**: `server/services/knowledgeService.ts` scans these directories on startup
2. **Cache**: Files are cached in `server/cache/` for fast lookup
3. **Retrieval**: When you search, Scout uses these docs
4. **Synthesis**: Scout combines search results + context to generate responses

## Important Rules

✅ **DO**:
- Drop all long-term knowledge files here
- Use markdown (.md) for text docs
- Organize by topic in the numbered folders
- Name files descriptively (e.g., `contractor-vetting-guide.md`)

❌ **DON'T**:
- Drop files in the repo root and expect Scout to find them
- Use random folder names outside this structure
- Add binary files (use cloud storage or links instead)
- Leave docs scattered across the filesystem

## Adding Knowledge

To add a new knowledge document:

```bash
# 1. Write your doc (markdown preferred)
# 2. Place it in the appropriate folder under data/TradeScout Brain/
# 3. Restart the server or trigger a knowledge sync
# 4. Scout will ingest it on next startup or API call
```

## Current Documents

- `TRADESCOUT_FULL_SPECIFICATION.md` - 01_CORE/specs/ (moved from root)
- `USER_FEATURES_SUMMARY.md` - 00_CORE/specs/ (moved from root)
- `Community_Impact_and_Giveback.md` - root level
- `knowledge base 1.0.docx` - root level (DOCX support enabled in knowledgeService.ts)

## Caching Strategy

- Knowledge is cached in `server/cache/` with a 5-minute TTL
- Cache is invalidated when files change
- For development, delete `server/cache/*` to force a fresh ingest

## Questions?

If Scout isn't finding a document you added:

1. Check that the file is under `data/TradeScout Brain/`
2. Verify the file extension is `.md`, `.txt`, or `.docx`
3. Restart the dev server: `npm run dev`
4. Check server logs for knowledge ingest messages
