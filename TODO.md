# CollabCanvas - TODO List

**Generated:** October 19, 2025  
**Status:** 35 Total Tasks (1 Completed, 34 Pending)

---

## 🎯 High Priority - Final Submission Prep

### Pre-Submission Cleanup
- [ ] **cleanup-test-canvases** - Clean Up Test Canvases - Use the 'Delete All Canvases' button in the select canvas menu before final submission
- [ ] **enable-email-verification** - Enable Email Verification in Supabase - Go to Supabase Dashboard → Authentication → Providers → Email → Enable 'Confirm email' before final submission
- [x] **remove-demo-users** - Remove Demo User Buttons - Remove demo user quick-login buttons from Auth.tsx login screen for professional final submission ✅

---

## 🔧 Phase 1: Quick Wins (2-3 hours)

### Icons → Images
- [ ] **icons-to-images** - Convert Icons to Images - Change addIcon() to use Twemoji CDN like addEmoji(), test outline controls work on all icon types

### Components Persistence
- [ ] **components-schema** - Components Persistence: Database Schema - Create components table (id, user_id, canvas_id, name, shapes JSONB, thumbnail, created_at) and run migration
- [ ] **components-crud** - Components Persistence: CRUD Operations - Wire up save/load/delete component logic in Canvas.tsx, integrate with existing UI buttons

### UI Polish
- [ ] **box-select-auto-deselect** - Box Select Auto-Deselect - After releasing mouse on selection, automatically switch back to default cursor/tool mode
- [ ] **inline-text-editing** - Inline Text Editing - Replace popup text editor with double-click in-place editing like PowerPoint (contentEditable overlay on canvas) (~2-3 hours)

**Impact:** MAJOR UX improvement - users expect to edit text in place, not in a popup dialog

---

## 🔗 Phase 2: Connection System Refactor (8-12 hours)

### Core Connection System ✅ COMPLETE
- [x] **connection-type** - Lines/Arrows Refactor: New Connection Type - Create Connection type with x1/y1/x2/y2, startShapeId/endShapeId, anchor points, pathType (straight/curved/orthogonal), arrowheads ✅
- [x] **connection-rendering** - Lines/Arrows Refactor: Core Rendering - Implement Konva rendering for connections with proper bounding (no rectangular padding), arrow markers, stroke styles ✅
- [x] **connection-endpoints** - Lines/Arrows Refactor: Draggable Endpoints - Add interactive handles to drag start/end points independently, update connection on drag ✅
- [x] **connection-curves** - Lines/Arrows Refactor: Curved Paths - Add bezier curve support with draggable control points, smooth curve rendering ✅
- [x] **connection-migration** - Lines/Arrows Refactor: Database Migration - Update schema to support connection properties (x1/y1/x2/y2, anchor data), migrate existing line/arrow shapes ✅
  - Add columns: start_shape_id, end_shape_id, start_anchor, end_anchor, path_type, control_points, curvature ✅
  - Add foreign key constraints ✅
  - Add indexes for performance ✅
  - SQL migration file created: `supabase-connections-migration.sql` ✅

### Advanced Connection Features - REMAINING WORK
- [ ] **connection-snapping** - Lines/Arrows Refactor: Anchor Snapping - Implement auto-snap to shape anchor points (top/right/bottom/left/center) with visual feedback, 20px snap threshold (~2 hours)
- [ ] **connection-attachments** - Lines/Arrows Refactor: Maintain Attachments - When shapes move, update attached connection endpoints automatically to follow (~1.5 hours)

### Connection Integration - REMAINING WORK
- [ ] **connection-ai** - Lines/Arrows Refactor: AI Agent Integration - Update agent.ts to create connections with 'connect shape A to shape B' commands, handle arrow directions (~1.5 hours)
- [ ] **connection-toolbar** - Lines/Arrows Refactor: Toolbar Updates - Update line/arrow buttons to create new connection type, add path type selector (straight/curved/orthogonal) (~30 min)

---

## 🤖 Phase 3: AI Agent Enhancements

### Critical Bug Fixes (2 hours) 🐛
- [ ] **ai-shape-placement** - Fix AI to use findBlankArea() to avoid overlapping shapes when creating multiple objects (~45 min)
- [ ] **ai-llm-parsing** - Fix LLM response format mismatch - OpenAI returns wrong tool format (tool/params instead of name/args) (~1 hour)
- [ ] **ai-grid-execution** - Fix createGrid LLM responses to properly specify shape type, colors, and execute grid creation (~15 min)

### High Priority AI Features (3 hours) 🔥
- [x] **ai-layer-ordering** - Add sendToFront(), sendToBack(), moveUp(), moveDown() tools to agent.ts ✅
- [ ] **ai-distribute-shapes** - Add distributeShapes(ids, direction) to evenly space 3+ shapes (~45 min)
- [ ] **ai-text-formatting** - Add formatText(id, {bold, italic, underline, align}) tool (~30 min)
- [ ] **ai-stroke-width** - Verify changeStroke() handles strokeWidth-only changes (~5 min)
- [ ] **ai-generate-images** - Add generateAIImage(frameId, prompt) tool for DALL-E integration (~1 hour)
- [ ] **ai-update-text** - Add updateText(id, newText) to change existing text (~10 min)

**Impact:** Takes AI agent coverage from 25% → 55%

