-- Safe version that handles existing tables/policies
-- Drop existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own shapes" ON public.shapes;
DROP POLICY IF EXISTS "Users can insert own shapes" ON public.shapes;
DROP POLICY IF EXISTS "Users can update own shapes" ON public.shapes;
DROP POLICY IF EXISTS "Users can delete own shapes" ON public.shapes;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public.shapes (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  x numeric not null,
  y numeric not null,
  w numeric not null,
  h numeric not null,
  rotation numeric default 0,
  color text default '#000000',
  text text,
  fontSize numeric default 16,
  updated_at bigint not null,
  updated_by uuid references auth.users(id) on delete cascade not null
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
ALTER TABLE public.shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create fresh policies for shapes (with proper type casting)
CREATE POLICY "Users can view own shapes" ON public.shapes
  for select using (updated_by = auth.uid()::uuid);

CREATE POLICY "Users can insert own shapes" ON public.shapes
  for insert with check (updated_by = auth.uid()::uuid);

CREATE POLICY "Users can update own shapes" ON public.shapes
  for update using (updated_by = auth.uid()::uuid);

CREATE POLICY "Users can delete own shapes" ON public.shapes
  for delete using (updated_by = auth.uid()::uuid);

-- Create fresh policies for user_profiles (with proper type casting)
CREATE POLICY "Users can view all profiles" ON public.user_profiles
  for select using (true);

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  for insert with check (auth.uid()::uuid = id);

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  for update using (auth.uid()::uuid = id);

-- Function to automatically create user profile on signup  
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, avatar_color)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'User'), 
          coalesce(new.raw_user_meta_data->>'avatar_color', '#3b82f6'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY definer;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
