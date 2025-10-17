-- Migration to add Mermaid diagram shapes and icons support
-- This migration adds new shape types: roundedRect, stadium, note

-- Step 1: Drop the existing type constraint
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_type_check;

-- Step 2: Add the new type constraint with Mermaid shapes included
ALTER TABLE public.shapes ADD CONSTRAINT shapes_type_check 
  CHECK (type IN (
    'rect', 'circle', 'text', 'image', 'triangle', 'star', 'heart', 
    'pentagon', 'hexagon', 'octagon', 'trapezoid', 'rhombus', 'parallelogram', 
    'oval', 'line', 'arrow', 'frame', 'cylinder', 'document', 'path',
    'roundedRect', 'stadium', 'note'
  ));

-- Note: Icons are stored as 'text' type with specific symbol characters
-- No additional columns needed - all properties handled by existing schema

-- You can run this migration in your Supabase SQL Editor
-- Safe to run multiple times due to IF EXISTS checks

