# Scout Phase 2 Implementation: Multi-Turn Reasoning with Tool Result Feedback

## Overview

Phase 2 introduces **multi-turn reasoning with tool result feedback**, enabling Scout to execute tools, analyze their results, and make intelligent decisions about what to do next. This is a major leap in Scout's autonomy and capability.

## What's New in Phase 2

### 1. Multi-Turn Reasoning Loop
Scout can now engage in multiple reasoning turns within a single user request:
- **Turn 1:** User asks a question → Scout plans and executes initial tools
- **Turn 2:** Scout analyzes the results → Decides if more tools are needed
- **Turn 3:** Scout executes additional tools if necessary → Provides final answer

This allows Scout to handle complex requests that require multiple steps of information gathering and analysis.

### 2. Tool Result Feedback
Scout now receives detailed feedback about tool execution:
- **Success/Failure Status:** Whether the tool call succeeded
- **Execution Time:** How long the tool took to execute
- **Result Data:** The actual data returned by the tool
- **Error Messages:** Clear error messages if something went wrong

Scout uses this feedback to decide its next action.

### 3. Adaptive Tool Selection
Based on tool results, Scout can:
- **Call a different tool** if the first one didn't return useful data
- **Refine parameters** based on what it learned from previous results
- **Fall back to alternatives** if a tool fails (e.g., use web_search if local data is insufficient)
- **Stop and provide an answer** if it has enough information

### 4. Outcome Validation
Scout validates whether tool results match its expectations:
- If results are as expected → Confidence increases
- If results are unexpected → Scout notes this and may try a different approach
- If results are incomplete → Scout identifies gaps and calls additional tools

## New Endpoints

### POST `/api/scout-enhanced-v2/message-v2`
The main endpoint for multi-turn reasoning.

**Request:**
```json
{
  "message": "Find me a roofing contractor in Harris County, Texas",
  "conversationHistory": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "max_reasoning_turns": 3
}
```

**Response:**
```json
{
  "intent": "find_contractor",
  "state_acknowledgment": { ... },
  "planning": { ... },
  "thought_flow": [ ... ],
  "tool_calls": [ ... ],
  "decision": "...",
  "message": "Based on your location in Harris County, Texas, I found 3 qualified roofing contractors...",
  "reflection": { ... },
  "tool_results": [
    {
      "tool_name": "search_contractors",
      "parameters": { "trade": "roofing", "county": "Harris" },
      "result": { ... },
      "success": true,
      "execution_time_ms": 245,
      "timestamp": "2026-02-21T12:34:56Z"
    }
  ],
  "multi_turn_context": {
    "reasoning_turns": 2,
    "is_complete": true,
    "tool_execution_history": [ ... ]
  },
  "suggestedActions": [ ... ]
}
```

### GET `/api/scout-enhanced-v2/capabilities`
Retrieve Scout's capabilities and configuration.

**Response:**
```json
{
  "version": "v2",
  "features": {
    "structured_reasoning": true,
    "dynamic_tool_invocation": true,
    "tool_result_feedback": true,
    "multi_turn_reasoning": true,
    "error_recovery": true,
    "outcome_validation": true
  },
  "config": { ... },
  "max_reasoning_turns": 3,
  "supported_tools": [
    "search_contractors",
    "search_marketplace",
    "get_county_data",
    "web_search",
    "message_user",
    "create_project"
  ]
}
```

### POST `/api/scout-enhanced-v2/test-multi-turn`
Test Scout's multi-turn reasoning with predefined scenarios.

**Request:**
```json
{
  "message": "Find contractors near me",
  "scenario": "contractor_search"
}
```

## How Multi-Turn Reasoning Works

### Example: User asks "Find me a roofing contractor in my area"

**Turn 1: Initial Planning**
```
Scout's thought process:
1. User is asking for a contractor (intent: find_contractor)
2. I need to know: user's location, available roofing contractors
3. I'll first search for contractors in their county
```

Scout calls: `search_contractors` with parameters `{ trade: "roofing", county: "Harris" }`

**Turn 2: Result Analysis**
```
Scout receives:
- 5 roofing contractors found
- All have ratings and contact info
- Some are WACO certified

Scout's reflection:
- I have good data about contractors
- I should provide this to the user
- I have high confidence in this answer
- No additional tools needed
```

Scout provides final message with contractor information.

**Result:** User gets a complete, well-researched answer in 2 turns.

## Configuration

Enable Phase 2 features by updating your `.env`:

```env
# Enable enhanced Scout features
SCOUT_ENHANCED_ENABLED=true

# Use the enhanced v2 system prompt
SCOUT_USE_ENHANCED_PROMPT=true

# Set prompt version to v2
SCOUT_PROMPT_VERSION=v2
```

## System Prompt

The new system prompt (`system_prompt_enhanced_v2.md`) includes:

1. **Multi-Turn Reasoning Protocol:** Detailed instructions for how Scout should behave across multiple reasoning turns
2. **Tool Result Analysis:** How to interpret tool results and decide next steps
3. **Adaptive Strategy:** How to adjust approach based on what you learn
4. **Outcome Validation:** How to check if results match expectations

