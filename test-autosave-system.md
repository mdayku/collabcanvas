# Auto-Save & Recovery System Testing Guide

## 🚀 **What We Just Built**

We've implemented a **comprehensive auto-save and canvas recovery system** with:

### **✨ Key Features:**
1. **⏰ Auto-Save Timer** - Saves every 30 seconds when there are unsaved changes
2. **💾 Manual Save Button** - Instant save with visual feedback  
3. **🔄 Recovery System** - Detects crashes and offers to restore work
4. **📊 Save Status Indicator** - Shows real-time save status
5. **🗂️ Local Backup** - Emergency localStorage backups for crash recovery
6. **⚙️ Settings** - Configurable auto-save interval and backup limits

---

## 🧪 **Testing Plan - Use Your Dev Room!**

### **🚦 Start Testing:**

1. **Open your development room:**
   ```bash
   # Dev server should be running, open this URL:
   http://localhost:5173/?room=dev-autosave-testing
   ```

2. **Sign in and create a canvas to test with**

---

## **Test Case 1: Auto-Save Status Indicator** 

### **🎯 Goal:** Verify the save status indicator works correctly

**Steps:**
1. ✅ **Check top-right corner** - Should see save status indicator
2. ✅ **Create a shape** (draw rectangle) 
   - Status should show "Unsaved changes" with orange dot
3. ✅ **Click the "Save" button** in status indicator
   - Should show "Saving..." with spinner
   - Then "Saved" with green checkmark
4. ✅ **Wait 3 seconds** - Status should return to "All changes saved"

**Expected Results:**
- 🟢 Status indicator appears in top-right
- 🟠 Orange dot when unsaved changes exist
- 🔵 Blue spinner during save
- 🟢 Green checkmark when saved
- ⚪ Neutral state when no changes

---

## **Test Case 2: Auto-Save Timer**

### **🎯 Goal:** Verify automatic saving works

**Steps:**
1. ✅ **Create several shapes** (don't manually save)
2. ✅ **Wait 30 seconds** and watch the status indicator
   - Should automatically show "Saving..." then "Saved"
3. ✅ **Modify a shape** (resize/move it)
4. ✅ **Wait another 30 seconds**
   - Should auto-save again

**Expected Results:**
- 🕐 Auto-save triggers every 30 seconds when changes exist
- 💾 Status indicator reflects auto-save activity
- 🔄 Only saves when there are actual unsaved changes

---

## **Test Case 3: File Menu Integration**

### **🎯 Goal:** Verify File > Save uses new system

**Steps:**
1. ✅ **Create shapes** to make unsaved changes
2. ✅ **Click File > Save** 
   - Should NOT show old alert popup
   - Status indicator should show save feedback
3. ✅ **Check status indicator** 
   - Should show save progress and completion

**Expected Results:**
- 🚫 No more annoying alert popups
- 🎨 Smooth UI feedback through status indicator
- 📂 File menu save uses new auto-save system

---

## **Test Case 4: Recovery System**

### **🎯 Goal:** Test crash recovery (most important!)

**Steps:**
1. ✅ **Create a canvas with several shapes**
2. ✅ **Make changes but DON'T save manually**
3. ✅ **Close the browser tab** (simulates crash)
4. ✅ **Reopen the dev room URL**
   ```bash
   http://localhost:5173/?room=dev-autosave-testing
   ```
5. ✅ **Look for recovery prompt** 
   - Should ask "We found unsaved changes from [Canvas Name]. Recover?"

**Recovery Test Options:**
- ✅ **Click "Yes"** - Should restore your shapes
- ✅ **Click "No"** - Should clear recovery data and start fresh

**Expected Results:**
- 💡 Recovery prompt appears on reload after unsaved work
- 🔄 Clicking "Yes" restores all your shapes
- 🗑️ Clicking "No" cleans up and starts fresh
- 🛡️ No data loss from unexpected closes

---

## **Test Case 5: Settings Configuration**

### **🎯 Goal:** Test auto-save settings (if implemented)**

**Steps:**
1. ✅ **Look for settings gear** in status indicator
2. ✅ **Change auto-save interval** (e.g., from 30s to 15s)
3. ✅ **Test new timing** - make changes and wait
4. ✅ **Disable auto-save** - verify it stops
5. ✅ **Re-enable** - verify it resumes

**Expected Results:**
- ⚙️ Settings accessible and responsive
- ⏱️ Interval changes take effect immediately
- ⏸️ Can disable/enable auto-save
- 💾 Manual save still works when auto-save disabled

---

## **Test Case 6: Multi-Canvas Behavior**

### **🎯 Goal:** Verify auto-save works with multiple canvases

**Steps:**
1. ✅ **Open multiple canvas tabs**
2. ✅ **Make changes in Tab 1** - verify auto-save works
3. ✅ **Switch to Tab 2** - verify separate save status
4. ✅ **Make changes in Tab 2** - verify independent auto-save

**Expected Results:**
- 📑 Each tab has independent save status
- 🔄 Auto-save works per-canvas
- 🎯 Status indicator shows active canvas state

---

## **🐛 Known Issues to Watch For:**

### **Potential Problems:**
1. **⚠️ Auto-save conflicts** - Saving while user is dragging
2. **🔄 Recovery false positives** - Showing recovery when not needed  
3. **💾 Storage quota** - Too many backups filling localStorage
4. **⏰ Timer persistence** - Auto-save continuing after tab close
5. **🔄 Race conditions** - Multiple saves triggering simultaneously

### **Edge Cases:**
- **🚫 No network** - How does auto-save handle offline?
- **🔒 Auth expiry** - Save fails due to expired session
- **💔 Rapid changes** - Dragging shapes rapidly
- **📱 Mobile** - Touch interactions with auto-save

---

## **✅ Success Criteria:**

### **Must Work:**
- ✅ Status indicator shows correct state always
- ✅ Auto-save triggers reliably every 30 seconds  
- ✅ Recovery prompt appears after simulated crash
- ✅ Manual save provides immediate feedback
- ✅ No more annoying alert popups

### **Should Work:**
- ✅ Settings changes take effect immediately
- ✅ Multi-canvas auto-save independence
- ✅ Clean localStorage management
- ✅ Graceful error handling

---

## **🎯 Ready to Test!**

### **Your Mission:**
1. **Follow each test case systematically**
2. **Note any bugs or unexpected behavior** 
3. **Pay special attention to the recovery system**
4. **Test edge cases** (rapid changes, network issues, etc.)
5. **Verify production behavior** by testing on the live site too

### **Development URLs:**
- **Canvas Testing:** `http://localhost:5173/?room=dev-autosave-testing`
- **Recovery Testing:** `http://localhost:5173/?room=dev-crash-recovery`
- **Settings Testing:** `http://localhost:5173/?room=dev-settings-test`

---

**🚀 This is a major UX improvement - no more lost work!**
