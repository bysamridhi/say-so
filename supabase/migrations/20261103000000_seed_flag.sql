-- Marks fake participants created by `npm run seed`, so they can be removed with
-- `npm run seed -- --clear` and are left out of the CSV export.
alter table public.participants add column if not exists is_seed boolean not null default false;
