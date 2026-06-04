# HomeID NFC Share Card Plan

Status: planning-only
Mode: future product concept
Scope: documentation only

## Decision

HomeID NFC Share Card should be planned as a controlled Home Snapshot access tool, not a full HomeID exposure mechanism.

The card should help homeowners carry useful home facts when shopping, meeting contractors, talking with buyers/realtors/inspectors, or giving limited job context to businesses that are not yet on TradeScout.

The card must not leak private home data, exact owner contact information, or full HomeID history by default.

## Core idea

Physical object:

- NFC card
- NFC key tag
- NFC sticker for breaker panel, utility closet, garage, or project binder
- contractor/realtor leave-behind version later

Digital object:

- read-only Home Snapshot page opened from a tokenized URL
- owner-controlled sharing mode
- revocable token
- audit trail of snapshot views

Example URL shape:

```txt
https://www.thetradescout.com/homeid/share/<token>
```

or:

```txt
https://www.thetradescout.com/h/<token>
```

The NFC tag stores only a URL/token. It never stores private home data directly.

## What this is

HomeID NFC Share Card is:

- a real-world bridge into HomeID;
- a controlled read-only home fact snapshot;
- a way to carry house details while shopping;
- a way to share job-relevant context with a contractor;
- a low-friction way to let a non-TradeScout business view context and request access/respond through TradeScout;
- a future growth loop for HomeID and Direct Connect.

## What this is not

HomeID NFC Share Card is not:

- a full private HomeID profile;
- a public home dossier;
- a contact card that exposes the homeowner;
- a way to bypass Direct Connect contact gates;
- identity verification;
- required for HomeID to be useful;
- required for Direct Connect request submission;
- a substitute for owner approval.

## Primary use cases

### 1. Shopping mode

Homeowner is at a store buying materials, fixtures, filters, appliances, paint, flooring, or parts.

The card helps them quickly check:

- room measurements;
- paint colors;
- appliance model numbers;
- HVAC filter size;
- fixture notes;
- project shopping list;
- non-sensitive photos;
- material preferences.

Default hidden data:

- exact address;
- owner phone/email;
- private documents;
- insurance records;
- access/security notes;
- alarm/lock/gate codes;
- full maintenance history.

### 2. Contractor estimate mode

Homeowner meets a contractor, handyman, installer, supplier, or service business.

The card opens a limited job-relevant snapshot:

- city/county or general location, not exact address by default;
- job scope;
- relevant photos;
- component age/condition;
- measurements;
- prior work notes;
- preferred schedule window;
- constraints that do not expose private access details.

Contact remains gated. The business can request access or respond through TradeScout.

### 3. Buyer / realtor / inspector packet

Homeowner or seller shares a controlled packet with a buyer, realtor, inspector, appraiser, or property manager.

Potential visible fields:

- completed work summary;
- permitted/verified project notes when available;
- appliance/system facts;
- warranty notes;
- maintenance highlights;
- inspection-relevant documents selected by owner.

Private notes, owner contact, exact access details, and sensitive documents remain hidden unless explicitly shared.

### 4. Emergency repair mode

Owner can share limited home context during an urgent repair.

Potential visible fields:

- relevant system shutoff notes;
- component location;
- utility type;
- safe access instructions without lock/security codes;
- emergency contact flow through TradeScout if needed.

This mode needs extra privacy review before build.

## Access levels

### Level 1 — Shopping Snapshot

Safe for casual owner use.

Visible examples:

- measurements;
- paint colors;
- appliance/filter model numbers;
- shopping lists;
- fixture/material notes;
- non-sensitive photos.

Hidden by default:

- address;
- contact info;
- private docs;
- security/access details;
- full HomeID history.

### Level 2 — Contractor Estimate Snapshot

Safe for pre-contact work scoping.

Visible examples:

- job scope;
- relevant property facts;
- relevant photos;
- component history needed for estimate;
- general location;
- owner-selected notes.

Hidden by default:

- homeowner direct contact;
- exact address unless owner permits;
- private docs;
- security/access details.

### Level 3 — Verified Work Packet

Only after owner decision and governed contact release.

