import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ShapeBase, CreateShapeData, UpdateShapeData, ShapeType, Cursor } from "../types";
import type { Canvas } from "../services/canvasService";

export type CanvasState = {
  shapes: Record<string, ShapeBase>;
  selectedIds: string[];
  roomId: string;
  me: { id: string; name: string; color: string };
  isAuthenticated: boolean;
  history: Record<string, ShapeBase>[];
  cursors: Record<string, Cursor>;
  onlineUsers: string[];
  
  // Canvas management
  currentCanvas: Canvas | null;
  canvasList: Canvas[];
  isCanvasLoading: boolean;
  canvasError: string | null;
  hasUnsavedChanges: boolean;
  
  // Tab management (for multi-canvas workflow)
  openTabs: Canvas[];
  activeTabId: string | null;
  
  // Room management
  setRoom: (id: string) => void;
  
  // Authentication
  setAuthenticated: (authenticated: boolean) => void;
  setUser: (user: { id: string; name: string; color: string }) => void;
  
  // Undo functionality
  pushHistory: () => void;
  undo: () => void;
  
  // Multiplayer
  updateCursor: (cursor: Cursor) => void;
  removeCursor: (userId: string) => void;
  setOnlineUsers: (users: string[]) => void;
  
  // Shape CRUD operations
  upsert: (s: ShapeBase | ShapeBase[]) => void;
  remove: (ids: string[]) => void;
  clear: () => void;
  
  // Selection management
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  
  // Shape creation helpers
  createShape: (type: ShapeType, data: Partial<CreateShapeData>) => ShapeBase;
  updateShape: (id: string, updates: UpdateShapeData) => void;
  duplicateShapes: (ids: string[]) => void;
  
  // Canvas management functions
  setCurrentCanvas: (canvas: Canvas | null) => void;
  setCanvasList: (canvases: Canvas[]) => void;
  setCanvasLoading: (loading: boolean) => void;
  setCanvasError: (error: string | null) => void;
  setUnsavedChanges: (hasChanges: boolean) => void;
  loadCanvas: (canvasId: string) => Promise<void>;
  createNewCanvas: (title?: string) => Promise<Canvas>;
  saveCurrentCanvas: (title?: string) => Promise<void>;
  duplicateCurrentCanvas: (newTitle?: string) => Promise<Canvas>;
  
  // Tab management functions
  openCanvasInTab: (canvas: Canvas) => void;
  closeTab: (canvasId: string) => Promise<boolean>; // Returns true if closed, false if cancelled
  switchToTab: (canvasId: string) => void;
  getActiveTab: () => Canvas | null;
  hasUnsavedTab: (canvasId: string) => boolean;
  
  // Getters
  getSelectedShapes: () => ShapeBase[];
  getShape: (id: string) => ShapeBase | undefined;
};

