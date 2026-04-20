# Technical Design - Feature Expansion (Skills, Profiles, Statuses, Reviews)

| Field | Detail |
|---|---|
| Project | WorkIt (Freelance Marketplace MVP extension) |
| Stack | Next.js App Router, TypeScript, Supabase, Zustand, React Hook Form, Zod |
| Scope | Skills mapping, profile editing/viewing, lifecycle status hardening, reviews |
| Schema Policy | Existing Supabase schema is authoritative (`types/database.ts`) |

## 1. Goals

1. Require each job to be associated with a category and skills.
2. Let freelancers maintain skill mappings.
3. Provide profile edit pages for client/freelancer contexts.
4. Provide viewable client/freelancer profile pages with deep links from workflow surfaces.
5. Enforce consistent status transitions across job/proposal/contract.
6. Implement review creation and retrieval.

## 2. Non-Goals

- Replacing auth/session model.
- Replacing schema with new table names or UUID-based IDs.
- Introducing external services (payments, messaging, notification queues).

## 3. Existing Data Model (Used As-Is)

### Core tables
- `users (id, email, password, is_verified, created_at)`
- `profile (user_id, first_name, last_name, avatar_url, bio)`
- `client (user_id, company_name)`
- `freelancer (user_id, hourly_rate, portfolio_url)`
- `job (id, client_id, category_id, title, description, budget, status, created_at)`
- `proposal (id, job_id, freelancer_id, bid_amount, status, created_at)`
- `contract (id, proposal_id, job_id, freelancer_id, total_price, status, start_date, end_date)`
- `transactions (id, contract_id, sender_id, receiver_id, amount, status, created_at)`

### Supporting tables
- `category (id, name)`
- `skill (id, name)`
- `job_skill (job_id, skill_id)`
- `freelancer_skill (freelancer_id, skill_id)`
- `review (id, contract_id, reviewer_id, reviewee_id, rating, comment, created_at)`

## 4. Architecture Changes

