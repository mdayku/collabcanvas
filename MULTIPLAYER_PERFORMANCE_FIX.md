# ⚡ Multiplayer Performance Optimization Plan

## Current Issues

### 1. **Broadcast Spam During Drag** 🚨 CRITICAL
**Problem**: Every pixel movement during drag triggers a broadcast
```typescript
// Line 2156 - fires on EVERY mousemove during drag!
broadcastUpsert(updatedShape);
```

**Impact**: 
- 60 FPS drag = 60 broadcasts per second per shape
- Network saturated with redundant updates
- Other users see choppy movement
- Supabase rate limits may kick in

### 2. **Transform Broadcasts** 🚨 HIGH
**Problem**: Every resize/rotate change triggers immediate broadcast
```typescript
// Line 2221 - fires during transform
broadcastUpsert(next);
```

### 3. **Verbose Console Logging** ⚠️ MEDIUM
```typescript
console.log('📡 Received shape:upsert broadcast:', payload); // Every update!
```

**Impact**: Console operations are expensive, adds ~5-10ms per log

### 4. **No Cursor Throttling** ⚠️ LOW
Cursor updates use `requestAnimationFrame` but could be further throttled to 30 FPS instead of 60 FPS

---

## 🎯 **Solution: Optimistic UI + Batch Updates**

### Strategy:
1. **Local updates are instant** (no lag for current user)
2. **Broadcast only on dragend/transformend** (final position)
3. **Throttle cursor updates** to 30 FPS (still smooth, half the bandwidth)
4. **Remove verbose logging** in production

### Implementation:

#### **Fix 1: Only broadcast on dragend**
```typescript
// During drag - UPDATE LOCAL ONLY
const onDragMove = (e: any) => {
  const node = e.target;
  const id = node.id();
  
  // ... position calculation ...
  
  // Update local state immediately (instant feedback)
  useCanvas.getState().upsert(updatedShape);
  // ❌ Remove: broadcastUpsert(updatedShape);
};

// On dragend - BROADCAST FINAL POSITION
const onDragEnd = (e: any) => {
  const node = e.target;
  const id = node.id();
  const finalShape = shapes[id];
  
  if (finalShape) {
    broadcastUpsert(finalShape); // ✅ Only broadcast once!
  }
};
```

#### **Fix 2: Only broadcast on transformend**
```typescript
// During transform - local updates only
// On transformend - broadcast final state
const onTransformEnd = (e: any) => {
  const node = transformerRef.current.nodes()[0];
  const id = node.id();
  
  // ... calculate final dimensions ...
  
  useCanvas.getState().upsert(finalShape);
  broadcastUpsert(finalShape); // ✅ Only broadcast final result
};
```

#### **Fix 3: Throttle cursor updates**
```typescript
// Throttle to 30 FPS instead of 60 FPS
let lastCursorUpdate = 0;
const CURSOR_THROTTLE_MS = 33; // ~30 FPS

const handler = (e: MouseEvent) => {
  const now = Date.now();
  if (now - lastCursorUpdate < CURSOR_THROTTLE_MS) {
    return; // Skip this update
  }
  lastCursorUpdate = now;
  
  // ... existing cursor broadcast code ...
};
```

#### **Fix 4: Remove verbose logging**
```typescript
// Only log errors, not every update
channel.on("broadcast", { event: "shape:upsert" }, ({ payload }) => {
  // Remove: console.log('📡 Received shape:upsert broadcast:', payload);
  useCanvas.getState().upsert(payload as ShapeBase | ShapeBase[]);
});
```

---

## 📊 **Expected Performance Gains**

### Before:
- **Drag**: 60 broadcasts/sec = ~3600 broadcasts for 1 minute of dragging
- **Cursor**: 60 updates/sec
- **Console**: 120+ logs/sec (send + receive)
- **Network**: Saturated, choppy for other users

### After:
- **Drag**: 1 broadcast on dragend = ~60 broadcasts for 1 minute of dragging (60x improvement!)
- **Cursor**: 30 updates/sec (2x improvement, still smooth)
- **Console**: ~0 logs/sec in production
- **Network**: Minimal, smooth for everyone

### Result:
- **98% reduction** in drag broadcasts
- **50% reduction** in cursor bandwidth
- **Smooth, responsive** multiplayer experience
- **No perceptible lag** for any user

---

## 🧪 **Testing Plan**

1. Test drag performance - should feel instant locally
2. Test with 2+ users - others should see final positions smoothly
3. Test rapid dragging - no network saturation
4. Test cursor smoothness - should still feel real-time

---

## 🚀 **Implementation Priority**

1. ✅ **HIGH**: Fix drag broadcasts (biggest win)
2. ✅ **HIGH**: Fix transform broadcasts
3. ✅ **MEDIUM**: Remove console logs
4. ✅ **LOW**: Throttle cursors

---

## 📝 **Additional Optimizations (Future)**

- **Batch multiple shape updates** into single broadcast
- **Delta compression** - only send changed properties
- **Predictive interpolation** - smooth cursor movement client-side
- **WebRTC peer-to-peer** for ultra-low latency (advanced)

---

*This optimization follows the same strategy used by Figma, Miro, and other professional collaborative tools.*

