# Project Memory — Freelance Marketplace MVP
_Last updated: Phase 9 complete_

## Stack
- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui
- **DB:** Supabase (existing pre-provisioned schema)
- **State:** Zustand
- **Forms:** React Hook Form + Zod
- **Toasts:** Sonner

## Env Vars Needed (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Phases
| # | Name | Status |
|---|---|---|
| 1 | Project Setup & Config | ✅ complete |
| 2 | Database Schema & RPC | ✅ complete |
| 3 | Auth (signup, login, session) | ✅ complete |
| 4 | Role Setup (client/freelancer activation) | ✅ complete |
| 5 | Client Flow (post job, proposals, accept) | ✅ complete |
| 6 | Freelancer Flow (browse, bid, contracts) | ✅ complete |
| 7 | Payment Simulation | ✅ complete |
| 8 | Polish (errors/loading/empty states) | ✅ complete |
| 9 | Feature Expansion (skills, profiles, statuses, reviews) | ✅ complete |

**Current Phase:** Phase 9 — Feature Expansion — ✅ complete  
**Gate:** Requested expansion delivered.

## Completed Tasks
- [Phase 1] Project scaffolded, required dependencies installed, shadcn components added, Supabase helpers/store/types/env template created.
- [Phase 2] Locked implementation to the user’s existing Supabase schema and existing generated DB types.
- [Phase 3] Auth APIs/pages/session hydration/guards implemented with localStorage `user_id` convention.
- [Phase 4] Role APIs/hooks and role-aware layouts/navigation implemented (client + freelancer).
- [Phase 5] Client workflow implemented: post jobs, view proposals, accept proposal, view contracts.
- [Phase 5+] Fixed job category null transform crash, added DB-backed categories dropdown, corrected sidebar active-state behavior.
- [Phase 6] Freelancer workflow implemented: open job feed, bid submission, freelancer contracts.
- [Phase 6+] Added client decline proposal and delete job actions with API guards.
- [Phase 7] Payment simulation implemented: transaction insert + contract completion; payment status surfaced in contracts UI.
- [Post-Phase 7] Freelancer contracts now include completed contracts.
- [Phase 8] Added API-wide try/catch error wrapping with typed JSON error responses.
- [Phase 8] Added loading skeletons and stronger empty states to all data-fetching screens.
- [Phase 8] Added logout action in sidebar.
- [Phase 8] Hardened duplicate proposal conflict handling (including DB conflict fallback to 409).
- [Post-Phase 8] Fixed app font loading by correcting global CSS font token mapping to Geist variables.
- [Phase 9 Planning] Added root-level implementation plan and technical design docs for skills, profile pages, profile links, status lifecycle hardening, and reviews.
- [Phase 9] Linked jobs to mandatory category + skills (`job_skill`) and added skills catalog API.
- [Phase 9] Added freelancer skill management (`/api/freelancer/skills`) and freelancer profile skill editor.
- [Phase 9] Added profile edit pages (`/client/profile`, `/freelancer/profile`) backed by `/api/profile/me`.
- [Phase 9] Added public profile pages (`/clients/[userId]`, `/freelancers/[userId]`) backed by `/api/profiles/[userId]`.
- [Phase 9] Added deep links to profile pages from jobs, proposals, and contracts.
- [Phase 9] Hardened status lifecycle: proposal withdraw, contract terminate, job completion on payment, contract review state visibility.
- [Phase 9] Implemented review feature (`/api/reviews`) with write + read flows and contract-page review submission UI.
- [Post-Phase 9] Updated linked-user rendering to prioritize names over IDs, added avatar rendering on profile/proposal/contract surfaces, applied white-green-black UI accents, and fixed freelancer-only default landing route.

