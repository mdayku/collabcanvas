# CollabCanvas Database Schema

## Canvas Projects Table

```sql
-- New table for canvas projects
CREATE TABLE public.canvases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Canvas',
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    room_id VARCHAR(50) UNIQUE NOT NULL, -- For multiplayer realtime
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    thumbnail_url TEXT, -- Optional: generated preview
    data JSONB -- Canvas metadata (zoom, pan position, etc.)
);

-- Updated shapes table with canvas reference
ALTER TABLE public.shapes ADD COLUMN canvas_id UUID REFERENCES public.canvases(id) ON DELETE CASCADE;

-- Indexes for performance
CREATE INDEX idx_canvases_user_id ON public.canvases(user_id);
CREATE INDEX idx_canvases_room_id ON public.canvases(room_id);
CREATE INDEX idx_shapes_canvas_id ON public.shapes(canvas_id);

-- Row Level Security
ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;

-- Users can only see their own canvases (for now)
CREATE POLICY "Users can view their own canvases" ON public.canvases
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create their own canvases" ON public.canvases  
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own canvases" ON public.canvases
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own canvases" ON public.canvases
    FOR DELETE USING (user_id = auth.uid());

-- Update shapes policy to include canvas ownership
DROP POLICY IF EXISTS "Enable read access for all users" ON public.shapes;
CREATE POLICY "Users can view shapes in their canvases" ON public.shapes
    FOR SELECT USING (
        canvas_id IN (
            SELECT id FROM public.canvases WHERE user_id = auth.uid()
        )
    );
```

## Migration Strategy

1. **Phase 1**: Add `canvas_id` column to existing shapes table
2. **Phase 2**: Create default canvas for existing shapes
3. **Phase 3**: Add canvases table with proper relationships  
4. **Phase 4**: Update frontend to use canvas-based routing

## Canvas Operations

### Create New Canvas
```sql
INSERT INTO public.canvases (title, user_id, room_id) 
VALUES ('My New Canvas', auth.uid(), 'room_' || gen_random_uuid());
```

### Load Canvas List
```sql
SELECT id, title, updated_at, room_id 
FROM public.canvases 
WHERE user_id = auth.uid() 
ORDER BY updated_at DESC;
```

### Load Canvas Shapes
```sql
SELECT * FROM public.shapes 
WHERE canvas_id = $1 
ORDER BY updated_at;
```

### Save Canvas Metadata
```sql
UPDATE public.canvases 
SET title = $1, updated_at = NOW(), data = $2
WHERE id = $3 AND user_id = auth.uid();
```
