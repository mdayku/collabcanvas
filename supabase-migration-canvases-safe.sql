-- CollabCanvas Database Migration: Multi-Canvas Support (Safe Version)
-- This migration adds support for multiple saved canvases and handles existing policies

-- =======================
-- STEP 1: Update shapes table
-- =======================

-- Add new shape types to the existing constraint (including image type)
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_type_check;
ALTER TABLE public.shapes ADD CONSTRAINT shapes_type_check 
  CHECK (type IN ('rect','circle','text','image','triangle','star','heart','pentagon','hexagon','octagon','oval','trapezoid','rhombus','parallelogram'));

-- Add new columns for enhanced shape support
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS fontSize INTEGER;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS fontFamily TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS stroke TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS strokeWidth INTEGER;

-- Add image support columns
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS imageUrl TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS originalWidth INTEGER;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS originalHeight INTEGER;

-- Add canvas relationship column (nullable for now during migration)
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS canvas_id UUID;

-- =======================
-- STEP 2: Create canvases table
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
-- STEP 3: Create indexes
-- =======================

CREATE INDEX IF NOT EXISTS idx_canvases_user_id ON public.canvases(user_id);
CREATE INDEX IF NOT EXISTS idx_canvases_room_id ON public.canvases(room_id);
CREATE INDEX IF NOT EXISTS idx_shapes_canvas_id ON public.shapes(canvas_id);

-- =======================
-- STEP 4: Enable RLS on canvases
-- =======================

ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;

-- =======================
-- STEP 5: Create RLS policies for canvases (safe)
-- =======================

-- Function to safely drop and recreate policies
CREATE OR REPLACE FUNCTION safe_recreate_canvas_policies()
RETURNS void AS $$
BEGIN
    -- Drop existing canvas policies if they exist
    DROP POLICY IF EXISTS "Users can view their own canvases" ON public.canvases;
    DROP POLICY IF EXISTS "Users can create their own canvases" ON public.canvases;
    DROP POLICY IF EXISTS "Users can update their own canvases" ON public.canvases;
    DROP POLICY IF EXISTS "Users can delete their own canvases" ON public.canvases;

    -- Create new canvas policies
    CREATE POLICY "Users can view their own canvases" ON public.canvases
        FOR SELECT USING (user_id = auth.uid());

    CREATE POLICY "Users can create their own canvases" ON public.canvases  
        FOR INSERT WITH CHECK (user_id = auth.uid());

    CREATE POLICY "Users can update their own canvases" ON public.canvases
        FOR UPDATE USING (user_id = auth.uid());

    CREATE POLICY "Users can delete their own canvases" ON public.canvases
        FOR DELETE USING (user_id = auth.uid());
END;
$$ LANGUAGE plpgsql;

-- Execute canvas policies function
SELECT safe_recreate_canvas_policies();

-- =======================
-- STEP 6: Create default canvases for existing shapes
-- =======================

-- Function to create default canvases for existing rooms
CREATE OR REPLACE FUNCTION create_default_canvases()
RETURNS void AS $$
DECLARE
    room_record RECORD;
    canvas_uuid UUID;
BEGIN
    -- Loop through each unique room_id in shapes table that doesn't have a canvas
    FOR room_record IN 
        SELECT DISTINCT room_id, MIN(updated_at) as first_shape_time
        FROM public.shapes 
        WHERE canvas_id IS NULL
        GROUP BY room_id
    LOOP
        -- Check if a canvas already exists for this room_id
        SELECT id INTO canvas_uuid FROM public.canvases WHERE room_id = room_record.room_id LIMIT 1;
        
        IF canvas_uuid IS NULL THEN
            -- Create a default canvas for this room
            INSERT INTO public.canvases (
                title, 
                room_id, 
                created_at, 
                updated_at,
                user_id
            ) VALUES (
                'Legacy Canvas - ' || room_record.room_id,
                room_record.room_id,
                to_timestamp(room_record.first_shape_time / 1000),
                NOW(),
                NULL  -- Legacy canvases don't have user ownership initially
            ) RETURNING id INTO canvas_uuid;
            
            RAISE NOTICE 'Created canvas % for room %', canvas_uuid, room_record.room_id;
        END IF;
        
        -- Update all shapes in this room to reference the canvas
        UPDATE public.shapes 
        SET canvas_id = canvas_uuid 
        WHERE room_id = room_record.room_id AND canvas_id IS NULL;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration function
SELECT create_default_canvases();

-- =======================
-- STEP 7: Update shapes RLS policies (safe)
-- =======================

-- Enable RLS on shapes if not already enabled
ALTER TABLE public.shapes ENABLE ROW LEVEL SECURITY;

