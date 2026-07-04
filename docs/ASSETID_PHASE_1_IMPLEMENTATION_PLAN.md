# AssetID Phase 1 Implementation Plan

## 1. Executive decision
TradeScout will implement `AssetID` as the durable truth layer and start with `HomeID` as the first production vertical.

Product law for Phase 1:
- AssetID is the durable truth layer.
- HomeID is the first implementation.
- HomeScout is the exchange/action layer.
- Direct Connect job cycles enrich HomeID through verified evidence.
- Users control authority, visibility, and transfer.

## 2. Phase 1 objective
Deliver the smallest useful implementation that:
- makes HomeID materially useful now,
- preserves universal AssetID patterns for future verticals,
- avoids overbuilding VehicleID/Insurance/Mortgage/Bill verticals in this phase.

Phase 1 success target:
- a homeowner can have a persistent HomeID record,
- verified service/project evidence can enrich HomeID timeline,
- authority and transfer rules are explicit and enforceable.

## 3. Universal AssetID foundation
Define a universal contract first, then instantiate HomeID.

Universal record contract:
- durable `recordId`
- canonical identity
- authority state/history
- timeline events
- evidence references
- visibility/transfer policy
- confidence/verification state

Phase 1 principle:
- implement this contract for `recordType=home` only.

## 4. HomeID as first vertical
HomeID will be the first AssetID vertical and the only implemented vertical in Phase 1.

Phase 1 HomeID coverage:
- home record creation and lookup
- authority lifecycle
- timeline event creation via verified evidence pipeline
- visibility-aware evidence handling
- transfer workflow contract

Out of scope for Phase 1 implementation:
- VehicleID runtime
- obligation-ledger runtime
- policy/loan/bill runtime

## 5. Core entities
Phase 1 entities (home vertical only):
- `home_id_records`
- `home_authorities`
- `home_events`
- `home_evidence`
- `home_transfers`
- `home_visibility_grants` (or equivalent policy object)

Phase 1 link entities:
- `direct_connect_home_links`
- `project_home_links`
- `estimate_home_links`
- `invoice_home_links`
- `receipt_home_links`
- `permit_home_links`
- `warranty_home_links`

## 6. Authority model
Authority is time-scoped and separate from record identity.

Core rules:
- HomeID belongs to property identity, not user identity.
- Users/businesses hold authority over a time window.
- Authority can be delegated/scoped without ownership replacement.

Minimum roles for Phase 1:
- `owner`
- `co_owner`
- `builder_of_record`
- `agent_delegate`
- `property_manager`
- `admin`
- `viewer`

Required authority fields:
- `homeId`
- `subjectId` (user/business)
- `role`
- `status`
- `authoritySource`
- `startedAt`
- `endedAt`
- `transferId`

## 7. Evidence model
Evidence is attachable independently from verification.

Evidence pipeline:
1. Attach source artifact(s) to HomeID.
2. Validate evidence quality/provenance.
3. Accept/reject for timeline promotion.
4. Persist verification and visibility states.

Required evidence attributes:
- `evidenceId`
- `homeId`
- `eventId` (optional until promoted)
- `evidenceType`
- `sourceType`
- `sourceId`
- `issuer/provider`
- `amount/date` (when relevant)
- `visibility`
- `verificationStatus`

## 8. Timeline event model
Timeline events are canonical history entries, not raw attachments.

Required event attributes:
- `eventId`
- `homeId`
- `eventType`
- `title`
- `description`
- `occurredAt`
- `sourceType`
- `sourceId`
- `actorUserId`
- `providerId`
- `amount`
- `verificationStatus`
- `confidenceScore`
- `visibility`
- `evidenceIds`
- `createdAt`

Phase 1 event families:
- `ownership_claimed`
- `ownership_transferred`
- `project_started`
- `job_completed`
- `invoice_paid`
- `receipt_added`
- `permit_added`
- `warranty_added`
- `inspection_added`
- `repair_completed`
- `renovation_completed`

## 9. Visibility model
Visibility is owner-controlled by default and transfer-aware.

Phase 1 visibility classes:
- `private_owner_only`
- `shared_with_service_provider`
- `shared_with_agent`
- `buyer_packet`
- `public_home_profile`
- `admin_only`
- `transfers_with_home`
- `does_not_transfer`

Core privacy rules:
- owner-uploaded financial details default private.
- evidence does not become public by attachment alone.
- transfer packet output is policy-filtered.

## 10. Direct Connect attachment model
Direct Connect must be able to reference HomeID in Phase 1.

Phase 1 contract:
- request may include optional `homeId`.
- linked request can attach estimate/invoice/receipt/completion evidence.
- completed verified job cycle can propose/create HomeID events.

Required behaviors:
- no automatic truth mutation without evidence/verification gate.
- source provenance must remain visible in event metadata.

## 11. Transfer model
Transfer governs authority handoff while preserving record continuity.

Phase 1 transfer types:
- `builder_to_homeowner`
- `homeowner_to_homeowner`
- `homescout_sale_transfer`
- `agent_assisted_transfer`
- `admin_verified_transfer`

Rules:
- HomeID identity is persistent.
- prior authority closes, new authority opens.
- private owner data does not auto-transfer.
- transfer packet is explicit and visibility-constrained.

## 12. MVP routes/API surfaces
Phase 1 target API surfaces (contract level):
- `GET /api/home-id/:homeId`
- `GET /api/home-id/:homeId/history`
- `GET /api/home-id/:homeId/verification`
- `POST /api/home-id/claim`
- `POST /api/home-id/:homeId/attachments`
- `POST /api/home-id/:homeId/events/propose`
- `POST /api/home-id/:homeId/transfers`
- `POST /api/direct-connect/:requestId/home-link` (or equivalent compatibility surface)

Compatibility rule:
- existing HomeScout routes remain operational and may resolve through HomeID where applicable.

## 13. Contract test plan
Add contract tests before schema rollout completion:
- HomeID exists without HomeScout listing.
- Direct Connect request can reference `homeId`.
- Completed job cycle proposes HomeID event.
- Receipt/invoice evidence links to proposed/verified HomeID event.
- Authority transfer builder -> homeowner succeeds.
- Authority transfer homeowner -> homeowner succeeds.
- HomeScout sale can trigger transfer workflow.
- Private evidence is excluded from transfer packet by default.

## 14. Migration/risk plan
Primary risks:
- naming collisions (`homeId` today vs canonical HomeID identity usage)
- SEO/route coupling around existing HomeScout listing surfaces
- accidental leakage of private evidence through exchange views
- authority confusion during mixed legacy/new paths

Mitigations:
- compatibility wrappers for legacy HomeScout flows
- explicit visibility policy checks in all read serializers
- strict event promotion rules (attachment != verified history)
- phased rollout by capability flag with audit logging

## 15. Explicit non-goals
Phase 1 non-goals:
- VehicleID implementation
- obligation-ledger implementation
- insurance/mortgage/bill runtime implementation
- broad Scout IA rename/rebrand
- replacing all legacy home/workflow tables in one release

## 16. Phase 1 closeout criteria
Phase 1 is complete when:
- HomeID core entities and contracts exist for home vertical.
- Direct Connect can attach and enrich HomeID via verified evidence path.
- authority and transfer workflows are functional and policy-constrained.
- visibility rules prevent private-data leakage by default.
- compatibility paths preserve existing HomeScout experiences.

This plan remains docs-only and is the implementation baseline for the next engineering slice.
