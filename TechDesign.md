# Technical Design Document
## Freelance Marketplace MVP

| Field | Detail |
|---|---|
| **Stack** | Next.js 15 (App Router) · Supabase · Tailwind CSS · TypeScript |
| **Database** | PostgreSQL via Supabase (pre-provisioned) |
| **Auth Strategy** | Custom email/password simulation — localStorage session |
| **Version** | 1.0 — MVP |
| **Date** | April 2026 |

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack & Rationale](#2-technology-stack--rationale)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [Project File Structure](#5-project-file-structure)
6. [API Route Specifications](#6-api-route-specifications)
7. [State Management](#7-state-management)
8. [Page & Component Breakdown](#8-page--component-breakdown)
9. [Key Code Patterns](#9-key-code-patterns)
10. [Environment Setup](#10-environment-setup)
11. [CRUD Operation Map](#11-crud-operation-map)
12. [Security & Scope Notes](#12-security--scope-notes)

---

## 1. Project Overview

A two-sided freelance marketplace MVP connecting Clients who post jobs with Freelancers who submit proposals. The primary academic goal is to demonstrate mastery of relational database design — including 1:1, 1:N, and M:N relationships — along with full CRUD operations exposed through a web UI.

### 1.1 Goals

- Implement a fully functional two-sided marketplace with dual-role accounts.
- Demonstrate all relationship types in a normalised PostgreSQL schema.
- Cover every CRUD operation through real Supabase queries (no mocking).
- Ship within a weekend sprint with clean, readable code.

### 1.2 Out of Scope

- Real JWT / cookie-based auth — using localStorage session simulation.
- Email verification — `is_verified` mocked to `true` on sign-up.
- In-app messaging / chat.
- Real payment processing (Stripe or equivalent).
- Mobile-first responsive polish or animations.

---

## 2. Technology Stack & Rationale

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.x | File-based routing, React Server Components, built-in API routes |
| Language | TypeScript | 5.x | Type safety for DB types, API payloads, and form schemas |
| Styling | Tailwind CSS | 3.x | Utility-first — fast to build, no CSS files to manage |
| Database | Supabase (PostgreSQL) | Pre-provisioned | Real-time, REST + JS client, free tier |
| DB Client | Supabase JS Client | 2.x | Type-safe queries, auto-generated types from schema |
| State | Zustand | 5.x | Lightweight global store for session; no Redux overhead needed |
| Forms | React Hook Form | 7.x | Performant uncontrolled forms, easy Zod integration |
| Validation | Zod | 3.x | Schema-first validation shared between client and API routes |
| UI Components | shadcn/ui | Latest | Accessible, Tailwind-native — install only what you need |
| Icons | Lucide React | Latest | Consistent icon set, tree-shakeable |
| Notifications | Sonner | Latest | Toast notifications — minimal bundle, great API |
| Linting | ESLint + Prettier | Latest | Code consistency across the sprint |

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────┐     fetch /api/*     ┌─────────────────────┐     Supabase client    ┌─────────────────────┐
│   Browser (Client)  │ ──────────────────▶  │   Next.js Server    │ ─────────────────────▶ │  Supabase (Postgres) │
│                     │                      │                     │                        │                     │
│  React components   │                      │  App Router pages   │                        │  PostgreSQL DB      │
│  Zustand store      │ ◀──────────────────  │  API Route handlers │ ◀───────────────────── │  Row-Level Security │
│  localStorage       │     JSON response    │  Zod validation     │     data / error       │  REST & Realtime    │
└─────────────────────┘                      └─────────────────────┘                        └─────────────────────┘
```

### 3.2 Request Lifecycle

1. User interacts with a React component (e.g. submits a form).
2. Client calls `fetch('/api/[route]', { method: 'POST', body: JSON.stringify(payload) })`.
3. Next.js API Route handler receives the request.
4. Handler validates body with Zod; returns `400` on failure.
5. Handler reads `user_id` from the `Authorization` header (sent by client from localStorage).
6. Handler uses the Supabase **server client** (service role) to execute the query.
7. Supabase returns data or an error; handler maps to HTTP response.
8. Client updates local state / Zustand store; UI re-renders.

### 3.3 Authentication Model

Because real JWT auth is out of scope, the following simulation is used:

- **Sign-Up / Login:** API Route queries the `Users` table, verifies password (plain-text comparison — acceptable for course context), and returns `user_id`.
- **Client Storage:** `user_id` stored in `localStorage` and in a Zustand session store.
- **API Auth:** Every mutating API route reads `Authorization: Bearer <user_id>` from the request header to identify the actor.
- **Route Guard:** A client-side `useEffect` in a `SessionGuard` component checks `localStorage` on mount and redirects to `/auth/login` if absent.

---

## 4. Database Schema

### 4.1 Entity Relationship Summary

| Relationship | Entity A | Entity B | Type | Join / FK |
|---|---|---|---|---|
| User → Profile | `users` | `profiles` | 1 : 1 | `profiles.user_id` UNIQUE FK |
| User → Client | `users` | `clients` | 1 : 1 | `clients.user_id` UNIQUE FK |
| User → Freelancer | `users` | `freelancers` | 1 : 1 | `freelancers.user_id` UNIQUE FK |
| Client → Jobs | `clients` | `jobs` | 1 : N | `jobs.client_id` FK |
| Freelancer → Proposals | `freelancers` | `proposals` | 1 : N | `proposals.freelancer_id` FK |
| Job → Proposals | `jobs` | `proposals` | 1 : N | `proposals.job_id` FK |
| Job ↔ Freelancer | `jobs` | `freelancers` | M : N | via `contracts` table |
| Contract → Transaction | `contracts` | `transactions` | 1 : 1 | `transactions.contract_id` UNIQUE FK |

### 4.2 Table Definitions

#### 4.2.1 `users`
Core identity table. All other entities reference this via `user_id`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `email` | `text` | NOT NULL, UNIQUE | Login identifier |
| `password` | `text` | NOT NULL | Plain-text for MVP |
| `first_name` | `text` | NOT NULL | |
| `last_name` | `text` | NOT NULL | |
| `is_verified` | `boolean` | NOT NULL, DEFAULT `true` | Always true — email flow out of scope |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

---

#### 4.2.2 `profiles`
1:1 extension of users. Stores display/bio information.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, UNIQUE, FK → `users(id)` ON DELETE CASCADE | 1:1 link |
| `bio` | `text` | | Optional self-description |
| `avatar_url` | `text` | | URL to avatar image (optional) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

---

#### 4.2.3 `clients`
Created on-demand when a user activates the Client role.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, UNIQUE, FK → `users(id)` ON DELETE CASCADE | 1:1 link |
| `company_name` | `text` | | Optional |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

---

#### 4.2.4 `freelancers`
Created on-demand when a user activates the Freelancer role.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, UNIQUE, FK → `users(id)` ON DELETE CASCADE | 1:1 link |
| `skills` | `text[]` | DEFAULT `'{}'` | PostgreSQL text array of skill tags |
| `hourly_rate` | `numeric(10,2)` | | Optional default rate |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

---

#### 4.2.5 `jobs`
Posted by Clients. Central entity of the marketplace. 1:N with proposals.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `client_id` | `uuid` | NOT NULL, FK → `clients(id)` ON DELETE CASCADE | 1:N — one client, many jobs |
| `title` | `text` | NOT NULL | |
| `description` | `text` | NOT NULL | |
| `budget` | `numeric(10,2)` | NOT NULL | Client's max spend |
| `category` | `text` | NOT NULL | e.g. `'Web Dev'`, `'Design'` |
| `status` | `text` | NOT NULL, DEFAULT `'open'` | Enum: `open` \| `in_progress` \| `completed` \| `cancelled` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

```sql
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled'));
```

---

#### 4.2.6 `proposals`
Submitted by Freelancers against open Jobs. Forms the M:N link between jobs and freelancers.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `job_id` | `uuid` | NOT NULL, FK → `jobs(id)` ON DELETE CASCADE | |
| `freelancer_id` | `uuid` | NOT NULL, FK → `freelancers(id)` ON DELETE CASCADE | |
| `bid_amount` | `numeric(10,2)` | NOT NULL | Freelancer's price |
| `cover_letter` | `text` | | Optional pitch text |
| `status` | `text` | NOT NULL, DEFAULT `'pending'` | Enum: `pending` \| `accepted` \| `rejected` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

```sql
-- Prevent duplicate bids
ALTER TABLE proposals ADD CONSTRAINT unique_proposal
  UNIQUE (job_id, freelancer_id);
```

---

#### 4.2.7 `contracts`
Created when a Client accepts a Proposal. This is the M:N resolution table between jobs and freelancers.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `job_id` | `uuid` | NOT NULL, FK → `jobs(id)` | |
| `client_id` | `uuid` | NOT NULL, FK → `clients(id)` | Denormalised for easy querying |
| `freelancer_id` | `uuid` | NOT NULL, FK → `freelancers(id)` | |
| `proposal_id` | `uuid` | NOT NULL, UNIQUE, FK → `proposals(id)` | 1:1 — one contract per proposal |
| `agreed_amount` | `numeric(10,2)` | NOT NULL | Copied from `proposal.bid_amount` |
| `status` | `text` | NOT NULL, DEFAULT `'active'` | Enum: `active` \| `completed` \| `cancelled` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

---

#### 4.2.8 `transactions`
Simulated payment record. 1:1 with contracts.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PRIMARY KEY, DEFAULT `gen_random_uuid()` | |
| `contract_id` | `uuid` | NOT NULL, UNIQUE, FK → `contracts(id)` | 1:1 — one payment per contract |
| `amount` | `numeric(10,2)` | NOT NULL | Copied from `contract.agreed_amount` |
| `status` | `text` | NOT NULL, DEFAULT `'pending'` | Enum: `pending` \| `completed` \| `failed` |
| `paid_at` | `timestamptz` | | Set when status → `completed` |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT `now()` | |

---

### 4.3 Indexes

Run in Supabase SQL Editor for query performance:

```sql
CREATE INDEX idx_jobs_client_id       ON jobs(client_id);
CREATE INDEX idx_jobs_status          ON jobs(status);
CREATE INDEX idx_proposals_job_id     ON proposals(job_id);
CREATE INDEX idx_proposals_freelancer  ON proposals(freelancer_id);
CREATE INDEX idx_contracts_job_id     ON contracts(job_id);
CREATE INDEX idx_contracts_freelancer  ON contracts(freelancer_id);
CREATE INDEX idx_contracts_client_id  ON contracts(client_id);
```

---

## 5. Project File Structure

```
freelance-marketplace/
├── app/
│   ├── layout.tsx                  # Root layout — Toaster, SessionProvider
│   ├── page.tsx                    # Redirect: auth → /client or /auth/login
│   ├── globals.css
│   │
│   ├── auth/
│   │   ├── login/page.tsx          # Login form page
│   │   └── signup/page.tsx         # Sign-up form page
│   │
│   ├── client/
│   │   ├── layout.tsx              # Client shell layout (sidebar + role switch)
│   │   ├── page.tsx                # Client dashboard (job list)
│   │   ├── jobs/
│   │   │   ├── new/page.tsx        # Post a new job form
│   │   │   └── [id]/proposals/
│   │   │       └── page.tsx        # View proposals for a job
│   │   └── contracts/page.tsx      # Active contracts (client view)
│   │
│   ├── freelancer/
│   │   ├── layout.tsx              # Freelancer shell layout
│   │   ├── page.tsx                # Freelancer dashboard
│   │   ├── jobs/
│   │   │   ├── page.tsx            # Open job feed
│   │   │   └── [id]/page.tsx       # Job detail + bid form
│   │   └── contracts/page.tsx      # Active contracts (freelancer view)
│   │
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   └── signup/route.ts
│       ├── jobs/
│       │   ├── route.ts            # GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts        # GET single job
│       │       └── proposals/route.ts
│       ├── proposals/
│       │   ├── route.ts            # POST create proposal
│       │   └── [id]/accept/route.ts
│       ├── contracts/route.ts      # GET contracts
│       ├── transactions/route.ts   # POST simulate payment
│       └── roles/route.ts          # POST create client/freelancer profile
│
├── components/
│   ├── ui/                         # shadcn/ui components (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── RoleSwitcher.tsx
│   │   └── SessionGuard.tsx        # Redirect if no localStorage session
│   ├── jobs/
│   │   ├── JobCard.tsx
│   │   ├── JobForm.tsx
│   │   └── JobFeed.tsx
│   ├── proposals/
│   │   ├── ProposalCard.tsx
│   │   └── BidForm.tsx
│   └── contracts/
│       └── ContractCard.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Browser Supabase client (anon key)
│   │   └── server.ts               # Server Supabase client (service role)
│   ├── validations/
│   │   ├── auth.ts                 # Zod schemas for login / signup
│   │   ├── job.ts                  # Zod schema for job creation
│   │   └── proposal.ts             # Zod schema for proposal creation
│   ├── hooks/
│   │   ├── useSession.ts
│   │   ├── useClientProfile.ts
│   │   └── useFreelancerProfile.ts
│   └── utils.ts                    # cn(), formatCurrency(), etc.
│
├── store/
│   └── session.ts                  # Zustand session store
│
├── types/
│   ├── database.ts                 # Supabase auto-generated DB types
│   └── index.ts                    # Derived app-level types
│
├── .env.local
├── next.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## 6. API Route Specifications

All routes live under `/app/api/`. Every mutating route requires an `Authorization: Bearer <user_id>` header. Responses are always JSON.

### 6.1 Auth Routes

| Method | Path | Body | Response | DB Operation |
|---|---|---|---|---|
| `POST` | `/api/auth/signup` | `email, password, first_name, last_name` | `{ user_id, profile_id }` | INSERT users → INSERT profiles |
| `POST` | `/api/auth/login` | `email, password` | `{ user_id, first_name, last_name }` | SELECT users WHERE email + password |

### 6.2 Role Setup

| Method | Path | Body | Response | DB Operation |
|---|---|---|---|---|
| `POST` | `/api/roles` | `{ role: 'client' \| 'freelancer' }` | `{ id }` | INSERT clients OR freelancers |
| `GET` | `/api/roles` | — | `{ client_id?, freelancer_id? }` | SELECT from clients + freelancers WHERE user_id |

### 6.3 Jobs

| Method | Path | Body / Params | Response | DB Operation |
|---|---|---|---|---|
| `GET` | `/api/jobs?status=open` | `status` (query) | `Job[]` | SELECT jobs WHERE status = ? |
| `GET` | `/api/jobs?client_id=X` | `client_id` (query) | `Job[]` | SELECT jobs WHERE client_id = ? |
| `POST` | `/api/jobs` | `title, description, budget, category` | `Job` | INSERT jobs |
| `GET` | `/api/jobs/[id]` | — | `Job` + client info | SELECT jobs JOIN clients WHERE id = ? |
| `GET` | `/api/jobs/[id]/proposals` | — | `Proposal[]` | SELECT proposals WHERE job_id = ? |

### 6.4 Proposals

| Method | Path | Body | Response | DB Operation |
|---|---|---|---|---|
| `POST` | `/api/proposals` | `job_id, bid_amount, cover_letter` | `Proposal` | INSERT proposals |
| `POST` | `/api/proposals/[id]/accept` | — | `{ contract_id }` | UPDATE proposal → UPDATE job → INSERT contract (via RPC) |

> **Note:** The accept endpoint runs three DB operations atomically using a Supabase RPC (PostgreSQL function). If any step fails, all are rolled back.

### 6.5 Contracts & Transactions

| Method | Path | Body | Response | DB Operation |
|---|---|---|---|---|
| `GET` | `/api/contracts?role=client` | `role` (query) | `Contract[]` | SELECT contracts WHERE client_id = ? |
| `GET` | `/api/contracts?role=freelancer` | `role` (query) | `Contract[]` | SELECT contracts WHERE freelancer_id = ? |
| `POST` | `/api/transactions` | `{ contract_id }` | `Transaction` | INSERT transactions + UPDATE contracts status |

### 6.6 Standard Error Responses

| HTTP Status | When Used | Body Shape |
|---|---|---|
| `400 Bad Request` | Zod validation fails | `{ error: string, details: ZodIssue[] }` |
| `401 Unauthorized` | Missing / invalid Authorization header | `{ error: 'Unauthorized' }` |
| `403 Forbidden` | Authenticated but not allowed | `{ error: 'Forbidden' }` |
| `404 Not Found` | Resource does not exist | `{ error: 'Not found' }` |
| `409 Conflict` | Duplicate (e.g. re-bid same job) | `{ error: 'Conflict', detail: string }` |
| `500 Server Error` | Supabase / unexpected error | `{ error: 'Internal server error' }` |

---

## 7. State Management

### 7.1 Zustand Session Store

```ts
// store/session.ts
interface SessionState {
  userId:       string | null;
  firstName:    string | null;
  clientId:     string | null;   // null if role not activated
  freelancerId: string | null;   // null if role not activated
  activeRole:   'client' | 'freelancer' | null;
  setSession:   (data: Partial<SessionState>) => void;
  clearSession: () => void;
}
```

### 7.2 Session Persistence

| Event | Action |
|---|---|
| Successful login | Set Zustand state + write to `localStorage` |
| App refresh | `SessionProvider` reads `localStorage` → `setSession()` |
| Logout | `clearSession()` → `localStorage.clear()` → `router.push('/auth/login')` |
| No session on protected page | `SessionGuard` redirects to `/auth/login` |

### 7.3 Server vs Client Data Fetching

- **Page-level data** (lists, dashboard counts): Fetch inside the Page component as an async Server Component using the Supabase server client.
- **User-triggered mutations** (form submits, button clicks): Call `/api/*` route handlers from the client using `fetch`.
- **Session data:** Always from the Zustand store (client-side only).

---

## 8. Page & Component Breakdown

| Route | Page | Auth? | Key Operations | Role |
|---|---|---|---|---|
| `/auth/login` | `LoginPage` | No | `POST /api/auth/login` | Any |
| `/auth/signup` | `SignupPage` | No | `POST /api/auth/signup` | Any |
| `/client` | `ClientDashboard` | Yes | `GET /api/jobs?client_id=X` | Client |
| `/client/jobs/new` | `NewJobPage` | Yes | `POST /api/jobs` | Client |
| `/client/jobs/[id]/proposals` | `ProposalsPage` | Yes | `GET /api/jobs/[id]/proposals`, `POST /api/proposals/[id]/accept` | Client |
| `/client/contracts` | `ClientContractsPage` | Yes | `GET /api/contracts?role=client`, `POST /api/transactions` | Client |
| `/freelancer` | `FreelancerDashboard` | Yes | `GET /api/contracts?role=freelancer` | Freelancer |
| `/freelancer/jobs` | `JobFeedPage` | Yes | `GET /api/jobs?status=open` | Freelancer |
| `/freelancer/jobs/[id]` | `JobDetailPage` | Yes | `GET /api/jobs/[id]`, `POST /api/proposals` | Freelancer |
| `/freelancer/contracts` | `FreelancerContractsPage` | Yes | `GET /api/contracts?role=freelancer` | Freelancer |

### 8.1 Shared Layout Components

| Component | Purpose | Behaviour |
|---|---|---|
| `SessionGuard` | Wraps all protected pages | Reads localStorage; redirects to login if absent |
| `RoleSwitcher` | Toggle between Client/Freelancer views | Shows 'Setup' button if role not activated |
| `Sidebar` | Navigation for client/freelancer shells | Links vary by `activeRole` |
| `RoleSetupBanner` | Prompts role activation | One-click setup calls `POST /api/roles` |

---

## 9. Key Code Patterns

### 9.1 Supabase Server Client

```ts
// lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const supabaseServer = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // server only — never expose to browser
);
```

### 9.2 Zod Validation in API Routes

```ts
// app/api/jobs/route.ts
import { z } from 'zod';

const CreateJobSchema = z.object({
  title:       z.string().min(5).max(120),
  description: z.string().min(20),
  budget:      z.number().positive(),
  category:    z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = CreateJobSchema.safeParse(body);

  if (!parsed.success)
    return Response.json({ error: parsed.error.issues }, { status: 400 });

  // extract user_id from auth header
  const userId = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // ... continue with Supabase query
}
```

### 9.3 Accept Proposal — Atomic RPC

The accept-proposal flow must execute three writes atomically. Create this PostgreSQL function in the Supabase SQL Editor:

```sql
CREATE OR REPLACE FUNCTION accept_proposal(p_proposal_id uuid)
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE
  v_proposal proposals%ROWTYPE;
  v_contract_id uuid;
BEGIN
  -- Fetch the proposal
  SELECT * INTO v_proposal FROM proposals WHERE id = p_proposal_id;

  -- 1. Accept this proposal
  UPDATE proposals SET status = 'accepted' WHERE id = p_proposal_id;

  -- 2. Reject all other proposals for the same job
  UPDATE proposals SET status = 'rejected'
    WHERE job_id = v_proposal.job_id AND id != p_proposal_id;

  -- 3. Move job to in_progress
  UPDATE jobs SET status = 'in_progress' WHERE id = v_proposal.job_id;

  -- 4. Create the contract
  INSERT INTO contracts (job_id, client_id, freelancer_id, proposal_id, agreed_amount)
    SELECT v_proposal.job_id, j.client_id, v_proposal.freelancer_id,
           p_proposal_id, v_proposal.bid_amount
    FROM jobs j WHERE j.id = v_proposal.job_id
  RETURNING id INTO v_contract_id;

  RETURN v_contract_id;
END; $$;
```

Call it from the API route handler:

```ts
const { data, error } = await supabaseServer.rpc('accept_proposal', {
  p_proposal_id: proposalId,
});
```

### 9.4 `useSession` Hook

```ts
// lib/hooks/useSession.ts
'use client';
import { useSessionStore } from '@/store/session';

export function useSession() {
  const { userId, clientId, freelancerId, activeRole } = useSessionStore();

  return {
    userId,
    clientId,
    freelancerId,
    activeRole,
    isAuthenticated:    !!userId,
    hasClientRole:      !!clientId,
    hasFreelancerRole:  !!freelancerId,
  };
}
```

### 9.5 Authenticated Fetch Helper

```ts
// lib/utils.ts
export function authFetch(url: string, options: RequestInit = {}) {
  const userId = localStorage.getItem('user_id');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userId}`,
      ...options.headers,
    },
  });
}
```

---

## 10. Environment Setup

### 10.1 Environment Variables

Store in `.env.local` — never commit to Git.

| Variable | Source | Exposed to Browser? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API | Yes (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API | **NO — server only** |

### 10.2 Bootstrap Commands

```bash
npx create-next-app@latest freelance-marketplace \
  --typescript --tailwind --eslint --app --src-dir=false

cd freelance-marketplace

npm install @supabase/supabase-js zustand react-hook-form \
  @hookform/resolvers zod sonner lucide-react

npx shadcn@latest init
npx shadcn@latest add button input label card badge select textarea separator
```

### 10.3 Generate Supabase TypeScript Types

Run this after finalising your schema:

```bash
npx supabase gen types typescript \
  --project-id <your-project-id> > types/database.ts
```

---

## 11. CRUD Operation Map

| Operation | Entity | UI Trigger | API Route | SQL |
|---|---|---|---|---|
| CREATE | User + Profile | Sign-up form submit | `POST /api/auth/signup` | INSERT INTO users; INSERT INTO profiles |
| CREATE | Client | Click 'Become a Client' | `POST /api/roles` | INSERT INTO clients |
| CREATE | Freelancer | Click 'Become a Freelancer' | `POST /api/roles` | INSERT INTO freelancers |
| CREATE | Job | Post Job form submit | `POST /api/jobs` | INSERT INTO jobs |
| CREATE | Proposal | Bid form submit | `POST /api/proposals` | INSERT INTO proposals |
| CREATE | Contract | Accept Proposal button | `POST /api/proposals/[id]/accept` | INSERT INTO contracts (via RPC) |
| CREATE | Transaction | Simulate Payment button | `POST /api/transactions` | INSERT INTO transactions |
| READ | All open Jobs | Freelancer job feed | `GET /api/jobs?status=open` | SELECT * FROM jobs WHERE status='open' |
| READ | My Jobs | Client dashboard | `GET /api/jobs?client_id=X` | SELECT * FROM jobs WHERE client_id=? |
| READ | Job Detail | Freelancer clicks a job | `GET /api/jobs/[id]` | SELECT jobs JOIN clients WHERE id=? |
| READ | Proposals for Job | Client clicks proposals tab | `GET /api/jobs/[id]/proposals` | SELECT * FROM proposals WHERE job_id=? |
| READ | My Contracts | Contracts page | `GET /api/contracts?role=X` | SELECT contracts WHERE client_id / freelancer_id=? |
| READ | My Roles | Role switcher on load | `GET /api/roles` | SELECT FROM clients + freelancers WHERE user_id |
| UPDATE | Proposal status | Accept Proposal button | `POST /api/proposals/[id]/accept` | UPDATE proposals SET status='accepted' |
| UPDATE | Job status | Accept Proposal button | `POST /api/proposals/[id]/accept` | UPDATE jobs SET status='in_progress' |
| UPDATE | Transaction status | Simulate Payment button | `POST /api/transactions` | UPDATE transactions SET status='completed' |
| UPDATE | Contract status | Simulate Payment button | `POST /api/transactions` | UPDATE contracts SET status='completed' |

---

## 12. Security & Scope Notes

This is an academic MVP. The table below documents intentional shortcuts and what a production system would do differently.

| Area | MVP Approach | Production Equivalent |
|---|---|---|
| Passwords | Stored and compared in plain text | bcrypt / argon2 hashing + salting |
| Auth tokens | `user_id` in `localStorage` | Signed JWT in `httpOnly` cookie |
| Row-Level Security | Disabled — service role key bypasses RLS | Enable RLS; use anon key + JWT claims |
| Email verification | `is_verified` always `true` | Send email via Supabase Auth or Resend |
| API auth | `Authorization: Bearer <user_id>` | Verify signed JWT signature on every request |
| Input sanitization | Zod validates shape/types only | Parameterised queries (Supabase already does this) |
| CORS | Default Next.js (same-origin) | Explicit CORS middleware for public APIs |
| Rate limiting | None | Upstash Redis rate limiter middleware |
