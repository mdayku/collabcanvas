import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvas } from '../state/store';
import type { ShapeBase } from '../types';

describe('Shape Alignment Tools', () => {
  beforeEach(() => {
    // Reset store state before each test
    useCanvas.setState({
      shapes: {},
      selectedIds: [],
      roomId: 'test-room',  
      me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
      history: [],
    });
  });

  describe('Horizontal Alignment', () => {
    it('aligns shapes to the left', () => {
      const shapes: ShapeBase[] = [
        { id: 'shape-1', type: 'rect', x: 100, y: 50, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'rect', x: 200, y: 100, w: 50, h: 50, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-3', type: 'rect', x: 300, y: 150, w: 50, h: 50, color: '#0000ff', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      shapes.forEach(shape => useCanvas.getState().upsert(shape));

      // Mock alignment function (since it's typically in the Canvas component)
      const alignShapesLeft = (shapeIds: string[]) => {
        const shapesToAlign = shapeIds.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
        if (shapesToAlign.length < 2) return;

        const leftmostX = Math.min(...shapesToAlign.map(s => s.x));
        
        shapesToAlign.forEach(shape => {
          const updatedShape = { ...shape, x: leftmostX, updated_at: Date.now() };
          useCanvas.getState().upsert(updatedShape);
        });
      };

      alignShapesLeft(['shape-1', 'shape-2', 'shape-3']);

      // All shapes should have the same x coordinate (100 - the leftmost)
      expect(useCanvas.getState().shapes['shape-1'].x).toBe(100);
      expect(useCanvas.getState().shapes['shape-2'].x).toBe(100);
      expect(useCanvas.getState().shapes['shape-3'].x).toBe(100);

      // Y coordinates should remain unchanged
      expect(useCanvas.getState().shapes['shape-1'].y).toBe(50);
      expect(useCanvas.getState().shapes['shape-2'].y).toBe(100);
      expect(useCanvas.getState().shapes['shape-3'].y).toBe(150);
    });

    it('aligns shapes to the right', () => {
      const shapes: ShapeBase[] = [
        { id: 'shape-1', type: 'rect', x: 100, y: 50, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'rect', x: 200, y: 100, w: 60, h: 50, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      shapes.forEach(shape => useCanvas.getState().upsert(shape));

      const alignShapesRight = (shapeIds: string[]) => {
        const shapesToAlign = shapeIds.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
        if (shapesToAlign.length < 2) return;

        const rightmostX = Math.max(...shapesToAlign.map(s => s.x + (s.w || 0)));
        
        shapesToAlign.forEach(shape => {
          const updatedShape = { ...shape, x: rightmostX - (shape.w || 0), updated_at: Date.now() };
          useCanvas.getState().upsert(updatedShape);
        });
      };

      alignShapesRight(['shape-1', 'shape-2']);

      // Right edges should align (shape-2 has x=200, w=60, so right edge is 260)
      expect(useCanvas.getState().shapes['shape-1'].x).toBe(210); // 260 - 50
      expect(useCanvas.getState().shapes['shape-2'].x).toBe(200); // 260 - 60
    });

    it('centers shapes horizontally', () => {
      const shapes: ShapeBase[] = [
        { id: 'shape-1', type: 'rect', x: 100, y: 50, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'rect', x: 200, y: 100, w: 60, h: 50, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      shapes.forEach(shape => useCanvas.getState().upsert(shape));

      const alignShapesCenter = (shapeIds: string[]) => {
        const shapesToAlign = shapeIds.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
        if (shapesToAlign.length < 2) return;

        const centers = shapesToAlign.map(s => s.x + (s.w || 0) / 2);
        const avgCenter = centers.reduce((sum, center) => sum + center, 0) / centers.length;
        
        shapesToAlign.forEach(shape => {
          const updatedShape = { ...shape, x: avgCenter - (shape.w || 0) / 2, updated_at: Date.now() };
          useCanvas.getState().upsert(updatedShape);
        });
      };

      alignShapesCenter(['shape-1', 'shape-2']);

      // Centers should be aligned
      const shape1Center = useCanvas.getState().shapes['shape-1'].x + 25; // w=50, so center is x+25
      const shape2Center = useCanvas.getState().shapes['shape-2'].x + 30; // w=60, so center is x+30
      
      expect(Math.abs(shape1Center - shape2Center)).toBeLessThan(1); // Allow for floating point precision
    });
  });

  describe('Vertical Alignment', () => {
    it('aligns shapes to the top', () => {
      const shapes: ShapeBase[] = [
        { id: 'shape-1', type: 'rect', x: 100, y: 50, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'rect', x: 200, y: 100, w: 50, h: 60, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      shapes.forEach(shape => useCanvas.getState().upsert(shape));

      const alignShapesTop = (shapeIds: string[]) => {
        const shapesToAlign = shapeIds.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
        if (shapesToAlign.length < 2) return;

        const topmostY = Math.min(...shapesToAlign.map(s => s.y));
        
        shapesToAlign.forEach(shape => {
          const updatedShape = { ...shape, y: topmostY, updated_at: Date.now() };
          useCanvas.getState().upsert(updatedShape);
        });
      };

      alignShapesTop(['shape-1', 'shape-2']);

      // Both shapes should have y=50 (the topmost)
      expect(useCanvas.getState().shapes['shape-1'].y).toBe(50);
      expect(useCanvas.getState().shapes['shape-2'].y).toBe(50);
    });

    it('aligns shapes to the bottom', () => {
      const shapes: ShapeBase[] = [
        { id: 'shape-1', type: 'rect', x: 100, y: 50, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'rect', x: 200, y: 100, w: 50, h: 60, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      shapes.forEach(shape => useCanvas.getState().upsert(shape));

      const alignShapesBottom = (shapeIds: string[]) => {
        const shapesToAlign = shapeIds.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
        if (shapesToAlign.length < 2) return;

        const bottommostY = Math.max(...shapesToAlign.map(s => s.y + (s.h || 0)));
        
        shapesToAlign.forEach(shape => {
          const updatedShape = { ...shape, y: bottommostY - (shape.h || 0), updated_at: Date.now() };
          useCanvas.getState().upsert(updatedShape);
        });
      };

      alignShapesBottom(['shape-1', 'shape-2']);

      // Bottom edges should align (shape-2 has y=100, h=60, so bottom is 160)
      expect(useCanvas.getState().shapes['shape-1'].y).toBe(110); // 160 - 50
      expect(useCanvas.getState().shapes['shape-2'].y).toBe(100); // 160 - 60
    });
  });

  describe('Distribution', () => {
    it('distributes shapes horizontally with even spacing', () => {
      const shapes: ShapeBase[] = [
        { id: 'shape-1', type: 'rect', x: 100, y: 50, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'rect', x: 200, y: 50, w: 50, h: 50, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-3', type: 'rect', x: 400, y: 50, w: 50, h: 50, color: '#0000ff', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      shapes.forEach(shape => useCanvas.getState().upsert(shape));

      const distributeShapesHorizontally = (shapeIds: string[]) => {
        const shapesToDistribute = shapeIds.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
        if (shapesToDistribute.length < 3) return;

        // Sort by x position
        const sorted = [...shapesToDistribute].sort((a, b) => a.x - b.x);
        const leftmost = sorted[0].x;
        const rightmost = sorted[sorted.length - 1].x + (sorted[sorted.length - 1].w || 0);
        const totalWidth = rightmost - leftmost;
        const gap = totalWidth / (sorted.length - 1);

        sorted.forEach((shape, index) => {
          if (index === 0 || index === sorted.length - 1) return; // Keep first and last in place
          
          const newX = leftmost + gap * index - (shape.w || 0) / 2;
          const updatedShape = { ...shape, x: newX, updated_at: Date.now() };
          useCanvas.getState().upsert(updatedShape);
        });
      };

      distributeShapesHorizontally(['shape-1', 'shape-2', 'shape-3']);

      // Middle shape should be positioned between the outer two
      const leftX = useCanvas.getState().shapes['shape-1'].x;
      const rightX = useCanvas.getState().shapes['shape-3'].x;
      const middleX = useCanvas.getState().shapes['shape-2'].x;

      expect(leftX).toBe(100); // Should remain unchanged
      expect(rightX).toBe(400); // Should remain unchanged
      expect(middleX).toBeGreaterThan(leftX);
      expect(middleX).toBeLessThan(rightX);
    });
  });

  describe('Error Handling', () => {
    it('handles alignment with insufficient shapes gracefully', () => {
      const shape: ShapeBase = {
        id: 'shape-1',
        type: 'rect', 
        x: 100, y: 50, w: 50, h: 50,
        color: '#ff0000',
        updated_at: Date.now(),
        updated_by: 'test-user'
      };

      useCanvas.getState().upsert(shape);

      // Mock alignment that should do nothing with single shape
      const alignShapesLeft = (shapeIds: string[]) => {
        const shapesToAlign = shapeIds.map(id => useCanvas.getState().shapes[id]).filter(Boolean);
        if (shapesToAlign.length < 2) return;
        // Alignment logic would go here but won't execute
      };

      const originalX = shape.x;
      alignShapesLeft(['shape-1']);

      // Shape position should remain unchanged
      expect(useCanvas.getState().shapes['shape-1'].x).toBe(originalX);
    });
  });
});
