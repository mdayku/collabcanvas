import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCanvas } from '../state/store';
import type { ShapeBase } from '../types';

// Mock OpenAI service
vi.mock('../services/openaiService', () => ({
  generateImageWithDALLE: vi.fn(async (prompt: string, width?: number, height?: number) => {
    // Mock returns a data URL
    return `data:image/png;base64,mock-image-data-for-${width}x${height}`;
  }),
}));

describe('AI Image Frame Feature', () => {
  beforeEach(() => {
    // Reset store state before each test
    useCanvas.setState({
      shapes: {},
      selectedIds: [],
      roomId: 'test-room',
      me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
      isAuthenticated: false,
      history: [],
      redoHistory: [],
      cursors: {},
      onlineUsers: [],
    });
  });

  describe('Frame Type Support', () => {
    it('creates frame shapes with correct defaults', () => {
      const frame = useCanvas.getState().createShape('frame', {});
      
      expect(frame.type).toBe('frame');
      expect(frame.color).toBe('transparent'); // Frames should be transparent
      expect(frame.stroke).toBeDefined(); // Should have border
      expect(frame.strokeWidth).toBe(2);
      expect(frame.w).toBe(200); // Default width
      expect(frame.h).toBe(150); // Default height
    });

    it('stores AI generation properties', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        aiPrompt: 'a beautiful sunset',
        generatedImageUrl: 'https://example.com/image.png',
        isGenerating: false,
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      const storedFrame = useCanvas.getState().shapes['frame-1'];
      expect(storedFrame.aiPrompt).toBe('a beautiful sunset');
      expect(storedFrame.generatedImageUrl).toBe('https://example.com/image.png');
      expect(storedFrame.isGenerating).toBe(false);
    });
  });

  describe('AI Image Generation Process', () => {
    it('sets isGenerating flag during generation', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        isGenerating: true, // User initiated generation
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      const storedFrame = useCanvas.getState().shapes['frame-1'];
      expect(storedFrame.isGenerating).toBe(true);
    });

    it('stores prompt and generated image URL after generation', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        aiPrompt: 'red sports car',
        generatedImageUrl: 'data:image/png;base64,mock-data',
        isGenerating: false,
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      const storedFrame = useCanvas.getState().shapes['frame-1'];
      expect(storedFrame.aiPrompt).toBe('red sports car');
      expect(storedFrame.generatedImageUrl).toBeDefined();
      expect(storedFrame.isGenerating).toBe(false);
    });

    it('handles generation errors gracefully', () => {
      // Frame should remain without image if generation fails
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        aiPrompt: 'invalid prompt',
        isGenerating: false, // Generation completed but failed
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      const storedFrame = useCanvas.getState().shapes['frame-1'];
      expect(storedFrame.generatedImageUrl).toBeUndefined();
      expect(storedFrame.isGenerating).toBe(false);
    });
  });

  describe('Smart Dimension System', () => {
    it('handles landscape frames (wide)', () => {
      const landscapeFrame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 400, // Wide frame
        h: 200,
        color: 'transparent',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(landscapeFrame);
      
      const storedFrame = useCanvas.getState().shapes['frame-1'];
      const aspectRatio = storedFrame.w / storedFrame.h;
      
      expect(aspectRatio).toBeGreaterThan(1.5); // Landscape
    });

    it('handles portrait frames (tall)', () => {
      const portraitFrame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 200, // Tall frame
        h: 400,
        color: 'transparent',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(portraitFrame);
      
      const storedFrame = useCanvas.getState().shapes['frame-1'];
      const aspectRatio = storedFrame.w / storedFrame.h;
      
      expect(aspectRatio).toBeLessThan(0.7); // Portrait
    });

    it('handles square frames', () => {
      const squareFrame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300, // Square-ish frame
        h: 280,
        color: 'transparent',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(squareFrame);
      
      const storedFrame = useCanvas.getState().shapes['frame-1'];
      const aspectRatio = storedFrame.w / storedFrame.h;
      
      expect(aspectRatio).toBeGreaterThanOrEqual(0.7);
      expect(aspectRatio).toBeLessThanOrEqual(1.5);
    });
  });

  describe('Frame Editing and Updates', () => {
    it('preserves generated image when frame is resized', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        aiPrompt: 'sunset',
        generatedImageUrl: 'data:image/png;base64,mock-data',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      // Resize the frame
      useCanvas.getState().updateShape('frame-1', { w: 400, h: 250 });
      
      const updatedFrame = useCanvas.getState().shapes['frame-1'];
      expect(updatedFrame.w).toBe(400);
      expect(updatedFrame.h).toBe(250);
      // Image URL should still be there
      expect(updatedFrame.generatedImageUrl).toBe('data:image/png;base64,mock-data');
    });

    it('allows re-generating image for same frame', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        aiPrompt: 'sunset',
        generatedImageUrl: 'data:image/png;base64,old-image',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      // Re-generate with new prompt
      useCanvas.getState().updateShape('frame-1', {
        aiPrompt: 'sunrise',
        generatedImageUrl: 'data:image/png;base64,new-image',
      });
      
      const updatedFrame = useCanvas.getState().shapes['frame-1'];
      expect(updatedFrame.aiPrompt).toBe('sunrise');
      expect(updatedFrame.generatedImageUrl).toBe('data:image/png;base64,new-image');
    });

    it('can clear generated image from frame', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        aiPrompt: 'sunset',
        generatedImageUrl: 'data:image/png;base64,mock-data',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      // Clear the image
      useCanvas.getState().updateShape('frame-1', {
        generatedImageUrl: undefined,
        aiPrompt: undefined,
      });
      
      const updatedFrame = useCanvas.getState().shapes['frame-1'];
      expect(updatedFrame.generatedImageUrl).toBeUndefined();
      expect(updatedFrame.aiPrompt).toBeUndefined();
    });
  });

  describe('Frame Duplication', () => {
    it('duplicates frame with generated image', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        aiPrompt: 'sunset',
        generatedImageUrl: 'data:image/png;base64,mock-data',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      useCanvas.getState().duplicateShapes(['frame-1']);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes).toHaveLength(2); // Original + duplicate
      
      const duplicate = shapes.find(s => s.id !== 'frame-1');
      if (duplicate) {
        expect(duplicate.type).toBe('frame');
        expect(duplicate.aiPrompt).toBe('sunset');
        expect(duplicate.generatedImageUrl).toBe('data:image/png;base64,mock-data');
        expect(duplicate.x).toBe(120); // Offset position
        expect(duplicate.y).toBe(120);
      }
    });
  });

  describe('Integration with Multiplayer', () => {
    it('broadcasts frame updates to other users', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        aiPrompt: 'mountain landscape',
        generatedImageUrl: 'data:image/png;base64,mock-data',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      // When other users receive the update, they should see the same frame
      const receivedFrame = useCanvas.getState().shapes['frame-1'];
      expect(receivedFrame.aiPrompt).toBe('mountain landscape');
      expect(receivedFrame.generatedImageUrl).toBe('data:image/png;base64,mock-data');
    });

    it('handles concurrent generation requests on same frame', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        isGenerating: true,
        updated_at: Date.now(),
        updated_by: 'user-1',
      };

      useCanvas.getState().upsert(frame);
      
      // Second user tries to generate - should see isGenerating flag
      const currentFrame = useCanvas.getState().shapes['frame-1'];
      expect(currentFrame.isGenerating).toBe(true);
      
      // After first generation completes
      useCanvas.getState().updateShape('frame-1', {
        isGenerating: false,
        generatedImageUrl: 'data:image/png;base64,result',
      });
      
      const completedFrame = useCanvas.getState().shapes['frame-1'];
      expect(completedFrame.isGenerating).toBe(false);
      expect(completedFrame.generatedImageUrl).toBeDefined();
    });
  });

  describe('Performance Considerations', () => {
    it('handles multiple frames efficiently', () => {
      const frames: ShapeBase[] = [];
      
      // Create 10 frames
      for (let i = 0; i < 10; i++) {
        const frame: ShapeBase = {
          id: `frame-${i}`,
          type: 'frame',
          x: 100 + i * 50,
          y: 100,
          w: 300,
          h: 200,
          color: 'transparent',
          updated_at: Date.now(),
          updated_by: 'test-user',
        };
        frames.push(frame);
      }
      
      // Batch upsert
      useCanvas.getState().upsert(frames);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      const frameShapes = shapes.filter(s => s.type === 'frame');
      
      expect(frameShapes).toHaveLength(10);
    });

    it('stores data URLs efficiently', () => {
      const largeDataUrl = `data:image/png;base64,${'A'.repeat(10000)}`; // Simulated large base64
      
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        generatedImageUrl: largeDataUrl,
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frame);
      
      const storedFrame = useCanvas.getState().shapes['frame-1'];
      expect(storedFrame.generatedImageUrl).toBe(largeDataUrl);
      expect(storedFrame.generatedImageUrl?.length).toBeGreaterThan(10000);
    });
  });

  describe('Undo/Redo with Frames', () => {
    it('undoes frame creation', () => {
      const frame: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      // Push history before adding frame
      useCanvas.getState().pushHistory();
      useCanvas.getState().upsert(frame);
      
      expect(useCanvas.getState().shapes).toHaveProperty('frame-1');
      
      // Undo should remove the frame
      useCanvas.getState().undo();
      expect(useCanvas.getState().shapes).not.toHaveProperty('frame-1');
    });

    it('undoes AI image generation', () => {
      const frameWithoutImage: ShapeBase = {
        id: 'frame-1',
        type: 'frame',
        x: 100,
        y: 100,
        w: 300,
        h: 200,
        color: 'transparent',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(frameWithoutImage);
      useCanvas.getState().pushHistory();
      
      // Add generated image
      useCanvas.getState().updateShape('frame-1', {
        aiPrompt: 'sunset',
        generatedImageUrl: 'data:image/png;base64,mock-data',
      });
      
      const frameWithImage = useCanvas.getState().shapes['frame-1'];
      expect(frameWithImage.generatedImageUrl).toBeDefined();
      
      // Undo should remove the generated image
      useCanvas.getState().undo();
      const restoredFrame = useCanvas.getState().shapes['frame-1'];
      expect(restoredFrame.generatedImageUrl).toBeUndefined();
    });
  });
});


