import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvas } from '../state/store';
import type { ShapeBase, ShapeType } from '../types';

describe('Shape Consistency Tests', () => {
  beforeEach(() => {
    useCanvas.setState({
      shapes: {},
      selectedIds: [],
      roomId: 'test-room',
      me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
      history: [],
      redoHistory: [],
      cursors: {},
      onlineUsers: [],
    });
  });

  describe('Size Consistency', () => {
    const shapeTypes: ShapeType[] = [
      'rect', 'circle', 'triangle', 'star', 'heart', 'pentagon',
      'hexagon', 'octagon', 'oval', 'trapezoid', 'rhombus', 'parallelogram'
    ];

    shapeTypes.forEach((type) => {
      it(`${type} should have consistent default size`, () => {
        const shape1 = useCanvas.getState().createShape(type, {});
        const shape2 = useCanvas.getState().createShape(type, {});
        
        expect(shape1.w).toBe(shape2.w);
        expect(shape1.h).toBe(shape2.h);
        expect(shape1.w).toBeGreaterThan(0);
        expect(shape1.h).toBeGreaterThan(0);
      });
    });

    it('rect should be 120×80 (horizontal)', () => {
      const rect = useCanvas.getState().createShape('rect', {});
      expect(rect.w).toBe(120);
      expect(rect.h).toBe(80);
    });

    it('circle should be 100×100 (square)', () => {
      const circle = useCanvas.getState().createShape('circle', {});
      expect(circle.w).toBe(100);
      expect(circle.h).toBe(100);
    });

    it('heart should be 90×100 (vertical bias)', () => {
      const heart = useCanvas.getState().createShape('heart', {});
      expect(heart.w).toBe(90);
      expect(heart.h).toBe(100);
    });

    it('oval should be 120×80 (horizontal ellipse)', () => {
      const oval = useCanvas.getState().createShape('oval', {});
      expect(oval.w).toBe(120);
      expect(oval.h).toBe(80);
    });

    it('regular polygons should be 100×100 (square)', () => {
      const regularShapes: ShapeType[] = ['triangle', 'star', 'pentagon', 'hexagon', 'octagon', 'rhombus'];
      
      regularShapes.forEach((type) => {
        const shape = useCanvas.getState().createShape(type, {});
        expect(shape.w).toBe(100);
        expect(shape.h).toBe(100);
      });
    });
  });

  describe('Stroke Width Consistency', () => {
    it('all shapes should have strokeWidth defined', () => {
      const allTypes: ShapeType[] = [
        'rect', 'circle', 'triangle', 'star', 'heart', 'pentagon',
        'hexagon', 'octagon', 'oval', 'trapezoid', 'rhombus', 'parallelogram',
        'text', 'image', 'frame', 'line', 'arrow'
      ];

      allTypes.forEach((type) => {
        const shape = useCanvas.getState().createShape(type, {});
        expect(shape.strokeWidth).toBeDefined();
      });
    });

    it('standard shapes should have strokeWidth=2', () => {
      const standardShapes: ShapeType[] = [
        'rect', 'circle', 'triangle', 'star', 'heart', 'pentagon',
        'hexagon', 'octagon', 'oval', 'trapezoid', 'rhombus', 'parallelogram',
        'image', 'frame'
      ];

      standardShapes.forEach((type) => {
        const shape = useCanvas.getState().createShape(type, {});
        expect(shape.strokeWidth).toBe(2);
      });
    });

    it('lines and arrows should have strokeWidth=3 for visibility', () => {
      const line = useCanvas.getState().createShape('line', {});
      const arrow = useCanvas.getState().createShape('arrow', {});
      
      expect(line.strokeWidth).toBe(3);
      expect(arrow.strokeWidth).toBe(3);
    });

    it('text should have strokeWidth=0 (no stroke)', () => {
      const text = useCanvas.getState().createShape('text', {});
      expect(text.strokeWidth).toBe(0);
    });
  });

  describe('Shape Properties', () => {
    it('all shapes should have required base properties', () => {
      const shape = useCanvas.getState().createShape('rect', {});
      
      expect(shape.id).toBeDefined();
      expect(shape.type).toBe('rect');
      expect(shape.x).toBeDefined();
      expect(shape.y).toBeDefined();
      expect(shape.w).toBeDefined();
      expect(shape.h).toBeDefined();
      expect(shape.updated_at).toBeDefined();
      expect(shape.updated_by).toBeDefined();
    });

    it('text should have text-specific properties', () => {
      const text = useCanvas.getState().createShape('text', {});
      
      expect(text.text).toBeDefined();
      expect(text.fontSize).toBe(16);
      expect(text.fontFamily).toBe('Arial');
      expect(text.textAlign).toBe('left');
      expect(text.color).toBe('#111111'); // Dark text for visibility
    });

    it('line should have line-specific properties', () => {
      const line = useCanvas.getState().createShape('line', {});
      
      expect(line.x2).toBeDefined();
      expect(line.y2).toBeDefined();
      expect(line.stroke).toBe('#111111');
    });

    it('arrow should have arrow-specific properties', () => {
      const arrow = useCanvas.getState().createShape('arrow', {});
      
      expect(arrow.x2).toBeDefined();
      expect(arrow.y2).toBeDefined();
      expect(arrow.arrowHead).toBe('end');
      expect(arrow.stroke).toBe('#111111');
    });

    it('frame should have frame-specific properties', () => {
      const frame = useCanvas.getState().createShape('frame', {});
      
      expect(frame.color).toBe('transparent');
      expect(frame.stroke).toBe('#6c757d');
      expect(frame.strokeWidth).toBe(2);
    });
  });

  describe('Resize Behavior', () => {
    it('shapes should maintain strokeWidth after resize', () => {
      const shape = useCanvas.getState().createShape('rect', {});
      const originalStrokeWidth = shape.strokeWidth;
      
      // Simulate resize
      useCanvas.getState().updateShape(shape.id, { w: 200, h: 150 });
      
      const updatedShape = useCanvas.getState().shapes[shape.id];
      expect(updatedShape.strokeWidth).toBe(originalStrokeWidth);
    });

    it('shapes should allow width and height changes', () => {
      const shape = useCanvas.getState().createShape('rect', {});
      
      useCanvas.getState().updateShape(shape.id, { w: 300, h: 200 });
      
      const updatedShape = useCanvas.getState().shapes[shape.id];
      expect(updatedShape.w).toBe(300);
      expect(updatedShape.h).toBe(200);
    });
  });

  describe('Color Properties', () => {
    it('shapes should accept custom colors', () => {
      const customColor = '#ff5733';
      const shape = useCanvas.getState().createShape('rect', { color: customColor });
      
      expect(shape.color).toBe(customColor);
    });

    it('shapes should accept custom stroke colors', () => {
      const customStroke = '#00ff00';
      const shape = useCanvas.getState().createShape('rect', { stroke: customStroke });
      
      expect(shape.stroke).toBe(customStroke);
    });
  });

  describe('Duplication', () => {
    it('duplicated shapes should have same dimensions as original', () => {
      const original = useCanvas.getState().createShape('rect', {});
      useCanvas.getState().select([original.id]);
      useCanvas.getState().duplicateShapes([original.id]);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(2);
      
      const duplicate = shapes.find(s => s.id !== original.id) as ShapeBase;
      expect(duplicate.w).toBe(original.w);
      expect(duplicate.h).toBe(original.h);
      expect(duplicate.strokeWidth).toBe(original.strokeWidth);
    });
  });

  describe('Special Shape Proportions', () => {
    it('heart should be taller than wide (vertical bias)', () => {
      const heart = useCanvas.getState().createShape('heart', {});
      expect(heart.h).toBeGreaterThan(heart.w);
    });

    it('oval should be wider than tall (horizontal bias)', () => {
      const oval = useCanvas.getState().createShape('oval', {});
      expect(oval.w).toBeGreaterThan(oval.h);
    });

    it('circle should be square (equal width and height)', () => {
      const circle = useCanvas.getState().createShape('circle', {});
      expect(circle.w).toBe(circle.h);
    });

    it('regular polygons should be square', () => {
      const regularShapes: ShapeType[] = ['triangle', 'star', 'pentagon', 'hexagon', 'octagon'];
      
      regularShapes.forEach((type) => {
        const shape = useCanvas.getState().createShape(type, {});
        expect(shape.w).toBe(shape.h);
      });
    });
  });

  describe('Line and Arrow Special Cases', () => {
    it('line should have default length of 120px', () => {
      const line = useCanvas.getState().createShape('line', {});
      const length = Math.abs((line.x2 || 0) - line.x);
      expect(length).toBe(120);
    });

    it('arrow should have default length of 120px', () => {
      const arrow = useCanvas.getState().createShape('arrow', {});
      const length = Math.abs((arrow.x2 || 0) - arrow.x);
      expect(length).toBe(120);
    });

    it('line should be horizontal by default', () => {
      const line = useCanvas.getState().createShape('line', {});
      expect(line.y).toBe(line.y2);
    });

    it('arrow should be horizontal by default', () => {
      const arrow = useCanvas.getState().createShape('arrow', {});
      expect(arrow.y).toBe(arrow.y2);
    });
  });
});

