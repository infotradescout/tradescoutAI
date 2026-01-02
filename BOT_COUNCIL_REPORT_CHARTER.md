# Bot Council Report Charter

**Location**: Super Admin OS → AI Monitoring → Bot Council  
**Purpose**: Daily decision compass for founder — what to fix, what to ship, what to avoid  
**Audience**: Solo founder (not engineers, not customers)  
**Refresh**: Every 24 hours (overnight job)  
**Standard**: If the report doesn't clearly suggest a next action, it's not done

---

## Philosophy

Bot Army is not a black box. It's a daily intelligence briefing.

You don't read transcripts or scroll logs. You read a structured report that answers:
- Is the system trustworthy today?
- What broke the mission?
- Where is Scout overselling?
- What should I build next?
- Can I ship this feature?

Each report is one unified view, five layers deep. Each layer is collapsible but actionable.

---

## The Five Layers (Final Architecture)

### Layer 1 — Executive Brief (Always Visible, ~60 seconds)

**Format**: Concise text blocks, no tables, no lists unless critical

**Contains**:

```
BOT COUNCIL — DAILY STATUS
Date: [DATE]
Overall Confidence: [XX]% (↑/↓ [X]%)

Verdict:
[One sentence. Is the system trustworthy enough to ship features today?
Or does something need attention?]

What changed since yesterday:
• [Signal 1]
• [Signal 2]
• [Signal 3]
[Max 3 bullets. What broke, what improved?]

Primary Risk:
[Specific mission threat, human-readable]

Primary Opportunity:
[Where Scout is winning, actionable]

Recommendation:
[Ship / Do not ship / Adjust and retry]
[If not "Ship": What to change?]
```

**Example**:

```
BOT COUNCIL — DAILY STATUS
Date: Jan 3, 2026
Overall Confidence: 84% (↓3%)

Verdict:
The system is usable but slightly misaligned with the mission today.

What changed since yesterday:
• Copy Assist acceptance dropped for "growth" variants
• One unfinished surface exposed in Finance
• No hard failures detected

Primary Risk:
Users may feel subtle pressure during profile polishing.

Primary Opportunity:
Scout execution preference is rising — users trust Scout to "do it" more often.

Recommendation:
Do not ship new features today.
Adjust copy tone OR hide growth variant temporarily.
```

**How This Is Computed**:

| Signal | Source | Threshold |
|--------|--------|-----------|
| Overall Confidence | Mission invariants (5 checks) | Avg % of checks passing |
| Verdict | Confidence trend + Risk level | Derived statement |
| Signals | Friction detection + Flow completion | Anomalies from baseline |
| Primary Risk | Highest mission-invariant failure | Explicit, human-readable |
| Opportunity | Highest success rate action | Based on user preference |
| Recommendation | Confidence + Risk matrix | Deterministic logic |

---

### Layer 2 — Diagnostic Narrative (Expandable)

**Purpose**: Answer "why does the brief say what it says?"

**Triggered by**: Any confidence drop >3% OR any mission invariant warning

**Contains**:

#### 🧠 Flow-Level Analysis

```
Observed Patterns:
• [X]% of bots hesitated after [event]
• [X]% rephrased instead of choosing
• [X] reached [page] that felt [quality descriptor]

Interpretation:
[What does this pattern mean? What is the system communicating?]

Implication:
[If real users experience this, what do they feel?]
```

**Example**:

```
Observed Patterns:
• 31% of bots hesitated after Scout offered headline variants
• 22% rephrased requests instead of choosing an option
• In finance flows, bots reached an invoice preview page that felt incomplete

Interpretation:
The language is correct but feels slightly transactional.
The system still feels honest, but polish is showing seams.

Implication:
If a real user were here, they would trust TradeScout,
but hesitate to rely on it for money-related tasks.
```

#### 🧭 Mission Alignment Check

```
Mission Stress Test:
[List 5 core invariants, PASS/WARNING/FAIL each]

Interpretation:
[If a real user experienced today's flows, what would they conclude
about TradeScout's honesty, freedom, and reliability?]
```

**Mission Invariants to Check**:

1. **Freedom to Skip**: Can users refuse without penalty? ✓
2. **Identity Pressure**: Does Scout assume identity? ✓
3. **Execution Honesty**: Does Scout say what it will actually do? ⚠
4. **Finish Quality**: Do pages feel complete or stub-ish? ✗
5. **Benefit Claims**: Are promises verifiable? ⚠

---

### Layer 3 — Action Tracebacks (Deep Dive, Optional)

**Purpose**: Show concrete evidence before you change anything

**Triggered by**: When Layer 2 contains FAIL or WARNING

**Format**: Incident-based, grouped by root cause

#### 🔍 Concrete Incidents

```
Incident [#] — [Title]

Context:
[Flow path where this happened]
[What Scout offered]

What happened:
[Bot behavior, step by step]

User Reaction (simulated):
[What would a real user infer?]

Why this matters:
[Which mission invariant breaks?]

Evidence:
• Screenshot: [file]
• Flow: [path]
• Exact quote: "..."
```

**Example**:

```
Incident 1 — Copy Assist Tone

Context:
Profile editing → Headline → Growth variant

What happened:
Scout proposed language implying guaranteed outcomes.
User re-opened modal. Then skipped.

User Reaction (simulated):
"This feels like sales copy. I don't trust it."

Why this matters:
It violates "no hype / no unverifiable claims."
Money + overpromise = credibility damage.

Evidence:
• Screenshot: headline_variant_growth.png
• Flow: /business/:slug/edit → Copy Assist
• Quote: "Attract 3x more customers with this headline"
```

**Grouping Rule**: Same root cause = one incident, multiple examples listed below

---

### Layer 4 — Capability Coverage Map

**Purpose**: Tell you where Scout promises more than it can deliver

**Updated**: Every 24h from action execution logs

**Shows**:

```
Scout Capability Coverage (Last 24h)

Actions Offered:
• [Action] → [X] times
• [Action] → [X] times
• [Action] → [X] times

Execution Outcomes:
• Scout-direct success: [X]%
• User-routed success: [X]%
• Partial/failed: [X]%

Interpretation:
[What does this tell you about where Scout should/shouldn't execute?]
[Where is routing more reliable than execution?]
[Which actions should Scout avoid offering directly?]
```

**Example**:

```
Scout Capability Coverage (Last 24h)

Actions Offered:
• Create invoice → 14 times
• Publish profile → 22 times
• Contact business → 31 times

Execution Outcomes:
• Scout-direct success: 61%
• User-routed success: 94%
• Partial/failed: 11%

Interpretation:
Users prefer Scout execution, but routing is currently more reliable.
Scout should not over-offer execution in finance flows yet.

Recommendation:
Keep execution available in onboarding (high trust).
Reduce execution offers in finance (wait for 90%+ success).
```

**Data Source**:
- `ScoutActionExecution[]` from Bot Army logs
- Filter by last 24h
- Group by actionType + executionPath
- Compute success rate per group

---

### Layer 5 — Language & Trust Heatmap (Optional Tab)

**Purpose**: Refine Scout wording without guessing

**Shown**: Only if friction signals >15% on any message/action pair

**Format**:

```
Language Signals:
• "[Phrasing A]" performs [X]% better than "[Phrasing B]"
• [Signal 2]
• [Signal 3]

Suggested Experiment:
Change: "[Current copy]"
To: "[Proposed copy]"

Rationale:
[Why would this reduce friction?]

Test method:
[How to A/B test safely]
```

**Example**:

```
Language Signals:
• "I can take you there" performs 18% better than "I can handle this"
• Users respond faster to neutral phrasing than benefit-led phrasing
• Questions ending in "or" cause 22% more hesitation than checkboxes

Suggested Experiment:
Change: "I can do this for you, or I can handle this"
To: "I can do this for you, or you can take over — either is fine"

Rationale:
Removes presumption. Gives explicit permission to refuse.

Test method:
A/B test in onboarding next week (100 users each variant).
Success metric: % users who accept Scout execution.
```

**Data Source**:
- `ScoutFrictionSignal[]` grouped by {message, actionOffered, signalType}
- Calculate signal rate per message
- If rate >15%: surface message for review
- Use LLM to suggest wording adjustments (mission-bound prompt)

---

## How This Report Is Generated

### Input Data

