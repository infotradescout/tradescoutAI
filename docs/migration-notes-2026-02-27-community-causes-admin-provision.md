## TradeScout migration notes (2026-02-27)

### API contract updates

- `GET /api/community-causes/profile/:profileId` now includes:
  - `weightedVoteTotal: number`
  - `allocationShare: number`
- `POST /api/community-causes/:causeId/vote` now includes:
  - `weightedVoteTotal: number`
  - `allocationShare: number`
  - `voteWeight: number`

### Admin provisioning updates

- `POST /api/admin/provision-user` now supports independent delivery toggles:
  - `sendActivationEmail: boolean`
  - `sendVerificationEmail: boolean`
- Existing `sendEmail` remains supported as a fallback/default behavior.

### Behavioral notes

- Community causes creation is restricted to platform curator roles:
  - `super_admin`, `super_admin`, `ops_admin`
- Builder notification read-marking now verifies ownership before update.
- Public profile publish flow supports explicit unverified proceed via:
  - `proceedUnverified: true`
