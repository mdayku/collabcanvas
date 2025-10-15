/**
 * Clean Zustand Store - Organized with Slices
 * Combines shape management, canvas management, auto-save, and multiplayer
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { subscribeWithSelector } from "zustand/middleware";

// Slice imports
import { createShapesSlice, type ShapesSlice } from './shapesSlice';
import { createCanvasSlice, type CanvasSlice } from './canvasSlice';
import { createAutoSaveSlice, type AutoSaveSlice } from './autoSaveSlice';
import { createMultiplayerSlice, type MultiplayerSlice } from './multiplayerSlice';

// Combined state type
export type CanvasState = ShapesSlice & CanvasSlice & AutoSaveSlice & MultiplayerSlice;

// Create the combined store
export const useCanvas = create<CanvasState>()(
  subscribeWithSelector(
    immer((...a) => ({
      ...createShapesSlice(...a),
      ...createCanvasSlice(...a), 
      ...createAutoSaveSlice(...a),
      ...createMultiplayerSlice(...a),
    }))
  )
);

// Auto-save integration - Watch for shape changes and mark canvas as unsaved
useCanvas.subscribe(
  (state) => state.shapes,
  (shapes, previousShapes) => {
    const hasChanges = Object.keys(shapes).length !== Object.keys(previousShapes).length ||
      Object.values(shapes).some(shape => {
        const prev = previousShapes[shape.id];
        return !prev || prev.updated_at !== shape.updated_at;
      });
    
    if (hasChanges && useCanvas.getState().currentCanvas) {
      useCanvas.getState().setUnsavedChanges(true);
    }
  }
);

// Canvas-auto-save integration - Connect triggerManualSave to canvas save
const originalCreateCanvasSlice = createCanvasSlice;
const enhancedCreateCanvasSlice = (...args: any[]) => {
  const canvasSlice = originalCreateCanvasSlice(...args);
  
  // Enhance triggerManualSave to use canvas saving
  const originalTriggerManualSave = canvasSlice.saveCurrentCanvas;
  
  return {
    ...canvasSlice,
    // Override the auto-save slice's triggerManualSave to use canvas save
    triggerManualSave: async () => {
      const store = useCanvas.getState();
      
      try {
        store.setSaveStatus('saving', 'Saving...');
        
        // Save current shapes first
        const currentShapes = Object.values(store.shapes);
        if (store.currentCanvas) {
          const { canvasService } = await import('../services/canvasService');
          await canvasService.saveShapesToCanvas(store.currentCanvas.id, currentShapes);
        }
        
        // Then save canvas metadata
        await store.saveCurrentCanvas();
        
        store.setSaveStatus('saved', 'Saved successfully');
        
        // Clear the "saved" status after a few seconds
        setTimeout(() => {
          const currentState = useCanvas.getState();
          if (currentState.saveStatus === 'saved') {
            currentState.setSaveStatus('idle');
          }
        }, 3000);
        
      } catch (error) {
        console.error('Manual save failed:', error);
        store.setSaveStatus('error', error instanceof Error ? error.message : 'Save failed');
        throw error;
      }
    },
  };
};

// Room synchronization - Update roomId when currentCanvas changes
useCanvas.subscribe(
  (state) => state.currentCanvas,
  (currentCanvas) => {
    if (currentCanvas && useCanvas.getState().roomId !== currentCanvas.room_id) {
      useCanvas.getState().setRoom(currentCanvas.room_id);
    }
  }
);

// Export individual slice creators for testing
export { createShapesSlice, createCanvasSlice, createAutoSaveSlice, createMultiplayerSlice };

// Legacy exports for compatibility
export function randomColor() {
  const hues = [200, 260, 320, 20, 140];
  const h = hues[Math.floor(Math.random() * hues.length)];
  return `hsl(${h} 90% 60%)`;
}