## Files Created
- `lib/supabase/client.ts` — browser Supabase client.
- `lib/supabase/server.ts` — server Supabase client.
- `store/session.ts` — session state store.
- `types/index.ts` — app-level domain/session types.
- `lib/validations/auth.ts` — auth schemas.
- `lib/validations/job.ts` — job/query/params schemas.
- `lib/validations/proposal.ts` — proposal schema.
- `lib/hooks/useSession.ts` — session helper.
- `lib/hooks/useClientProfile.ts` — client role hook.
- `lib/hooks/useFreelancerProfile.ts` — freelancer role hook.
- `lib/api/error.ts` — shared API error message resolver.
- `components/layout/SessionProvider.tsx` — session hydration.
- `components/layout/SessionGuard.tsx` — auth gate.
- `components/layout/Sidebar.tsx` — role nav + logout.
- `components/layout/RoleSwitcher.tsx` — role switching.
- `components/layout/RoleSetupBanner.tsx` — role activation banner.
- `components/jobs/JobCard.tsx` — job display card.
- `components/jobs/JobForm.tsx` — client job posting form.
- `components/jobs/JobFeed.tsx` — freelancer open job feed.
- `components/proposals/ProposalCard.tsx` — client proposal card.
- `components/proposals/BidForm.tsx` — freelancer bid form.
- `components/contracts/ContractCard.tsx` — shared contract card.
- `app/api/**/route.ts` files for auth, roles, jobs, proposals, contracts, categories, transactions.
- `app/auth/**`, `app/client/**`, `app/freelancer/**` pages/layouts for full MVP flows.
- `Plan.md` — phased implementation plan for post-MVP feature expansion.
- `TechDesign.md` — technical design for skills mapping, profile system, status transitions, and reviews.
- `app/api/skills/route.ts` — skill options API.
- `app/api/freelancer/skills/route.ts` — freelancer skill read/replace API.
- `app/api/profile/me/route.ts` — authenticated profile read/update API.
- `app/api/profiles/[userId]/route.ts` — public composed profile API with reviews.
- `app/api/proposals/[id]/withdraw/route.ts` — proposal withdraw status transition.
- `app/api/contracts/[id]/status/route.ts` — contract termination status transition.
- `app/api/reviews/route.ts` — review create/read API.
- `app/client/profile/page.tsx` and `app/freelancer/profile/page.tsx` — editable profile pages.
- `app/clients/[userId]/page.tsx` and `app/freelancers/[userId]/page.tsx` — public profile views.
- `components/reviews/ReviewForm.tsx` and `components/reviews/ReviewList.tsx` — review UI.
- `components/shared/UserAvatar.tsx` — reusable avatar component with URL + initials fallback.
- `lib/validations/profile.ts`, `lib/validations/skill.ts`, `lib/validations/review.ts`, `lib/validations/contract.ts` — new Zod schemas.

## Key Decisions
- Auth is intentionally simulated (plain-text password compare for MVP only).
- Session persists via `localStorage.user_id` and Zustand hydration.
- API auth convention remains `Authorization: Bearer <user_id>`.
- Existing Supabase schema is the source of truth; no schema replacement.
- User account can hold both roles; role checks guard role-specific actions.
- API routes now consistently wrap logic in `try/catch` with typed JSON errors.
- Duplicate proposal protection exists at pre-check and DB-conflict handling levels.
- New feature-expansion design keeps existing tables and IDs; enhancements are wired through current schema (`job_skill`, `freelancer_skill`, `review`, `profile`, `client`, `freelancer`).
- Job creation now enforces category + at least one skill for new jobs.
- Profile discovery is now first-class navigation across marketplace entities (jobs, proposals, contracts).
- Root route now resolves role-based default navigation so freelancer-only accounts land on `/freelancer`.

## DB Tables (existing schema)
`users` → `profile` → `client` / `freelancer`  
`client` → `job` → `proposal`  
`proposal` / `job` → `contract` → `transactions`  
Supporting: `category`, `skill`, `job_skill`, `freelancer_skill`, `review`

## Known Issues / Blockers
- None.