Visible examples:

- exact address;
- approved job details;
- contact path;
- timeline;
- approved documents;
- work packet details.

This level must obey Direct Connect contact-gate doctrine.

### Level 4 — Owner Private HomeID

Only visible to the owner/authenticated authorized users.

Visible examples:

- full HomeID;
- all documents;
- receipts;
- warranties;
- private notes;
- full maintenance history;
- audit/history.

## Doctrine rules

This concept must preserve TradeScout law:

- Visibility does not equal contact access.
- A Home Snapshot is not a full HomeID.
- NFC tap does not equal permission to contact the owner.
- Businesses can view limited context, but contact still requires owner decision.
- Home Record remains optional for Direct Connect.
- No private owner/contact/security data by default.
- Tokens must be revocable.

## MVP requirements

Planning-only MVP requirements:

1. Generate a HomeID share token.
2. Owner chooses share mode.
3. NFC URL opens a read-only Home Snapshot.
4. No owner contact info by default.
5. No exact address by default.
6. Token can be paused, revoked, or rotated.
7. Token has an audit trail: viewed_at, mode, approximate user agent, approximate referrer if available.
8. Non-TradeScout viewer can request access or respond through TradeScout.
9. Direct Connect request can eventually be created from a snapshot.
10. Lost card flow allows token rotation without deleting HomeID.
11. Owner can preview exactly what each mode exposes.
12. Share page must clearly label the snapshot level.

## Safety and privacy requirements

Do not expose by default:

- exact address;
- homeowner phone/email;
- private documents;
- insurance documents;
- security/alarm data;
- gate/door/lock codes;
- hidden/private notes;
- full property history;
- children/family/private household details;
- financial data;
- anything that can create physical safety risk.

Required controls:

- token revocation;
- token rotation;
- share-mode preview;
- view audit trail;
- owner-only edit controls;
- clear read-only state;
- abuse report path;
- no indexing/crawling of tokenized snapshots.

## Product copy direction

Good framing:

```txt
Your home’s useful facts, always with you.
```

```txt
Share only what is needed for the job.
```

```txt
A controlled snapshot, not your full home record.
```

Avoid:

```txt
Scan this to see my full HomeID.
```

```txt
Scan this to contact me.
```

```txt
Join TradeScout to see the info.
```

The better CTA for a business is:

```txt
Request access or respond through TradeScout.
```

## Possible physical products

Future options:

- free digital share link;
- NFC card;
- NFC key tag;
- utility closet sticker;
- breaker panel sticker;
- realtor closing gift card;
- contractor leave-behind card;
- homeowner maintenance kit card;
- insurance/inspection packet card.

## Business potential

Possible monetization must not corrupt routing, visibility, trust, or contact gates.

Possible safe revenue paths:

- paid physical NFC card/key tag;
- replacement cards;
- realtor closing gift package;
- contractor-branded leave-behind package with no ranking advantage;
- homeowner maintenance kit;
- printing/fulfillment margin.

Not allowed:

- paid priority routing;
- paid trust boost;
- paid contact bypass;
- pay-to-play provider exposure;
- lead selling.

## Future implementation notes

Potential data model concepts:

- `home_share_tokens`
- `home_share_token_events`
- `home_share_modes`
- `home_snapshot_views`

Potential fields:

- token_id;
- home_id;
- owner_user_id;
- share_mode;
- status: active / paused / revoked / expired;
- created_at;
- rotated_at;
- revoked_at;
- last_viewed_at;
- allowed_sections;
- audit metadata.

No migration should be created until this plan is accepted for implementation.

## Danger zones

- Treating NFC tap as consent.
- Accidentally exposing address/contact/security details.
- Letting public snapshots be indexed.
- Making share pages editable by viewers.
- Creating full HomeID public pages.
- Allowing contractors to bypass Direct Connect.
- Printing permanent tokens without rotation/revocation.
- Adding implementation during cleanup/handoff mode.

## Cleanup-mode boundary

This file is a planning artifact only.

Do not implement this while the repo is in production cleanup / handoff mode unless explicitly approved later as a new product slice.
