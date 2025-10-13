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

### MVP (24h)
- Smooth pan/zoom
- Create/move/resize/rotate rect/circle/text
- Realtime sync across 2+ users
- Multiplayer cursors with display names
- Presence awareness
- User authentication (anon ok)
- State persistence (DB)
- Deployed app

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

### UX
- Toolbar (rect/circle/text, AI box)
- Name + color chip
- FPS & connection indicators (nice-to-have)
- Error tolerance (retry, reconnect)

## Ordered Task List

### Day 1 (MVP)
1. Setup Vite + Tailwind
2. Zustand store for shapes & selection
3. Supabase client + anonymous auth
4. Konva Stage/Layer with pan/zoom
5. Create & drag shapes
6. Broadcast upserts/removes via Realtime
7. Presence cursors (rAF throttle)
8. Persist shapes table, load on subscribe
9. Two-browser test + refresh test
10. Deploy (Vercel/Netlify)

### Days 2–4 (Early)
1. Resize/rotate via Transformer
2. Selection (single/multi), delete/duplicate
3. AI interpreter (6+ commands)
4. Broadcast AI actions
5. Perf polish (batchDraw, memoization)
6. Demo video draft

### Days 5–7 (Final)
1. OpenAI function-calling edge function
2. Layout commands (grid/row/space evenly)
3. Reconnect hardening & error messages
4. AI Development Log (1 page)
5. Final video (3–5 min)
6. Final submission
