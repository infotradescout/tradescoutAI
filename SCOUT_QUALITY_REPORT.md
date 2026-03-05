# Scout Quality Report

Generated: 2026-03-04T00:46:05.852Z

## Summary
- Quality score: 32/32 (100%)
- Prompt count: 8
- Contract: direct output, actionable step, no dead-end, no filler

## Prompt Results
| Prompt | Mode | Score | Expected Route Present | Output Preview |
| --- | --- | --- | --- | --- |
| Open Direct Connect | explicit_nav | 4/4 | yes | Got it - opening Direct Connect. Next: pick a button below. Which option should I run firs |
| Take me to community | explicit_nav | 4/4 | yes | Got it - opening Community. Next: pick a button below. Which option should I run first? |
| Show me marketplace | explicit_nav | 4/4 | yes | Got it - opening Exchange. Next: pick a button below. Which option should I run first? |
| I need a plumber near me | fallback | 4/4 | yes | Scout had a connection issue. You can keep moving with trusted, recent options and take ac |
| Find a contractor for roof repair | fallback | 4/4 | yes | Scout had a connection issue. You can keep moving with trusted, recent options and take ac |
| I want to buy tools | fallback | 4/4 | yes | Scout had a connection issue. You can keep moving with trusted, recent options and take ac |
| Help me post in community | fallback | 4/4 | yes | Scout had a connection issue. You can keep moving with trusted, recent options and take ac |
| Open notes | explicit_nav | 4/4 | yes | Got it - opening Notes. Next: pick a button below. Which option should I run first? |

## Detailed Checks

### Open Direct Connect
- Mode: explicit_nav
- Routes: /direct-connect
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Got it - opening Direct Connect. Next: pick a button below. Which option should I run first?

### Take me to community
- Mode: explicit_nav
- Routes: /community
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Got it - opening Community. Next: pick a button below. Which option should I run first?

### Show me marketplace
- Mode: explicit_nav
- Routes: /exchange
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Got it - opening Exchange. Next: pick a button below. Which option should I run first?

### I need a plumber near me
- Mode: fallback
- Routes: /direct-connect/pros, /direct-connect, /contractors
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Scout had a connection issue. You can keep moving with trusted, recent options and take action now. Next: pick a button below. Which option should I run first?

### Find a contractor for roof repair
- Mode: fallback
- Routes: /direct-connect/pros, /exchange, /community
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Scout had a connection issue. You can keep moving with trusted, recent options and take action now. Next: pick a button below. Which option should I run first?

### I want to buy tools
- Mode: fallback
- Routes: /direct-connect/pros, /exchange, /direct-connect
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Scout had a connection issue. You can keep moving with trusted, recent options and take action now. Next: pick a button below. Which option should I run first?

### Help me post in community
- Mode: fallback
- Routes: /community, /direct-connect, /contractors
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Scout had a connection issue. You can keep moving with trusted, recent options and take action now. Next: pick a button below. Which option should I run first?

### Open notes
- Mode: explicit_nav
- Routes: /notes
- Checks: route=pass, actionable=pass, no_dead_end=pass, no_filler=pass
- Output: Got it - opening Notes. Next: pick a button below. Which option should I run first?

