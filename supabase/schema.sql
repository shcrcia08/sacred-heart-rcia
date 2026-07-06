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

create table if not exists cycles (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  attachment_url text,
  attachment_name text,
  attachment_type text,
  cycle_id uuid references cycles(id),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists important_dates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  location text,
  description text,
  is_session boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  person_id uuid not null references profiles(id) on delete cascade,
  group_role text not null default 'member' check (group_role in ('member','leader','co_leader','mentor')),
  created_at timestamptz not null default now(),
  unique (group_id, person_id)
);

create table if not exists sponsor_catechumen (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references profiles(id) on delete cascade,
  catechumen_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sponsor_id, catechumen_id)
);

create table if not exists schedules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  file_url text not null,
  cycle_id uuid references cycles(id),
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists prayer_booklets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  file_url text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists prayer_booklets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text not null,
  file_url text not null,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
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
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function get_current_cycle_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from cycles where is_current = true limit 1;
$$;

-- ---------- Auto-create profile row on signup ----------
-- Reads full_name / phone / role out of the signUp() metadata payload.
-- This runs with elevated privileges regardless of email-confirmation settings.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
set search_path = public
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

-- ---------- Only one cycle can be "current" at a time ----------

create or replace function enforce_single_current_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_current then
    update cycles set is_current = false where id <> new.id;
    -- fold in anything created before cycles existed, so nothing is lost
    update announcements set cycle_id = new.id where cycle_id is null;
    update schedules set cycle_id = new.id where cycle_id is null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_single_current_cycle on cycles;
create trigger trg_single_current_cycle
  after insert or update on cycles
  for each row
  when (new.is_current)
  execute function enforce_single_current_cycle();

-- ---------- Row Level Security ----------

alter table profiles enable row level security;
alter table announcements enable row level security;
alter table important_dates enable row level security;
alter table sponsor_catechumen enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table attendance enable row level security;
alter table schedules enable row level security;
alter table cycles enable row level security;
alter table prayer_booklets enable row level security;
alter table prayer_booklets enable row level security;

-- profiles: everyone signed in can view the directory; admins can update
-- anyone, members can update their own non-role fields (role changes are
-- blocked by the trigger above unless the actor is an admin).
create policy "profiles_select" on profiles for select
  using (auth.role() = 'authenticated');

create policy "profiles_update_admin" on profiles for update
  using (get_my_role() = 'admin');

create policy "profiles_update_self" on profiles for update
  using (id = auth.uid());

-- announcements: current-cycle items are visible to everyone (including
-- logged-out visitors); items from past (archived) cycles are visible only
-- to Admin. Only Admin can write.
create policy "announcements_select" on announcements for select
  using (
    cycle_id is null
    or cycle_id = get_current_cycle_id()
    or get_my_role() = 'admin'
  );

drop policy if exists "announcements_write" on announcements;
create policy "announcements_write" on announcements for insert
  with check (get_my_role() = 'admin');

drop policy if exists "announcements_update" on announcements;
create policy "announcements_update" on announcements for update
  using (get_my_role() = 'admin');

drop policy if exists "announcements_delete" on announcements;
create policy "announcements_delete" on announcements for delete
  using (get_my_role() = 'admin');

-- important_dates: anyone (including logged-out visitors) can read; only
-- Admin can write.
create policy "dates_select" on important_dates for select
  using (true);

drop policy if exists "dates_write" on important_dates;
create policy "dates_write" on important_dates for insert
  with check (get_my_role() = 'admin');

drop policy if exists "dates_update" on important_dates;
create policy "dates_update" on important_dates for update
  using (get_my_role() = 'admin');

drop policy if exists "dates_delete" on important_dates;
create policy "dates_delete" on important_dates for delete
  using (get_my_role() = 'admin');

-- sponsor_catechumen: everyone can read; only Admin/Core Team manage pairings.
create policy "pairs_select" on sponsor_catechumen for select
  using (auth.role() = 'authenticated');

create policy "pairs_write" on sponsor_catechumen for insert
  with check (get_my_role() in ('admin','core_team'));

create policy "pairs_delete" on sponsor_catechumen for delete
  using (get_my_role() in ('admin','core_team'));

-- ---------- Groups ----------

-- everyone signed in can view groups and their members; only Admin can
-- create groups or assign/remove people.
create policy "groups_select" on groups for select
  using (auth.role() = 'authenticated');

create policy "groups_insert_admin" on groups for insert
  with check (get_my_role() = 'admin');

create policy "groups_update_admin" on groups for update
  using (get_my_role() = 'admin');

create policy "groups_delete_admin" on groups for delete
  using (get_my_role() = 'admin');

create policy "group_members_select" on group_members for select
  using (auth.role() = 'authenticated');

create policy "group_members_insert_admin" on group_members for insert
  with check (get_my_role() = 'admin');

create policy "group_members_update_admin" on group_members for update
  using (get_my_role() = 'admin');

