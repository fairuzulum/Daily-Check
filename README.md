# Daily Check — IT Support

A private, single-user workspace for daily work logs, lead-assigned follow-up tasks, with reusable locations.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth + Postgres with row-level security
- Deployable to Vercel and connectable to a private GitHub repository

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
4. In the Supabase SQL Editor, run the migrations in order: `202611090001_daily_check.sql`, `202611120001_add_activity_metadata.sql`, `202611120002_fix_existing_log_time_zone.sql`, `20261116071339_reusable_locations_and_workspace_filters.sql`, then `20261116072308_restrict_daily_check_anonymous_access.sql`.
5. In Supabase Authentication, create your user. Disable public sign-ups for a private personal app and enable MFA.
6. Run `npm run dev` and open `http://localhost:3000`.

## Supabase configuration

Use the **publishable key** in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The database migration grants authenticated users CRUD access to the app tables, while RLS restricts every row to its `user_id`. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable, the browser, or GitHub.

Daily Task entries can include the worker name, department, location, time, and an optional ticket number.

Daily Task time is entered manually. Saved locations are reused from a dropdown; new locations are stored atomically with an activity, with database-level case/whitespace-insensitive deduplication per account. Existing locations are backfilled by the migration.

Both lists use server pagination (10/20/50 rows), search, filters, loading/error states, edit forms, and delete confirmation. Daily Task supports date ranges, petugas, department, location, and ticket filters. Daily Check supports explicit status, priority and overdue filters. Notes and AI are no longer exposed or queried by the app. Existing work_notes data is retained.

The summary RPC uses SECURITY INVOKER and account ownership checks; new location rows are protected by RLS. The location trigger is atomic with the daily log save. No service-role key is used.

## Deploy

1. Push this project to a **private** GitHub repository.
2. Import the repository into Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to Vercel's Production and Preview environments.
4. Set the Supabase Auth site URL and allowed redirect URLs to the deployed Vercel domain.
5. Deploy, then sign in with the user created in Supabase.

All database migrations are included in this repository. Apply them to the Supabase project before using the app.
