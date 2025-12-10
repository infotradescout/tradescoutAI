# Roles x Location Layers Matrix

This document defines how key roles interact with the app-native location layers (no external Facebook group dependency).

## Location Layers

- **Project layer**: A single project or micro-initiative (e.g. "Smith Street Tree Cleanup").
- **HOA / Micro-neighborhood layer**: A `homeownerAssociation` or named neighborhood.
- **County / City layer**: The primary local area (state + `countyFips`, optional city).
- **Global / Multi-county layer**: Platform-wide or multi-region announcements.

## Core Roles (Conceptual)

- **Homeowner**: End user in a home or unit.
- **Builder (Pro)**: Contractor / professional providing services.
- **Community Builder**: Local operator/steward who grows participation and programs.
- **Admin**: Platform operator with global controls.

> Note: In schema, `community_builder` is a `userRoleEnum` entry and Community Builder program details live in `communityBuilderProfiles`.

## Matrix: Capabilities by Role and Layer

| Role / Layer         | Project                                   | HOA / Micro-neighborhood                          | County / City                                           | Global / Multi-county                         |
|----------------------|-------------------------------------------|----------------------------------------------------|--------------------------------------------------------|-----------------------------------------------|
| **Homeowner**        | Create/join project chats, comment, react | View HOA feed, vote in `hoaVotes`, receive notices | Browse community feed, groups, marketplace             | Read global announcements                      |
| **Builder (Pro)**    | Join project, bid, post updates           | Offer services, respond to HOA requests            | Post to community feed, list in marketplace, join groups | See global best-practice content              |
| **Community Builder**| Start/curate projects, spotlight progress | Pin HOA posts, create HOA marketplace items, send announcements | Create/pin county groups, curate feed, highlight projects | Help seed new counties, pilot global programs |
| **Admin**            | Audit/resolve abuse                       | Configure HOA features and safeguards              | Configure defaults, moderation rules, analytics         | Publish platform-wide updates and policies    |

## Location Keys on Core Entities (current implementation)

- `communityPosts`
  - Uses `scope`, `stateCode`, `countyFips`, `cityName`, `regionName` for geographic targeting.
  - Defaults to county-level usage in current community feed routes.
- `communityGroups`
  - `scope`, `stateCode`, `countyFips`, `cityName`, `regionName`, plus `groupCountyLinks` for multi-county.
- `marketplaceListings`
  - `county`, `state`, `city`, `zipCode` for location.
- `homeownerAssociations`, `hoaVotes`, `hoaMembers`
  - `homeownerAssociations` carries `state` and `countyFips`; `hoaVotes` and `hoaMembers` reference the HOA.

These fields are the backbone for the **Project → HOA → County → Global** layering model.

## Design Principles (No Facebook Dependency)

- All community surfaces (feed, groups, marketplace, HOA, projects) should:
  - Default queries to the user’s `state` + `countyFips` and, when relevant, their `hoaId` or project context.
  - Allow explicit overrides for admin/power-user tools (e.g., cross-county dashboards).
- External platforms like Facebook are **marketing funnels only** (e.g., links into onboarding), not data sources or mirrors.
- Community Builders are treated as local stewards, not generic "admins"; copy and UI should consistently use the "Community Builder" label.
