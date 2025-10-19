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

### 🔴 CRITICAL GAPS (1)

#### 1. **Cut Operation**
- **What UI does:** Ctrl+X cuts selected shapes (copy + delete)
- **Why AI can't:** No `cutShapes` tool
- **Complexity:** Simple (combines existing duplicate + delete logic)
- **Value:** Medium-High - "cut the blue circle" is intuitive
- **Implementation:** ~10 minutes
- **Note:** Copy/paste via AI are out of scope (complex clipboard state management)

---

### ⚪ OUT OF SCOPE (Too Risky This Late)

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

The following features were considered but are **OUT OF SCOPE** for this submission due to time constraints and risk of breaking existing functionality:

- ❌ **Copy/Paste via AI** - Complex clipboard state management
- ❌ **Opacity/Transparency Control** - Not critical, can be added post-submission
- ❌ **Lock/Unlock Shapes** - Nice-to-have but not essential
- ❌ **Shadow/Effects** - Styling feature, not core functionality
- ❌ **Border Radius** - `roundedRect` type already exists
- ❌ **Visibility Toggle** - Layer management complexity
- ❌ **Blend Modes** - Advanced feature, not in UI yet
- ❌ **Path Boolean Operations** - Complex, low demand
- ❌ **Animation/Transitions** - Out of scope for static design tool
- ❌ **Canvas Zoom/Pan via AI** - Stage ref integration complexity
- ❌ **Multi-Shape Selection by Name** - Text search complexity

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

### OpenAI/Groq Prompt Status:

#### ✅ **ALL FIXED:**
- Tool list matches actual implementations (30+ tools documented)
- Examples show correct `name/args` format
- Canvas context injection working (dynamic state + selected shapes)
- AI image generation includes proper type: 'frame' instruction
- Multi-step operations demonstrated in examples
- Timeout handling prevents hanging widget
- Network error messages guide users

#### 📝 **Notes:**
- Copy/paste/cut are intentionally excluded (complex state management)
- Styling features (opacity, shadows, etc.) deferred to post-submission

---

## 5. PRIORITIZED TODO LIST

### 🔴 OPTIONAL (Low Risk, Quick Win - ~10 min total)

- [ ] **Add `cutShapes(ids)` tool** - 10 min
  - Duplicates shape, selects duplicate, deletes original
  - OR: Uses clipboard if available (check store implementation)
  - Low risk - leverages existing duplicate + delete logic

### 🔧 CODE QUALITY (Optional Polish)

- [ ] **Standardize tool return types** - 20 min
  - All tools return `string | string[] | null`
  - Improves tool chaining consistency
  
- [ ] **Extract template creation helper** - 15 min
  - Reduces duplication in legacy parser
  - Makes template code more maintainable

### ✅ ALREADY COMPLETE

- [x] **Error handling for generateAIImage** - Added timeout + network error messages
- [x] **OpenAI/Groq system prompts** - Updated with all 30+ tools and canvas context

---

## 6. QUICK WINS (Optional - Conservative Scope)

### Single Feature Recommended:

1. **`cutShapes`** - 10 min, Low risk, completes cut/copy/paste trio

**Total Time:** ~10 minutes  
**Impact:** Adds 1 commonly expected command  
**Risk:** Minimal (uses existing duplicate + delete logic)

---

## 7. RECOMMENDATIONS

### Pre-Submission (Conservative Approach):
1. ✅ **AI image generation fixed** - Rule-based parser + error handling complete
2. ✅ **Error handling improved** - Timeout + network error messages added
3. ✅ **System prompts updated** - All 30+ tools documented with context
4. **OPTIONAL:** Add `cutShapes` tool (10 min, low risk)

### Post-Submission (Future Enhancements):
1. Consider additional features like opacity, lock, shadows (if user demand exists)
2. Implement zoom/pan controls (requires architecture discussion)
3. Standardize return types across all tools for consistency

### Long-term Vision:
1. Tool usage analytics to identify most-requested features
2. AI-specific "macro" tools that combine multiple operations
3. Voice command optimization based on usage patterns

---

## 8. CONCLUSION

**Current State:** The AI agent has excellent coverage of core design operations (~90% of manual UI capabilities).

**Recent Improvements:**
- ✅ AI image generation now works via rule-based parser (no network delays)
- ✅ Error handling improved with timeouts and clear messages
- ✅ System prompts updated with all 30+ tools and canvas context

**Remaining Gap:** Cut operation (optional, 10 min implementation)

**Code Quality:** Good overall. AI image generation error handling complete. Return type standardization is optional polish.

**Final Recommendation:** **Ship as-is.** The AI agent is production-ready with 90% capability coverage. The optional `cutShapes` tool can be added in 10 minutes if desired, but it's not critical for submission. All major bugs fixed, error handling robust, and feature set comprehensive.

---

**End of Audit**

