# Group Types x Features Matrix

This document captures the idea that **HOA is a special kind of Group** inside the Community OS: one Group engine (feed, members, messaging, marketplace, notifications) with extra modules for HOA behavior.

## Core Group Model

- **Base entity**: `communityGroups`
- **Key fields** (conceptual):
  - `groupType`: `"general" | "interest" | "hoa" | "project" | "board" | ...`
  - `scope`: `"county" | "neighborhood" | "hoa" | "project" | "global"` (implemented via `scope` + location fields)
  - `location`: derived from fields like `stateCode`, `countyFips`, `cityName`, and (for HOA/project views) the associated `hoaId` / project context.
- **Membership**: `groupMembers` with roles such as `member`, `moderator`, `admin`, `owner`.

HOA is **not** a completely separate social object – it is a Group with additional modules (votes, fees, ledger) and stricter membership / permissions.

## Group Type Matrix

| Group Type     | Typical Scope      | Feed & Posts | Members & Roles              | Messaging / Threads | Marketplace Visibility                | HOA Votes / Governance                    | HOA Finances / Vault                     | Notes                                                                 |
|----------------|--------------------|-------------|------------------------------|---------------------|----------------------------------------|-------------------------------------------|-----------------------------------------|-----------------------------------------------------------------------|
| `general`      | County / City      | Yes         | Yes (member/mod/admin/owner) | Yes (DMs / threads) | County marketplace (normal listings)   | No                                        | No                                      | Default community groups (e.g. Q&A, recommendations, events).        |
| `interest`     | County / Region    | Yes         | Yes                          | Yes                 | County marketplace                     | No                                        | No                                      | Themed groups (parents, DIY, investors, etc.).                        |
| `hoa`          | HOA / Micro-hood   | Yes         | Yes (member/board/builder)   | Yes                 | HOA-focused listings (optional filter) | **Yes**: tied to this HOA/group context   | **Yes**: fees, ledger, transparency     | **HOA is a GroupType = `hoa` with votes + money modules attached.**   |
| `project`      | Project / Block    | Yes         | Yes                          | Yes                 | Local, project-scoped offers           | Optional (project-specific polls)         | Optional (budget tracking only)         | Micro-initiatives: e.g. "Smith Street Tree Cleanup" project groups. |
| `board`        | HOA / Org-wide    | Limited     | Yes (board-level only)       | Yes                 | No (usually)                           | Yes (board-only governance threads)       | Yes (review/approval, high-sensitivity) | Small, higher-security board/committee spaces.                        |

## How HOA Maps Onto This

- **User mental model**:
  - Homeowner: "My HOA is just one of my groups, but it’s the serious one with votes and money."
  - Builder: "I join/serve groups; some of those groups are HOAs."
- **Technical model**:
  - HOA group = `communityGroups` row with `groupType = "hoa"` and HOA-specific metadata.
  - HOA modules (today: `homeownerAssociations`, `hoaMembers`, `hoaVotes`, `hoaFinancialRecords`) are effectively **attached to the HOA group**, not a totally separate social surface.
  - Social behaviors (feed, posts, membership, messaging, notifications) follow the **same Group pipes** you already use for other group types.

## Alignment With Existing Tables

Current implementation pieces that align with this model:

- **Groups**: `communityGroups`, `groupMembers`, `group_county_links` provide the generic group engine (feed context, membership, location).
- **HOA**: `homeownerAssociations`, `hoaMembers`, `hoaVotes`, `hoaVoteResponses`, `hoaFinancialRecords` provide HOA-specific capabilities (governance + money), keyed today by `hoaId`.
- **Location**: `stateCode`, `countyFips`, `cityName` on posts/groups; `state` + `countyFips` on `homeownerAssociations`; `county` / `state` on `marketplaceListings`.

In this worldview:

- `/groups` is the **root abstraction** for community surfaces.
- `/hoa-management` and `/hoa-dashboard` are **detail views for a `groupType = "hoa"` group** with the HOA modules turned on.

Over time, HOA membership can be unified with group membership (e.g., `groupMembers` is the single source of truth, with HOA modules checking role + `groupType` before allowing votes/fee actions).

## Copy / UX Guidelines

- Refer to HOA as **"Your HOA Group"** or **"Your Homeowner Group"** in the UI, not as a silo separate from groups.
- Avoid references to external / Facebook groups in product copy; instead, use:
  - "Local groups inside TradeScout" or
  - "County groups" / "HOA group" / "Project group" as appropriate.
- Clearly differentiate context in the UI:
  - County-level chatter vs. binding HOA votes/fees should always be visually and textually distinct.
