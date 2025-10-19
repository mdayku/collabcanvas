-- CollabCanvas Components System Migration
-- Adds support for saving and reusing component templates
-- Safe to run multiple times

-- =======================
-- STEP 1: Create components table
-- =======================

CREATE TABLE IF NOT EXISTS public.components (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    canvas_id UUID REFERENCES public.canvases(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    shapes JSONB NOT NULL, -- Array of shape objects to be instantiated
    thumbnail_url TEXT, -- Preview image for the component
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =======================
-- STEP 2: Create indexes for performance
-- =======================

CREATE INDEX IF NOT EXISTS idx_components_user_id ON public.components(user_id);
CREATE INDEX IF NOT EXISTS idx_components_canvas_id ON public.components(canvas_id);
CREATE INDEX IF NOT EXISTS idx_components_name ON public.components(name);

-- =======================
-- STEP 3: Enable Row Level Security
-- =======================

ALTER TABLE public.components ENABLE ROW LEVEL SECURITY;

-- =======================
-- STEP 4: Create RLS Policies
-- =======================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own components" ON public.components;
DROP POLICY IF EXISTS "Users can create their own components" ON public.components;
DROP POLICY IF EXISTS "Users can update their own components" ON public.components;
DROP POLICY IF EXISTS "Users can delete their own components" ON public.components;

-- Create component policies (users can only access their own components)
CREATE POLICY "Users can view their own components" ON public.components
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own components" ON public.components  
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own components" ON public.components
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own components" ON public.components
    FOR DELETE USING (user_id = auth.uid());

-- =======================
-- STEP 5: Add helpful comments
-- =======================

COMMENT ON TABLE public.components IS 'Stores reusable component templates (groups of shapes)';
COMMENT ON COLUMN public.components.shapes IS 'JSONB array of shape objects without IDs (template data)';
COMMENT ON COLUMN public.components.canvas_id IS 'Optional: Canvas where component was originally created';
COMMENT ON COLUMN public.components.thumbnail_url IS 'Optional: Preview image URL for component library UI';

-- =======================
-- VERIFICATION
-- =======================

-- Show table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'components' 
  AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'Components table created successfully! ✅' AS result;

