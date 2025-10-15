import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvas } from '../state/store';
import type { ShapeBase } from '../types';

describe('Shape Grouping System', () => {
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

  describe('Group Creation', () => {
    it('groups multiple shapes together', () => {
      // Create test shapes
      const shape1: ShapeBase = {
        id: 'shape-1',
        type: 'rect',
        x: 100, y: 100, w: 50, h: 50,
        color: '#ff0000',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };
      
      const shape2: ShapeBase = {
        id: 'shape-2', 
        type: 'circle',
        x: 200, y: 200, w: 60, h: 60,
        color: '#00ff00',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      // Add shapes to store
      useCanvas.getState().upsert(shape1);
      useCanvas.getState().upsert(shape2);

      // Group the shapes
      const groupId = useCanvas.getState().groupShapes([shape1.id, shape2.id]);

      expect(groupId).toBeTruthy();
      expect(useCanvas.getState().shapes[shape1.id].groupId).toBe(groupId);
      expect(useCanvas.getState().shapes[shape2.id].groupId).toBe(groupId);
    });

    it('does not group single shape', () => {
      const shape: ShapeBase = {
        id: 'shape-1',
        type: 'rect',
        x: 100, y: 100, w: 50, h: 50,
        color: '#ff0000',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(shape);
      const groupId = useCanvas.getState().groupShapes([shape.id]);

      expect(groupId).toBeNull();
      expect(useCanvas.getState().shapes[shape.id].groupId).toBeUndefined();
    });

    it('retrieves shapes in a group', () => {
      const shapes = [
        { id: 'shape-1', type: 'rect' as const, x: 100, y: 100, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'circle' as const, x: 200, y: 200, w: 60, h: 60, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-3', type: 'rect' as const, x: 300, y: 300, w: 40, h: 40, color: '#0000ff', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      // Add shapes
      shapes.forEach(shape => useCanvas.getState().upsert(shape));

      // Group first two shapes
      const groupId = useCanvas.getState().groupShapes(['shape-1', 'shape-2']);
      
      // Get grouped shapes
      const groupShapes = useCanvas.getState().getGroupShapes(groupId!);
      
      expect(groupShapes).toHaveLength(2);
      expect(groupShapes.map(s => s.id).sort()).toEqual(['shape-1', 'shape-2']);
    });
  });

  describe('Group Ungrouping', () => {
    it('ungroups shapes correctly', () => {
      const shapes = [
        { id: 'shape-1', type: 'rect' as const, x: 100, y: 100, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'circle' as const, x: 200, y: 200, w: 60, h: 60, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      shapes.forEach(shape => useCanvas.getState().upsert(shape));
      
      // Group shapes
      const groupId = useCanvas.getState().groupShapes(['shape-1', 'shape-2']);
      expect(groupId).toBeTruthy();

      // Verify grouped
      expect(useCanvas.getState().shapes['shape-1'].groupId).toBe(groupId);
      expect(useCanvas.getState().shapes['shape-2'].groupId).toBe(groupId);

      // Ungroup
      useCanvas.getState().ungroupShapes(groupId!);

      // Verify ungrouped
      expect(useCanvas.getState().shapes['shape-1'].groupId).toBeUndefined();
      expect(useCanvas.getState().shapes['shape-2'].groupId).toBeUndefined();
    });
  });

  describe('Group Status Detection', () => {
    it('correctly identifies grouped shapes', () => {
      const shape: ShapeBase = {
        id: 'shape-1',
        type: 'rect',
        x: 100, y: 100, w: 50, h: 50,
        color: '#ff0000',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(shape);

      // Initially not grouped
      expect(useCanvas.getState().isGrouped(shape.id)).toBe(false);

      // Add another shape and group them
      const shape2: ShapeBase = {
        id: 'shape-2',
        type: 'circle',
        x: 200, y: 200, w: 60, h: 60,
        color: '#00ff00',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      useCanvas.getState().upsert(shape2);
      useCanvas.getState().groupShapes([shape.id, shape2.id]);

      // Now should be grouped
      expect(useCanvas.getState().isGrouped(shape.id)).toBe(true);
      expect(useCanvas.getState().isGrouped(shape2.id)).toBe(true);
    });
  });

  describe('Group Persistence', () => {
    it('maintains groupId when updating shapes', () => {
      const shapes = [
        { id: 'shape-1', type: 'rect' as const, x: 100, y: 100, w: 50, h: 50, color: '#ff0000', updated_at: Date.now(), updated_by: 'test-user' },
        { id: 'shape-2', type: 'circle' as const, x: 200, y: 200, w: 60, h: 60, color: '#00ff00', updated_at: Date.now(), updated_by: 'test-user' },
      ];

      shapes.forEach(shape => useCanvas.getState().upsert(shape));
      const groupId = useCanvas.getState().groupShapes(['shape-1', 'shape-2']);

      // Update a shape's properties
      const updatedShape = {
        ...useCanvas.getState().shapes['shape-1'],
        color: '#ff00ff',
        x: 150,
      };

      useCanvas.getState().upsert(updatedShape);

      // GroupId should still be maintained
      expect(useCanvas.getState().shapes['shape-1'].groupId).toBe(groupId);
      expect(useCanvas.getState().shapes['shape-1'].color).toBe('#ff00ff');
      expect(useCanvas.getState().shapes['shape-1'].x).toBe(150);
    });
  });
});
