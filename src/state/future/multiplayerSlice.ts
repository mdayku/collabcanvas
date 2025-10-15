/**
 * Multiplayer Management Slice
 * Handles cursors, room management, and online users
 */

import type { StateCreator } from 'zustand';
import type { Cursor } from '../../types';

export interface MultiplayerSlice {
  // Multiplayer state
  roomId: string;
  cursors: Record<string, Cursor>;
  onlineUsers: string[];
  isAuthenticated: boolean;
  
  // Room management
  setRoom: (id: string) => void;
  
  // Authentication
  setAuthenticated: (authenticated: boolean) => void;
  
  // Cursor management
  updateCursor: (cursor: Cursor) => void;
  removeCursor: (userId: string) => void;
  
  // User management
  setOnlineUsers: (users: string[]) => void;
}

export const createMultiplayerSlice: StateCreator<
  MultiplayerSlice,
  [],
  [],
  MultiplayerSlice
> = (set, get) => ({
  // Initial state
  roomId: "room-1",
  cursors: {},
  onlineUsers: [],
  isAuthenticated: false,

  // Room management
  setRoom: (id) => set({ roomId: id }),

  // Authentication
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

  // Cursor management
  updateCursor: (cursor) => set((state) => ({
    cursors: { ...state.cursors, [cursor.id]: cursor }
  })),

  removeCursor: (userId) => set((state) => {
    const newCursors = { ...state.cursors };
    delete newCursors[userId];
    return { cursors: newCursors };
  }),

  // User management
  setOnlineUsers: (users) => set({ onlineUsers: users }),
});
