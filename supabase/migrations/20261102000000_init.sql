-- Say So — database schema.
-- Safe to run more than once (everything is "if not exists"). Works on Supabase and on the
-- local PGlite database the dev server uses, so local testing runs exactly this SQL.

-- One row per person who tapped in. No name, email or device info — only a hash of their
-- random return code, so the code itself is never stored.
create table if not exists public.participants (
  id           uuid primary key default gen_random_uuid(),
  code_hash    text not null unique,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- One flat table for every answer (not one table per question — see docs/say-so-handoff.md §4.1).
-- A participant has at most one answer per prompt; editing updates that row in place.
create table if not exists public.answers (
  id             uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  prompt_id      text not null,
  text           text not null check (char_length(text) between 1 and 600),
  choices        text[],                       -- chip prompts only: the options picked
  is_chip        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (participant_id, prompt_id)
);
create index if not exists answers_prompt_idx  on public.answers (prompt_id, created_at);
create index if not exists answers_updated_idx on public.answers (updated_at);

-- Which days each participant has submitted. A submitted day with no answer row for a
-- prompt means that prompt was skipped.
create table if not exists public.day_submissions (
  participant_id     uuid not null references public.participants (id) on delete cascade,
  day_key            text not null,
  first_submitted_at timestamptz not null default now(),
  last_submitted_at  timestamptz not null default now(),
  primary key (participant_id, day_key)
);

-- Lock the tables away from Supabase's public Data API. Only the server (api/*.js), which
-- connects as the database owner, reads or writes them. RLS on with no policies = no access
-- for the anon/authenticated roles, even if someone has the project's anon key.
alter table public.participants    enable row level security;
alter table public.answers         enable row level security;
alter table public.day_submissions enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on public.participants, public.answers, public.day_submissions from anon, authenticated;
  end if;
end $$;
