# Implementation Plan - Marketplace Feature Expansion

## Objective
Deliver the next feature wave on top of the existing MVP:
1. Link jobs to both category and skills.
2. Link freelancers to skills.
3. Add editable profile pages for client/freelancer bio and portfolio URL.
4. Add viewable client/freelancer profile pages, with deep links from jobs, proposals, and contracts.
5. Make job/proposal/contract status transitions consistent and reliable.
6. Add review creation and review reading flows.

## Constraints and Ground Rules
- Keep the existing Supabase schema as source of truth (`types/database.ts`).
- Use existing tables for these features: `category`, `skill`, `job_skill`, `freelancer_skill`, `profile`, `client`, `freelancer`, `review`.
- Keep auth model unchanged (`Authorization: Bearer <user_id>`).
- Keep route conventions and Zod-first validation patterns already used in `app/api/**/route.ts`.

## Current Baseline (from code audit)
- Jobs already support `category_id` but do not yet use `job_skill`.
- Freelancers exist but do not yet use `freelancer_skill`.
- Profiles are partially used (`profile` for names), but there are no profile edit/view pages.
- Proposal accept currently updates proposal/job/contract, but lifecycle coverage is incomplete for some status paths.
- No review routes/pages/components are implemented yet.

## Phase Plan

### Phase 9.1 - Skills and Category Wiring
**Goal:** Make skills first-class in job posting and freelancer setup/editing.

**Backend**
- Add `GET /api/skills` (list all skills).
- Extend `POST /api/jobs` to accept `skillIds: number[]`.
- Persist selected skills into `job_skill` with ownership/validity checks.
- Add freelancer skills API:
  - `GET /api/freelancer/skills` (current user skills)
  - `PUT /api/freelancer/skills` (replace set in `freelancer_skill`)

**Frontend**
- Update `JobForm` to load skill options and submit selected skills.
- Add freelancer skill editor page under `/freelancer/profile` (or section on same page).

**Acceptance**
- Every newly posted job includes 1+ skills and a category.
- Freelancer can save and re-edit skills.
- Job feed/detail surfaces job skills.

---

### Phase 9.2 - Profile Edit Pages (Client + Freelancer)
**Goal:** Let users update profile details (bio + portfolio URL where available).

**Backend**
- Add `GET /api/profile/me` (composed profile object from `users`, `profile`, `client`, `freelancer`).
- Add `PATCH /api/profile/me` with field-level validation:
  - `profile.bio`
  - `profile.avatar_url` (optional)
  - `client.company_name` (optional)
  - `freelancer.hourly_rate` (optional)
  - `freelancer.portfolio_url` (optional)

**Frontend**
- Add `/client/profile` edit page.
- Add `/freelancer/profile` edit page.
- Add nav links in `Sidebar` for both roles.
- Show success/error Sonner toasts for all mutations.

**Acceptance**
- Client and freelancer can persist profile edits.
- Bio is editable for both via `profile.bio`.
- Portfolio URL is editable through freelancer profile data.

---

### Phase 9.3 - Public Profile Pages + Deep Linking
**Goal:** View full profile cards and navigate to them from key workflow surfaces.

**Backend**
- Add `GET /api/profiles/[userId]` returning composed profile payload:
  - Identity/name from `profile` (+ `users` if needed)
  - Role details from `client` and/or `freelancer`
  - Skills from `freelancer_skill`
  - Aggregated review stats and recent reviews

**Frontend**
- Add public profile routes:
  - `/clients/[userId]`
  - `/freelancers/[userId]`
- Add links to profile pages from:
  - Job listing/detail (client link)
  - Proposal cards (freelancer link)
  - Contract cards (counterparty link)

**Acceptance**
- User can open profile pages from job listing, proposal, and contract UI.
- Profile pages display merged data from `users` + `profile` + `client` + `freelancer`.

---

### Phase 9.4 - Status Lifecycle Hardening
**Goal:** Ensure job/proposal/contract statuses remain consistent after each action.

**Status contract**
- **Job:** `open -> in_progress -> completed` (or `cancelled` when appropriate)
- **Proposal:** `pending -> accepted | rejected | withdrawn`
- **Contract:** `active -> completed | terminated`

**Backend updates**
- Keep accept flow authoritative:
  - accepted proposal set to `accepted`
  - sibling pending proposals set to `rejected`
  - contract created as `active`
  - job moved to `in_progress`
- Add withdraw endpoint for freelancer (`POST /api/proposals/[id]/withdraw`).
- Ensure payment completion updates both:
  - `contract.status = completed`
  - related `job.status = completed` (if no other active contract path exists)
- Add contract termination endpoint (`PATCH /api/contracts/[id]/status`) for valid actors.
- Add explicit guards to block invalid transitions.

**Acceptance**
- No illegal transition is possible via API.
- UI reflects fresh statuses after each mutation without stale labels.

---

### Phase 9.5 - Reviews (Create + Read)
**Goal:** Enable bilateral reviews after contract completion.

**Backend**
- Add `POST /api/reviews`:
  - Validate rating/comment/contract/reviewee.
  - Permit only contract participants.
  - Permit only completed contracts.
  - Prevent duplicate review pair per contract in app logic.
- Add `GET /api/reviews` for:
  - `?reviewee_id=...` (profile pages)
  - optionally `?contract_id=...` (contract context)

**Frontend**
- Add review form on completed-contract experience.
- Add review list and average rating display on profile pages.

**Acceptance**
- Users can leave review only when eligible.
- Users can read reviews on profile pages.

## API and File Impact Summary

### New/Updated API routes
- New: `app/api/skills/route.ts`
- New: `app/api/freelancer/skills/route.ts`
- New: `app/api/profile/me/route.ts`
- New: `app/api/profiles/[userId]/route.ts`
- New: `app/api/proposals/[id]/withdraw/route.ts`
- New: `app/api/contracts/[id]/status/route.ts`
- New: `app/api/reviews/route.ts`
- Update: `app/api/jobs/route.ts`
- Update: `app/api/jobs/[id]/route.ts`
- Update: `app/api/jobs/[id]/proposals/route.ts`
- Update: `app/api/contracts/route.ts`
- Update: `app/api/transactions/route.ts`

### New/Updated frontend surfaces
- Update: `components/jobs/JobForm.tsx`, `components/jobs/JobCard.tsx`, `components/jobs/JobFeed.tsx`
- Update: `components/proposals/ProposalCard.tsx`
- Update: `components/contracts/ContractCard.tsx`
- New/Update profile UI under:
  - `app/client/profile/page.tsx`
  - `app/freelancer/profile/page.tsx`
  - `app/clients/[userId]/page.tsx`
  - `app/freelancers/[userId]/page.tsx`
- Update sidebar navigation: `components/layout/Sidebar.tsx`

## Risks and Mitigations
- **Risk:** inconsistent status updates across endpoints.
  - **Mitigation:** centralize transition checks in shared helpers and enforce transition table rules.
- **Risk:** duplicate reviews without DB unique constraint.
  - **Mitigation:** app-level existence check before insert; add conflict-style `409` response.
- **Risk:** profile payload fragmentation across tables.
  - **Mitigation:** use one composed response shape for profile read APIs.

## Definition of Done
- Skill mappings are fully persisted and visible for jobs and freelancers.
- Profile edit pages work for client/freelancer contexts with proper toasts.
- Public profile pages are reachable from jobs, proposals, and contracts.
- Status transitions are validated and synchronized across job/proposal/contract.
- Review write/read features are complete and role-safe.
