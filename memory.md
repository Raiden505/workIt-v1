# Project Memory — Freelance Marketplace MVP
_Last updated: Phase 0 (initialised)_

---

## Stack
- **Framework:** Next.js 15, App Router, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui
- **DB:** Supabase (PostgreSQL, pre-provisioned)
- **State:** Zustand (session only)
- **Forms:** React Hook Form + Zod
- **Toasts:** Sonner
- **Icons:** Lucide React

## Env Vars Needed (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Phases

| # | Name | Status |
|---|---|---|
| 1 | Project Setup & Config | ⬜ pending |
| 2 | Database Schema & RPC | ⬜ pending |
| 3 | Auth (signup, login, session) | ⬜ pending |
| 4 | Role Setup (client/freelancer activation) | ⬜ pending |
| 5 | Client Flow (post job, view proposals, accept) | ⬜ pending |
| 6 | Freelancer Flow (browse jobs, submit bid, contracts) | ⬜ pending |
| 7 | Payment Simulation | ⬜ pending |
| 8 | Polish (errors, loading states, empty states) | ⬜ pending |

**Current Phase:** None — awaiting start  
**Gate:** Agent must confirm with user before advancing to next phase.

---

## Completed Tasks
_Nothing completed yet._

---

## Files Created
_None yet._

---

## Key Decisions
- Auth: plain-text password comparison (course project — no bcrypt)
- Session: user_id in localStorage + Zustand store
- API auth: `Authorization: Bearer <user_id>` header on all mutating routes
- Atomic accept-proposal: PostgreSQL RPC `accept_proposal(uuid)`
- No RLS (service role key used server-side)

## DB Tables (all uuid PKs)
`users` → `profiles` (1:1) → `clients` (1:1) → `freelancers` (1:1)  
`clients` → `jobs` (1:N) → `proposals` (1:N, also freelancers→proposals 1:N)  
`proposals` → `contracts` (1:1) → `transactions` (1:1)

## Known Issues / Blockers
_None._
