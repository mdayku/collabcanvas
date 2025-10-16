# Conflict Resolution Enhancement Prompt for Sonnet

## Context
A critical evaluator (Haiku) reviewed our CollabCanvas project and gave us honest feedback on our grade: **85-89 (A-/B+) instead of the 98+ we initially claimed**. 

One key area for improvement: **Conflict Resolution & State Management** - Currently scoring 5/9 (basic LWW). We need to bump this to 8-9/9 to get closer to 90+.

## Current State
Our conflict resolution uses:
- ✅ **Last-Write-Wins (LWW)** with timestamps (`updated_at`)
- ❌ **Basic implementation** - no sophisticated edge case handling
- ❌ **Limited visual feedback** - users don't see conflicts happening
- ❌ **No operation queuing** - rapid concurrent edits sometimes lose data

## Test Cases That Expose Issues

### **Test 1: Simultaneous Move**
- User A and User B drag the same rectangle simultaneously
- Current behavior: Whoever's change arrives last wins (correct, but user doesn't know why their change was overridden)
- **Need**: Visual feedback showing the conflict resolution

### **Test 2: Rapid Edit Storm**
- User A resizes object while User B changes color while User C moves it
- Current behavior: Last change wins, but intermediate states can flicker
- **Need**: Smooth resolution without visual glitching

### **Test 3: Delete vs Edit**
- User A deletes an object while User B is actively editing it
- Current behavior: Object disappears, but User B's edits are lost
- **Need**: Graceful handling with undo capability

### **Test 4: Create Collision**
- Two users create objects at nearly identical timestamps
- Current behavior: Both created (good), but can cause UI confusion
- **Need**: Clear indication of who created what

## What We Need to Improve

1. **Enhanced Conflict Detection**
   - Detect when two users edit the same object within 500ms
   - Log conflicts for debugging
   - Provide undo capability for overridden changes

2. **Visual Conflict Feedback**
   - Show users when their edit was overridden (brief flash or notification)
   - Indicate which user's change won and why
   - Don't surprise users - make conflicts visible

3. **Operation Queueing** (if time permits)
   - Queue operations during brief network issues
   - Sync on reconnect with proper conflict resolution
   - Test with 30s network latency simulation

4. **Better Delete Handling**
   - Cache deleted objects for recovery
   - Notify users if they try to edit deleted objects
   - Implement soft-delete + cascade properly

5. **Documentation**
   - Document the conflict resolution strategy clearly
   - Add comments explaining LWW choice vs alternatives
   - Show test scenarios in code

## Specific Asks

1. **Analyze** current conflict resolution code in `src/Canvas.tsx` and `src/state/store.ts`
2. **Implement** at least 2 of these improvements:
   - Visual conflict feedback (easiest, high impact)
   - Graceful delete handling (medium difficulty)
   - Operation queuing during network issues (harder)
3. **Test** all 4 test cases above - create reproducible scenarios
4. **Document** findings and implementation choices
5. **Estimate** score improvement - could we hit 8/9 for conflict resolution?

## Success Criteria
- ✅ Test all 4 conflict scenarios and show they resolve correctly
- ✅ Users see visual feedback when conflicts occur
- ✅ Delete vs Edit case doesn't lose user work
- ✅ Code is well-commented explaining LWW strategy
- ✅ Achieve 8-9/9 on conflict resolution rubric (up from current 5/9)

## Bonus Points
- Implement CRDT-style conflict resolution (instead of LWW)
- Add operation replay visualization for debugging
- Create automated conflict simulation test suite

---

**Target**: Push from 85-89 grade to 90+ by addressing this rubric gap.


