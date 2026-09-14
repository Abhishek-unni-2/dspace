# DSPACE ERP

Real estate ERP for DSPACE — Projects, Units, Leads, Realtors, Site Visits, Bookings and Commissions — with role-based login.

`dspace-erp_1.html` is the original static mockup this app was built from; kept for design reference.

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Neon Postgres** via **Drizzle ORM** — stores users & roles
- Custom session auth: signed, httpOnly JWT cookie (`jose`) + `bcryptjs` password hashing — no third-party auth provider
- Deploys to **Vercel**

The ERP modules themselves (Projects, Units, Leads, …) still use the original mockup's mock data, persisted to the browser's `localStorage` — not yet wired to Postgres. Only login/users/roles are backed by the database. See "What's real vs. mock" below.

## How access control works

- Every user has a **Role**. A role grants **None / View only / Full access** to each module (Projects, Units, Leads, Realtors, Site Visits, Bookings, Commissions).
- The **Administrator** role (seeded once, see below) always has full access to everything, plus the **Admin → Users** and **Admin → Roles** screens to manage everyone else.
- Permissions are re-read from the database on every request (not cached in the session), so an admin editing a role or deactivating a user takes effect on that user's very next page load.
- `middleware.ts` blocks any request without a valid session cookie at the edge; each page/layout then does a real per-module permission check server-side (`src/lib/auth-guard.ts`) before rendering — visiting a URL you don't have permission for renders "Access restricted" server-side, it never ships that module's UI to your browser.

## Local setup

1. **Create a Neon project** at [neon.tech](https://neon.tech) and copy its connection string.
2. Copy the env file and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   - `DATABASE_URL` — your Neon connection string
   - `SESSION_SECRET` — a long random string, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the first admin account (only used once, by the seed script)
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create the database tables:
   ```bash
   npm run db:generate   # generates SQL migration files from src/db/schema.ts
   npm run db:migrate    # applies them to your Neon database
   ```
5. Seed the Administrator role + your first admin user:
   ```bash
   npm run db:seed
   ```
6. Run the app:
   ```bash
   npm run dev
   ```
   Sign in at `http://localhost:3000/login` with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Deploying to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. In the Vercel project's Neon integration (or manually), set the same environment variables from `.env.example` (`DATABASE_URL`, `SESSION_SECRET`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`) in **Project Settings → Environment Variables**.
3. Before (or after) the first deploy, run the migration + seed against the **production** database from your machine (point `DATABASE_URL` in `.env.local` at the production Neon database temporarily, or use `vercel env pull`):
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
4. Deploy. `ADMIN_PASSWORD` is only read by the seed script — consider rotating it (sign in and reset it isn't built into the UI for your own account yet; use `Admin → Users → Reset Password`, or re-run the seed logic manually) once you've confirmed the account works, and remove it from Vercel's env vars if you'd rather not leave it there long-term.

## Managing roles & users

Sign in as an Administrator, then use the **Admin** section in the sidebar:

- **Roles** — create a role, name it (e.g. "Sales Executive", "Site Manager"), and pick None / View only / Full access for each module. Full access shows that module's "+ Add", edit and delete controls; View only hides them.
- **Users** — create a user with a name, email, temporary password and role; edit their name/email/role, activate/deactivate their account, or reset their password.

## What's real vs. mock

- **Real, server-enforced, backed by Neon Postgres:** login, sessions, roles, users, per-module page access.
- **Still mock data in `localStorage`** (unchanged from the original mockup, just re-gated by role): the actual Projects/Units/Leads/Realtors/Visits/Bookings/Commissions records. Wiring these to real database tables (so data is shared across users/devices and individual records can be permissioned) is the natural next step — see `src/components/erp/erp-legacy-core.ts`.
