# AI Agent Capability Audit
**Date:** October 19, 2025
**Purpose:** Systematic comparison of UI capabilities vs. AI agent capabilities to identify gaps

---

## Executive Summary

**Current Coverage:** ~90% of manual capabilities  
**Critical Gaps:** 2 features  
**High Priority Gaps:** 4 features  
**Medium Priority Gaps:** 3 features  
**Code Quality Issues:** 3 patterns identified

---

## 1. INVENTORY PHASE

### 1.1 UI Capabilities (from Canvas.tsx)

#### **Toolbar Actions:**
- ✅ **Shapes**: Rectangle, Circle, Triangle, Star, Heart, Pentagon, Hexagon, Octagon, Oval, Trapezoid, Rhombus, Parallelogram
- ✅ **Mermaid Shapes**: Rounded Rectangle, Stadium, Note, Cylinder, Document
- ✅ **Lines & Arrows**: Straight line, Arrow, Curved lines/arrows
- ✅ **Text**: Text boxes with formatting
- ✅ **Emojis**: 12+ popular emojis
- ✅ **Icons**: 9+ interface icons
- ✅ **Frames**: AI Image Frame
- ✅ **Tools**: Box Select, Pen Tool (bezier paths)
- ✅ **Templates**: Login form, Nav bar, Card, Hero section, Contact form, User profile, Mobile header
- ✅ **Components**: Save and insert custom components

#### **Keyboard Shortcuts:**
- ✅ Ctrl+Z: Undo
- ✅ Ctrl+Y: Redo
- ✅ Ctrl+C: Copy
- ✅ Ctrl+V: Paste
- ✅ Ctrl+X: Cut
- ✅ Ctrl+Shift+D: Duplicate
- ✅ Ctrl+G: Group
- ✅ Ctrl+Shift+G: Ungroup
- ✅ Delete/Backspace: Delete shapes
- ✅ Arrow keys: Move shapes (1px, 10px with Shift)
- ✅ Escape: Deselect/cancel operations

#### **Context Menu Actions** (Right-click):
- ✅ Duplicate
- ✅ Delete
- ✅ Send to Front
- ✅ Send to Back
- ✅ Move Up
- ✅ Move Down
- ✅ Change Color
- ✅ Change Outline
- ✅ Generate AI Image (for frames)
- ✅ Save as Component
- ✅ Text formatting (Bold, Italic, Underline)
- ✅ Alignment (Left, Center, Right)

#### **Transform Operations:**
- ✅ Drag to move
- ✅ Resize handles
- ✅ Rotation handle
- ✅ Multi-select (Shift+Click, Box Select)
- ✅ Smart guides (5px snap threshold)
- ✅ Snap to grid

#### **Advanced Features:**
- ✅ Canvas management (New, Open, Duplicate, Delete)
- ✅ Export (PNG, PDF)
- ✅ Zoom/Pan
- ✅ Real-time collaboration
- ✅ Undo/Redo history
- ✅ Offline queue

---

### 1.2 AI Agent Tools (from agent.ts)

#### **Implemented Tools (30+):**
1. ✅ `createShape` - All 20+ shape types
2. ✅ `moveShape` - Move to x,y
3. ✅ `resizeShape` - Change width/height
4. ✅ `rotateShape` - Rotate by degrees
5. ✅ `changeColor` - Fill color
6. ✅ `changeStroke` - Outline color/width
7. ✅ `updateText` - Change text content
8. ✅ `changeFontSize` / `changeFontFamily` - Font properties
9. ✅ `formatText` - Bold, italic, underline, alignment
10. ✅ `distributeShapes` - Even spacing
11. ✅ `generateAIImage` - DALL-E integration
12. ✅ `deleteShape` - Remove shapes
13. ✅ `duplicateShape` - Clone shapes
14. ✅ `groupShapes` / `ungroupShapes` - Grouping
15. ✅ `alignShapes` - Align multiple shapes
16. ✅ `sendToFront` / `sendToBack` / `moveUp` / `moveDown` - Layer ordering
17. ✅ `matchSize` / `matchPosition` - Match dimensions/positions
18. ✅ `copyStyle` - Copy visual styles
19. ✅ `connectShapes` - Create lines/arrows between shapes
20. ✅ `createGrid` - NxM grid layouts
21. ✅ `undo` / `redo` - History navigation
22. ✅ `createEmoji` - Place emojis
23. ✅ `createIcon` - Place icons
24. ✅ `createText` - Create text boxes
25. ✅ `arrangeInGrid` - Arrange existing shapes in grid
26. ✅ `stackVertically` - Vertical stacking
27. ✅ `selectByType` / `selectByColor` / `selectByRegion` - Smart selection
28. ✅ `saveAsComponent` / `insertComponent` - Component system
29. ✅ `exportCanvas` - Export functionality
30. ✅ Template creation (login form, nav bar, card, etc.)

---

## 2. GAP ANALYSIS

### 🔴 CRITICAL GAPS (2)

