import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvas } from '../state/store';

describe('Box Select Tool', () => {
  // Note: Each test creates its own shapes, no global reset needed

  describe('Selection Logic', () => {
    it('should select shapes that intersect with box bounds', () => {
      const { result } = renderHook(() => useCanvas());
      
      // Clear any existing shapes
      act(() => {
        const shapeIds = Object.keys(result.current.shapes);
        if (shapeIds.length > 0) {
          result.current.remove(shapeIds);
        }
      });
      
      // Create test shapes
      act(() => {
        result.current.upsert({
          id: 'shape1',
          type: 'rect',
          x: 100,
          y: 100,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 0
        });
        
        result.current.upsert({
          id: 'shape2',
          type: 'rect',
          x: 200,
          y: 200,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 1
        });
        
        result.current.upsert({
          id: 'shape3',
          type: 'rect',
          x: 400,
          y: 400,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 2
        });
      });

      // Simulate box select that covers shape1 and shape2
      const boxMinX = 50;
      const boxMaxX = 230;
      const boxMinY = 50;
      const boxMaxY = 230;

      act(() => {
        const shapes = result.current.shapes;
        const selectedIds: string[] = [];
        
        Object.values(shapes).forEach(shape => {
          const shapeRight = shape.x + shape.w;
          const shapeBottom = shape.y + shape.h;
          
          // Check if shape intersects with box
          const intersects = !(
            shape.x > boxMaxX ||
            shapeRight < boxMinX ||
            shape.y > boxMaxY ||
            shapeBottom < boxMinY
          );
          
          if (intersects) {
            selectedIds.push(shape.id);
          }
        });
        
        result.current.select(selectedIds);
      });

      expect(result.current.selectedIds).toHaveLength(2);
      expect(result.current.selectedIds).toContain('shape1');
      expect(result.current.selectedIds).toContain('shape2');
      expect(result.current.selectedIds).not.toContain('shape3');
    });

    it('should handle empty box selection (no shapes intersect)', () => {
      const { result } = renderHook(() => useCanvas());
      
      // Clear any existing shapes
      act(() => {
        const shapeIds = Object.keys(result.current.shapes);
        if (shapeIds.length > 0) {
          result.current.remove(shapeIds);
        }
      });
      
      // Create test shape
      act(() => {
        result.current.upsert({
          id: 'shape1',
          type: 'rect',
          x: 100,
          y: 100,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 0
        });
      });

      // Simulate box select in empty area
      const boxMinX = 300;
      const boxMaxX = 400;
      const boxMinY = 300;
      const boxMaxY = 400;

      act(() => {
        const shapes = result.current.shapes;
        const selectedIds: string[] = [];
        
        Object.values(shapes).forEach(shape => {
          const shapeRight = shape.x + shape.w;
          const shapeBottom = shape.y + shape.h;
          
          const intersects = !(
            shape.x > boxMaxX ||
            shapeRight < boxMinX ||
            shape.y > boxMaxY ||
            shapeBottom < boxMinY
          );
          
          if (intersects) {
            selectedIds.push(shape.id);
          }
        });
        
        result.current.select(selectedIds);
      });

      expect(result.current.selectedIds).toHaveLength(0);
    });

    it('should select all shapes when box covers entire canvas', () => {
      const { result } = renderHook(() => useCanvas());
      
      // Create multiple shapes
      act(() => {
        for (let i = 0; i < 5; i++) {
          result.current.upsert({
            id: `shape${i}`,
            type: 'rect',
            x: i * 100,
            y: i * 100,
            w: 50,
            h: 50,
            color: '#000',
            created_at: Date.now(),
            updated_at: Date.now(),
            created_by: 'test-user',
            updated_by: 'test-user',
            zIndex: i
          });
        }
      });

      // Simulate large box select
      const boxMinX = -100;
      const boxMaxX = 1000;
      const boxMinY = -100;
      const boxMaxY = 1000;

      act(() => {
        const shapes = result.current.shapes;
        const selectedIds: string[] = [];
        
        Object.values(shapes).forEach(shape => {
          const shapeRight = shape.x + shape.w;
          const shapeBottom = shape.y + shape.h;
          
          const intersects = !(
            shape.x > boxMaxX ||
            shapeRight < boxMinX ||
            shape.y > boxMaxY ||
            shapeBottom < boxMinY
          );
          
          if (intersects) {
            selectedIds.push(shape.id);
          }
        });
        
        result.current.select(selectedIds);
      });

      expect(result.current.selectedIds).toHaveLength(5);
    });

    it('should select shapes with partial intersection', () => {
      const { result } = renderHook(() => useCanvas());
      
      // Create shape at edge of box
      act(() => {
        result.current.upsert({
          id: 'shape1',
          type: 'rect',
          x: 90,
          y: 90,
          w: 50, // extends to 140
          h: 50, // extends to 140
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 0
        });
      });

      // Box that partially overlaps shape (100-130)
      const boxMinX = 100;
      const boxMaxX = 130;
      const boxMinY = 100;
      const boxMaxY = 130;

      act(() => {
        const shapes = result.current.shapes;
        const selectedIds: string[] = [];
        
        Object.values(shapes).forEach(shape => {
          const shapeRight = shape.x + shape.w;
          const shapeBottom = shape.y + shape.h;
          
          const intersects = !(
            shape.x > boxMaxX ||
            shapeRight < boxMinX ||
            shape.y > boxMaxY ||
            shapeBottom < boxMinY
          );
          
          if (intersects) {
            selectedIds.push(shape.id);
          }
        });
        
        result.current.select(selectedIds);
      });

      expect(result.current.selectedIds).toHaveLength(1);
      expect(result.current.selectedIds).toContain('shape1');
    });
  });

  describe('Multi-Select with Shift/Ctrl', () => {
    it('should add to existing selection with Ctrl+Click', () => {
      const { result } = renderHook(() => useCanvas());
      
      // Create shapes
      act(() => {
        result.current.upsert({
          id: 'shape1',
          type: 'rect',
          x: 100,
          y: 100,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 0
        });
        
        result.current.upsert({
          id: 'shape2',
          type: 'rect',
          x: 200,
          y: 200,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 1
        });
      });

      // Select first shape
      act(() => {
        result.current.select(['shape1']);
      });

      expect(result.current.selectedIds).toEqual(['shape1']);

      // Add second shape to selection (simulating Ctrl+Click)
      act(() => {
        const currentSelection = result.current.selectedIds;
        result.current.select([...currentSelection, 'shape2']);
      });

      expect(result.current.selectedIds).toHaveLength(2);
      expect(result.current.selectedIds).toContain('shape1');
      expect(result.current.selectedIds).toContain('shape2');
    });

    it('should remove from selection with Ctrl+Click on already selected shape', () => {
      const { result } = renderHook(() => useCanvas());
      
      // Create and select multiple shapes
      act(() => {
        result.current.upsert({
          id: 'shape1',
          type: 'rect',
          x: 100,
          y: 100,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 0
        });
        
        result.current.upsert({
          id: 'shape2',
          type: 'rect',
          x: 200,
          y: 200,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 1
        });
        
        result.current.select(['shape1', 'shape2']);
      });

      expect(result.current.selectedIds).toHaveLength(2);

      // Remove shape1 from selection (simulating Ctrl+Click on selected)
      act(() => {
        const currentSelection = result.current.selectedIds;
        const newSelection = currentSelection.filter(id => id !== 'shape1');
        result.current.select(newSelection);
      });

      expect(result.current.selectedIds).toHaveLength(1);
      expect(result.current.selectedIds).toContain('shape2');
      expect(result.current.selectedIds).not.toContain('shape1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle shapes with zero dimensions', () => {
      const { result } = renderHook(() => useCanvas());
      
      // Clear any existing shapes
      act(() => {
        const shapeIds = Object.keys(result.current.shapes);
        if (shapeIds.length > 0) {
          result.current.remove(shapeIds);
        }
      });
      
      act(() => {
        result.current.upsert({
          id: 'shape1',
          type: 'line',
          x: 100,
          y: 100,
          w: 0,
          h: 0,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 0
        });
      });

      const boxMinX = 50;
      const boxMaxX = 150;
      const boxMinY = 50;
      const boxMaxY = 150;

      act(() => {
        const shapes = result.current.shapes;
        const selectedIds: string[] = [];
        
        Object.values(shapes).forEach(shape => {
          const shapeRight = shape.x + shape.w;
          const shapeBottom = shape.y + shape.h;
          
          const intersects = !(
            shape.x > boxMaxX ||
            shapeRight < boxMinX ||
            shape.y > boxMaxY ||
            shapeBottom < boxMinY
          );
          
          if (intersects) {
            selectedIds.push(shape.id);
          }
        });
        
        result.current.select(selectedIds);
      });

      expect(result.current.selectedIds).toHaveLength(1);
      expect(result.current.selectedIds).toContain('shape1');
    });

    it('should handle negative coordinates', () => {
      const { result } = renderHook(() => useCanvas());
      
      act(() => {
        result.current.upsert({
          id: 'shape1',
          type: 'rect',
          x: -100,
          y: -100,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 0
        });
      });

      const boxMinX = -150;
      const boxMaxX = -40;
      const boxMinY = -150;
      const boxMaxY = -40;

      act(() => {
        const shapes = result.current.shapes;
        const selectedIds: string[] = [];
        
        Object.values(shapes).forEach(shape => {
          const shapeRight = shape.x + shape.w;
          const shapeBottom = shape.y + shape.h;
          
          const intersects = !(
            shape.x > boxMaxX ||
            shapeRight < boxMinX ||
            shape.y > boxMaxY ||
            shapeBottom < boxMinY
          );
          
          if (intersects) {
            selectedIds.push(shape.id);
          }
        });
        
        result.current.select(selectedIds);
      });

      expect(result.current.selectedIds).toHaveLength(1);
      expect(result.current.selectedIds).toContain('shape1');
    });

    it('should handle box drawn from bottom-right to top-left', () => {
      const { result } = renderHook(() => useCanvas());
      
      // Clear any existing shapes
      act(() => {
        const shapeIds = Object.keys(result.current.shapes);
        if (shapeIds.length > 0) {
          result.current.remove(shapeIds);
        }
      });
      
      act(() => {
        result.current.upsert({
          id: 'shape1',
          type: 'rect',
          x: 100,
          y: 100,
          w: 50,
          h: 50,
          color: '#000',
          created_at: Date.now(),
          updated_at: Date.now(),
          created_by: 'test-user',
          updated_by: 'test-user',
          zIndex: 0
        });
      });

      // Box drawn backwards (start at 200,200, end at 50,50)
      const start = { x: 200, y: 200 };
      const end = { x: 50, y: 50 };
      const boxMinX = Math.min(start.x, end.x);
      const boxMaxX = Math.max(start.x, end.x);
      const boxMinY = Math.min(start.y, end.y);
      const boxMaxY = Math.max(start.y, end.y);

      act(() => {
        const shapes = result.current.shapes;
        const selectedIds: string[] = [];
        
        Object.values(shapes).forEach(shape => {
          const shapeRight = shape.x + shape.w;
          const shapeBottom = shape.y + shape.h;
          
          const intersects = !(
            shape.x > boxMaxX ||
            shapeRight < boxMinX ||
            shape.y > boxMaxY ||
            shapeBottom < boxMinY
          );
          
          if (intersects) {
            selectedIds.push(shape.id);
          }
        });
        
        result.current.select(selectedIds);
      });

      expect(result.current.selectedIds).toHaveLength(1);
      expect(result.current.selectedIds).toContain('shape1');
    });
  });
});

