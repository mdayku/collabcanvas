# CollabCanvas (MVP)

Real-time collaborative canvas with AI agent scaffolding.

## Stack
- React + Vite + Tailwind + Konva
- Zustand (state)
- Supabase Realtime + Auth + Postgres (persistence)
- Optional: OpenAI function calling via edge function

## Quickstart
```bash
cp .env.example .env   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Enable Realtime on the `public.shapes` table in Supabase, then run `supabase.sql` in the SQL editor.

## Scripts
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run preview` — preview build

## Notes
- Conflict policy: Last-Write-Wins via `updated_at` timestamp.
- Broadcast events: `shape:upsert`, `shape:remove`.
- Presence: Supabase Realtime presence API; cursors throttled with rAF.
