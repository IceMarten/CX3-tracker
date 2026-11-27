-- Run once in the Supabase SQL editor before deploying the updated app.
alter table public.units
  add column if not exists company_identification_code text;
