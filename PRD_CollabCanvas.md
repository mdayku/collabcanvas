# CollabCanvas PRD

## Vision
A real-time collaborative design canvas where users and AI co-create. Like Figma + ChatGPT: multiple users, one shared canvas, instant feedback.

## Success Criteria
| KPI | Target |
|-----|--------|
| Shape update latency | <100 ms |
| Cursor latency | <50 ms |
| FPS during pan/zoom | 60 |
| Concurrent users | ≥ 5 |
| Persistence on refresh | 100% |
| AI latency | <2 s |
| AI command coverage | ≥ 6 tool types |

## Requirements

### ✅ MVP (Phase 1 - Completed)
- Smooth pan/zoom
- Create/move/resize/rotate rect/circle/text
- Realtime sync across 2+ users
- Multiplayer cursors with display names
- Presence awareness
- User authentication (anon ok)
- State persistence (DB)
- Deployed app
- AI integration (Groq + OpenAI + serverless fallback)
- Clear canvas functionality

### 🎨 Professional UI (Phase 2 - Current)
**Goal: Transform into professional design tool with categorized toolbar**

#### UI Refactor
- **Categorized Toolbar**: Lines+Arrows, Shapes, Symbols, Forms, Assets
- **Icon-based Interface**: Replace text buttons with icons + hover tooltips
- **Professional Layout**: Clean, intuitive tool organization
- **Help System**: Collapsible help panel with AI commands and shortcuts

#### Enhanced Shape Library
- **Basic Shapes**: Circle, square, rectangle, triangle, star, heart
- **Polygons**: Pentagon, hexagon, octagon
- **Advanced**: Trapezoid, rhombus, parallelogram, oval
- **3D Shapes**: Cube, sphere (if feasible with Konva)

#### Lines & Arrows
- **Line Drawing**: Straight lines, arrows (single/double-ended)
- **Styling Controls**: Line thickness, line color, arrow styles
- **Smart Snapping**: Snap to shapes, grid, angles

#### Universal Styling System
- **Full Color Palette**: Rich color picker for all objects
- **Shape Styling**: Fill color, outline color, outline weight
- **Text Styling**: Font size, color, weight (future phase)

### 🚀 Advanced Features (Phase 3 - Future)
- Multi-select and group operations
- PNG/SVG export
- Component system (reusable elements)
- Advanced AI layout commands
- Voice comments and annotations

### Realtime Infra
- Supabase channel per `room`
- Broadcast: `shape:upsert`, `shape:remove`
- Presence for cursors/users
- Persistence: `public.shapes` (upsert, fetch on join)
- Conflict resolution: LWW (`updated_at` ms)

### AI Agent (Phase 2)
- Tools: `createShape`, `moveShape`, `resizeShape`, `rotateShape`, `createText`, `getCanvasState`
- Interpreter supports 6+ commands (create, manipulate, layout, simple “login form”)
- Shared AI actions (broadcast results to all clients)
- Optional: OpenAI function calling (edge function)

### UX Evolution
#### Phase 1 (Completed)
- Basic toolbar (rect/circle/text, AI box)
- Name + color chip
- Error tolerance (retry, reconnect)

#### Phase 2 (Current Focus)
- **Categorized Icon Toolbar**:
  - 📏 Lines & Arrows (line, arrow-right, arrow-both)
  - 🔷 Shapes (circle, square, triangle, star, heart, polygon variants)
  - 🔣 Symbols (currently disabled - future icons, graphics)
  - 📝 Forms (login-form, contact-form - AI-generated layouts)  
  - 🧩 Assets (navbar, card, footer - AI-generated components)
- **Color System**: Rich color palette with recent colors
- **Help Panel**: Collapsible ? icon with AI commands, shortcuts, tips
- **Clean Interface**: Remove redundant text, emoji, improve spacing

## Implementation Roadmap

### ✅ Phase 1: MVP Foundation (Completed)
1. ✅ Setup Vite + Tailwind + TypeScript
2. ✅ Zustand store for shapes & selection with undo
3. ✅ Supabase client + anonymous auth + user profiles
4. ✅ Konva Stage/Layer with pan/zoom
5. ✅ Create & drag rect/circle/text shapes
6. ✅ Broadcast upserts/removes via Realtime
7. ✅ Presence cursors with throttling
8. ✅ Persist shapes table, load on subscribe
9. ✅ Multi-browser testing + refresh persistence
10. ✅ Deploy to Vercel with environment variables
11. ✅ AI integration (Groq + OpenAI + serverless API)
12. ✅ Clear canvas with confirmation + undo support

### 🎯 Phase 2: Professional UI (Current - 2-3 weeks)

#### Week 1: UI Foundation
1. **UI Refactor**: Design new categorized toolbar structure
2. **Icon System**: Implement icon components with hover tooltips
3. **Help Panel**: Move AI commands to collapsible help system
4. **Color Palette**: Design and implement rich color picker
5. **Clean Interface**: Remove redundant elements, improve spacing

#### Week 2: Shape Library Expansion  
6. **Line Tool**: Implement line drawing with start/end points
7. **Arrow Tool**: Add arrow variants (single, double, styled tips)
8. **Basic Shapes**: Triangle, star, heart with proper geometry
9. **Polygon Shapes**: Pentagon, hexagon, octagon generation
10. **Advanced Shapes**: Trapezoid, rhombus, parallelogram, oval

#### Week 3: Styling & Polish
11. **Shape Styling**: Fill color, outline color, outline weight controls
12. **Line Styling**: Thickness, color, dash patterns for lines/arrows
13. **Universal Color System**: Apply color palette to all shape types
14. **Testing & Refinement**: Cross-browser testing, performance optimization
15. **Documentation**: Update user guides, tooltips, help content

### 🚀 Phase 3: Advanced Features (Future - 3-4 weeks)
1. **Multi-Select**: Drag selection box, group operations
2. **Export System**: PNG, SVG, PDF export functionality  
3. **Component Library**: Save/reuse shape groups as components
4. **Advanced AI**: Smart layout, design critique, auto-styling
5. **Collaboration++**: Comments, version history, permissions
6. **Performance**: Canvas virtualization, shape culling, lazy loading

### 📊 Success Metrics
- **User Engagement**: Time spent creating vs. configuring
- **Feature Adoption**: Usage of new shape types and styling
- **Performance**: 60 FPS with 100+ shapes on canvas
- **AI Effectiveness**: Commands successfully executed vs. failed
- **Multiplayer Reliability**: <100ms sync latency, >99% uptime
