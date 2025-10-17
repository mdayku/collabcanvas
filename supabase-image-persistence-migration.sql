-- CollabCanvas Image Persistence Migration
-- Adds database support for regular images and AI-generated images
-- Safe to run multiple times

-- =======================
-- Add Image columns to shapes table
-- =======================

-- Regular image properties (for uploaded images and emojis)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS original_width NUMERIC;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS original_height NUMERIC;

-- AI Frame properties (if not already added)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS ai_prompt TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS generated_image_url TEXT; 
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS is_generating BOOLEAN DEFAULT FALSE;

-- Text formatting properties (if not already added)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS text_align TEXT DEFAULT 'left';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS font_style TEXT DEFAULT 'normal';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS font_weight TEXT DEFAULT 'normal';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS text_decoration TEXT DEFAULT 'none';

-- Line/arrow properties (if not already added)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS x2 NUMERIC;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS y2 NUMERIC;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS arrow_head TEXT;

-- Group properties (if not already added)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Layer ordering (if not already added)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS z_index INTEGER;

-- Verify the migration worked
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'shapes' 
  AND table_schema = 'public'
  AND column_name IN (
    'image_url', 'original_width', 'original_height',
    'ai_prompt', 'generated_image_url', 'is_generating',
    'text_align', 'font_style', 'font_weight', 'text_decoration',
    'x2', 'y2', 'arrow_head', 'group_id', 'z_index'
  )
ORDER BY column_name;

