# Shape Consistency Audit Report

## 🔍 Audit Date: October 16, 2025

### Executive Summary
Comprehensive audit of all 17 shape types in CollabCanvas to identify inconsistencies in:
- Default sizes
- Stroke/outline properties
- Resize behavior
- Rendering logic

---

## 🚨 Issues Found

### 1. **CRITICAL: Size Inconsistency Between `getShapeDefaults` and `addShape`**

**Problem**: Two different sources of truth for default shapes sizes

**In `getShapeDefaults` (store.ts:951-1010)**:
- `rect`: 120×80
- `circle`: 100×100
- `text`: 200×40
- `image`: 200×150
- `line`: 120×2
- `arrow`: 120×2
- `frame`: 200×150
- **Default case (all other 10 shapes)**: 100×100

**In `addShape` (Canvas.tsx:3368-3400)**:
- `rect`: 120×80
- `text`: 220×50 (different from getShapeDefaults!)
- `line`: 200×2 (different!)
- `arrow`: 200×2 (different!)
- `frame`: 200×150
- **All other shapes**: 100×80 (different from getShapeDefaults!)

**Impact**: 
- When shapes are created via `createShape` method, they get 100×100
- When shapes are created via `addShape` (UI buttons), they get 100×80
- This creates unpredictable behavior and inconsistent UX

---

### 2. **Missing Explicit Defaults for 10 Shape Types**

**Problem**: These shapes only get the default case (100×100 or 100×80):
- triangle
- star
- heart
- pentagon
- hexagon
- octagon
- oval
- trapezoid
- rhombus
- parallelogram

**Impact**: 
- No control over individual shape proportions
- Can't optimize aspect ratios for different shapes (e.g., hearts look better taller)
- Inconsistent with the careful sizing given to rect, circle, frame

---

### 3. **Stroke Property Inconsistencies**

**Line & Arrow**:
- `getShapeDefaults`: stroke="#111111", strokeWidth=3
- `addShape`: (inherits from default, may not set stroke explicitly)
- Both have explicit stroke in rendering

**Frame**:
- Explicit stroke="#6c757d", strokeWidth=2 (good)

**All other shapes**:
- `getShapeDefaults`: No stroke defaults
- `addShape`: stroke=colors.text, strokeWidth=2
- Rendering: stroke fallback to "#000", strokeWidth fallback to 1

**Impact**:
- Inconsistent default stroke widths (1 vs 2 vs 3)
- Different fallback colors depending on creation method

---

### 4. **Oval-Specific Issues**

**Problem**: Oval uses different rendering logic
```typescript
// Oval (Canvas.tsx:2453-2463)
<Circle
  x={s.w / 2}
  y={s.h / 2}
  radiusX={s.w / 2}
  radiusY={s.h / 2}
  ...
/>
```

**Unlike other shapes** which use:
```typescript
width={s.w}
height={s.h}
```

**Impact**:
- Resize behavior might feel different
- Selection box might not align perfectly
- User reported "oval sizing/resizing issues" (see todo #31)

---

### 5. **Text Shape Size Discrepancy**

**Issue**: Text defaults are different:
- `getShapeDefaults`: 200×40
- `addShape`: 220×50

**Impact**: Depending on how text is created, it has different initial proportions

---

### 6. **Line/Arrow Length Inconsistency**

**Issue**: Default line lengths differ:
- `getShapeDefaults`: 120px (x2=220, starting at x=100)
- `addShape`: 200px

**Impact**: Lines created programmatically vs. UI have very different lengths

---

## ✅ What Works Well

1. **Consistent Color Scheme**: Each shape type has a unique, visually distinct color
2. **All shapes support stroke/strokeWidth**: Property is in ShapeBase type
3. **Frame implementation**: Well-designed with transparent fill and dashed border
4. **Resize transformer**: Works for all shapes (uses Konva transformer)

---

## 📋 Recommendations (Priority Order)

### HIGH PRIORITY

1. **Unify Default Sizes**: Make `getShapeDefaults` the single source of truth
   - Remove duplicate size logic from `addShape`
   - Ensure both functions use identical defaults

2. **Add Explicit Defaults for All 10 Missing Shapes**:
   ```typescript
   case 'triangle': return { x: 100, y: 100, w: 100, h: 100 };
   case 'star': return { x: 100, y: 100, w: 100, h: 100 };
   case 'heart': return { x: 100, y: 100, w: 90, h: 100 }; // Taller for better heart proportions
   case 'pentagon': return { x: 100, y: 100, w: 100, h: 100 };
   case 'hexagon': return { x: 100, y: 100, w: 100, h: 100 };
   case 'octagon': return { x: 100, y: 100, w: 100, h: 100 };
   case 'oval': return { x: 100, y: 100, w: 120, h: 80 }; // Match rect proportions
   case 'trapezoid': return { x: 100, y: 100, w: 120, h: 80 };
   case 'rhombus': return { x: 100, y: 100, w: 100, h: 100 };
   case 'parallelogram': return { x: 100, y: 100, w: 120, h: 80 };
   ```

3. **Standardize Stroke Defaults**: Pick ONE default strokeWidth (recommend 2)
   - Update getShapeDefaults to include stroke: undefined, strokeWidth: 2 for all shapes
   - Or ensure addShape always sets stroke explicitly

### MEDIUM PRIORITY

4. **Fix Oval Rendering**: Consider whether current implementation is optimal
   - Test if resize behavior feels natural
   - Document why Circle with radiusX/Y was chosen vs. Ellipse

5. **Add Stroke to Default Case**: Ensure all shapes get consistent stroke defaults

### LOW PRIORITY

6. **Optimize Shape Proportions**: Fine-tune aspect ratios
   - Hearts: 90×100 (vertical bias)
   - Pentagons: Equal sides work best
   - Ovals: 120×80 (horizontal bias like rectangles)

---

## 🧪 Testing Recommendations

1. Create test: "All shapes have consistent default sizes via createShape vs addShape"
2. Create test: "All shapes support stroke and strokeWidth properties"
3. Create test: "Oval resize behavior matches rectangle resize behavior"
4. Manual testing: Create all 17 shapes, verify they look proportional and professional

---

## 📝 Notes

- Current system works, but inconsistencies create maintenance debt
- Users may notice size differences between shapes created different ways
- The oval issue (#31 on todo list) may be related to the different rendering approach
- Fixing these now prevents future bugs and improves code maintainability


