# Local Development Guide: Safe Canvas Testing

## Executive Summary

Since Docker Desktop is not available for full local Supabase setup, this guide provides a **safe local development strategy** for testing canvas features without risking production data or requiring complex local database setup.

## 🚀 Recommended Approach: Development Room Strategy

### **Strategy 1: URL-Based Development Rooms (Recommended)**

Use the existing `?room=` URL parameter system for isolated development testing:

```bash
# Development URLs (Safe - Isolated from production users)
http://localhost:5173/?room=dev-marcus-canvas-testing
http://localhost:5173/?room=dev-feature-autosave
http://localhost:5173/?room=dev-multicanvas-testing
```

**Benefits:**
- ✅ **No database migration needed** - uses existing production DB safely
- ✅ **Complete isolation** - your dev work won't interfere with production usage
- ✅ **Real environment testing** - same DB structure as production
- ✅ **Immediate feedback** - no setup time, start testing immediately

### **How to Use Development Rooms:**

1. **Start your dev server:**
```bash
npm run dev
```

2. **Create isolated development rooms:**
```bash
# For canvas feature testing
http://localhost:5173/?room=dev-canvas-features

# For auto-save testing  
http://localhost:5173/?room=dev-autosave-testing

# For multi-canvas testing
http://localhost:5173/?room=dev-multicanvas-work
```

3. **Test canvas operations safely:**
- Create/save/load canvases in your dev room
- Test the robust error handling you built
- Verify canvas creation, duplication, export
- Test with multiple tabs and concurrent users

## 🛠️ Development Workflow

### **Daily Development Process:**

```bash
# 1. Start development
npm run dev

# 2. Open your isolated development room
# Browser: http://localhost:5173/?room=dev-[your-name]-[feature]

# 3. Test canvas operations:
#    - New Canvas creation
#    - Save/Load operations  
#    - Multi-canvas tabs
#    - Export functionality
#    - Error handling

# 4. Run tests to verify no regressions
npm run test

# 5. When satisfied, push to production
git add .
git commit -m "feat: canvas improvements with local testing"
git push origin main
```

### **Canvas Testing Checklist:**

#### ✅ **Basic Canvas Operations**
- [ ] Create new canvas (`File > New`)
- [ ] Save canvas (`File > Save`) 
- [ ] Load existing canvas (`File > Open`)
- [ ] Duplicate canvas (`File > Duplicate`)
- [ ] Export as PNG/PDF (`File > Export`)

#### ✅ **Multi-Canvas Testing**
- [ ] Open multiple tabs (+ button)
- [ ] Switch between canvases
- [ ] Close tabs with confirmation
- [ ] Unsaved changes warnings

#### ✅ **Error Handling**
- [ ] Network interruption during save
- [ ] Invalid canvas operations
- [ ] Concurrent user editing
- [ ] Browser refresh with unsaved changes

#### ✅ **Performance Testing**
- [ ] Large canvas with 100+ shapes
- [ ] Rapid create/save operations
- [ ] Multiple concurrent users in room

## 🔧 Advanced: Optional Local Database Setup

**If you want a true local database** (requires Docker Desktop):

### **Prerequisites:**
```bash
# Install Docker Desktop from: https://docs.docker.com/desktop/
# After installation, start Docker Desktop
```

### **Local Supabase Setup:**
```bash
# Initialize Supabase (already done)
npx supabase init

# Start local services (requires Docker)
npx supabase start

# Apply migrations
npx supabase db reset
```

### **Run Migrations:**
```bash
# Apply base schema
npx supabase db reset --db-url postgresql://postgres:postgres@localhost:5432/postgres < supabase-safe.sql

# Apply canvas migration
npx supabase db reset --db-url postgresql://postgres:postgres@localhost:5432/postgres < supabase-migration-canvases-safe.sql
```

### **Update Environment for Local:**
```bash
# Create .env.local (UTF-8 encoding!)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GROQ_API_KEY=your_actual_groq_key
VITE_OPENAI_API_KEY=your_actual_openai_key
```

## 🚨 Safety Guidelines

### **DO:**
- ✅ Use `?room=dev-*` URLs for all development work
- ✅ Test canvas operations in isolated rooms
- ✅ Run `npm run test` before pushing to production
- ✅ Use descriptive room names: `dev-marcus-autosave-testing`

### **DON'T:**
- ❌ Test in production rooms without `dev-` prefix
- ❌ Use room names that production users might guess
- ❌ Skip testing before pushing canvas-related changes
- ❌ Test with real user accounts in production

## 📊 Current Database Status

**Production Database Already Has:**
- ✅ **`canvases` table** - Multi-canvas support active
- ✅ **Enhanced `shapes` table** - All new shape types, styling
- ✅ **Canvas functions** - `create_new_canvas`, `duplicate_canvas`
- ✅ **Proper RLS policies** - Row Level Security configured
- ✅ **Canvas creation fallbacks** - Robust error handling implemented

**You can immediately test:**
- Canvas creation, saving, loading
- Multi-canvas tabs and file operations
- Shape creation in canvas context
- Export functionality (PNG/PDF)
- Error handling and recovery

## 🎯 Testing Recommendations

### **High-Priority Testing Areas:**

1. **Canvas Creation Flow:**
   - Test the enhanced error handling you implemented
   - Verify retry logic works under poor network conditions
   - Check fallback canvas construction

2. **Multi-Canvas State Management:**
   - Open 5+ canvas tabs
   - Switch rapidly between them
   - Close tabs with unsaved changes

3. **Real-time Collaboration:**
   - Open same dev room in multiple browser windows
   - Test simultaneous editing
   - Verify cursor synchronization

4. **Performance Under Load:**
   - Create canvas with 200+ shapes
   - Test save/load performance
   - Monitor browser memory usage

## 🚀 Ready to Start!

**Your development environment is ready!** 

1. **Run:** `npm run dev`
2. **Open:** `http://localhost:5173/?room=dev-testing-canvas-work`
3. **Test:** All canvas operations safely
4. **Verify:** `npm run test` passes
5. **Deploy:** `git push origin main`

The production database already has all the canvas migration applied, so you can immediately start testing the full canvas workflow in your isolated development room.

---

**Need help?** The canvas creation system you built has extensive logging. Check the browser console for detailed debugging information during testing.
