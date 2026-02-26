# Scout Quality Report

Generated: 2026-02-26T00:36:47.247Z

## Summary
- Quality score: 32/32 (100%)
- Prompt count: 8
- Contract: direct output, actionable step, no dead-end, no filler

## Prompt Results
| Prompt | Mode | Score | Expected Route Present | Output Preview |
| --- | --- | --- | --- | --- |
| Open Direct Connect | explicit_nav | 4/4 | yes | Got it - opening Direct Connect. Next: choose one action below to continue. |
| Take me to community | explicit_nav | 4/4 | yes | Got it - opening Community. Next: choose one action below to continue. |
| Show me marketplace | explicit_nav | 4/4 | yes | Got it - opening Exchange. Next: choose one action below to continue. |
| I need a plumber near me | fallback | 4/4 | yes | Scout had a connection issue. You can keep moving with trusted, recent options and take ac |
| Find a contractor for roof repair | fallback | 4/4 | yes | Scout had a connection issue. You can keep moving with trusted, recent options and take ac |
| I want to buy tools | fallback | 4/4 | yes | Scout had a connection issue. You can keep moving with trusted, recent options and take ac |
| Help me post in community | fallback | 4/4 | yes | Scout had a connection issue. You can keep moving with trusted, recent options and take ac |
| Open notes | explicit_nav | 4/4 | yes | Got it - opening Notes. Next: choose one action below to continue. |

## Detailed Checks

### Open Direct Connect
- Mode: explicit_nav
- Routes: /direct-connect
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Got it - opening Direct Connect. Next: choose one action below to continue.

### Take me to community
- Mode: explicit_nav
- Routes: /community
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Got it - opening Community. Next: choose one action below to continue.

### Show me marketplace
- Mode: explicit_nav
- Routes: /exchange
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Got it - opening Exchange. Next: choose one action below to continue.

### I need a plumber near me
- Mode: fallback
- Routes: /direct-connect/pros, /direct-connect, /contractors
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Scout had a connection issue. You can keep moving with trusted, recent options and take action now. Next: choose one action below to continue.

### Find a contractor for roof repair
- Mode: fallback
- Routes: /direct-connect/pros, /exchange, /community
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Scout had a connection issue. You can keep moving with trusted, recent options and take action now. Next: choose one action below to continue.

### I want to buy tools
- Mode: fallback
- Routes: /direct-connect/pros, /exchange, /direct-connect
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Scout had a connection issue. You can keep moving with trusted, recent options and take action now. Next: choose one action below to continue.

### Help me post in community
- Mode: fallback
- Routes: /community, /direct-connect, /contractors
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Scout had a connection issue. You can keep moving with trusted, recent options and take action now. Next: choose one action below to continue.

### Open notes
- Mode: explicit_nav
- Routes: /notes
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Got it - opening Notes. Next: choose one action below to continue.

