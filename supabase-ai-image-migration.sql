-- CollabCanvas AI Image Generation Migration
-- Adds database support for AI-generated images in frames
-- Safe to run multiple times

-- =======================
-- Add AI Image Generation columns to shapes table
-- =======================

-- AI Frame properties for generated images
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS ai_prompt TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS generated_image_url TEXT; 
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS is_generating BOOLEAN DEFAULT FALSE;

-- Update shape types to include 'frame' type
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_type_check;
ALTER TABLE public.shapes ADD CONSTRAINT shapes_type_check 
  CHECK (type IN (
    'rect','circle','text','image','triangle','star','heart','pentagon',
    'hexagon','octagon','oval','trapezoid','rhombus','parallelogram',
    'line','arrow','frame'
  ));

-- Add grouping support (if missing)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Add text formatting support (if missing)  
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS text_align TEXT DEFAULT 'left';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS font_style TEXT DEFAULT 'normal';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS font_weight TEXT DEFAULT 'normal';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS text_decoration TEXT DEFAULT 'none';

-- Verify the migration worked
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'shapes' 
  AND table_schema = 'public'
  AND column_name IN ('ai_prompt', 'generated_image_url', 'is_generating')
ORDER BY column_name;