Key sections:
- Hard Identity Rules
- Enhanced Execution Contract v2.1
- Enhanced Response Schema v2.1
- Multi-Turn Reasoning Protocol (NEW)
- Dynamic Tool Invocation Protocol
- Data Source Hierarchy
- Self-Correction and Learning

## Implementation Details

### Tool Execution History

Each tool execution is recorded with metadata:
```typescript
interface ToolExecutionResult {
  tool_name: string;
  parameters: Record<string, any>;
  result: any;
  success: boolean;
  error?: string;
  execution_time_ms: number;
  timestamp: string;
}
```

This history is provided to Scout in subsequent reasoning turns, allowing it to:
- See what tools have already been called
- Understand what data was retrieved
- Avoid calling the same tool twice with identical parameters
- Learn from failures and try alternative approaches

### Reasoning Turn Limit

By default, Scout can perform up to 3 reasoning turns per request:
- **Turn 1:** Initial planning and tool execution
- **Turn 2:** Result analysis and adaptive tool selection
- **Turn 3:** Final refinement and answer preparation

This limit prevents infinite loops and ensures timely responses.

### Completion Criteria

Scout stops reasoning when:
1. It reaches the maximum number of reasoning turns
2. It has high confidence in its answer
3. It has no more tools to call
4. It explicitly decides it has enough information

## Testing Phase 2

### Test Scenario 1: Contractor Search
```bash
curl -X POST http://localhost:5000/api/scout-enhanced-v2/message-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Find me a licensed electrician in my county",
    "conversationHistory": [],
    "max_reasoning_turns": 3
  }'
```

### Test Scenario 2: Marketplace Browse
```bash
curl -X POST http://localhost:5000/api/scout-enhanced-v2/message-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show me available tools and equipment for rent",
    "conversationHistory": [],
    "max_reasoning_turns": 2
  }'
```

### Test Scenario 3: Project Creation
```bash
curl -X POST http://localhost:5000/api/scout-enhanced-v2/message-v2 \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I need to post a roofing project and find contractors",
    "conversationHistory": [],
    "max_reasoning_turns": 3
  }'
```

## Monitoring and Debugging

### Check Configuration
```bash
curl http://localhost:5000/api/scout-enhanced-v2/config
```

### Check Capabilities
```bash
curl http://localhost:5000/api/scout-enhanced-v2/capabilities
```

### Monitor Tool Execution
The response includes `tool_results` with execution times and success status:
```json
"tool_results": [
  {
    "tool_name": "search_contractors",
    "execution_time_ms": 245,
    "success": true,
    "timestamp": "2026-02-21T12:34:56Z"
  }
]
```

## Performance Considerations

### Latency
- Each reasoning turn adds ~500-2000ms (depending on tool execution time)
- Multi-turn requests may take 2-6 seconds total
- Consider implementing request timeouts on the frontend

### Cost
- Each reasoning turn calls the LLM once
- Tool executions may incur database or API costs
- Monitor tool execution times to identify bottlenecks

### Optimization
- Set `max_reasoning_turns` to 2 for faster responses (sacrifices some intelligence)
- Cache tool results when possible
- Implement request deduplication to avoid duplicate tool calls

## Error Handling and Recovery

Scout implements error recovery strategies:

1. **Tool Failure:** If a tool fails, Scout notes the error and tries an alternative
2. **Unexpected Results:** If results don't match expectations, Scout may call another tool
3. **Incomplete Data:** If data is incomplete, Scout identifies gaps and attempts to fill them
4. **Timeout:** If a tool takes too long, Scout may skip it and try alternatives

All errors are documented in the `reflection` section of the response.

## Next Steps (Phase 3)

After Phase 2 is stable, consider implementing:

1. **Contextual Awareness:** Scout remembers previous conversations and uses them to inform current decisions
2. **Proactive Engagement:** Scout suggests actions before being asked
3. **Learning from Feedback:** Scout improves based on user feedback
4. **Specialized Agents:** Domain-specific agents for different types of requests

## Troubleshooting

### Scout isn't calling tools
- Check that `SCOUT_ENHANCED_ENABLED=true` in your `.env`
- Verify that the LLM is returning valid JSON with `tool_calls` array
- Check logs for LLM API errors

### Tools are failing
- Verify that `executeAssistantAction` is properly configured
- Check that tool names match approved tool categories
- Review tool parameters for correctness

### Multi-turn reasoning isn't working
- Ensure `max_reasoning_turns` is > 1
- Check that the LLM is receiving tool execution history
- Verify that the system prompt is loading correctly

## Support

For issues or questions:
1. Review the enhanced system prompt (`system_prompt_enhanced_v2.md`)
2. Check the scout-enhanced-v2 router code
3. Review the implementation guide (`SCOUT_PHASE_2_IMPLEMENTATION.md`)
4. Check logs for error messages and stack traces

---

**Version:** 2.0
**Date:** February 21, 2026
**Status:** Ready for Integration
