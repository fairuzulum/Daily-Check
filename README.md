# Daily Check — IT Support

A private, single-user workspace for daily work logs, lead-assigned follow-up tasks, and non-sensitive work notes.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth + Postgres with row-level security
- Deployable to Vercel and connectable to a private GitHub repository

## Local setup

1. Install Node.js 20.9 or newer.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable key.
4. In the Supabase SQL Editor, run `supabase/migrations/202611090001_daily_check.sql`.
5. In Supabase Authentication, create your user. Disable public sign-ups for a private personal app and enable MFA.
6. Run `npm run dev` and open `http://localhost:3000`.

## Supabase configuration

Use the **publishable key** in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The database migration grants authenticated users CRUD access to the app tables, while RLS restricts every row to its `user_id`. Never put a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable, the browser, or GitHub.

The app does not implement a password vault. Do not enter email passwords, system credentials, API tokens, recovery codes, or other secrets in Notes. Use a dedicated password manager. Follow your employer's policy before storing internal work information in a personal cloud project.

## Deploy

1. Push this project to a **private** GitHub repository.
2. Import the repository into Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to Vercel's Production and Preview environments.
4. Set the Supabase Auth site URL and allowed redirect URLs to the deployed Vercel domain.
5. Deploy, then sign in with the user created in Supabase.

The database migration is included in this repository. Apply it once to the Supabase project before the first login to the app.