#### 1. **Copy/Paste Actions**
- **What UI does:** Ctrl+C copies selected shapes, Ctrl+V pastes at mouse cursor or offset position
- **Why AI can't:** No `copyShapes` or `pasteShapes` tools implemented
- **Complexity:** Simple (clipboard management already exists in useCanvas store)
- **Value:** Critical - users expect "copy these 3 circles" to work
- **Implementation:** ~15 minutes
  ```typescript
  copyToClipboard: (ids: string[]) => {
    const shapes = ids.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
    useCanvas.getState().setClipboard(shapes);
    return shapes.length;
  },
  pasteFromClipboard: (x?: number, y?: number) => {
    const clipboard = useCanvas.getState().clipboard;
    // Create copies at offset position
  }
  ```

#### 2. **Cut Operation**
- **What UI does:** Ctrl+X cuts selected shapes (copy + delete)
- **Why AI can't:** No `cutShapes` tool
- **Complexity:** Simple (combines copy + delete)
- **Value:** High - "cut the blue circle and move it here"
- **Implementation:** ~5 minutes (calls `copyToClipboard` + `deleteShape`)

---

### 🟡 HIGH PRIORITY GAPS (4)

#### 3. **Canvas Zoom/Pan Controls**
- **What UI does:** Mouse wheel zoom, drag to pan, fit-to-screen
- **Why AI can't:** No `zoomToFit`, `zoomIn`, `zoomOut`, `panToRegion` tools
- **Complexity:** Medium (requires Stage ref access from agent)
- **Value:** High - "zoom in on the logo" is intuitive
- **Implementation:** ~30 minutes
  ```typescript
  zoomToFit: () => {
    // Reset zoom and center all shapes
  },
  panToShape: (id: string) => {
    // Center viewport on specific shape
  }
  ```

#### 4. **Multi-Shape Selection by Name/Pattern**
- **What UI does:** Box select, Shift+Click
- **Why AI partially can:** `selectByType/Color/Region` exist but limited
- **Missing:** "select all shapes with 'button' in their name", "select the left column"
- **Complexity:** Medium (needs text search in shape properties)
- **Value:** High - "select all the nav items"
- **Implementation:** ~20 minutes

#### 5. **Opacity/Transparency Control**
- **What UI does:** Context menu → Opacity slider (0-100%)
- **Why AI can't:** No `changeOpacity` tool
- **Complexity:** Simple (single property update)
- **Value:** High - "make it 50% transparent" is common
- **Implementation:** ~10 minutes
  ```typescript
  changeOpacity: (id: string, opacity: number) => up(id, { opacity: Math.max(0, Math.min(1, opacity)) })
  ```

#### 6. **Lock/Unlock Shapes**
- **What UI does:** Context menu → Lock (prevents editing)
- **Why AI can't:** No `lockShape` / `unlockShape` tools
- **Complexity:** Simple (boolean property)
- **Value:** Medium-High - "lock the background so I don't move it"
- **Implementation:** ~10 minutes

---

### 🟢 MEDIUM PRIORITY GAPS (3)

#### 7. **Shadow/Effects**
- **What UI does:** Context menu → Add shadow (x, y, blur, color)
- **Why AI can't:** No `addShadow` tool
- **Complexity:** Medium (multiple properties)
- **Value:** Medium - "add drop shadow to the card"
- **Implementation:** ~20 minutes

