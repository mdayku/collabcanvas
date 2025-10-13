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

-- User profiles table for authenticated users
create table if not exists public.user_profiles (
  id uuid references auth.users(id) primary key,
  display_name text not null,
  avatar_color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.user_profiles enable row level security;

-- RLS Policies for user_profiles
create policy "Users can view all profiles" on public.user_profiles
  for select using (true);

create policy "Users can insert their own profile" on public.user_profiles
  for insert with check (auth.uid() = id);

create policy "Users can update their own profile" on public.user_profiles
  for update using (auth.uid() = id);

-- Function to automatically create user profile on signup  
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, display_name, avatar_color)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'User'), 
          coalesce(new.raw_user_meta_data->>'avatar_color', '#3b82f6'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