| Source | What | How Collected |
|--------|------|---------------|
| Bot Army Test Runs | Structured flows, mission invariants, screenshots | `BotArmyTestRun` from database |
| Scout Logging | Session logs, friction signals, action execution | `ScoutSessionLog` where `isTestRun=true` |
| Admin Notes | Founder observations, manual flags | Admin OS text input |
| Mission Invariants | 5 core checks | Hardcoded rules in system |

### Processing Pipeline

```
1. Collect (overnight job)
   ├─ Query Bot Army runs from last 24h
   ├─ Query Scout action executions
   ├─ Query Scout friction signals
   └─ Load mission invariant results

2. Aggregate
   ├─ Compute Overall Confidence (avg of 5 mission checks)
   ├─ Identify anomalies vs. baseline (day-over-day)
   ├─ Group incidents by root cause
   ├─ Calculate action success rates
   └─ Detect friction signals >15%

3. Summarize (Mission-Bound LLM Prompt)
   ├─ Input: Raw data + mission invariant context
   ├─ Task: Generate Layers 2–5 narratives
   ├─ Constraint: Every statement must be evidence-backed
   ├─ Constraint: Prioritize mission over features
   ├─ Output: Structured JSON for each layer

4. Render
   ├─ Display Layer 1 (always visible)
   ├─ Make Layers 2–5 expandable
   ├─ Link screenshots and flow paths
   └─ Timestamp the report (refresh time visible)
```

### Mission-Bound Summarizer Prompt

```
You are a product intelligence system for TradeScout.
Your job is to summarize bot test results into a daily report for the founder.

Core mission (non-negotiable):
- Users participate freely, never charged
- Promotions shown only when relevant
- Scout prioritizes conversion quality and trust
- System is locality-first and community-driven
- Users always have control and clarity

You are analyzing bot behavior to detect:
1. Where the system breaks the mission
2. Where Scout oversells capability
3. Where language confuses or pressures
4. Where the founder should focus tomorrow

Rules:
- Every claim must cite evidence (test run ID, flow path, screenshot)
- Prioritize mission alignment over feature completeness
- Highlight specific language that breaks trust
- Never recommend changes that undermine mission
- Be actionable: each section suggests next step or no action needed

Input data:
[Raw test results, friction signals, mission invariant checks, screenshots]

Output format:
{
  "diagnosticNarrative": "...",
  "missionCheck": { "freedom_to_skip": "PASS", ... },
  "incidents": [ { "title": "...", "context": "...", ... } ],
  "capabilityMap": { "actionsOffered": { ... }, "outcomes": { ... } },
  "languageSignals": [ ... ]
}
```

---

## Admin OS Implementation

### UI Structure

**Header**:
```
BOT COUNCIL REPORT
[Date range selector: Last 24h / 7 days / 30 days]
[Refresh button] [Last updated: HH:MM UTC]
```

**Layer 1** (Always visible):
- White background, large readable text
- Color coded: Confidence bar (red/yellow/green)
- Verdict + Changes + Risk/Opportunity as text blocks
- Recommendation highlighted (bold, colored)

**Layers 2–5** (Collapsible sections):
```
▶ 🧠 Flow-Level Analysis
▶ 🧭 Mission Alignment Check
▶ 🔍 Action Tracebacks
▶ 📊 Capability Coverage Map
▶ 🌡️ Language & Trust Heatmap (if needed)
```

**Each Section**:
- Expand to full view
- Screenshots embedded (clickable to full res)
- Links to flow paths (click-through to Admin Monitoring)
- Copy buttons for sharing findings

### Access & Permissions

**Who sees this**: Admin role only (founder + designated reviewers)

**Read-only**: Yes (bots can never modify this report)

**Archival**: All reports stored (query by date in Admin OS)

**Export**: JSON/CSV for external analysis or sharing

---

## Decision Flow from Report

### Daily Reading (5 minutes)

```
1. Read Layer 1 brief
2. Check Recommendation line
3. If "Ship": proceed with planned release
4. If "Do not ship": read Layer 2 to understand why
5. If "Adjust": read Layer 3 for specific changes
6. If time: skim Layer 4 for roadmap signals
```

### If Recommendation is "Do not ship"