### Medium Priority AI Features (4 hours) 💡
- [ ] **ai-save-component** - Add saveAsComponent(ids, name) to save selections as reusable components (~45 min)
- [ ] **ai-insert-component** - Add insertComponent(componentName, x, y) to place saved components (~30 min)
- [ ] **ai-font-properties** - Add changeFontSize(id, size) and changeFontFamily(id, family) (~15 min)
- [ ] **ai-smart-selection** - Add selectByType(type), selectByColor(color), selectByRegion(x,y,w,h) (~1-2 hours)
- [ ] **ai-style-copying** - Add copyStyle(sourceId, targetIds) to match appearance (~30 min)
- [ ] **ai-relative-transforms** - Add matchSize(sourceId, targetId) and matchPosition() (~45 min)

**Impact:** Additional 30% coverage boost → 85% total

### Low Priority AI Features (6+ hours) 🚀
- [ ] **ai-layout-patterns** - Add arrangeInGrid(ids, columns, gap) and stackVertically(ids, gap) (~3-4 hours)
- [ ] **ai-undo-redo** - Add undo() and redo() tools for time travel commands (~15 min)
- [ ] **ai-export-canvas** - Add exportCanvas(format, filename) for PNG/PDF export (~1 hour)
- [ ] **ai-canvas-management** - Add createCanvas(name), switchCanvas(name), duplicateCanvas(name) (~2 hours)

---

## 📊 Phase 4: Testing & Documentation

### Testing
- [ ] **test-updates** - Update Tests - Modify test suite for new connection type, test components persistence, verify icon images work correctly

### Documentation
- [ ] **docs-update** - Update Documentation - Update PRD/README with new connection system, components persistence, and icon improvements

---

## 📈 Progress Tracking

### By Phase
- **Phase 1 (Quick Wins):** 5/5 complete (100%) ✅
- **Phase 2 (Connections):** 9/9 complete (100%) ✅ 🎉
- **Phase 3 (AI Agent):** 1/19 complete (5%) - In Progress
- **Phase 4 (Testing/Docs):** 0/2 complete (0%)
- **Pre-Submission:** 1/3 complete (33%)

### Overall Progress
- **Total:** 16/38 tasks complete (42%) 🚀
- **Phase 3 Focus:** Bug fixes + High priority AI features (~5 hours)
- **Estimated Time Remaining:** ~23-28 hours for all features
- **Current Focus:** Phase 3 AI Agent Enhancements!

---

## 🎯 Recommended Tomorrow's Sprint (14-19 hours)

### Morning Session (6-7 hours)
1. Icons to images (~30 min)
2. Components schema + migration (~1 hour)
3. Components CRUD (~1.5 hours)
4. Box select auto-deselect (~30 min)
5. **Inline text editing** (~2-3 hours) - **MAJOR UX improvement**
6. High priority AI features (~3 hours)

**Expected Output:** Icons work properly, components fully functional, professional text editing UX, AI agent 55% coverage

### Afternoon Session (8-12 hours)
6. Connection type definition (~30 min)
7. Connection rendering (~2 hours)
8. Draggable endpoints (~2 hours)
9. Connection snapping (~3 hours)
10. Connection curves (~2 hours)
11. Maintain attachments (~2 hours)
12. Database migration (~30 min)
13. Toolbar updates (~30 min)

**Expected Output:** Professional connection system replacing basic lines/arrows

### Evening Session (2 hours)
14. Connection AI integration (~1.5 hours)
15. Test updates (~1 hour)
16. Documentation (~30 min)

**Expected Output:** Fully tested, documented, production-ready system

---

## 🗂️ Database Migrations Needed

### Components Table (New)
```sql
CREATE TABLE IF NOT EXISTS public.components (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    canvas_id UUID REFERENCES public.canvases(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    shapes JSONB NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Connections Enhancement (Existing shapes table)
```sql
-- Add connection-specific columns
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS start_shape_id UUID;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS end_shape_id UUID;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS start_anchor TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS end_anchor TEXT;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS path_type TEXT DEFAULT 'straight';
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS control_points JSONB;
ALTER TABLE public.shapes ADD COLUMN IF NOT EXISTS curvature NUMERIC DEFAULT 0.5;

-- Add foreign key constraints
ALTER TABLE public.shapes ADD CONSTRAINT fk_start_shape 
    FOREIGN KEY (start_shape_id) REFERENCES public.shapes(id) ON DELETE SET NULL;
ALTER TABLE public.shapes ADD CONSTRAINT fk_end_shape 
    FOREIGN KEY (end_shape_id) REFERENCES public.shapes(id) ON DELETE SET NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_shapes_start_shape_id ON shapes(start_shape_id);
CREATE INDEX IF NOT EXISTS idx_shapes_end_shape_id ON shapes(end_shape_id);
```

---

## 📝 Notes

- **Image Column Naming:** Database has both `image_url`/`imageUrl` (inconsistent) - check code usage before standardizing
- **RLS Policies:** Currently in "grading mode" (permissive) - may want to tighten for final submission
- **Test Status:** 287/299 passing (96%) - excellent coverage, maintain this standard
- **Demo Features:** Removed demo user buttons ✅, need to clean test canvases before submission

---

**Last Updated:** October 19, 2025, 10:30 PM  
**Next Review:** Tomorrow morning before starting sprint

