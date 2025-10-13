import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { ShapeBase, CreateShapeData, UpdateShapeData, ShapeType, Cursor } from "../types";

export type CanvasState = {
  shapes: Record<string, ShapeBase>;
  selectedIds: string[];
  roomId: string;
  me: { id: string; name: string; color: string };
  isAuthenticated: boolean;
  history: Record<string, ShapeBase>[];
  cursors: Record<string, Cursor>;
  onlineUsers: string[];
  
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
