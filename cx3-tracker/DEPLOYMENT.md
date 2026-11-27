# CX-3 Tracker update

## Database change

Before deploying the updated app, run `supabase-migration-company-identification-code.sql` once in the Supabase SQL editor. It adds the optional `company_identification_code` field to `public.units` without changing existing unit records.

## Deploy

Deploy the `cx3-tracker` folder using the same Next.js hosting setup and Supabase environment variables as the current app. The existing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` settings are still required. For a local production build, install the dependencies and run `npm run build` from this folder.

Existing CX-3 units will show a blank company code until one is entered. Add or update the code for each unit in the Units section; the code then appears in the rental unit selector and unit list.