-- Function to safely recreate shape policies
CREATE OR REPLACE FUNCTION safe_recreate_shape_policies()
RETURNS void AS $$
BEGIN
    -- Drop all possible existing shape policies (including both naming conventions)
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.shapes;
    DROP POLICY IF EXISTS "Enable insert for all users" ON public.shapes;
    DROP POLICY IF EXISTS "Enable update for all users" ON public.shapes;
    DROP POLICY IF EXISTS "Enable delete for all users" ON public.shapes;
    DROP POLICY IF EXISTS "Enable read access for all shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Enable insert for all shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Enable update for all shapes" ON public.shapes;
    DROP POLICY IF EXISTS "Enable delete for all shapes" ON public.shapes;
    
    -- Drop the new naming convention policies too
    DROP POLICY IF EXISTS "shapes_select_policy" ON public.shapes;
    DROP POLICY IF EXISTS "shapes_insert_policy" ON public.shapes;
    DROP POLICY IF EXISTS "shapes_update_policy" ON public.shapes;
    DROP POLICY IF EXISTS "shapes_delete_policy" ON public.shapes;

    -- Create new canvas-aware policies for shapes
    -- For now, allow all users to access all shapes (for legacy support)
    CREATE POLICY "shapes_select_policy" ON public.shapes
        FOR SELECT USING (true);

    CREATE POLICY "shapes_insert_policy" ON public.shapes
        FOR INSERT WITH CHECK (true);

    CREATE POLICY "shapes_update_policy" ON public.shapes
        FOR UPDATE USING (true);

    CREATE POLICY "shapes_delete_policy" ON public.shapes
        FOR DELETE USING (true);
END;
$$ LANGUAGE plpgsql;

-- Execute shapes policies function
SELECT safe_recreate_shape_policies();

-- =======================
-- STEP 8: Add foreign key constraint
-- =======================

-- Add foreign key constraint to link shapes to canvases (if not exists)
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
-- STEP 9: Create helper functions
-- =======================

-- Function to create a new canvas for a user
CREATE OR REPLACE FUNCTION create_new_canvas(canvas_title TEXT DEFAULT 'Untitled Canvas')
RETURNS UUID AS $$
DECLARE
    new_canvas_id UUID;
    new_room_id TEXT;
BEGIN
    -- Generate a unique room ID
    new_room_id := 'room_' || gen_random_uuid()::text;
    
    -- Insert the new canvas
    INSERT INTO public.canvases (title, user_id, room_id)
    VALUES (canvas_title, auth.uid(), new_room_id)
    RETURNING id INTO new_canvas_id;
    
    RETURN new_canvas_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to duplicate a canvas
CREATE OR REPLACE FUNCTION duplicate_canvas(source_canvas_id UUID, new_title TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    new_canvas_id UUID;
    new_room_id TEXT;
    shape_record RECORD;
    source_canvas RECORD;
BEGIN
    -- Check if user owns the source canvas
    SELECT * INTO source_canvas FROM public.canvases 
    WHERE id = source_canvas_id AND user_id = auth.uid();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Canvas not found or access denied';
    END IF;
    
    -- Generate a unique room ID
    new_room_id := 'room_' || gen_random_uuid()::text;
    
    -- Create the new canvas
    INSERT INTO public.canvases (title, user_id, room_id, is_public, data)
    VALUES (
        COALESCE(new_title, 'Copy of ' || source_canvas.title), 
        auth.uid(), 
        new_room_id,
        false, -- Copies are private by default
        source_canvas.data
    )
    RETURNING id INTO new_canvas_id;
    
    -- Copy all shapes from source canvas
    FOR shape_record IN 
        SELECT * FROM public.shapes WHERE canvas_id = source_canvas_id
    LOOP
        INSERT INTO public.shapes (
            id, canvas_id, room_id, type, x, y, w, h, rotation, 
            color, text, fontSize, fontFamily, stroke, strokeWidth,
            imageUrl, originalWidth, originalHeight,
            updated_at, updated_by
        ) VALUES (
            gen_random_uuid(), -- New ID for the copied shape
            new_canvas_id,
            new_room_id,
            shape_record.type,
            shape_record.x,
            shape_record.y,
            shape_record.w,
            shape_record.h,
            shape_record.rotation,
            shape_record.color,
            shape_record.text,
            shape_record.fontSize,
            shape_record.fontFamily,
            shape_record.stroke,
            shape_record.strokeWidth,
            shape_record.imageUrl,
            shape_record.originalWidth,
            shape_record.originalHeight,
            extract(epoch from now()) * 1000, -- Current timestamp in milliseconds
            COALESCE(auth.uid()::text, 'system')
        );
    END LOOP;
    
    RETURN new_canvas_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- CLEANUP
-- =======================

-- Clean up helper functions
DROP FUNCTION IF EXISTS safe_recreate_canvas_policies();
DROP FUNCTION IF EXISTS safe_recreate_shape_policies();
DROP FUNCTION IF EXISTS create_default_canvases();

-- =======================
-- FINAL COMMENTS
-- =======================

COMMENT ON TABLE public.canvases IS 'Stores canvas projects for multi-canvas support';
COMMENT ON FUNCTION create_new_canvas IS 'Creates a new canvas for the authenticated user';
COMMENT ON FUNCTION duplicate_canvas IS 'Duplicates an existing canvas with all its shapes';

-- Migration completed successfully
SELECT 'Multi-canvas migration completed successfully!' AS result;