### 4.1 API surface additions

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/skills` | List skill options |
| GET | `/api/freelancer/skills` | Read current freelancer skill set |
| PUT | `/api/freelancer/skills` | Replace current freelancer skill set |
| GET | `/api/profile/me` | Read editable profile payload for current user |
| PATCH | `/api/profile/me` | Update profile/client/freelancer fields |
| GET | `/api/profiles/[userId]` | Public profile view payload |
| POST | `/api/proposals/[id]/withdraw` | Freelancer withdraws pending proposal |
| PATCH | `/api/contracts/[id]/status` | Controlled contract transitions (`terminated`) |
| GET | `/api/reviews` | Read reviews (by reviewee or contract) |
| POST | `/api/reviews` | Create review |

### 4.2 Existing route updates

| Route | Change |
|---|---|
| `/api/jobs` (POST) | Accept and persist `skillIds` into `job_skill` |
| `/api/jobs` (GET) | Include skill metadata for list/detail payloads |
| `/api/jobs/[id]` | Include client profile summary and skills |
| `/api/jobs/[id]/proposals` | Include freelancer profile link metadata |
| `/api/contracts` | Include profile-link IDs and review summary cues |
| `/api/transactions` | When contract becomes `completed`, set related job to `completed` |

## 5. Validation and Auth Rules

### 5.1 Validation (Zod)
- `skillIds`: array of positive ints, min length 1 for job creation.
- `categoryId`: positive int, required for new jobs.
- `bio`: trimmed string, bounded max length.
- `portfolioUrl`: nullable valid URL.
- `rating`: int in range `[1..5]`.
- Proposal/contract status inputs constrained to known enums.

### 5.2 Authorization
- Keep token parsing pattern (`Authorization: Bearer <user_id>`).
- Clients only:
  - create jobs
  - accept/decline proposals on owned jobs
  - simulate payment on owned contracts
- Freelancers only:
  - submit/withdraw own proposals
  - edit freelancer skills/profile fields
- Reviews:
  - reviewer must be contract participant
  - reviewee must be the opposite participant on the same contract
  - contract must be `completed`

## 6. Status Lifecycle Design

### 6.1 Job status transitions

| From | To | Trigger | Guard |
|---|---|---|---|
| `open` | `in_progress` | client accepts a proposal | proposal pending, no existing contract |
| `in_progress` | `completed` | successful payment flow | related contract completed |
| `open` | `cancelled` | client cancels job | no accepted proposal/contract |

### 6.2 Proposal status transitions

| From | To | Trigger | Guard |
|---|---|---|---|
| `pending` | `accepted` | client accepts | job open, actor is job owner |
| `pending` | `rejected` | client declines or another proposal accepted | actor is job owner or system side effect |
| `pending` | `withdrawn` | freelancer withdraws | actor is proposal owner |

### 6.3 Contract status transitions

| From | To | Trigger | Guard |
|---|---|---|---|
| `active` | `completed` | payment simulated as completed | actor is owning client |
| `active` | `terminated` | manual termination | actor is valid participant per policy |

### 6.4 Consistency policy
- Transition checks happen before writes.
- Side-effect updates occur in deterministic order:
  1. primary entity transition
  2. dependent entity transitions
  3. response payload generation
- If a dependent update fails, endpoint returns non-2xx and surfaces explicit error.

## 7. Profile System Design

### 7.1 Edit pages
- `/client/profile`
- `/freelancer/profile`

Both pages use `<SessionGuard>` and update through `/api/profile/me`.

### 7.2 Editable fields by table

| Table | Fields |
|---|---|
| `profile` | `bio`, `avatar_url` |
| `client` | `company_name` |
| `freelancer` | `portfolio_url`, `hourly_rate` |

### 7.3 Public profile pages
- `/clients/[userId]`
- `/freelancers/[userId]`

Composed payload should include:
- name/avatar/bio from `profile`
- role-specific info from `client`/`freelancer`
- freelancer skills from `freelancer_skill + skill`
- review aggregate (`count`, `avg_rating`) + latest reviews

## 8. Deep Linking Requirements

### 8.1 From jobs
- Job list/detail includes `client_id` and visible client name link to `/clients/[client_id]`.

### 8.2 From proposals
- Proposal cards include `freelancer_id` and link to `/freelancers/[freelancer_id]`.

### 8.3 From contracts
- Contract cards include counterpart `user_id`.
- Counterpart name becomes clickable:
  - client view -> freelancer profile
  - freelancer view -> client profile

## 9. Reviews Design

### 9.1 Write flow
1. User opens completed contract context.
2. Submits rating/comment to `POST /api/reviews`.
3. API checks:
   - contract exists and is `completed`
   - reviewer belongs to contract participants
   - reviewee is opposite participant
   - duplicate review pair for same contract does not already exist
4. Insert into `review`.

### 9.2 Read flow
- `GET /api/reviews?reviewee_id=<id>` for profile pages.
- Optional `GET /api/reviews?contract_id=<id>` for contract detail use.

### 9.3 Response shape
- review list item:
  - `id`, `rating`, `comment`, `created_at`
  - `reviewer_id`, `reviewer_name`
- aggregate:
  - `count`, `average_rating`

## 10. UI Components and Pages (Planned)

### Updated components
- `components/jobs/JobForm.tsx` - category+skills selection.
- `components/jobs/JobCard.tsx` - client link + skills badge list.
- `components/jobs/JobFeed.tsx` - client link + skill hints.
- `components/proposals/ProposalCard.tsx` - freelancer link.
- `components/contracts/ContractCard.tsx` - counterpart profile link + review status indicator.
- `components/layout/Sidebar.tsx` - add role profile links.

### New components (recommended)
- `components/profile/ProfileForm.tsx`
- `components/profile/ProfileHeader.tsx`
- `components/profile/SkillsSelector.tsx`
- `components/reviews/ReviewForm.tsx`
- `components/reviews/ReviewList.tsx`

## 11. Error Handling Contract

Use existing status code policy:
- `400` invalid Zod payload
- `401` missing/invalid auth header
- `403` role or ownership mismatch
- `404` entity missing
- `409` illegal state transition or duplicate review/proposal
- `500` Supabase/unknown errors

All mutation UIs must show Sonner success/error toasts.

## 12. Testing and Verification Strategy

1. Unit-level schema validation checks for new Zod schemas.
2. API behavior checks for:
   - role ownership
   - status transition validity
   - duplicate review and duplicate skill mapping handling
3. UI checks:
   - profile edit save + refetch
   - deep link visibility from jobs/proposals/contracts
   - review read/write visibility on profile pages

## 13. Implementation Order

1. Build shared schemas/types for new payloads.
2. Implement skills APIs and wire job/freelancer forms.
3. Implement profile APIs and edit pages.
4. Implement public profile API and pages.
5. Add deep links in existing cards/pages.
6. Harden status lifecycle endpoints.
7. Add reviews API + UI integration.
8. Final end-to-end polish and consistency sweep.
