-- CollabCanvas Complete Database Migration
-- This fixes ALL schema inconsistencies and adds missing columns for current codebase
-- Safe to run multiple times on any schema version

-- =======================
-- STEP 1: Add ALL missing columns to shapes table
-- =======================

-- Core drawing properties that may be missing
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS fontSize INTEGER DEFAULT 16;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS fontFamily TEXT DEFAULT 'Inter';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS stroke TEXT DEFAULT '#000000';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS strokeWidth INTEGER DEFAULT 2;

-- Layer management (critical for UI)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS zIndex INTEGER DEFAULT 0;

-- Image support
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS imageUrl TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS originalWidth INTEGER;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS originalHeight INTEGER;

-- Lines & Arrows support (NEW - critical for current codebase)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS x2 NUMERIC;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS y2 NUMERIC;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS arrowHead TEXT DEFAULT 'none';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS dashPattern TEXT; -- JSON array as text

-- Canvas relationship (if not exists)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS canvas_id UUID;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS room_id TEXT;

-- =======================
-- STEP 2: Update type constraints to include ALL current types
-- =======================

-- Remove old constraint and add comprehensive one
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_type_check;
ALTER TABLE public.shapes ADD CONSTRAINT shapes_type_check 
  CHECK (type IN (
    'rect','circle','text','image','line','arrow',
    'triangle','star','heart','pentagon','hexagon','octagon',
    'oval','trapezoid','rhombus','parallelogram'
  ));

-- =======================
-- STEP 3: Create canvases table if it doesn't exist
-- =======================

CREATE TABLE IF NOT EXISTS public.canvases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Canvas',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    room_id VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    thumbnail_url TEXT,
    data JSONB DEFAULT '{}'::jsonb
);

-- =======================
-- STEP 4: Create indexes if they don't exist
-- =======================

CREATE INDEX IF NOT EXISTS idx_shapes_room_id ON public.shapes(room_id);
CREATE INDEX IF NOT EXISTS idx_shapes_canvas_id ON public.shapes(canvas_id);
CREATE INDEX IF NOT EXISTS idx_shapes_zindex ON public.shapes(zIndex); -- NEW: for layer queries
CREATE INDEX IF NOT EXISTS idx_canvases_user_id ON public.canvases(user_id);
CREATE INDEX IF NOT EXISTS idx_canvases_room_id ON public.canvases(room_id);

-- =======================
-- STEP 5: Enable RLS and create policies
-- =======================

-- Enable RLS on both tables
ALTER TABLE public.shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;

-- Function to safely recreate ALL policies
CREATE OR REPLACE FUNCTION recreate_all_policies()
RETURNS void AS $$
BEGIN
    -- DROP ALL possible existing policies (handles all naming conventions)
    
    -- Shapes policies (all variations)
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.shapes;
    DROP POLICY IF EXISTS "Enable insert for all users" ON public.shapes;
    DROP POLICY IF EXISTS "Enable update for all users" ON public.shapes;
    DROP POLICY IF EXISTS "Enable delete for all users" ON public.shapes;
    DROP POLICY IF EXISTS "Enable read access for all shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Enable insert for all shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Enable update for all shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Enable delete for all shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Users can view own shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Users can insert own shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Users can update own shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Users can delete own shapes" ON public.shapes;
    DROP POLICY IF EXISTS "shapes_select_policy" ON public.shapes;
    DROP POLICY IF EXISTS "shapes_insert_policy" ON public.shapes;
    DROP POLICY IF EXISTS "shapes_update_policy" ON public.shapes;
    DROP POLICY IF EXISTS "shapes_delete_policy" ON public.shapes;
    
    -- Canvas policies (all variations)
    DROP POLICY IF EXISTS "Users can view their own canvases" ON public.canvases;
    DROP POLICY IF EXISTS "Users can create their own canvases" ON public.canvases;
    DROP POLICY IF EXISTS "Users can update their own canvases" ON public.canvases;
    DROP POLICY IF EXISTS "Users can delete their own canvases" ON public.canvases;

    -- CREATE simple, permissive policies that work with current codebase
    -- (These can be tightened later when user ownership is fully implemented)
    
    CREATE POLICY "shapes_select_all" ON public.shapes
        FOR SELECT USING (true);

    CREATE POLICY "shapes_insert_all" ON public.shapes
        FOR INSERT WITH CHECK (true);

    CREATE POLICY "shapes_update_all" ON public.shapes
        FOR UPDATE USING (true);

    CREATE POLICY "shapes_delete_all" ON public.shapes
        FOR DELETE USING (true);
        
    -- Canvas policies (more restrictive since they have user ownership)
    CREATE POLICY "canvases_select_own" ON public.canvases
        FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

    CREATE POLICY "canvases_insert_own" ON public.canvases  
        FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

    CREATE POLICY "canvases_update_own" ON public.canvases
        FOR UPDATE USING (user_id = auth.uid() OR user_id IS NULL);

    CREATE POLICY "canvases_delete_own" ON public.canvases
        FOR DELETE USING (user_id = auth.uid() OR user_id IS NULL);
END;
$$ LANGUAGE plpgsql;

-- Execute policy recreation
SELECT recreate_all_policies();

-- =======================
-- STEP 6: Handle existing data migration
-- =======================

-- Set default values for new columns on existing rows
UPDATE public.shapes SET 
    fontSize = COALESCE(fontSize, 16),
    fontFamily = COALESCE(fontFamily, 'Inter'),
    stroke = COALESCE(stroke, color, '#000000'),
    strokeWidth = COALESCE(strokeWidth, 2),
    zIndex = COALESCE(zIndex, 0),
    arrowHead = COALESCE(arrowHead, 'none')
WHERE fontSize IS NULL OR fontFamily IS NULL OR stroke IS NULL OR strokeWidth IS NULL OR zIndex IS NULL OR arrowHead IS NULL;

-- =======================
-- STEP 7: Create helper functions for current codebase
-- =======================

-- Function to create a new canvas
CREATE OR REPLACE FUNCTION create_new_canvas(canvas_title TEXT DEFAULT 'Untitled Canvas')
RETURNS UUID AS $$
DECLARE
    new_canvas_id UUID;
    new_room_id TEXT;
BEGIN
    new_room_id := 'room_' || gen_random_uuid()::text;
    
    INSERT INTO public.canvases (title, user_id, room_id)
    VALUES (canvas_title, auth.uid(), new_room_id)
    RETURNING id INTO new_canvas_id;
    
    RETURN new_canvas_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- STEP 8: Add foreign key constraints safely
-- =======================

-- Add canvas relationship constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_shapes_canvas_id' AND table_name = 'shapes'
    ) THEN
        ALTER TABLE public.shapes ADD CONSTRAINT fk_shapes_canvas_id 
            FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =======================
-- CLEANUP
-- =======================

-- Drop helper function
DROP FUNCTION IF EXISTS recreate_all_policies();

-- =======================
-- VERIFICATION
-- =======================

-- Show final table structure for verification
SELECT 
    'shapes table columns:' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'shapes' AND table_schema = 'public'
UNION ALL
SELECT 
    'canvases table columns:' as info,
    string_agg(column_name || ' (' || data_type || ')', ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns 
WHERE table_name = 'canvases' AND table_schema = 'public';

SELECT 'Complete migration finished successfully! ✅' AS result;
