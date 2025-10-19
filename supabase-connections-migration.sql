-- CollabCanvas Lines/Arrows Connection System Migration
-- Adds support for attaching lines/arrows to shapes with anchor points
-- Safe to run multiple times

-- =======================
-- Add connection-specific columns to shapes table
-- =======================

-- Shape attachment properties
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS start_shape_id UUID;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS end_shape_id UUID;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS start_anchor TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS end_anchor TEXT;

-- Path rendering properties
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS path_type TEXT DEFAULT 'straight';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS control_points JSONB;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS curvature NUMERIC DEFAULT 0.5;

-- =======================
-- Add foreign key constraints
-- =======================

-- Add constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_start_shape' AND table_name = 'shapes'
    ) THEN
        ALTER TABLE public.shapes ADD CONSTRAINT fk_start_shape 
            FOREIGN KEY (start_shape_id) REFERENCES public.shapes(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_end_shape' AND table_name = 'shapes'
    ) THEN
        ALTER TABLE public.shapes ADD CONSTRAINT fk_end_shape 
            FOREIGN KEY (end_shape_id) REFERENCES public.shapes(id) ON DELETE SET NULL;
    END IF;
END $$;

-- =======================
-- Create indexes for performance
-- =======================

CREATE INDEX IF NOT EXISTS idx_shapes_start_shape_id ON shapes(start_shape_id);
CREATE INDEX IF NOT EXISTS idx_shapes_end_shape_id ON shapes(end_shape_id);

-- =======================
-- Migrate existing line/arrow shapes
-- =======================

-- Set default pathType for existing lines/arrows (they're currently straight)
UPDATE public.shapes 
SET path_type = 'straight'
WHERE type IN ('line', 'arrow') AND path_type IS NULL;

-- =======================
-- Add check constraints
-- =======================

-- Ensure anchor values are valid
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS check_start_anchor;
ALTER TABLE public.shapes ADD CONSTRAINT check_start_anchor 
    CHECK (start_anchor IS NULL OR start_anchor IN ('top', 'right', 'bottom', 'left', 'center'));

ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS check_end_anchor;
ALTER TABLE public.shapes ADD CONSTRAINT check_end_anchor 
    CHECK (end_anchor IS NULL OR end_anchor IN ('top', 'right', 'bottom', 'left', 'center'));

ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS check_path_type;
ALTER TABLE public.shapes ADD CONSTRAINT check_path_type 
    CHECK (path_type IS NULL OR path_type IN ('straight', 'curved', 'orthogonal'));

-- =======================
-- VERIFICATION
-- =======================

-- Show added columns
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'shapes' 
  AND table_schema = 'public'
  AND column_name IN (
    'start_shape_id', 'end_shape_id', 'start_anchor', 'end_anchor',
    'path_type', 'control_points', 'curvature'
  )
ORDER BY column_name;

SELECT 'Connection system migration completed successfully! ✅' AS result;

