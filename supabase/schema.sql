-- ============================================================
-- Sacred Heart RCIA Ministry Portal — Supabase schema
-- Run this whole file once in Supabase SQL Editor (Project > SQL Editor > New query)
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Tables ----------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  role text not null default 'catechumen' check (role in ('admin','core_team','sponsor','catechumen')),
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists important_dates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  location text,
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists sponsor_catechumen (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references profiles(id) on delete cascade,
  catechumen_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sponsor_id, catechumen_id)
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  important_date_id uuid not null references important_dates(id) on delete cascade,
  person_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'present' check (status in ('present','absent')),
  note text,
  updated_at timestamptz not null default now(),
  unique (important_date_id, person_id)
);

-- ---------- Helper: current user's role (bypasses RLS to avoid recursion) ----------

create or replace function get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from profiles where id = auth.uid();
$$;

-- ---------- Auto-create profile row on signup ----------
-- Reads full_name / phone / role out of the signUp() metadata payload.
-- This runs with elevated privileges regardless of email-confirmation settings.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Member'),
    new.raw_user_meta_data->>'phone',
    case
      when new.raw_user_meta_data->>'role' in ('sponsor','catechumen')
        then new.raw_user_meta_data->>'role'
      else 'catechumen'
    end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- Prevent self-promotion to admin/core_team ----------

create or replace function prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.role <> old.role and get_my_role() <> 'admin' then
    raise exception 'Only an admin can change a member''s role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_escalation on profiles;
create trigger trg_prevent_role_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();

-- ---------- Row Level Security ----------

alter table profiles enable row level security;
alter table announcements enable row level security;
alter table important_dates enable row level security;
alter table sponsor_catechumen enable row level security;
alter table attendance enable row level security;

-- profiles: everyone signed in can view the directory; admins can update
-- anyone, members can update their own non-role fields (role changes are
-- blocked by the trigger above unless the actor is an admin).
create policy "profiles_select" on profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles_update_admin" on profiles for update
  using (get_my_role() = 'admin');

create policy "profiles_update_self" on profiles for update
  using (id = auth.uid());

-- announcements: everyone can read; only Admin/Core Team can write.
create policy "announcements_select" on announcements for select
  using (auth.role() = 'authenticated');

create policy "announcements_write" on announcements for insert
  with check (get_my_role() in ('admin','core_team'));

create policy "announcements_update" on announcements for update
  using (get_my_role() in ('admin','core_team'));

create policy "announcements_delete" on announcements for delete
  using (get_my_role() in ('admin','core_team'));

-- important_dates: everyone can read; only Admin/Core Team can write.
create policy "dates_select" on important_dates for select
  using (auth.role() = 'authenticated');

create policy "dates_write" on important_dates for insert
  with check (get_my_role() in ('admin','core_team'));

create policy "dates_update" on important_dates for update
  using (get_my_role() in ('admin','core_team'));

create policy "dates_delete" on important_dates for delete
  using (get_my_role() in ('admin','core_team'));

-- sponsor_catechumen: everyone can read; only Admin/Core Team manage pairings.
create policy "pairs_select" on sponsor_catechumen for select
  using (auth.role() = 'authenticated');

create policy "pairs_write" on sponsor_catechumen for insert
  with check (get_my_role() in ('admin','core_team'));

create policy "pairs_delete" on sponsor_catechumen for delete
  using (get_my_role() in ('admin','core_team'));

-- attendance: Admin/Core Team can see and manage everything; a Sponsor or
-- Catechumen can only see and mark their own record.
create policy "attendance_select_own" on attendance for select
  using (person_id = auth.uid() or get_my_role() in ('admin','core_team'));

create policy "attendance_insert_own" on attendance for insert
  with check (person_id = auth.uid() or get_my_role() in ('admin','core_team'));

create policy "attendance_update_own" on attendance for update
  using (person_id = auth.uid() or get_my_role() in ('admin','core_team'));

-- ============================================================
-- After running this file, promote your first Admin:
-- Table Editor > profiles > find your row > set role = 'admin'
-- ============================================================