create policy "group_members_delete_admin" on group_members for delete
  using (get_my_role() = 'admin');

-- attendance: Admin can see and manage everything; Core Team can view
-- everyone's attendance (read-only); a Sponsor or Catechumen can only see
-- and mark their own record.
create policy "attendance_select_own" on attendance for select
  using (person_id = auth.uid() or get_my_role() in ('admin', 'core_team'));

create policy "attendance_insert_own" on attendance for insert
  with check (person_id = auth.uid() or get_my_role() = 'admin');

create policy "attendance_update_own" on attendance for update
  using (person_id = auth.uid() or get_my_role() = 'admin');

-- ============================================================
-- After running this file, promote your first Admin:
-- Table Editor > profiles > find your row > set role = 'admin'
-- ============================================================

-- ---------- Schedule PDFs ----------

-- schedules: current-cycle PDFs are visible to everyone; archived (past
-- cycle) PDFs are visible only to Admin. Only Admin can upload/remove.
create policy "schedules_select" on schedules for select
  using (
    cycle_id is null
    or cycle_id = get_current_cycle_id()
    or get_my_role() = 'admin'
  );

create policy "schedules_insert_admin" on schedules for insert
  with check (get_my_role() = 'admin');

create policy "schedules_delete_admin" on schedules for delete
  using (get_my_role() = 'admin');

-- Storage bucket that holds the actual PDF files (public so links work
-- without login, matching Announcements/Dates).
insert into storage.buckets (id, name, public)
values ('schedules', 'schedules', true)
on conflict (id) do nothing;

create policy "schedule_files_select" on storage.objects for select
  using (bucket_id = 'schedules');

create policy "schedule_files_insert_admin" on storage.objects for insert
  with check (bucket_id = 'schedules' and get_my_role() = 'admin');

create policy "schedule_files_delete_admin" on storage.objects for delete
  using (bucket_id = 'schedules' and get_my_role() = 'admin');

-- ---------- RCIA Cycles ----------

-- everyone can see which cycle is current (shown as a banner); only Admin
-- can create cycles or change which one is current.
create policy "cycles_select" on cycles for select
  using (true);

create policy "cycles_insert_admin" on cycles for insert
  with check (get_my_role() = 'admin');

create policy "cycles_update_admin" on cycles for update
  using (get_my_role() = 'admin');

create policy "cycles_delete_admin" on cycles for delete
  using (get_my_role() = 'admin');

-- ---------- Prayer Booklet PDFs ----------

-- everyone (including logged-out visitors) can read; only Admin can
-- upload/remove.
create policy "prayer_booklets_select" on prayer_booklets for select
  using (true);

create policy "prayer_booklets_insert_admin" on prayer_booklets for insert
  with check (get_my_role() = 'admin');

create policy "prayer_booklets_delete_admin" on prayer_booklets for delete
  using (get_my_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('prayer-booklets', 'prayer-booklets', true)
on conflict (id) do nothing;

create policy "prayer_booklet_files_select" on storage.objects for select
  using (bucket_id = 'prayer-booklets');

create policy "prayer_booklet_files_insert_admin" on storage.objects for insert
  with check (bucket_id = 'prayer-booklets' and get_my_role() = 'admin');

create policy "prayer_booklet_files_delete_admin" on storage.objects for delete
  using (bucket_id = 'prayer-booklets' and get_my_role() = 'admin');

-- ---------- Prayer Booklet PDFs ----------

-- everyone can read; only Admin can upload/remove.
create policy "prayer_booklets_select" on prayer_booklets for select
  using (true);

create policy "prayer_booklets_insert_admin" on prayer_booklets for insert
  with check (get_my_role() = 'admin');

create policy "prayer_booklets_delete_admin" on prayer_booklets for delete
  using (get_my_role() = 'admin');

insert into storage.buckets (id, name, public)
values ('prayer-booklets', 'prayer-booklets', true)
on conflict (id) do nothing;

create policy "prayer_booklet_files_select" on storage.objects for select
  using (bucket_id = 'prayer-booklets');

create policy "prayer_booklet_files_insert_admin" on storage.objects for insert
  with check (bucket_id = 'prayer-booklets' and get_my_role() = 'admin');

create policy "prayer_booklet_files_delete_admin" on storage.objects for delete
  using (bucket_id = 'prayer-booklets' and get_my_role() = 'admin');

-- ---------- Announcement attachments (images/documents) ----------

insert into storage.buckets (id, name, public)
values ('announcements', 'announcements', true)
on conflict (id) do nothing;

create policy "announcement_files_select" on storage.objects for select
  using (bucket_id = 'announcements');

create policy "announcement_files_insert" on storage.objects for insert
  with check (bucket_id = 'announcements' and get_my_role() in ('admin','core_team'));

create policy "announcement_files_delete" on storage.objects for delete
  using (bucket_id = 'announcements' and get_my_role() in ('admin','core_team'));
