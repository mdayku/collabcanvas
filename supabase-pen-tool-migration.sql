-- Migration to add pen tool (path type) support
-- This migration adds the "path" type to the shapes table and required columns

-- Step 1: Drop the existing type constraint
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_type_check;

-- Step 2: Add the new type constraint with "path" included
ALTER TABLE public.shapes ADD CONSTRAINT shapes_type_check 
  CHECK (type IN (
    'rect', 'circle', 'text', 'image', 'triangle', 'star', 'heart', 
    'pentagon', 'hexagon', 'octagon', 'trapezoid', 'rhombus', 'parallelogram', 
    'oval', 'line', 'arrow', 'frame', 'cylinder', 'document', 'path'
  ));

-- Step 3: Add new columns for path shapes (if they don't exist)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS points jsonb;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS closed boolean DEFAULT false;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS smooth boolean DEFAULT true;

-- Note: You can run this migration in your Supabase SQL Editor
-- It's safe to run multiple times due to IF NOT EXISTS and IF EXISTS checks

