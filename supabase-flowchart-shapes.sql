-- Migration: Add flowchart shape types (cylinder, document)
-- Date: October 2025
-- Purpose: Update shapes table constraint to include new flowchart shape types

-- Drop the existing constraint
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_type_check;

-- Add the updated constraint with all shape types including new ones
ALTER TABLE public.shapes 
ADD CONSTRAINT shapes_type_check 
CHECK (type IN (
  'rect', 
  'circle', 
  'text', 
  'image', 
  'triangle', 
  'star', 
  'heart', 
  'pentagon', 
  'hexagon', 
  'octagon', 
  'trapezoid', 
  'rhombus', 
  'parallelogram', 
  'oval', 
  'line', 
  'arrow', 
  'frame',
  'cylinder',
  'document'
));

-- Verify the constraint was updated
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'shapes_type_check';

