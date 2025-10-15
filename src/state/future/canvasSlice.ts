/**
 * Canvas Management Slice
 * Handles canvas loading, saving, and tab management
 */

import type { StateCreator } from 'zustand';
import type { Canvas } from '../../services/canvasService';

export interface CanvasSlice {
  // Canvas state
  currentCanvas: Canvas | null;
  canvasList: Canvas[];
  isCanvasLoading: boolean;
  canvasError: string | null;
  hasUnsavedChanges: boolean;
  
  // Tab management 
  openTabs: Canvas[];
  activeTabId: string | null;
  
  // Canvas actions
  setCurrentCanvas: (canvas: Canvas | null) => void;
  setCanvasList: (canvases: Canvas[]) => void;
  setCanvasLoading: (loading: boolean) => void;
  setCanvasError: (error: string | null) => void;
  setUnsavedChanges: (hasChanges: boolean) => void;
  loadCanvas: (canvasId: string) => Promise<void>;
  createNewCanvas: (title?: string) => Promise<Canvas>;
  saveCurrentCanvas: (title?: string) => Promise<void>;
  duplicateCurrentCanvas: (newTitle?: string) => Promise<Canvas>;
  
  // Tab actions
  openCanvasInTab: (canvas: Canvas) => void;
  closeTab: (canvasId: string) => Promise<boolean>;
  switchToTab: (canvasId: string) => void;
  getActiveTab: () => Canvas | null;
  hasUnsavedTab: (canvasId: string) => boolean;
}

export const createCanvasSlice: StateCreator<
  CanvasSlice,
  [],
  [],
  CanvasSlice
> = (set, get) => ({
  // Initial state
  currentCanvas: null,
  canvasList: [],
  isCanvasLoading: false,
  canvasError: null,
  hasUnsavedChanges: false,
  openTabs: [],
  activeTabId: null,

  // Canvas management
  setCurrentCanvas: (canvas) => set({ 
    currentCanvas: canvas,
    // Auto-update roomId when canvas changes
    ...(canvas && { roomId: canvas.room_id })
  }),
  
  setCanvasList: (canvases) => set({ canvasList: canvases }),
  setCanvasLoading: (loading) => set({ isCanvasLoading: loading }),
  setCanvasError: (error) => set({ canvasError: error }),
  setUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),

  loadCanvas: async (canvasId) => {
    const { canvasService } = await import('../../services/canvasService');
    
    try {
      set({ isCanvasLoading: true, canvasError: null });
      
      const canvas = await canvasService.getCanvas(canvasId);
      if (!canvas) {
        throw new Error('Canvas not found');
      }
      
      const shapes = await canvasService.getCanvasShapes(canvasId);
      
      set({
        currentCanvas: canvas,
        isCanvasLoading: false,
        hasUnsavedChanges: false
      });
      
      // Update shapes in main store
      // (This will be handled by the main store)
      
    } catch (error) {
      set({ 
        canvasError: error instanceof Error ? error.message : 'Failed to load canvas',
        isCanvasLoading: false 
      });
      throw error;
    }
  },

  createNewCanvas: async (title = 'Untitled Canvas') => {
    const { canvasService } = await import('../../services/canvasService');
    
    try {
      set({ isCanvasLoading: true, canvasError: null });
      
      // Get current shapes from main store 
      // (This will need to be handled by the combined store)
      const currentShapes: any[] = []; // Placeholder
      
      const canvas = await canvasService.createCanvas({
        title,
        shapes: currentShapes
      });
      
      set({
        currentCanvas: canvas,
        hasUnsavedChanges: false,
        isCanvasLoading: false
      });
      
      return canvas;
      
    } catch (error) {
      set({ 
        canvasError: error instanceof Error ? error.message : 'Failed to create canvas',
        isCanvasLoading: false 
      });
      throw error;
    }
  },

  saveCurrentCanvas: async (title) => {
    const { canvasService } = await import('../../services/canvasService');
    const { currentCanvas } = get();
    
    if (!currentCanvas) {
      throw new Error('No canvas to save');
    }
    
    try {
      set({ canvasError: null });
      
      const saveData: any = {};
      if (title !== undefined) {
        saveData.title = title;
      }
      
      await canvasService.saveCanvas(currentCanvas.id, saveData);
      
      // Save shapes from main store
      // (This will be handled by the combined store)
      
      if (title) {
        set({ 
          currentCanvas: { ...currentCanvas, title }
        });
      }
      
      set({ hasUnsavedChanges: false });
      
    } catch (error) {
      set({ 
        canvasError: error instanceof Error ? error.message : 'Failed to save canvas'
      });
      throw error;
    }
  },

  duplicateCurrentCanvas: async (newTitle) => {
    const { canvasService } = await import('../../services/canvasService');
    const { currentCanvas } = get();
    
    if (!currentCanvas) {
      throw new Error('No canvas to duplicate');
    }
    
    try {
      set({ isCanvasLoading: true, canvasError: null });
      
      // First save current changes
      await get().saveCurrentCanvas();
      
      const duplicatedCanvas = await canvasService.duplicateCanvas(
        currentCanvas.id, 
        newTitle || `Copy of ${currentCanvas.title}`
      );
      
      set({ isCanvasLoading: false });
      
      return duplicatedCanvas;
      
    } catch (error) {
      set({ 
        canvasError: error instanceof Error ? error.message : 'Failed to duplicate canvas',
        isCanvasLoading: false 
      });
      throw error;
    }
  },

  // Tab management
  openCanvasInTab: (canvas) => set((state) => {
    const existingTabIndex = state.openTabs.findIndex(tab => tab.id === canvas.id);
    
    if (existingTabIndex >= 0) {
      // Tab already open, just switch to it
      return {
        activeTabId: canvas.id,
        currentCanvas: canvas
      };
    } else {
      // Add new tab
      return {
        openTabs: [...state.openTabs, canvas],
        activeTabId: canvas.id,
        currentCanvas: canvas
      };
    }
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
    
    // Remove tab
    set((state) => {
      const newTabs = state.openTabs.filter(tab => tab.id !== canvasId);
      let newActiveTabId = state.activeTabId;
      let newCurrentCanvas = state.currentCanvas;
      
      // If this was the active tab, switch to another tab or clear
      if (state.activeTabId === canvasId) {
        if (newTabs.length > 0) {
          const tabIndex = state.openTabs.findIndex(tab => tab.id === canvasId);
          const newActiveTab = newTabs[Math.max(0, tabIndex - 1)];
          newActiveTabId = newActiveTab.id;
          newCurrentCanvas = newActiveTab;
        } else {
          newActiveTabId = null;
          newCurrentCanvas = null;
        }
      }
      
      return {
        openTabs: newTabs,
        activeTabId: newActiveTabId,
        currentCanvas: newCurrentCanvas,
        hasUnsavedChanges: false
      };
    });
    
    return true;
  },

  switchToTab: (canvasId) => set((state) => {
    const targetTab = state.openTabs.find(tab => tab.id === canvasId);
    if (targetTab) {
      return {
        activeTabId: canvasId,
        currentCanvas: targetTab
      };
    }
    return state;
  }),

  getActiveTab: () => {
    const state = get();
    return state.openTabs.find(tab => tab.id === state.activeTabId) || null;
  },

  hasUnsavedTab: (canvasId) => {
    const state = get();
    return state.activeTabId === canvasId && state.hasUnsavedChanges;
  },
});
