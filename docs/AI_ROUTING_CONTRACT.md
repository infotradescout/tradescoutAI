AI Routing Contract — TradeScout (v2026-01)

All AI assistance follows this routing order:

1. Authority Router (Merlin / Chat Interface)
   - Interprets TradeScout Law
   - Approves scope
   - Assigns task class
   - Selects execution model

2. Execution Models (ChatGPT 5.x)
   - Implement only the approved scope
   - Escalate on protected zones
   - Never reinterpret system law

3. Analysis Models (Gemini)
   - Read-only analysis
   - No code changes
   - No refactors
   - No behavior changes

Rules:
- Models are tools, not decision-makers
- Authority always outranks speed
- If model capability conflicts with system law, the task is blocked
- Silent optimization is forbidden

This contract overrides model defaults and IDE suggestions.
