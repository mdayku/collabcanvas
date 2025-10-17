# ✅ New Object/Shape Checklist

Use this checklist when adding new shapes, templates, or assets to CollabCanvas.

---

## 📋 **For Adding a New SHAPE TYPE** (e.g., cylinder, star, rhombus)

### **1. Type Definition** 
**File**: `src/types.ts`
- [ ] Add shape type to `ShapeType` union (line 1)
```typescript
export type ShapeType = "rect" | "circle" | ... | "your-new-shape";
```

---

### **2. Visual Rendering**
**File**: `src/Canvas.tsx`

- [ ] **Add shape component function** (around line 5690+)
```typescript
function YourNewShapeComponent({ width, height, fill, stroke, strokeWidth }: {
  width: number; height: number; fill: string; stroke: string; strokeWidth: number;
}) {
  // Use Konva primitives: Line, RegularPolygon, etc.
}
```

- [ ] **Add rendering case** in `shapeEls` mapping (around line 2990+)
```typescript
{s.type === "your-new-shape" && (
  <YourNewShapeComponent
    width={s.w}
    height={s.h}
    fill={s.color || "#000"}
    stroke={s.stroke || "#000"}
    strokeWidth={s.strokeWidth || 1}
  />
)}
```

- [ ] **Add toolbar button** in `CategorizedToolbar` (around line 3271+)
```typescript
const addYourShape = () => addShape("your-new-shape", colors, snapToGrid, centerOnNewShape, stageRef);
```

- [ ] **Add to toolbar category** (around line 3408+)
```typescript
{
  id: 'shapes',
  name: 'Shapes',
  emoji: '🔷',
  tools: [
    { name: '⬟', action: addYourShape, available: true, tooltip: 'Your Shape' },
    // ...
  ]
}
```

---

### **3. Default Properties**
**File**: `src/state/store.ts`

- [ ] **Add shape defaults** in `getShapeDefaults` function (around line 1039+)
```typescript
case 'your-new-shape':
  return { x: 100, y: 100, w: 120, h: 80, strokeWidth: 2 };
```

**Auto-center**: ✅ Automatically handled by `addShape` function if defaults are set

---

### **4. AI Agent Support**
**File**: `src/ai/agent.ts`

- [ ] **Update `createShape` tool signature** (line 9)
```typescript
createShape: (type: "rect"|"circle"|...|"your-new-shape", ...)
```

- [ ] **Add rule-based parser** (around line 712+)
```typescript
if (/\b(your-new-shape|alias)\b/.test(t)) {
  const id = tools.createShape("your-new-shape", 250, 200, 120, 80, parseColor(t));
  return { ok: true, tool_calls: [{ name:"createShape", args:{ type:"your-new-shape", id }}] };
}
```

- [ ] **Add to grid support** in `shapePatterns` (around line 601)
```typescript
const shapePatterns: Record<string, any> = {
  'your-new-shape|alias': 'your-new-shape',
  // ...
};
```

---

### **5. Database Schema**
**File**: Create new migration file `supabase-your-shape.sql`

- [ ] **Update database constraint**
```sql
ALTER TABLE public.shapes DROP CONSTRAINT IF EXISTS shapes_type_check;

ALTER TABLE public.shapes 
ADD CONSTRAINT shapes_type_check 
CHECK (type IN (
  'rect', 'circle', ..., 'your-new-shape'
));
```

- [ ] **Run migration** in Supabase SQL Editor

---

### **6. Tests**
**File**: `src/test/ai-agent.test.ts` or create new test file

- [ ] **Add creation test**
```typescript
it('should create your-new-shape', () => {
  const result = interpret('create a your-new-shape');
  expect(result).toBeTruthy();
  expect(mockUpsert).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'your-new-shape' })
  );
});
```

- [ ] **Add grid test**
```typescript
it('should create 3x3 grid of your-new-shapes', () => {
  const result = interpret('create a 3x3 grid of your-new-shapes');
  // Assert 9 shapes created
});
```

- [ ] **Add style test** (color, resize, rotate, etc.)

- [ ] **Run tests**: `npm test`

---

### **7. Documentation**
**File**: `README.md`

- [ ] **Update shape list** in "Current Status" section
- [ ] **Update AI command examples** if needed
- [ ] **Add to feature list** if it's a significant addition

