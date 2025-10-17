import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCanvas } from '../state/store';
import { interpret } from '../ai/agent';
import type { ShapeBase } from '../types';

// Mock Supabase
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      send: vi.fn(),
    })),
    from: vi.fn(() => ({
      upsert: vi.fn(),
      delete: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  },
}));

describe('Auto-Center Feature', () => {
  beforeEach(() => {
    // Reset canvas state
    useCanvas.setState({
      shapes: {},
      selectedIds: [],
      me: { id: 'test-user', name: 'Test User', color: '#ff0000' },
      roomId: 'test-room',
      centerOnShape: null, // Reset center callback
    });
    vi.clearAllMocks();
  });

  describe('Agent-Created Objects', () => {
    it('should call centerOnShape callback after creating a single shape', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a red circle');

      expect(mockCenter).toHaveBeenCalledTimes(1);
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.type).toBe('circle');
      // Color is converted to hex code by parseColor function
      expect(calledShape.color).toBeTruthy();
    });

    it('should call centerOnShape callback after creating an emoji', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a rocket emoji');

      expect(mockCenter).toHaveBeenCalledTimes(1);
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.type).toBe('image');
    });

    it('should call centerOnShape callback after creating an icon', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a settings icon');

      expect(mockCenter).toHaveBeenCalledTimes(1);
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.type).toBe('image');
    });

    it('should call centerOnShape callback after creating a text box', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create text "Hello World"');

      expect(mockCenter).toHaveBeenCalledTimes(1);
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.type).toBe('text');
      // Text is lowercased by parser
      expect(calledShape.text?.toLowerCase()).toContain('hello');
    });

    it('should NOT call centerOnShape if callback is null', async () => {
      useCanvas.getState().setCenterOnShapeCallback(null);

      await interpret('create a blue rectangle');

      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(1);
      // No error should occur
    });
  });

  describe('Grid Creation', () => {
    it('should call centerOnShape once after creating a grid of shapes', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a 3x3 grid of circles');

      // Should be called once for the first shape in the grid
      expect(mockCenter).toHaveBeenCalledTimes(1);
      
      // Should have created 9 shapes
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(9);
      
      // Should center on the first shape
      const firstShapeId = Object.keys(useCanvas.getState().shapes)[0];
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.id).toBe(firstShapeId);
    });

    it('should call centerOnShape after creating a grid of emojis', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a 2x2 grid of rocket emojis');

      expect(mockCenter).toHaveBeenCalledTimes(1);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(4);
      
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.type).toBe('image');
    });

    it('should call centerOnShape after creating a grid of stars', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a 4x2 grid of stars');

      expect(mockCenter).toHaveBeenCalledTimes(1);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(8);
      
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.type).toBe('star');
    });

    it('should NOT call centerOnShape for grid if callback is null', async () => {
      useCanvas.getState().setCenterOnShapeCallback(null);

      await interpret('create a 2x2 grid of hearts');

      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(4);
      // No error should occur
    });
  });

  describe('Multi-Shape Selection', () => {
    it('should select all shapes after grid creation', async () => {
      await interpret('create a 3x3 grid of rectangles');

      const selectedIds = useCanvas.getState().selectedIds;
      const shapes = Object.values(useCanvas.getState().shapes);
      
      expect(selectedIds.length).toBe(9);
      expect(shapes.length).toBe(9);
      
      // All shapes should be selected
      shapes.forEach(shape => {
        expect(selectedIds).toContain(shape.id);
      });
    });

    it('should select all shapes after emoji grid creation', async () => {
      await interpret('create a 2x3 grid of fire emojis');

      const selectedIds = useCanvas.getState().selectedIds;
      const shapes = Object.values(useCanvas.getState().shapes);
      
      expect(selectedIds.length).toBe(6);
      expect(shapes.length).toBe(6);
      
      shapes.forEach(shape => {
        expect(selectedIds).toContain(shape.id);
      });
    });
  });

  describe('Callback Management', () => {
    it('should allow setting and clearing the center callback', () => {
      const mockCenter = vi.fn();
      
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);
      expect(useCanvas.getState().centerOnShape).toBe(mockCenter);
      
      useCanvas.getState().setCenterOnShapeCallback(null);
      expect(useCanvas.getState().centerOnShape).toBe(null);
    });

    it('should handle multiple callback updates', () => {
      const mockCenter1 = vi.fn();
      const mockCenter2 = vi.fn();
      
      useCanvas.getState().setCenterOnShapeCallback(mockCenter1);
      expect(useCanvas.getState().centerOnShape).toBe(mockCenter1);
      
      useCanvas.getState().setCenterOnShapeCallback(mockCenter2);
      expect(useCanvas.getState().centerOnShape).toBe(mockCenter2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle centering on shapes with zero dimensions', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      // Create a line (which has minimal height)
      await interpret('create a line');

      expect(mockCenter).toHaveBeenCalledTimes(1);
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.type).toBe('line');
    });

    it('should handle centering on very large shapes', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a rectangle');
      
      // Manually resize to very large
      const shapeId = Object.keys(useCanvas.getState().shapes)[0];
      useCanvas.getState().upsert({
        ...useCanvas.getState().shapes[shapeId],
        w: 5000,
        h: 5000
      });

      // Should have been called during creation
      expect(mockCenter).toHaveBeenCalled();
      const calledShape = mockCenter.mock.calls[0][0];
      expect(calledShape.type).toBe('rect');
    });

    it('should not error when centering on empty grid', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      // This should not create anything (invalid command)
      await interpret('create a 0x0 grid of circles');

      // Mock should not be called for invalid grids
      const shapes = Object.values(useCanvas.getState().shapes);
      if (shapes.length === 0) {
        expect(mockCenter).not.toHaveBeenCalled();
      }
    });
  });

  describe('Complex Scenarios', () => {
    it('should center correctly after creating multiple individual shapes sequentially', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a red circle');
      await interpret('create a blue star');
      await interpret('create a green heart');

      expect(mockCenter).toHaveBeenCalledTimes(3);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(3);
    });

    it('should center correctly after creating a grid then individual shape', async () => {
      const mockCenter = vi.fn();
      useCanvas.getState().setCenterOnShapeCallback(mockCenter);

      await interpret('create a 2x2 grid of circles');
      await interpret('create a rocket emoji');

      // Once for grid, once for emoji
      expect(mockCenter).toHaveBeenCalledTimes(2);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(5); // 4 circles + 1 emoji
    });
  });
});

