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
// TODO: This will be implemented when we fully migrate to the slice architecture

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
