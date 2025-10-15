/**
 * Shapes Management Slice
 * Handles shape CRUD, selection, and history
 */

import type { StateCreator } from 'zustand';
import type { ShapeBase, CreateShapeData, UpdateShapeData, ShapeType } from '../../types';

export interface ShapesSlice {
  // Shape state
  shapes: Record<string, ShapeBase>;
  selectedIds: string[];
  history: Record<string, ShapeBase>[];
  
  // User context
  me: { id: string; name: string; color: string };
  
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
  
  // History management
  pushHistory: () => void;
  undo: () => void;
  
  // Getters
  getSelectedShapes: () => ShapeBase[];
  getShape: (id: string) => ShapeBase | undefined;
  
  // User management
  setUser: (user: { id: string; name: string; color: string }) => void;
}

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
    case 'image':
      return { x: 100, y: 100, w: 200, h: 150 };
    default:
      return { x: 100, y: 100, w: 100, h: 100 };
  }
}

function randomColor() {
  const hues = [200, 260, 320, 20, 140];
  const h = hues[Math.floor(Math.random() * hues.length)];
  return `hsl(${h} 90% 60%)`;
}

export const createShapesSlice: StateCreator<
  ShapesSlice,
  [],
  [],
  ShapesSlice
> = (set, get) => ({
  // Initial state
  shapes: {},
  selectedIds: [],
  history: [],
  me: { id: crypto.randomUUID(), name: "", color: randomColor() },

  // Shape CRUD operations
  upsert: (s) => set((state) => {
    const list = Array.isArray(s) ? s : [s];
    const newShapes = { ...state.shapes };
    
    for (const item of list) {
      newShapes[item.id] = item;
    }
    
    return { 
      shapes: newShapes,
      // Mark as unsaved when shapes are modified
      // (This will be handled by the canvas slice)
    };
  }),

  remove: (ids) => set((state) => {
    const newShapes = { ...state.shapes };
    ids.forEach((id) => delete newShapes[id]);
    
    // Remove from selection if deleted
    const newSelectedIds = state.selectedIds.filter(selectedId => !ids.includes(selectedId));
    
    return {
      shapes: newShapes,
      selectedIds: newSelectedIds
      // Mark as unsaved when shapes are deleted
      // (This will be handled by the canvas slice)
    };
  }),

  clear: () => set((state) => {
    const hadShapes = Object.keys(state.shapes).length > 0;
    
    return {
      shapes: {},
      selectedIds: []
      // Mark as unsaved when canvas is cleared
      // (This will be handled by the canvas slice)
    };
  }),

  // Selection management
  select: (ids) => set({ selectedIds: ids }),

  toggleSelect: (id) => set((state) => {
    const newSelectedIds = state.selectedIds.includes(id)
      ? state.selectedIds.filter(selectedId => selectedId !== id)
      : [...state.selectedIds, id];
    
    return { selectedIds: newSelectedIds };
  }),

  selectAll: () => set((state) => ({
    selectedIds: Object.keys(state.shapes)
  })),

  clearSelection: () => set({ selectedIds: [] }),

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
    
    set((state) => ({
      shapes: { ...state.shapes, [shape.id]: shape }
    }));
    
    return shape;
  },

  updateShape: (id, updates) => set((state) => {
    if (!state.shapes[id]) return state;
    
    const updatedShape = {
      ...state.shapes[id],
      ...updates,
      updated_at: Date.now(),
      updated_by: state.me.id,
    };
    
    return {
      shapes: { ...state.shapes, [id]: updatedShape }
      // Mark as unsaved when shape is updated
      // (This will be handled by the canvas slice)
    };
  }),

  duplicateShapes: (ids) => set((state) => {
    const newShapes = { ...state.shapes };
    const newShapeIds: string[] = [];
    const now = Date.now();
    
    ids.forEach(id => {
      const original = state.shapes[id];
      if (original) {
        const duplicate: ShapeBase = {
          ...original,
          id: crypto.randomUUID(),
          x: original.x + 20,
          y: original.y + 20,
          updated_at: now,
          updated_by: state.me.id,
        };
        newShapes[duplicate.id] = duplicate;
        newShapeIds.push(duplicate.id);
      }
    });
    
    return {
      shapes: newShapes,
      selectedIds: newShapeIds // Select the duplicated shapes
    };
  }),

  // History management
  pushHistory: () => set((state) => {
    // Keep only last 50 states for performance
    let newHistory = [...state.history];
    if (newHistory.length >= 50) {
      newHistory = newHistory.slice(-49);
    }
    newHistory.push({ ...state.shapes });
    
    return { history: newHistory };
  }),

  undo: () => set((state) => {
    if (state.history.length === 0) return state;
    
    const newHistory = [...state.history];
    const previousState = newHistory.pop();
    
    if (!previousState) return state;
    
    return {
      shapes: previousState,
      selectedIds: [], // Clear selection after undo
      history: newHistory
    };
  }),

  // Getters
  getSelectedShapes: () => {
    const { shapes, selectedIds } = get();
    return selectedIds.map(id => shapes[id]).filter(Boolean);
  },

  getShape: (id) => {
    return get().shapes[id];
  },

  // User management
  setUser: (user) => set({ me: user }),
});
