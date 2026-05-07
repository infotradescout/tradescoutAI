# Scout 2.0 Codex Handoff

**Project:** Trade Scout Intelligence Engine
**Component:** Scout 2.0 (The Data Factory)
**Integration:** LISA (The Interstate)
**Date:** May 2026

---

## 1. System Architecture

Scout 2.0 is a multi-source intelligence engine designed to act as the "Data Factory" for Trade Scout. It actively scouts for building codes, material prices, and market conditions, synthesizes the findings, and feeds them into the LISA decision engine.

### The Core Flow
1. **Mission Trigger:** User or scheduled job initiates a scouting mission.
2. **Multi-Source Gathering:** Scout queries the Knowledge Base (Primary), Local Data (Secondary), and Live Web (Tertiary).
3. **Synthesis:** The LLM synthesizes the data, resolving conflicts based on source priority.
4. **Optimization:** Responses are cached, deduplicated, and token-optimized to reduce API costs by 50-70%.
5. **LISA Conversion:** Findings are converted into `LisaFeedItem` objects.
6. **Persistence:** Findings are stored in the `scout_lisa_findings` table.
7. **Routing:** LISA consumes the findings and routes them to the appropriate UI surfaces.

---

## 2. The Intelligence Layers

### Multi-Source Synthesis (`scoutMultiSourceSynthesis.ts`)
Scout 2.0 relies on a strict hierarchy of truth:
1. **TradeScout Knowledge Base** (Highest Trust)
2. **Local Jurisdiction Data** (Overrides general web data)
3. **Live Web Search** (General market context)

### Cost Optimization Engine (`scoutOptimizationEngine.ts`)
A 4-layer strategy to minimize API spend:
- **Response Caching:** Memory lookup for repeated queries (20-30% reduction).
- **Query Routing:** FAQ pattern matching to skip LLM processing (40-60% reduction).
- **Request Deduplication:** Tracks in-flight requests to prevent double-charging.
- **Token Optimization:** Compresses prompts before LLM execution (30-50% reduction).

### Visual Scouting Command Center (`scout-heatmap.ts`)
The Geography Heatmap transformed into a visual file sorting system:
- **Regional Intelligence Browser:** Sidebar showing county-specific findings, contractors, and files.
- **Draggable Data Tray:** Visual drag-and-drop assignment of files to counties.
- **Heatmap Intelligence Layer:** Visualizes Scout findings directly on the map.

---

## 3. LISA Integration

Scout 2.0 is fully wired into the LISA decision engine.

### The Converter (`scoutToLisaConverter.ts`)
Transforms Scout intelligence into the exact format LISA expects:
- Maps Scout confidence (`high`, `medium`, `low`) to LISA priority (`critical`, `high`, `medium`, `low`).
- Builds precise scope references (e.g., `48453` for Travis County, `trade:electrical`).
- Formats narratives into the required "What, Why, What to do" structure.

### The Persistence Layer (`scoutLisaPersistence.ts`)
Stores the converted findings so LISA can consume them:
- **Table:** `scout_lisa_findings`
- **Features:** Evidence hashing, deduplication, TTL-based expiration.
- **Cleanup:** Automated hourly job (`scoutLisaCleanupJob.ts`) removes stale intelligence.

---

## 4. Key Services & Routes

### Active Routes
- `POST /api/scout-v2` — The main Scout 2.0 engine (Admin only).
- `POST /api/scout-v2-learning` — Scout 2.0 with the learning pipeline.
- `GET /api/scout-heatmap/*` — Endpoints for the Visual Command Center.

### Core Services
- `scoutMemoryService.ts` — Caching and deduplication.
- `scoutMultiSourceSynthesis.ts` — Source prioritization and synthesis.
- `scoutOptimizationEngine.ts` — Query routing and token compression.
- `scoutStreamingHandler.ts` — Real-time SSE responses.
- `scoutToLisaConverter.ts` — LISA format conversion.
- `scoutLisaPersistence.ts` — Database storage for LISA findings.

---

## 5. Operational Guidelines

### Brand Separation
Scout 2.0 is currently configured **strictly for Trade Scout**. It does not mix data with Trader's Corner or MealScout. The knowledge base, local data, and web search are all scoped to construction, trades, codes, and pricing.

### The "No Fake Data" Rule
Scout 2.0 uses a real data loader (`scoutKnowledgeLoader.ts`) that reads directly from the `data/TradeScout Brain/40_KNOWLEDGE/` directory. If data is missing, Scout reports "not yet indexed" rather than inventing placeholders.

### Active Scouting vs. Chat
Scout is an intelligence tool, not a chatbot. The UI and system prompts are designed around "Scouting Missions" and "Scouting Reports," emphasizing active intelligence gathering over conversational back-and-forth.

---

## 6. Next Steps for Deployment

1. **Database Migration:** Ensure the `scout_lisa_findings` table is created in production.
2. **Admin Testing:** Use the `/api/scout-v2` endpoint to run test missions.
3. **LISA Routing:** Configure LISA rules to route the new `scout_intelligence` source kind to the appropriate UI surfaces.
4. **Heatmap Rollout:** Deploy the Visual Scouting Command Center to the admin dashboard for spatial data organization.
