-- ============================================
-- GRADING MODE: Enable cross-user canvas access
-- ============================================
-- This temporarily allows all users to see all canvases
-- for grading/demonstration purposes.
-- 
-- ⚠️ IMPORTANT: This reduces security for demo purposes only!
--    Restore proper RLS policies after grading is complete.

-- Drop existing restrictive canvas policies
DROP POLICY IF EXISTS "Users can view their own canvases" ON public.canvases;
DROP POLICY IF EXISTS "Users can create their own canvases" ON public.canvases;
DROP POLICY IF EXISTS "Users can update their own canvases" ON public.canvases;
DROP POLICY IF EXISTS "Users can delete their own canvases" ON public.canvases;

-- Create permissive policies for grading mode
CREATE POLICY "grading_mode_view_all_canvases" ON public.canvases
    FOR SELECT USING (true); -- Allow all users to view all canvases

CREATE POLICY "grading_mode_create_canvases" ON public.canvases
    FOR INSERT WITH CHECK (true); -- Allow all users to create canvases

CREATE POLICY "grading_mode_update_all_canvases" ON public.canvases
    FOR UPDATE USING (true); -- Allow all users to update all canvases

CREATE POLICY "grading_mode_delete_all_canvases" ON public.canvases
    FOR DELETE USING (true); -- Allow all users to delete all canvases

-- Also update shapes policies to allow cross-canvas access
DROP POLICY IF EXISTS "Users can view shapes in their canvases" ON public.shapes;
DROP POLICY IF EXISTS "shapes_select_all" ON public.shapes;
DROP POLICY IF EXISTS "shapes_insert_all" ON public.shapes;
DROP POLICY IF EXISTS "shapes_update_all" ON public.shapes;
DROP POLICY IF EXISTS "shapes_delete_all" ON public.shapes;

CREATE POLICY "grading_mode_view_all_shapes" ON public.shapes
    FOR SELECT USING (true);

CREATE POLICY "grading_mode_create_shapes" ON public.shapes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "grading_mode_update_shapes" ON public.shapes
    FOR UPDATE USING (true);

CREATE POLICY "grading_mode_delete_shapes" ON public.shapes
    FOR DELETE USING (true);

-- Log the change
DO $$
BEGIN
    RAISE NOTICE '🎓 GRADING MODE ENABLED: All users can now access all canvases and shapes';
    RAISE NOTICE '⚠️  Remember to restore proper RLS policies after grading!';
END $$;
