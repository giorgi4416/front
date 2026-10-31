-- Notes app schema. Run once in the Supabase SQL editor (or `supabase db push` as a migration).
-- Requires PostgreSQL 15+ (column-list ON DELETE SET NULL), which all current Supabase projects use.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Folders
-- ---------------------------------------------------------------------------
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);
create unique index if not exists folders_user_name_idx on public.folders (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------
create table if not exists public.tags (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 40),
  created_at  timestamptz not null default now(),
  unique (id, user_id)
);
create unique index if not exists tags_user_name_idx on public.tags (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- Notes
-- content holds the Tiptap/ProseMirror JSON document; content_text is a plain-text
-- projection kept for previews and search.
-- ---------------------------------------------------------------------------
create table if not exists public.notes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title           text not null default '' check (char_length(title) <= 300),
  content         jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text    text not null default '',
  folder_id       uuid,
  is_pinned       boolean not null default false,
  is_favorite     boolean not null default false,
  is_archived     boolean not null default false,
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_opened_at  timestamptz,
  unique (id, user_id),
  -- Composite FK: a note can only point at a folder owned by the same user.
  foreign key (folder_id, user_id) references public.folders (id, user_id) on delete set null (folder_id)
);
create index if not exists notes_user_updated_idx on public.notes (user_id, updated_at desc);
create index if not exists notes_user_opened_idx  on public.notes (user_id, last_opened_at desc) where last_opened_at is not null;
create index if not exists notes_folder_idx       on public.notes (folder_id) where folder_id is not null;
create index if not exists notes_user_deleted_idx on public.notes (user_id, deleted_at) where deleted_at is not null;

-- ---------------------------------------------------------------------------
-- Note ↔ tag relationship
-- ---------------------------------------------------------------------------
create table if not exists public.note_tags (
  note_id   uuid not null,
  tag_id    uuid not null,
  user_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (note_id, tag_id),
  foreign key (note_id, user_id) references public.notes (id, user_id) on delete cascade,
  foreign key (tag_id, user_id)  references public.tags (id, user_id)  on delete cascade
);
create index if not exists note_tags_tag_idx  on public.note_tags (tag_id);
create index if not exists note_tags_user_idx on public.note_tags (user_id);

-- ---------------------------------------------------------------------------
-- updated_at only moves for real edits, so pinning / opening a note doesn't
-- change its "last modified" time. user_id and created_at are immutable.
-- ---------------------------------------------------------------------------
create or replace function public.notes_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  if new.title is distinct from old.title
     or new.content is distinct from old.content
     or new.folder_id is distinct from old.folder_id then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists notes_before_update on public.notes;
create trigger notes_before_update
  before update on public.notes
  for each row execute function public.notes_before_update();

-- ---------------------------------------------------------------------------
-- Row Level Security: every row is visible/writable only by its owner.
-- ---------------------------------------------------------------------------
alter table public.folders   enable row level security;
alter table public.tags      enable row level security;
alter table public.notes     enable row level security;
alter table public.note_tags enable row level security;

do $$
declare t text;
begin
  foreach t in array array['folders', 'tags', 'notes', 'note_tags'] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$I', t);

    execute format('create policy "%1$s_select_own" on public.%1$I for select to authenticated
                    using ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I for insert to authenticated
                    with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_update_own" on public.%1$I for update to authenticated
                    using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "%1$s_delete_own" on public.%1$I for delete to authenticated
                    using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Anonymous visitors get nothing; signed-in users get CRUD (still filtered by RLS).
revoke all on public.folders, public.tags, public.notes, public.note_tags from anon;
grant select, insert, update, delete on public.folders, public.tags, public.notes, public.note_tags to authenticated;

-- ===========================================================================
-- Accounts: profiles, avatars, self-service deletion
-- ===========================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '' check (char_length(display_name) <= 60),
  avatar_url    text check (avatar_url is null or char_length(avatar_url) <= 1000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

revoke all on public.profiles from anon;
grant select, insert, update on public.profiles to authenticated;

create or replace function public.profiles_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.profiles_touch();

-- Create a profile for every new account (display name comes from sign-up metadata).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Existing users get a profile too, so nobody loses access to their data.
insert into public.profiles (id, display_name)
select id, left(coalesce(raw_user_meta_data ->> 'display_name', ''), 60) from auth.users
on conflict (id) do nothing;

-- Avatars: public-read bucket; users may only write inside a folder named after their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;
drop policy if exists "avatars_select_own" on storage.objects;
create policy "avatars_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Lets a signed-in user delete their own account. Notes, folders, tags and the
-- profile are removed by the ON DELETE CASCADE foreign keys. It can only ever
-- delete the caller (auth.uid()), never another user.
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