```
→ Read Layer 2 (mission alignment)
→ If warning on specific invariant: read Layer 3 (concrete incident)
→ Make minimal change (copy wording, hide feature, add missing UI)
→ Re-test with Bot Army
→ Report regenerates overnight
→ Read next morning's brief
→ Decision: ship or iterate again
```

### If Confidence dropping trend (3+ days)

```
→ This signals systemic issue, not incident
→ Read Layer 4 (capability map): where is Scout overselling?
→ Read Layer 5 (language): what wording patterns fail?
→ Plan larger refinement (Scout prompt, action routing, surface polish)
→ Brief engineering: here's what to improve, here's the order
→ After changes: run Bot Army again
→ Verify Confidence rises before shipping
```

### Weekly Synthesis

```
Every Sunday evening:
→ Review all 7 daily reports
→ Identify persistent issues (appear in 3+ days)
→ Identify rapid improvements (signal working)
→ Plan 1-2 week focus items
→ Brief community/engineering on direction
```

---

## Critical Guardrails

### Bots NEVER:

- ❌ Train Scout (influence prompts)
- ❌ Train rankings (influence recommendations)
- ❌ Alter behavior (change flows, logic)
- ❌ Affect production users (tests isolated)
- ❌ Vote on roadmap (but they flag what matters)

### Report NEVER:

- ❌ Recommends shipping broken features
- ❌ Pressures founder ("you must ship today")
- ❌ Uses undefined metrics ("engagement", "growth")
- ❌ Makes unevidenced claims ("users love this")
- ❌ Defaults to adding features (default is "refine what you have")

### If report is ambiguous:

- ❌ You don't ship yet
- ✅ You ask: "What am I missing?"
- ✅ You re-run Bot Army with different test cases
- ✅ You come back when data is clear

---

## What This Gives You

| Question | Answer Source |
|----------|----------------|
| "Is today's build trustworthy?" | Layer 1: Confidence + Verdict |
| "What broke the mission?" | Layer 2: Mission Alignment Check |
| "What should I change?" | Layer 3: Concrete Incidents + Suggested Edits |
| "Where can Scout do better?" | Layer 4: Capability Coverage Map |
| "How should I word this?" | Layer 5: Language Signals + Suggestions |
| "What matters for next week?" | Weekly synthesis of all reports |

---

## Example: Full Daily Report

### Layer 1 (Brief)

```
BOT COUNCIL — DAILY STATUS
Date: Jan 3, 2026 — 06:00 UTC
Overall Confidence: 84% (↓3%)

Verdict:
The system is usable but slightly misaligned with the mission today.

What changed since yesterday:
• Copy Assist acceptance dropped for "growth" variants
• One unfinished surface exposed in Finance
• No hard failures detected

Primary Risk:
Users may feel subtle pressure during profile polishing.

Primary Opportunity:
Scout execution preference is rising — users trust Scout to "do it" more often.

Recommendation:
Do not ship new features today.
Adjust copy tone OR hide growth variant temporarily.
Re-test Friday. Ship if confidence recovers to 87%+.
```

### Layer 2 (Why)

```
🧠 FLOW-LEVEL ANALYSIS

Observed Patterns:
• 31% of bots hesitated after Scout offered headline variants (up from 18% yesterday)
• 22% rephrased their intent instead of choosing Scout's option
• Finance flow: 9 of 14 bots reached invoice preview page; 3 flagged "Coming soon" text

Interpretation:
The headline language shifted yesterday to emphasize "growth" and "results."
This phrasing is more sales-like and less neutral.
Finance flows have placeholder UI that signals incompleteness.

Implication:
Real users would likely:
- Distrust growth-focused language (feels like hype)
- Question invoice creation (sees unfinished UI, wonders if billing is real)
- Prefer Scout to route them instead of execute

---

🧭 MISSION ALIGNMENT CHECK

Mission Stress Test:
✅ Freedom to Skip: Users can decline any Scout action
✅ Identity Pressure: Scout doesn't assume role
⚠️  Execution Honesty: "Growth" language overstates results
✅ Finish Quality: Most surfaces complete except Finance
⚠️  Benefit Claims: Copy claims "guaranteed results" (unverifiable)

Interpretation:
Yesterday's copy updates violated two core invariants:
1. Benefit claims must be verifiable (not "guarantee")
2. Tone must be neutral, not sales-driven

If a real user experienced these flows:
They would trust TradeScout fundamentally,
but feel like Copy Assist is trying to upsell them on an image,
not help them be more authentic.
```