export const useCanvas = create<CanvasState>()(immer((set, get) => ({
  shapes: {},
  selectedIds: [],
  roomId: "room-1",
  me: { id: crypto.randomUUID(), name: "", color: randomColor() },
  isAuthenticated: false,
  history: [],
  cursors: {},
  onlineUsers: [],
  
  // Canvas management state
  currentCanvas: null,
  canvasList: [],
  isCanvasLoading: false,
  canvasError: null,
  hasUnsavedChanges: false,
  
  // Tab management state
  openTabs: [],
  activeTabId: null,
  
  // Room management
  setRoom: (id) => set((s) => { s.roomId = id; }),
  
  // Authentication
  setAuthenticated: (authenticated) => set((s) => { s.isAuthenticated = authenticated; }),
  setUser: (user) => set((s) => { s.me = user; }),
  
  // Multiplayer
  updateCursor: (cursor) => set((s) => { 
    s.cursors[cursor.id] = cursor; 
  }),
  removeCursor: (userId) => set((s) => { 
    delete s.cursors[userId]; 
  }),
  setOnlineUsers: (users) => set((s) => { 
    s.onlineUsers = users; 
  }),
  
  // Undo functionality
  pushHistory: () => set((s) => {
    // Keep only last 50 states for performance
    if (s.history.length >= 50) {
      s.history = s.history.slice(-49);
    }
    s.history.push({ ...s.shapes });
  }),
  
  undo: () => set((s) => {
    if (s.history.length > 0) {
      const previousState = s.history.pop();
      if (previousState) {
        s.shapes = previousState;
        s.selectedIds = []; // Clear selection after undo
      }
    }
  }),
  
  // Shape CRUD operations
  upsert: (s) => set((state) => {
    const list = Array.isArray(s) ? s : [s];
    for (const item of list) state.shapes[item.id] = item;
  }),
  
  remove: (ids) => set((s) => {
    ids.forEach((id) => delete s.shapes[id]);
    // Remove from selection if deleted
    s.selectedIds = s.selectedIds.filter(selectedId => !ids.includes(selectedId));
  }),
  
  clear: () => set((s) => { s.shapes = {}; s.selectedIds = []; }),
  
  // Selection management
  select: (ids) => set((s) => { s.selectedIds = ids; }),
  
  toggleSelect: (id) => set((s) => {
    if (s.selectedIds.includes(id)) {
      s.selectedIds = s.selectedIds.filter(selectedId => selectedId !== id);
    } else {
      s.selectedIds.push(id);
    }
  }),
  
  selectAll: () => set((s) => { 
    s.selectedIds = Object.keys(s.shapes); 
  }),
  
  clearSelection: () => set((s) => { s.selectedIds = []; }),
  
  // Shape creation helpers
  createShape: (type, data) => {
    const now = Date.now();
    const me = get().me;
    
    const defaults = getShapeDefaults(type);
    const shape: ShapeBase = {
      id: crypto.randomUUID(),
      type,
      updated_at: now,
      updated_by: me.id,
      color: me.color,
      ...defaults,
      ...data,
    } as ShapeBase;
    
    set((s) => { s.shapes[shape.id] = shape; });
    return shape;
  },
  
  updateShape: (id, updates) => set((s) => {
    if (s.shapes[id]) {
      Object.assign(s.shapes[id], updates, {
        updated_at: Date.now(),
        updated_by: s.me.id,
      });
    }
  }),
  
  duplicateShapes: (ids) => set((s) => {
    const newShapes: ShapeBase[] = [];
    const now = Date.now();
    
    ids.forEach(id => {
      const original = s.shapes[id];
      if (original) {
        const duplicate: ShapeBase = {
          ...original,
          id: crypto.randomUUID(),
          x: original.x + 20,
          y: original.y + 20,
          updated_at: now,
          updated_by: s.me.id,
        };
        s.shapes[duplicate.id] = duplicate;
        newShapes.push(duplicate);
      }
    });
    
    // Select the duplicated shapes
    s.selectedIds = newShapes.map(shape => shape.id);
  }),
  
  // Getters
  getSelectedShapes: () => {
    const { shapes, selectedIds } = get();
    return selectedIds.map(id => shapes[id]).filter(Boolean);
  },
  
  getShape: (id) => {
    return get().shapes[id];
  },
  
  // Canvas management functions
  setCurrentCanvas: (canvas) => set((s) => { 
    s.currentCanvas = canvas;
    if (canvas) {
      s.roomId = canvas.room_id;
    }
  }),
  
  setCanvasList: (canvases) => set((s) => { s.canvasList = canvases; }),
  setCanvasLoading: (loading) => set((s) => { s.isCanvasLoading = loading; }),
  setCanvasError: (error) => set((s) => { s.canvasError = error; }),
  setUnsavedChanges: (hasChanges) => set((s) => { s.hasUnsavedChanges = hasChanges; }),
  
  loadCanvas: async (canvasId) => {
    const { canvasService } = await import('../services/canvasService');
    
    try {
      set((s) => { 
        s.isCanvasLoading = true; 
        s.canvasError = null; 
      });
      
      // Load canvas metadata
      const canvas = await canvasService.getCanvas(canvasId);
      if (!canvas) {
        throw new Error('Canvas not found');
      }
      
      // Load canvas shapes
      const shapes = await canvasService.getCanvasShapes(canvasId);
      
      set((s) => {
        s.currentCanvas = canvas;
        s.roomId = canvas.room_id;
        s.shapes = {};
        
        // Convert shapes array to shapes object
        shapes.forEach(shape => {
          s.shapes[shape.id] = shape;
        });
        
        s.selectedIds = [];
        s.hasUnsavedChanges = false;
        s.isCanvasLoading = false;
      });
      
    } catch (error) {
      set((s) => { 
        s.canvasError = error instanceof Error ? error.message : 'Failed to load canvas';
        s.isCanvasLoading = false;
      });
      throw error;
    }
  },
  
  createNewCanvas: async (title = 'Untitled Canvas') => {
    const { canvasService } = await import('../services/canvasService');
    
    try {
      set((s) => { 
        s.isCanvasLoading = true; 
        s.canvasError = null; 
      });
      
      // Get current shapes to save to new canvas
      const currentShapes = Object.values(get().shapes);
      
      const canvas = await canvasService.createCanvas({
        title,
        shapes: currentShapes
      });
      
      set((s) => {
        s.currentCanvas = canvas;
        s.roomId = canvas.room_id;
        s.hasUnsavedChanges = false;
        s.isCanvasLoading = false;
        s.history = []; // Clear history for new canvas
      });
      
      return canvas;
      
    } catch (error) {
      set((s) => { 
        s.canvasError = error instanceof Error ? error.message : 'Failed to create canvas';
        s.isCanvasLoading = false;
      });
      throw error;
    }
  },
  
  saveCurrentCanvas: async (title) => {
    const { canvasService } = await import('../services/canvasService');
    const { currentCanvas } = get();
    
    if (!currentCanvas) {
      throw new Error('No canvas to save');
    }
    
    try {
      set((s) => { s.canvasError = null; });
      
      // Save canvas metadata
      const saveData: any = {};
      if (title !== undefined) {
        saveData.title = title;
      }
      
      await canvasService.saveCanvas(currentCanvas.id, saveData);
      
      // Save current shapes
      const currentShapes = Object.values(get().shapes);
      await canvasService.saveShapesToCanvas(currentCanvas.id, currentShapes);
      
      // Update local canvas state
      if (title) {
        set((s) => {
          if (s.currentCanvas) {
            s.currentCanvas.title = title;
          }
        });
      }
      
      set((s) => { s.hasUnsavedChanges = false; });
      
    } catch (error) {
      set((s) => { 
        s.canvasError = error instanceof Error ? error.message : 'Failed to save canvas';
      });
      throw error;
    }
  },
  
  duplicateCurrentCanvas: async (newTitle) => {
    const { canvasService } = await import('../services/canvasService');
    const { currentCanvas } = get();
    
    if (!currentCanvas) {
      throw new Error('No canvas to duplicate');
    }
    
    try {
      set((s) => { 
        s.isCanvasLoading = true; 
        s.canvasError = null; 
      });
      
      // First save current changes
      await get().saveCurrentCanvas();
      
      // Then duplicate the canvas
      const duplicatedCanvas = await canvasService.duplicateCanvas(
        currentCanvas.id, 
        newTitle || `Copy of ${currentCanvas.title}`
      );
      
      set((s) => { s.isCanvasLoading = false; });
      
      return duplicatedCanvas;
      
    } catch (error) {
      set((s) => { 
        s.canvasError = error instanceof Error ? error.message : 'Failed to duplicate canvas';
        s.isCanvasLoading = false;
      });
      throw error;
    }
  },
  
  // Tab management functions
  openCanvasInTab: (canvas) => set((s) => {
    // Check if tab is already open
    const existingTabIndex = s.openTabs.findIndex(tab => tab.id === canvas.id);
    
    if (existingTabIndex >= 0) {
      // Tab already open, just switch to it
      s.activeTabId = canvas.id;
    } else {
      // Add new tab
      s.openTabs.push(canvas);
      s.activeTabId = canvas.id;
    }
    
    // Update current canvas
    s.currentCanvas = canvas;
    s.roomId = canvas.room_id;
  }),
  
  closeTab: async (canvasId) => {
    const state = get();
    const tabToClose = state.openTabs.find(tab => tab.id === canvasId);
    
    if (!tabToClose) {
      return true; // Tab not found, consider it closed
    }
    
    // Check for unsaved changes if this is the active tab
    if (state.activeTabId === canvasId && state.hasUnsavedChanges) {
      const shouldSave = confirm(`"${tabToClose.title}" has unsaved changes. Save before closing?`);
      
      if (shouldSave) {
        try {
          await state.saveCurrentCanvas();
        } catch (error) {
          const forceClose = confirm('Failed to save. Close anyway?');
          if (!forceClose) {
            return false; // User cancelled close
          }
        }
      }
    }
    
    // Remove tab from openTabs
    set((s) => {
      const tabIndex = s.openTabs.findIndex(tab => tab.id === canvasId);
      if (tabIndex >= 0) {
        s.openTabs.splice(tabIndex, 1);
      }
      
      // If this was the active tab, switch to another tab or clear
      if (s.activeTabId === canvasId) {
        if (s.openTabs.length > 0) {
          // Switch to the previous tab or first available
          const newActiveTab = s.openTabs[Math.max(0, tabIndex - 1)];
          s.activeTabId = newActiveTab.id;
          s.currentCanvas = newActiveTab;
          s.roomId = newActiveTab.room_id;
          s.hasUnsavedChanges = false; // Reset for new tab
        } else {
          // No tabs left, clear everything
          s.activeTabId = null;
          s.currentCanvas = null;
          s.roomId = "room-1"; // Default room
          s.shapes = {};
          s.selectedIds = [];
          s.hasUnsavedChanges = false;
        }
      }
    });
    
    // Load shapes for the new active tab if there is one
    if (get().activeTabId && get().activeTabId !== canvasId) {
      try {
        await get().loadCanvas(get().activeTabId!);
      } catch (error) {
        console.error('Failed to load shapes for new active tab:', error);
      }
    }
    
    return true;
  },
  
  switchToTab: (canvasId) => set((s) => {
    const targetTab = s.openTabs.find(tab => tab.id === canvasId);
    if (targetTab) {
      s.activeTabId = canvasId;
      s.currentCanvas = targetTab;
      s.roomId = targetTab.room_id;
      
      // Load the canvas shapes (this will be handled by the UI)
    }
  }),
  
  getActiveTab: () => {
    const state = get();
    return state.openTabs.find(tab => tab.id === state.activeTabId) || null;
  },
  
  hasUnsavedTab: (canvasId) => {
    const state = get();
    return state.activeTabId === canvasId && state.hasUnsavedChanges;
  },
})));

// Helper function to get default properties for each shape type
function getShapeDefaults(type: ShapeType): Partial<ShapeBase> {
  switch (type) {
    case 'rect':
      return { x: 100, y: 100, w: 120, h: 80 };
    case 'circle':
      return { x: 100, y: 100, w: 100, h: 100 };
    case 'text':
      return { 
        x: 100, 
        y: 100, 
        w: 200, 
        h: 40, 
        text: 'Text', 
        fontSize: 16 
      };
    default:
      return { x: 100, y: 100, w: 100, h: 100 };
  }
}

export function randomColor() {
  const hues = [200, 260, 320, 20, 140];
  const h = hues[Math.floor(Math.random()*hues.length)];
  return `hsl(${h} 90% 60%)`;
}
