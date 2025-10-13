-- Supabase schema for persistent shapes table
create table if not exists public.shapes (
  id uuid primary key,
  room_id text not null,
  type text not null check (type in ('rect','circle','text')),
  x float8 not null, y float8 not null,
  w float8 not null, h float8 not null,
  rotation float8 default 0,
  color text,
  text text,
  updated_at bigint not null,
  updated_by text
);
create index if not exists idx_shapes_room on public.shapes(room_id);
