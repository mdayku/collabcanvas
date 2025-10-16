# 🚨 CRITICAL BUG: Cursor Canvas Isolation Failure

## Bug Report
**Date**: October 16, 2025  
**Severity**: CRITICAL (breaks multi-canvas collaboration)  
**Reporter**: User Testing

## Reproduction
1. User A opens Canvas 1
2. User B opens Canvas 2
3. **BUG**: Both users see each other's cursors, even though they're on different canvases

## Root Cause Analysis

### Problem Location: `src/Canvas.tsx:2741`
```typescript
{Object.values(cursors).filter(cursor => cursor.id !== me.id).map((cursor) => (
  <div ... />
))}
```

**Issue**: Only filters out the current user's cursor, but doesn't filter by `roomId`!

### Why This Happens

1. **Global Cursor State**: `cursors: Record<string, Cursor>` is global in Zustand store
   - All cursors from all rooms are stored together
   - No room/canvas association

2. **Cursor Type Missing roomId**: 
   ```typescript
   export type Cursor = { 
     id: string; 
     name: string; 
     x: number; 
     y: number; 
     color: string; 
     last: number 
     // ❌ NO roomId!
   };
   ```

3. **No Cleanup on Canvas Switch**:
   - When switching canvases, `roomId` changes
   - But old cursors remain in the global state
   - New cursor updates add to the same global object
   - Rendering shows cursors from ALL rooms

4. **Channel Subscription Doesn't Clear Old Cursors**:
   ```typescript
   // Canvas.tsx:1522-1524
   const roomId = useCanvas.getState().roomId;
   const channel = supabase.channel(`room:${roomId}`, ...);
   // Creates new channel but doesn't clean up old cursors!
   ```

## Impact

**User Experience**: 
- Confusing: Users see ghost cursors from other canvases
- Privacy concern: Users can see where others are working on different projects
- Breaks mental model of canvas isolation

**Severity**: HIGH
- Doesn't crash the app
- But fundamentally breaks multi-canvas collaboration UX
- May expose user activity across canvases

## Solution Options

### Option 1: Quick Fix - Clear Cursors on Canvas Switch ⚡
**Pros**: Simple, immediate fix  
**Cons**: Brief moment where cursors disappear/reappear

```typescript
// src/state/store.ts - in setCurrentCanvas
setCurrentCanvas: (canvas) => set((s) => { 
  s.currentCanvas = canvas;
  s.cursors = {}; // 👈 Clear all cursors
  if (canvas) {
    s.roomId = canvas.room_id;
    setLastActiveCanvasId(canvas.id);
  }
}),
```

### Option 2: Add roomId to Cursor Type (Recommended) 🎯
**Pros**: Proper data model, allows filtering  
**Cons**: Requires type update and presence data changes

```typescript
// 1. Update Cursor type (types.ts)
export type Cursor = { 
  id: string; 
  name: string; 
  x: number; 
  y: number; 
  color: string; 
  last: number;
  roomId: string; // 👈 ADD THIS
};

// 2. Include roomId in presence updates (Canvas.tsx)
await roomChannel.track({
  x: pos.x,
  y: pos.y,
  name: me.name,
  color: me.color,
  roomId: roomId, // 👈 ADD THIS
  last: Date.now()
});

// 3. Store roomId when updating cursor (Canvas.tsx:1548)
useCanvas.getState().updateCursor({
  id: userId,
  name: presenceData.name || 'Guest',
  x: presenceData.x,
  y: presenceData.y,
  color: presenceData.color || '#666',
  last: presenceData.last || Date.now(),
  roomId: presenceData.roomId || roomId // 👈 ADD THIS
});

// 4. Filter cursors by roomId when rendering (Canvas.tsx:2741)
{Object.values(cursors)
  .filter(cursor => 
    cursor.id !== me.id && 
    cursor.roomId === roomId // 👈 ADD THIS
  )
  .map((cursor) => (
    <div ... />
  ))}
```

### Option 3: useEffect Cleanup (Belt & Suspenders) 🛡️
**Pros**: Prevents memory leaks, ensures cleanup  
**Cons**: More complex, need to track channel ref properly

```typescript
// Canvas.tsx - add cleanup to realtime useEffect
useEffect(() => {
  const roomId = useCanvas.getState().roomId;
  const channel = supabase.channel(`room:${roomId}`, ...);
  roomChannel = channel;
  
  // ... subscription logic ...
  
  // 👇 ADD CLEANUP
  return () => {
    console.log('🧹 Cleaning up channel for room:', roomId);
    channel.unsubscribe();
    // Clear cursors from this room
    const currentRoomId = useCanvas.getState().roomId;
    if (currentRoomId !== roomId) {
      // We switched rooms, clear old cursors
      useCanvas.setState({ cursors: {} });
    }
  };
}, [roomId]); // 👈 Re-run when roomId changes
```

## Recommended Implementation

**Phase 1: Immediate Fix (Option 1)**
- Clear cursors on canvas switch
- Deploy immediately to stop the bleeding

**Phase 2: Proper Fix (Option 2)**
- Add `roomId` to Cursor type
- Update presence tracking
- Add filtering logic
- Test thoroughly

**Phase 3: Robust Cleanup (Option 3)**
- Add useEffect cleanup
- Prevent edge cases
- Add comprehensive testing

## Testing Checklist

- [ ] Two users on different canvases don't see each other's cursors
- [ ] Two users on same canvas DO see each other's cursors
- [ ] Switching canvases clears old cursors immediately
- [ ] Cursor updates only affect current canvas
- [ ] No memory leaks from old channel subscriptions
- [ ] Works when rapidly switching between canvases
- [ ] Works with 5+ users across 3+ canvases

## Related Issues

- Shape updates ARE properly isolated (they work correctly)
- This is specifically a cursor rendering bug
- May affect online user count display (needs verification)

## Priority

**CRITICAL** - Should be fixed before next demo/presentation where multiple users will use multiple canvases simultaneously.

