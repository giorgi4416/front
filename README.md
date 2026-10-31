# Notes

A dark-first note-taking app (React + TypeScript + Vite, Tiptap editor) with accounts, private per-user workspaces and Supabase as the backend.

## Run locally

```bash
cd front
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
```

## Two authentication modes

| | **Demo mode** (no `.env`) | **Supabase mode** (`.env` set) |
|---|---|---|
| Accounts stored | This browser's `localStorage` | Supabase Auth |
| Passwords | Salted PBKDF2-SHA-256 hashes | Managed by Supabase |
| Notes stored | `localStorage`, one key per account | Postgres, protected by Row Level Security |
| Password reset | Reset link shown on screen (no email) | Real email link |
| Security | **Not production-secure** — anyone with access to the browser can read or alter the data | Production-ready |

The app shows a "Demo mode" banner on the auth pages, in the account menu and in the sidebar whenever it runs without Supabase.

Notes created before accounts existed (single-user local mode) are moved into the **first** demo account registered in that browser.

## Enable real authentication (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it. It is safe to re-run. It creates:
   - `notes`, `folders`, `tags`, `note_tags` and `profiles` tables, each with RLS so users only see their own rows;
   - composite foreign keys so a note can never point at another user's folder or tag;
   - a trigger that creates a profile for each new user, plus a backfill for existing users;
   - the public `avatars` storage bucket, where users can only write inside a folder named after their user id;
   - `delete_own_account()`, which deletes only the calling user. Their data is removed by cascading deletes.
3. **Authentication → URL Configuration**: set **Site URL** to your app URL and add `http://localhost:5173/**` and your production URL followed by `/**` to **Redirect URLs**. Confirmation, password-reset and email-change links depend on these.
4. Copy `.env.example` to `.env` and fill in **Project Settings → API**:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon / publishable key>
   ```
   Never put the `service_role` key in a `VITE_` variable, because it would be shipped to the browser.
5. Restart `npm run dev`.

With "Confirm email" enabled (the Supabase default), sign-up shows a "Check your inbox" screen. The user can log in after clicking the link.

## Deploy to Vercel

1. Push the repository to GitHub and import it in Vercel.
2. Set **Root Directory** to `front`. The framework (Vite), build command and output directory come from [`vercel.json`](vercel.json), which also rewrites every route to `index.html` so `/login`, `/reset-password` and the other routes work on refresh.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Settings → Environment Variables**, then redeploy.
4. Add the Vercel URL to Supabase's Site URL and Redirect URLs (step 3 above).

`.env` files are git-ignored; only `.env.example` is committed.
