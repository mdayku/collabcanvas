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
  - 🔷 Shapes (▭ ● ▲ ★ ♥ - visual icons, not text)
  - 😊 Emojis (12 popular emojis as clickable elements)
  - 🔣 Symbols (future icons, graphics)
  - 📝 Forms (login-form, contact-form - AI-generated layouts)  
  - 🎯 Assets (📝 text-box, navbar, card - AI-generated components)
- **Right-Click Context Menu**: Object styling without sidebar clutter
- **Help Panel**: Collapsible ? icon with AI commands, shortcuts, tips  
- **Clean Interface**: Professional visual icons, proper spacing, intuitive layout

#### Phase 3 (Next Priority - Multi-Canvas System)
- **Top Ribbon**: File dropdown menu (New, Open, Save, Export)
- **Tabbed Canvas**: Browser-style tabs with + button to add new canvas
- **Canvas Management**: Editable tab titles, close with x button, unsaved warnings
- **Export System**: High-quality PDF and PNG export with options
- **Canvas Database**: Save canvas projects with metadata (title, created_at, updated_at)

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
11. **Right-Click Context Menu**: Object styling interface triggered by right-click
12. **Shape Styling**: Fill color, outline color, outline weight in context menu
13. **Line Styling**: Thickness, color, dash patterns for lines/arrows in context menu
14. **Text Formatting**: Font size, font family, text color controls in context menu
15. **Universal Color System**: Consistent color picker across all object types
16. **Context Menu Polish**: Smooth animations, proper positioning, mobile support
17. **Testing & Refinement**: Cross-browser testing, performance optimization
18. **Documentation**: Update user guides, tooltips, help content

### 🚀 Phase 3: Multi-Canvas & Export System (High Priority - 1-2 weeks)
1. **Tabbed Canvas System**: Browser-style tabs for multiple projects
2. **File Management**: New, Open, Save, Close canvas operations
3. **Top Ribbon Interface**: File dropdown menu with canvas operations  
4. **Export System**: PNG, PDF export functionality with quality options
5. **Canvas Database**: Save/load canvas projects with metadata
6. **Canvas Lifecycle**: Auto-save, unsaved changes warnings, recovery

### 🎯 Phase 4: Advanced Features (Future - 3-4 weeks)  
7. **Multi-Select**: Drag selection box, group operations
8. **Component Library**: Save/reuse shape groups as components
9. **Advanced AI**: Smart layout, design critique, auto-styling
10. **Collaboration++**: Comments, version history, permissions
11. **Performance**: Canvas virtualization, shape culling, lazy loading

### 📊 Success Metrics
- **User Engagement**: Time spent creating vs. configuring
- **Feature Adoption**: Usage of new shape types and styling
- **Performance**: 60 FPS with 100+ shapes on canvas
- **AI Effectiveness**: Commands successfully executed vs. failed
- **Multiplayer Reliability**: <100ms sync latency, >99% uptime