### Layer 3 (Concrete Incidents)

```
🔍 ACTION TRACEBACKS

Incident 1 — Growth-Focused Headline Language

Context:
Profile editing → Headline → Copy Assist → Growth variant

What happened:
Scout offered: "Attract 3x more customers with this headline"
Bot hesitated, re-opened modal, rephrased query, then skipped.

User Reaction (simulated):
"This is sales language, not authentic. I don't want to use it."

Why this matters:
- Copy Assist broke authenticity promise
- "3x more" is unverifiable claim
- Users should feel empowered to be themselves, not upsold

Evidence:
• Test run: bot_2026-01-03_04:32 (bot_id: army_profile_001)
• Screenshot: headline_growth_variant.png
• Exact copy: headline_growth.copy_assist.prompts[2].variant

Action:
Change "Attract 3x more" to "Strengthen your positioning"
Re-test with 5 bots in next run.
```

### Layer 4 (Capability Map)

```
📊 CAPABILITY COVERAGE MAP (Last 24h)

Actions Offered:
• Create invoice → 14 times
• Publish profile → 22 times
• Contact business → 31 times

Execution Outcomes:
• Scout-direct success: 61% (↓7%)
• User-routed success: 94%
• Partial/failed: 11%

Interpretation:
Scout-direct execution success dropped today.
In finance flows (invoicing), the drop is significant (55% → 45%).
This correlates with "Coming soon" UI appearing.

Implication:
Scout should not over-offer execution in finance until UI is complete.
Users prefer Scout execution in profile publishing (88% success).

Roadmap signal:
Complete Finance surface before expanding Scout execution there.
Profile publishing is ready for more Scout control.
```

### Layer 5 (Language)

```
🌡️ LANGUAGE & TRUST HEATMAP

Language Signals:
• "I can do this for you" performs 18% better than "I can handle this"
• Neutral tone ("strengthen") outperforms benefit tone ("attract 3x") by 22%
• Multi-step offers ("or I can take you there") reduce hesitation vs. single option

Suggested Experiment:
Change all Scout execution offers from:
"I can handle this for you. Should I proceed?"
To:
"I can do this for you, or you can take over — either is fine."

Rationale:
Explicit permission to refuse reduces hesitation.
"Take over" is clearer than "handle it yourself."
"Either is fine" removes pressure.

Test method:
A/B test in onboarding flows (Friday 100-bot run).
Variant A: Current wording
Variant B: Proposed wording
Success metric: % users who accept execution, hesitation rate

Expected outcome:
Hesitation rate drops from 31% → <18%
```

---

## Deployment Checklist

Before Bot Council Report goes live:

- [ ] Data sources connected (Bot Army runs, Scout logs, mission checks)
- [ ] Aggregation job runs nightly (logs all errors)
- [ ] LLM summarizer tested with 10 past Bot Army runs
- [ ] UI components built (Layer 1–5 sections)
- [ ] Screenshot embedding working
- [ ] Access control enforced (Admin role only)
- [ ] Report archival working (query by date)
- [ ] Founder reads 5 sample reports, approves tone/content
- [ ] Emergency exit: founder can manually suppress report (if system broken)
- [ ] Documentation shared (how to read, how to act on findings)

---

## Final Rule

**If the report doesn't clearly suggest a next action, it's not done.**

This means:

- ✅ "Do not ship. Change X, then re-test." ← Clear action
- ✅ "Ship. Monitor these signals." ← Clear action
- ✅ "Pause shipping. This is a roadmap issue." ← Clear action
- ❌ "System is neutral." ← Not actionable (rewrite)
- ❌ "Some signals are mixed." ← Not actionable (dig deeper)
- ❌ "Need more testing." ← Evasion (bot coverage is sufficient)

If you're unsure, the report isn't finished. Re-run analysis, expand time window, or ask clarifying questions.

---

## Status

**Ready for**: Implementation in Admin OS  
**Timeline**: 1 week (data wiring) + 1 week (UI + LLM testing)  
**Owner**: Engineering + Product  
**Reviewer**: Founder (daily user)  

**Impact**: Founder goes from reading logs to reading decisions.

