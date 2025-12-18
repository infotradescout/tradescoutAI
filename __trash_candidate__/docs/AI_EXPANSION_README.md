# PHASE 3: AI Expansion - Multi-Model, Fallback, Prompt Versioning

## 1. Multi-Model Architecture
- Integrate multiple LLM providers (e.g., Gemini, OpenAI, local models)
- Use a model router to select the best model per request (based on cost, speed, or user role)
- Example config:
  - `GEMINI_API_KEY`, `OPENAI_API_KEY`, etc. in secrets
  - Add a `model` field to API requests (optional override)

## 2. Fallback Logic
- If primary model fails (timeout, quota, error), auto-fallback to secondary provider
- Log all fallback events for monitoring
- Example pseudocode:
  ```ts
  try {
    return await callGemini(...);
  } catch (e) {
    log('Gemini failed, falling back to OpenAI');
    return await callOpenAI(...);
  }
  ```

## 3. Prompt Versioning
- Store all system prompts with version/timestamp in `server/cache/manual/`
- Add a `promptVersion` field to API responses for traceability
- Allow admin to select or roll back prompt versions via UI

## 4. Implementation Steps
- Refactor backend to support multiple model providers (adapter pattern)
- Add fallback logic in service layer
- Track and expose prompt version in API
- Update admin UI for prompt version management

## 5. Best Practices
- Monitor model usage and fallback rates
- Regularly review and update prompt versions
- Log all model errors and fallbacks for audit