---

## 🎨 **For Adding a New TEMPLATE/ASSET** (e.g., Login Form, Hero Section)

### **1. Template Handler**
**File**: `src/ai/agent.ts`

- [ ] **Add template handler** in `interpret` function (around line 946+)
```typescript
if (t.includes("your template name")) {
  const W = 300, H = 200;
  const pos = findTemplatePosition(W, H);
  const baseX = pos.x, baseY = pos.y;
  
  const allIds: string[] = [];
  
  // Create your template shapes
  const shape1 = tools.createShape("rect", baseX, baseY, W, H, "#fff");
  allIds.push(shape1);
  
  // Group all elements
  tools.groupShapes(allIds);
  
  return { ok: true, tool_calls: [{ name:"createTemplate", args:{ ids: allIds }}] };
}
```

- [ ] **Also add in legacy handler** (around line 1554+ in `interpretLegacy`)

---

### **2. Toolbar Button**
**File**: `src/Canvas.tsx`

- [ ] **Add button** to `Assets & Templates` section (around line 3501+)
```typescript
{
  id: 'assets',
  name: 'Assets & Templates',
  emoji: '📦',
  tools: [
    { 
      name: '🎯', 
      action: () => handleAITemplateCommand('create your template'), 
      available: true, 
      tooltip: 'Your Template' 
    },
    // ...
  ]
}
```

---

### **3. Collision Detection**
**Templates automatically use**:
- ✅ `findTemplatePosition()` helper (line 1349 in `agent.ts`)
- ✅ Grid-based placement with collision detection
- ✅ Auto-grouping of elements

---

### **4. Tests**
**File**: `src/test/ai-agent.test.ts`

- [ ] **Add template creation test**
```typescript
it('should create your template', async () => {
  const result = await interpret('create your template');
  expect(result.ok).toBe(true);
  expect(mockGroupShapes).toHaveBeenCalled();
});
```

- [ ] **Test collision avoidance** (create multiple, verify no overlap)

---

### **5. Documentation**
**File**: `README.md`

- [ ] **Add to Assets & Templates section**
- [ ] **Update AI command examples**

---

## 🧪 **Testing Checklist (for ALL changes)**

**Files**: `src/test/*.test.ts`

- [ ] **Unit tests pass**: `npm test`
- [ ] **No linter errors**: Check file in IDE or run build
- [ ] **Build succeeds**: `npm run build`
- [ ] **Manual testing**:
  - [ ] Create shape via toolbar
  - [ ] Create shape via AI command
  - [ ] Create grid via AI
  - [ ] Resize, rotate, style changes
  - [ ] Auto-center works
  - [ ] Save/reload persists
  - [ ] Multiplayer sync works
  - [ ] Component system works (save/load)

---

## 📝 **Quick Reference: Files to Update**

| **Change Type** | **Files to Update** |
|----------------|-------------------|
| **New Shape** | `types.ts`, `Canvas.tsx`, `store.ts`, `agent.ts`, `supabase-*.sql`, tests, `README.md` |
| **New Template** | `agent.ts`, `Canvas.tsx`, tests, `README.md` |
| **AI Commands** | `agent.ts` (rule parser + legacy), tests |
| **Styling** | `Canvas.tsx` (rendering), `store.ts` (defaults) |
| **Database** | `supabase-*.sql`, run migration in Supabase |

---

## 🚀 **After Adding Everything**

- [ ] **Commit changes**: `git add -A && git commit -m "Add [shape/template name]"`
- [ ] **Build locally**: `npm run build`
- [ ] **Test in dev**: `npm run dev`
- [ ] **Push to production**: `git push`
- [ ] **Update Supabase**: Run SQL migration
- [ ] **Verify on both platforms**: Vercel + AWS Amplify

---

## 💡 **Pro Tips**

1. **Copy existing shapes** as templates - fastest way to get started
2. **Test AI commands early** - rule parser is usually the tricky part
3. **Grid support is key** - users love "create 5x5 grid of X"
4. **Collision detection** - use `findTemplatePosition()` for templates
5. **Group by default** - templates should auto-group (better UX)
6. **Document as you go** - update README immediately, not later

---

**Last Updated**: October 2025  
**Maintained by**: CollabCanvas Team