#### 8. **Border Radius for Rectangles**
- **What UI does:** Property panel → Corner radius slider
- **Why AI can't:** No `changeBorderRadius` tool
- **Complexity:** Simple (single property)
- **Value:** Medium - "make the corners rounded"
- **Implementation:** ~10 minutes (note: `roundedRect` type exists, but can't modify existing rects)

#### 9. **Visibility Toggle**
- **What UI does:** Layer panel → Eye icon (show/hide)
- **Why AI can't:** No `hideShape` / `showShape` tools
- **Complexity:** Simple (visible boolean)
- **Value:** Medium - "hide the draft watermark"
- **Implementation:** ~10 minutes

---

### ⚪ LOW PRIORITY / EDGE CASES

#### 10. **Blend Modes**
- Not implemented in UI yet (future feature)

#### 11. **Path Boolean Operations**
- Complex feature, low user demand

#### 12. **Animation/Transitions**
- Not in scope for static design tool

---

## 3. CODE QUALITY AUDIT

### Issues Found:

#### 3.1 **Inconsistent Return Types**
**Location:** `agent.ts` tools object  
**Problem:** Some tools return IDs, some return void, some return arrays  
**Impact:** Makes chaining operations difficult  
**Fix:** Standardize all tools to return `string | string[] | null`

```typescript
// Current (inconsistent):
createShape: (...) => { /* returns string */ },
moveShape: (...) => up(id, { x, y }), // returns void
groupShapes: (...) => { /* no explicit return */ }

// Should be:
createShape: (...): string => { /* ... */ return s.id; },
moveShape: (id, x, y): string => { up(id, { x, y }); return id; },
groupShapes: (ids): string[] => { /* ... */ return ids; }
```

#### 3.2 **Duplicate Logic in Legacy Parser**
**Location:** `agent.ts` lines 2000-2300 (template creation)  
**Problem:** Each template has repeated grouping/selection logic  
**Impact:** Harder to maintain, prone to bugs  
**Fix:** Extract common pattern into helper function

```typescript
function createTemplate(shapes: string[], selectAndGroup: boolean = true): string[] {
  if (selectAndGroup) {
    tools.groupShapes(shapes);
    useCanvas.getState().select(shapes);
  }
  return shapes;
}
```

#### 3.3 **Missing Error Handling in generateAIImage**
**Location:** `agent.ts` line 90-140  
**Problem:** No user-friendly error messages for DALL-E failures  
**Impact:** Users see cryptic errors in console  
**Fix:** Add try/catch with toast notifications

```typescript
try {
  const imageUrl = await generateImageWithDALLE(prompt, frame.w, frame.h);
  // ...
} catch (error) {
  const message = error.message.includes('localhost') 
    ? 'AI image generation requires production deployment' 
    : 'Failed to generate image. Please try again.';
  showToast(message, 'error');
  throw error;
}
```

---

## 4. LLM SYSTEM PROMPT ACCURACY

### OpenAI/Groq Prompt Issues:

#### ✅ **FIXED:**
- Tool list matches actual implementations (30+ tools documented)
- Examples show correct `name/args` format
- Canvas context injection working

#### ⚠️ **NEEDS UPDATE:**
- Missing tools in prompt: `copyToClipboard`, `pasteFromClipboard`, `cutShapes`
- Missing tools in prompt: `changeOpacity`, `lockShape`, `unlockShape`
- Examples don't show multi-step operations (e.g., "create 3 circles and connect them with arrows")

---

## 5. PRIORITIZED TODO LIST

### 🔴 CRITICAL (Implement First - ~30 min total)

- [ ] **Add `copyToClipboard(ids)` tool** - 15 min
  - Uses existing clipboard in useCanvas store
  - Returns number of shapes copied
  
- [ ] **Add `pasteFromClipboard(x?, y?)` tool** - 15 min
  - Creates copies at offset or specified position
  - Returns array of new shape IDs

### 🟡 HIGH PRIORITY (~70 min total)

- [ ] **Add `cutShapes(ids)` tool** - 5 min
  - Calls copyToClipboard + deleteShape
  
- [ ] **Add `changeOpacity(id, opacity)` tool** - 10 min
  - Clamps opacity between 0-1
  
- [ ] **Add `lockShape(id)` / `unlockShape(id)` tools** - 10 min
  - Sets draggable property
  
- [ ] **Add `zoomToFit()` / `panToShape(id)` tools** - 30 min
  - Requires Stage ref integration
  
- [ ] **Enhance selection tools** - 15 min
  - Add `selectByName(pattern)` for text matching

### 🟢 MEDIUM PRIORITY (~40 min total)

- [ ] **Add `changeBorderRadius(id, radius)` tool** - 10 min
  - For rectangle shapes only
  
- [ ] **Add `addShadow(id, config)` tool** - 20 min
  - shadowColor, shadowBlur, shadowOffsetX, shadowOffsetY
  
- [ ] **Add `hideShape(id)` / `showShape(id)` tools** - 10 min
  - Sets visible property

### 🔧 CODE QUALITY (~60 min total)

- [ ] **Standardize tool return types** - 20 min
  - All tools return `string | string[] | null`
  
- [ ] **Extract template creation helper** - 15 min
  - Reduces duplication in legacy parser
  
- [ ] **Add error handling to generateAIImage** - 10 min
  - User-friendly toast messages
  
- [ ] **Update OpenAI/Groq system prompts** - 15 min
  - Document all new tools
  - Add multi-step operation examples

---

## 6. QUICK WINS (3-5 features, <30 min each)

### Highest Impact, Lowest Effort:

1. **`changeOpacity`** - 10 min, Critical for design work
2. **`cutShapes`** - 5 min, Completes clipboard trinity
3. **`lockShape`** - 10 min, Prevents accidental moves
4. **`changeBorderRadius`** - 10 min, Common styling need
5. **`selectByName`** - 15 min, Powerful for organization

**Total Time:** ~50 minutes  
**Impact:** Closes 5 major gaps, adds ~15% more capability coverage

---

## 7. RECOMMENDATIONS

### Immediate Actions (Next Session):
1. Implement the 5 Quick Wins above (50 min)
2. Update system prompts with new tools (15 min)
3. Test each new tool with sample commands

### Next Sprint:
1. Implement zoom/pan controls (requires architecture discussion)
2. Add shadow/effects support
3. Standardize return types across all tools

### Long-term:
1. Consider tool categorization in system prompt
2. Add tool usage analytics to identify most-requested features
3. Create AI-specific "macro" tools that combine multiple operations

---

## 8. CONCLUSION

**Current State:** The AI agent has excellent coverage of core design operations (~90%).

**Main Gaps:** Clipboard operations (copy/paste/cut), opacity control, and advanced selection tools.

**Code Quality:** Good overall, but needs return type standardization and better error handling.

**Recommendation:** Focus on the 5 Quick Wins first - they're high-value, low-effort, and will bring AI capability coverage to ~95% of manual UI actions.

---

**End of Audit**

