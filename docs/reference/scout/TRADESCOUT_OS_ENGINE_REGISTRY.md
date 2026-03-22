# TradeScout OS Engine Registry

This file is the canonical registry of TradeScout OS engines.

Purpose:
- Define which engines are officially part of the OS control plane.
- Prevent accidental introduction of ungoverned engines.
- Require explicit registration and contract locking for every new engine.

## Registered Engines (Locked)

1. CVS / Trust Engine
- Governs trust-based exposure and eligibility across platform surfaces.
- Contract: `CVS_TRUST_EXECUTION_CONTRACT.md`

2. Scout
- Governs intent interpretation, objective framing, and platform routing.
- Contract: `SCOUT_FULL_SYSTEM_ARCHITECTURE.md`

3. Direct Connect
- Governs contact authorization and coordination lifecycle.
- Contract: `DIRECT_CONNECT_EXECUTION_CONTRACT.md`

4. Community
- Governs local signal and reputation generation for CVS input.
- Contract: `COMMUNITY_ENGINE_EXECUTION_CONTRACT.md`

5. Messages
- Governs post-approval transaction communication lifecycle.
- Contract: `MESSAGES_ENGINE_EXECUTION_CONTRACT.md`

6. Exchange
- Governs marketplace supply objects, discovery, and listing lifecycle under CVS eligibility.
- Contract: `EXCHANGE_ENGINE_EXECUTION_CONTRACT.md`

7. HomeScout
- Governs property lifecycle records, ownership context, and property exposure under CVS eligibility.
- Contract: `HOMESCOUT_ENGINE_EXECUTION_CONTRACT.md`

8. Maps
- Governs spatial indexing, geographic discovery, and location-based routing context under CVS eligibility.
- Contract: `MAPS_ENGINE_EXECUTION_CONTRACT.md`

9. User System
- Governs identity authority, claims semantics, entity types, permissions, and account state.
- Contract: `USER_SYSTEM_ENGINE_EXECUTION_CONTRACT.md`

## Engine Registration Rule (Required)

Any future engine must be registered here before implementation changes are considered complete.

A new engine is valid only if all conditions are met:
- Added to this registry with clear system role.
- Has a canonical execution contract file in repo root.
- Includes explicit invariants, boundaries, and compliance checklist.
- Defines review requirement and implementation anchors.
- States interaction rules with existing registered engines.

Unregistered engines are non-canonical and must not be treated as authority surfaces.

## Current Build State

Control Plane (locked):
- CVS / Trust Engine
- Scout
- Direct Connect
- Community
- Messages

Identity Engine (locked):
- User System

Economic Engine (locked):
- Exchange

Property Engine (locked):
- HomeScout

Spatial Intelligence Engine (locked):
- Maps

Platform Status:
- All currently defined TradeScout OS engines are formally locked by contract.
