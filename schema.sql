create extension if not exists pgcrypto;

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

alter table locations add column if not exists address text;
alter table locations add column if not exists notes text;
alter table locations add column if not exists created_at timestamptz not null default now();

create table if not exists photo_uploads (
  id uuid primary key default gen_random_uuid(),
  location_id uuid references locations(id) on delete set null,
  uploader_name text,
  notes text,
  photo_url text not null,
  file_name text,
  created_at timestamptz not null default now()
);

alter table photo_uploads add column if not exists location_id uuid;
alter table photo_uploads add column if not exists uploader_name text;
alter table photo_uploads add column if not exists notes text;
alter table photo_uploads add column if not exists photo_url text;
alter table photo_uploads add column if not exists file_name text;
alter table photo_uploads add column if not exists created_at timestamptz not null default now();

alter table locations disable row level security;
alter table photo_uploads disable row level security;

grant usage on schema public to anon;
grant select, insert, update, delete on locations to anon;
grant select, insert, update, delete on photo_uploads to anon;

insert into storage.buckets (id, name, public)
values ('maintenance-photos', 'maintenance-photos', true)
on conflict (id) do update set public = true;
