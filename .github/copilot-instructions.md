# GitHub Copilot — Workspace Instructions
# Freelance Marketplace MVP

---

## Start of Every Session

**Always read `memory.md` first.** It tells you:
- Which phase is active
- What files exist
- What decisions have been made
- Any open blockers

Do not write a single line of code before reading it.

---

## Project Context (summary)

Two-sided freelance marketplace. Clients post jobs; Freelancers submit proposals.
A single user account can hold both roles simultaneously.

**Stack:** Next.js 15 App Router · TypeScript · Tailwind · Supabase (PostgreSQL) · Zustand · React Hook Form · Zod · shadcn/ui · Sonner

**Auth model:** Custom simulation — no real JWT. `user_id` stored in `localStorage`. API routes authenticate via `Authorization: Bearer <user_id>` header. Service role Supabase client used server-side only.

**DB summary:** `users → profiles` (1:1) · `users → clients` (1:1) · `users → freelancers` (1:1) · `clients → jobs` (1:N) · `jobs ← proposals → freelancers` (M:N) · `proposals → contracts` (1:1) · `contracts → transactions` (1:1)

---

## Behaviour Rules

### Phased Execution
- Work only on the **active phase** defined in `memory.md`
- After completing a phase: summarise, update `memory.md`, then **stop and ask** the user before proceeding
- Never skip ahead or assume permission to start the next phase

### Code Quality
- Write **complete files** — no `// TODO`, no `...rest`, no placeholders
- Every API route: validate with Zod → authenticate → query Supabase → return typed JSON
- Every client mutation: show a Sonner toast on success and error
- Every page that requires auth: use `<SessionGuard>`
- Never use `any` — derive types from `types/database.ts` (Supabase generated)

### File Conventions
```
app/api/**/route.ts        → Route handlers (server only)
app/**/page.tsx            → Page components
components/**/*.tsx        → Reusable UI
lib/supabase/client.ts     → Browser Supabase client (anon key)
lib/supabase/server.ts     → Server Supabase client (service role)
lib/validations/*.ts       → Zod schemas
lib/hooks/*.ts             → Custom React hooks
store/session.ts           → Zustand session store
types/index.ts             → App-level TypeScript types
```

### Supabase Usage
```ts
// In API routes and Server Components:
import { supabaseServer } from '@/lib/supabase/server';

// In Client Components (read-only, low privilege):
import { supabaseBrowser } from '@/lib/supabase/client';
```

### API Route Template
```ts
import { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const Schema = z.object({ /* ... */ });

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });

  const userId = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!userId)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseServer.from('table').insert({ ... });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
```

### Authenticated Fetch (client-side)
```ts
// Always use this pattern for mutations from the browser:
const res = await fetch('/api/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('user_id')}`,
  },
  body: JSON.stringify(payload),
});
```

---

## memory.md — Update Protocol

After every completed task or phase, update `memory.md`:

1. Flip phase status from `⬜ pending` → `✅ complete`
2. Add completed tasks to the **Completed Tasks** list (one line each)
3. Add new files to **Files Created** (path + one-line purpose)
4. Record any decisions or blockers discovered
5. Keep the total file under **150 lines** — summarise old entries

**Do not append raw code to memory.md.** Descriptions only.

---

## Error Codes Reference

| Status | Meaning | When to use |
|---|---|---|
| 400 | Bad Request | Zod validation failed |
| 401 | Unauthorized | No / invalid user_id in header |
| 403 | Forbidden | Wrong role (e.g. freelancer trying to post a job) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate (e.g. same freelancer bids twice) |
| 500 | Server Error | Supabase error or uncaught exception |

---

## Phase Gate Reminder

```
✅ Phase complete → update memory.md → tell user what was built
⏸  STOP. Ask: "Ready to start Phase N+1: [name]?"
▶  Only continue after explicit user confirmation.
```
