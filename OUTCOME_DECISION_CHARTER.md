# Outcome Decision Charter

## Purpose

This charter defines when TradeScout is allowed to change product behavior in response to outcome data. It exists to:

- Separate **observation** from **action**.
- Prevent mid-stream improvisation.
- Ensure decisions are **defensible, repeatable, and non-emotional**.

Until explicitly unlocked by a trigger below, the product remains frozen with respect to outcome flows:

- No new features related to outcome capture or Direct Connect.
- No copy tweaks that change meaning or positioning.
- No new action types or schema changes.

Documentation updates and analytics inspection are always allowed.

---

## Global Guardrails (When *Not* to Decide)

For any trigger below, **do not act** unless all of these conditions are met for the relevant scope:

- **Sample size per actionType**
  - `initiated >= 100` events in the window for that action type.
- **Time stability**
  - The same pattern appears in **at least 2 consecutive windows** (e.g., two 7-day or two 14-day windows).
- **Geographic breadth (when comparing geos)**
  - At least **3 counties** each have `initiated >= 20` for that action type when drawing geographic conclusions.

If these conditions are not met, the freeze continues by default.

---

## Windows & Ritual

- Use a rolling **7-day** window for early observation; move to **14-day or 28-day** windows for serious decisions.
- Once per week:
  - Open the internal Outcome Summary for the chosen window.
  - Capture a screenshot for the record.
  - Copy key numbers into an external doc or sheet:
    - For each actionType: `initiated`, `success`, `pending`, `failed`, `success_rate`, `pending_share`, `median_time_to_outcome`.
    - Top counties by confirmation rate with `initiated`, `success`, `confirmation_rate`.
  - Write **descriptive-only** bullets (no prescriptions).
- During this observation window:
  - ✅ Allowed: reading, screenshotting, documenting, analysis.
  - ❌ Not allowed: product changes to outcome UX, Direct Connect behavior, or action taxonomies.

---

## Trigger 1 – Clear Winner Action Type (Amplification Only)

Goal: identify a single actionType among:

- `community_notice`
- `provider_coordination`
- `promotion`

that performs meaningfully better than the others.

Definitions (per actionType `a` in the window):

- `R_a = success_a / initiated_a` (confirmation rate).

Conditions to declare a **winner `W`** and end the freeze for **amplification** of that actionType:

1. **Volume**
   - `initiated_W >= 100` and `success_W >= 30`.
2. **Relative performance**
   - `R_W ≥ 1.3 * max(R_other)`
   - i.e., at least **30% higher** confirmation rate than the next best actionType.
3. **Stability**
   - Same winner and similar ratios for **2 consecutive windows**.

If all are met:

- The freeze ends **only** for:
  - Adding or improving entry points, prompts, or CTAs for winner `W`.
  - Increasing visibility of `W` in Scout and navigation.
- The freeze **remains** for:
  - Changing other actionTypes.
  - Changing the core outcome schema.

If no actionType clears the 1.3× bar with sufficient volume and stability, no winner is declared.

---

## Trigger 2 – Bottleneck Action Type (Targeted UX Intervention Only)

Goal: identify an actionType where many attempts stall (pending) and few succeed.

For each actionType `a`, define over the window:

- `initiated_a`, `success_a`, `pending_a`, `failed_a`.
- `P_a = pending_a / initiated_a` (pending share).
- `S_a = success_a / initiated_a` (success share).
- `T_a = medianTimeToOutcomeMs` for successes.

Declare `B` as a **bottleneck actionType** when:

1. **Volume**
   - `initiated_B >= 100`.
2. **Pending dominance**
   - `P_B ≥ 0.30` and `pending_B >= success_B`.
3. **Comparative underperformance**
   - `S_B ≤ 0.5 * max(S_other)` across the remaining actionTypes.
4. **No natural catch-up**
   - Across two consecutive windows, `pending_B` is flat or rising and `P_B` does not improve by at least 5 percentage points.

If all are met:

- The freeze ends **only** for targeted UX/flow changes on `B`:
  - Clarifying copy, adding guidance, reducing friction.
  - Introducing a re-ask pattern or reminder **for that actionType**.
- The freeze **remains** for:
  - Changing other actionTypes.
  - Changing the outcome schema or analytics pipeline.

If `pending` is elevated everywhere in similar proportions, this is treated as a global behavior, **not** a bottleneck on a specific type.

---

## Trigger 3 – Geographic Overperformance (Territory Focus Only)

Goal: identify counties where a given actionType is performing meaningfully better than its global baseline.

For each actionType `a` and county `(stateCode, countyFips)`:

- County rate: `R_county = success_county / initiated_county`.
- Global rate: `R_global_a = success_a / initiated_a`.

A county qualifies as an **overperformer** for actionType `a` when:

1. **Volume per county**
   - `initiated_county >= 20` for that `a` in the window.
2. **Overperformance**
   - `R_county ≥ R_global_a + 0.15` (at least **15 percentage points** higher than global).
3. **Consistency**
   - The same county appears in the top list with similar or better `R_county` in **2 consecutive windows**.

If **3 or more counties** meet this bar for the same `a`:

- The freeze ends **only** for **territory strategy** around that actionType:
  - Focused outreach, onboarding, and internal playbooks in those counties.
- The freeze **remains** for:
  - Global UX changes.
  - Schema or analytics changes.

If no counties clear this threshold with adequate volume, no geographic conclusion is drawn.

---

## Trigger 4 – Scout vs. Direct Leverage (Scout Investment Only)

Goal: determine whether Scout-initiated flows meaningfully outperform direct user-initiated flows.

For each actionType `a` over a longer window (recommended **28 days**):

- `initiated_scout`, `success_scout` for events with `initiatedBy = "scout"`.
- `initiated_direct`, `success_direct` for events with `initiatedBy = "direct"`.
- `R_scout = success_scout / initiated_scout`.
- `R_direct = success_direct / initiated_direct`.

Only evaluate when:

- `initiated_scout >= 50` **and** `initiated_direct >= 50` for that `a`.

Conditions to declare that Scout provides leverage for `a`:

1. **Relative confirmation**
   - `R_scout ≥ 1.2 * R_direct` (at least **20% higher**).
2. **Stability**
   - Holds for **2 consecutive 14-day windows**.

If met:

- The freeze ends **only** for **Scout investment** on that actionType:
  - More Scout-introduced entry points.
  - Better prompts to create or update Direct Connect items for that `a`.

If `R_scout` and `R_direct` are within ±10% with enough volume:

- Scout is treated as convenience, not leverage, for that actionType.
- This informs future experiments but does **not** by itself unlock UX changes.

---

## No-Decision Outcome (Explicit Clause)

If, after **28 days of live data** and regular observation:

- None of the triggers above fire (i.e., no winner, no clear bottleneck, no overperforming counties, no clear Scout leverage by the defined thresholds),

then the correct top-level conclusion is:

> "TradeScout’s current framing is not yet creating differentiated outcomes at scale."

This is **not** treated as failure; it is treated as information. It implies that the next step is to **design a new experiment** (e.g., sharper value prop, different entry points, or focused use case) rather than to guess or thrash the existing flows.

Any such new experiment should be written down as its own charter and must not retroactively change the thresholds in this one.

---

## Binding Nature of This Charter

- These rules are **binding** for outcome-related changes during the current learning phase.
- Triggers may be refined **after** a full learning cycle (e.g., after 28–56 days) but **not mid-stream** in response to partial results.
- Any decision to override this charter must itself be documented as a deliberate exception, not an ad-hoc choice.
