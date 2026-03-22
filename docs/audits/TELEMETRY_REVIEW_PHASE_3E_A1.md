# 📊 Scout Copy Assist v1.1 — Telemetry Review (Day-7 & Day-14)

## Review Date
**Window:** Last 7 days (rolling)  
**Feature Scope:** Headline + Services Copy Assist (Phase 3e-A.1)  
**Status:** Observational only (no changes during bake window)

---

## 1️⃣ Acceptance Rate (Primary Signal)

**Question:** Is Scout producing copy users actually want to keep?

### Headline

| Variant | Accepts | Views | Acceptance Rate |
|---------|---------|-------|-----------------|
| Safe    |         |       |                 |
| Growth  |         |       |                 |

### Services

| Variant | Accepts | Views | Acceptance Rate |
|---------|---------|-------|-----------------|
| Safe    |         |       |                 |
| Growth  |         |       |                 |

### Interpretation Notes

- Safe > Growth early = expected (trust formation phase)
- Growth catching up by Day-14 = strong signal
- Services typically lag headlines (higher cognitive load)

---

## 2️⃣ Engagement Funnel (Quality Signal)

**Question:** Where does friction occur?

### Headline Funnel
Opened → Viewed → Accepted

| Step     | Count | Drop % |
|----------|-------|--------|
| Opened   |       |        |
| Viewed   |       |        |
| Accepted |       |        |

### Services Funnel
Opened → Viewed → Accepted

| Step     | Count | Drop % |
|----------|-------|--------|
| Opened   |       |        |
| Viewed   |       |        |
| Accepted |       |        |

### Interpretation Notes

- High open, low view → prompt relevance issue
- High view, low accept → copy quality mismatch
- Long dwell + no accept → cognitive overload

---

## 3️⃣ Edit Delta (Outcome Signal)

**Question:** Does accepted copy actually make it to a published profile?

### Edit Delta = Accepted → Saved → Published

| Field     | Accepted | Saved | Published | Publish Rate |
|-----------|----------|-------|-----------|--------------|
| Headline  |          |       |           |              |
| Services  |          |       |           |              |

### Interpretation Notes

- Accepted but not published = hesitation or trust gap
- Published rate ≥70% = strong ownership signal
- Services lower than headline is normal; watch trend

---

## 4️⃣ Variant Preference Split (Intent Signal)

**Question:** What tone do users prefer once trust exists?

| Field     | Safe % | Growth % |
|-----------|--------|----------|
| Headline  |        |          |
| Services  |        |          |

### Interpretation Notes

- Safe dominance = early-stage conservatism (OK)
- Growth ≥35% by Day-14 = readiness for stronger positioning
- Growth > Safe = greenlight for SEO v1.2 later

---

## 5️⃣ Go / No-Go Criteria (LOCKED)

### ✅ Greenlight Phase 3e-B (Multi-Profile Ownership) IF:

- **Headline acceptance ≥ 35%**
- **Services acceptance ≥ 25%**
- **Publish rate after acceptance ≥ 60%**
- **No significant regression in edit abandonment**

**➡️ Action:** Proceed to Phase 3e-B build (model already locked)

### ⚠️ Iterate Copy (Stay in Phase 3e-A) IF:

- Acceptance < thresholds BUT
- Engagement (views) is high

**➡️ Action:** Prompt refinement only (no UX change)

### ❌ Rollback / Rework IF:

- Opened → viewed drop > 50%
- Acceptance < 15% across both fields
- Strong negative feedback or manual overrides

**➡️ Action:** Disable Copy Assist buttons, revert to manual edit only

---

## 6️⃣ Final Decision (Fill at Review)

**Decision:**  
☐ Proceed to Phase 3e-B  
☐ Iterate Copy Assist prompts  
☐ Rollback & reassess  

**Rationale** (1–2 sentences):  
—

**Next Action Owner:**  
—

**Decision Timestamp:**  
—

---

## 🔒 Lock Statement

> This review replaces opinion with evidence.
> No architectural changes without passing these gates.

---

## Telemetry Events to Monitor

During the bake window, track these events continuously:

| Event | Properties | Purpose |
|-------|-----------|---------|
| `scout_copy_assist_opened` | `{ field: 'headline' \| 'services' }` | Track which fields get clicked |
| `scout_copy_variant_viewed` | `{ field, variant: 'safe' \| 'growth' }` | Track user engagement with variants |
| `scout_copy_variant_accepted` | `{ field, variant, charCount }` | Track acceptance and content length |
| `scout_copy_variant_closed` | `{ field, action: 'dismissed' \| 'accepted' }` | Track abandonment |
| `business_profile_published` | `{ headline_used, services_used }` | Track if accepted copy made it to live profile |

---

## Notes for Day-7 Review

- Collect raw data by EOD Day-6
- Run SQL queries to populate all tables above
- Convene review meeting Day-7 morning
- Make decision before EOD Day-7 (no weekend delays)
- Communicate outcome to team + pilot user by Day-7 EOD
