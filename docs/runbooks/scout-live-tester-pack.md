# Scout Live Tester Pack

## Purpose
Run fast, natural-behavior validation of Scout payload continuity and destination completion across Direct Connect, Exchange, and Community.

## Psychological Intent
- Target belief: "Scout gets me to the right next step without making me retype everything."
- Target behavior: tester clicks the first Scout action and attempts completion.
- Principle: reduce cognitive load and preserve trust through prefilled continuity.
- Risk prevented: false conversion confidence from click-only data and manual tester over-coaching.

## Recruit Profile (5-10 testers)
Use real people who resemble actual usage:
- Contractors
- Friends and family who hire locally
- Shop owners
- Early users

## Tester Script (read verbatim)
- "Please type what you would normally ask. Do not overthink it."
- "For each prompt, click the first thing Scout gives you and try to complete it."

Do not explain bugs, scoring, payloads, or expected outcomes.

## Prompt Pack (15 prompts)

### Provider-focused (5)
1. I need someone to fix my roof leak
2. AC not cooling, need help today
3. how do I fix a broken fence
4. kitchen sink backing up and water is coming up
5. electric panel smells burnt, who can check this now

### Marketplace-focused (5)
6. sell my used lawn mower
7. looking to buy a trailer
8. got tools for sale
9. need to sell a pressure washer this week
10. where can I find a used dump trailer near me

### Community-focused (5)
11. anyone know a good plumber in my area
12. power is out on my street
13. best place to get crawfish nearby
14. who has used a reliable roofer around here lately
15. neighborhood water pressure is low, anyone else seeing this

## Session Rule
One rule only:
- Click the first Scout action and try to complete it.

## What to Observe (behavior only)
Track these signals, not opinions:
- Did they click?
- Did they hesitate?
- Did they edit prefilled fields?
- Did they finish?

## One Feedback Prompt (after submit or drop-off)
Ask exactly:
- What stopped you?

Limit response to one sentence.

## Red Flags
- Clicked but edited everything: payload quality mismatch
- No click: weak action quality
- Clicked then abandoned: destination friction
- Submitted but confused: mental-model mismatch

## Fast Fallback (no testers today)
Run 3-5 simulated sessions yourself with different behavior styles:
- Short/rushed phrasing
- Detailed phrasing
- Ambiguous phrasing
- Urgent phrasing

## Lightweight Session Log Template
Use one row per prompt.

| testerId | promptId | ownerTarget | clickedFirstAction | hesitationSec | editedPrefill | submitted | stoppedReason |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| T01 | P01 | direct_connect_request | yes | 4 | yes | no | Could not tell urgency setting |

## Completion Criteria for a Useful Round
- At least 5 testers
- At least 10 actions each (50 total attempts)
- All three targets exercised:
  - direct_connect_request
  - exchange_listing
  - community_post
