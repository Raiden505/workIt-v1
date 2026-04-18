# Product Requirements Document (PRD)

**Project Name:** Freelance Marketplace MVP (Database Course Project)  
**Document Status:** Approved for Weekend Sprint  
**Tech Stack:** Next.js (App Router), Tailwind CSS, Supabase (PostgreSQL)  

---

## 1. Project Objective
To design and build a functional Minimum Viable Product (MVP) of a two-sided freelance marketplace. The primary goal is to demonstrate a strong understanding of database design, entity relationships (1:1, 1:N, M:N), and CRUD (Create, Read, Update, Delete) operations through a web interface.

## 2. Scope

**In-Scope (P0 - Critical for course grade):**
* Custom user authentication simulation (validating email/password against a custom `Users` table).
* Dual-role account management (Users can act as Clients, Freelancers, or both).
* Client flow: Posting jobs, reviewing proposals, accepting bids, and simulating payments.
* Freelancer flow: Browsing open jobs, submitting proposals, viewing active contracts.
* Database interaction: Direct SQL insertions, updates, and queries using Supabase Client.

**Out of Scope (To save time):**
* Real JWT-based or cookie-based secure authentication.
* Email verification workflows (`is_verified` will be mocked to `true`).
* In-app messaging or chat systems.
* Real payment gateway integrations (e.g., Stripe).
* Complex UI animations or mobile-first responsive design perfection.

---

## 3. User Roles & Permissions
A single account (User) can hold multiple roles simultaneously. The interface will provide a "context switch" between roles.

1. **Unauthenticated User:** Can only view the Login and Signup pages.
2. **Client:** Can create `Jobs`, view `Proposals` mapped to their jobs, create `Contracts`, and trigger `Transactions`.
3. **Freelancer:** Can view open `Jobs`, create `Proposals`, and view `Contracts` assigned to them.

---

## 4. Core Features & User Flows

### Flow 1: Authentication & Onboarding
* **Sign Up:** User inputs Email, Password, First Name, Last Name. App inserts into `Users` -> retrieves `id` -> inserts into `Profiles`.
* **Login:** User inputs Email & Password. App queries `Users`. If matched, saves `user_id` to the browser's Local Storage.
* **Role Setup:** Upon accessing `/client` or `/freelancer` routes, the app checks if the user exists in `Clients` or `Freelancers` tables. If not, prompts a 1-click setup ("Create Client Profile" / "Create Freelancer Profile").

### Flow 2: Client Job Management
* **Post a Job:** Client fills out a form (Title, Description, Budget, Category). App performs an `INSERT` into the `Jobs` table with `status = 'open'`.
* **Dashboard:** Client views a list of their posted jobs via a `SELECT` query (`WHERE client_id = current_user`).

### Flow 3: Freelancer Bidding Loop
* **Job Discovery:** Freelancer navigates to `/jobs` and views a feed of jobs (`SELECT * FROM Jobs WHERE status = 'open'`).
* **Submit Proposal:** Freelancer views a job and submits a "Bid Amount". App performs an `INSERT` into the `Proposals` table.

### Flow 4: Contract & Transaction Simulation
* **Accept Proposal:** Client views proposals for their job. Clicks "Accept".
  * *DB Action 1:* `UPDATE Proposals SET status = 'accepted'`.
  * *DB Action 2:* `UPDATE Jobs SET status = 'in_progress'`.
  * *DB Action 3:* `INSERT INTO Contracts`.
* **Simulate Payment:** Client views