import { describe, it, expect } from 'vitest';

/**
 * Layer Ordering Tests
 * 
 * Tests the logic that ensures selected shapes are always rendered on top,
 * allowing them to be dragged even when underneath other shapes.
 */

interface ShapeBase {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zIndex?: number;
}

// Replicate the sorting logic from Canvas.tsx
function sortShapesForRendering(shapes: ShapeBase[], selectedIds: string[]): ShapeBase[] {
  return [...shapes].sort((a, b) => {
    const aSelected = selectedIds.includes(a.id);
    const bSelected = selectedIds.includes(b.id);
    
    // Selected shapes always on top
    if (aSelected && !bSelected) return 1;
    if (!aSelected && bSelected) return -1;
    
    // Otherwise sort by zIndex
    return (a.zIndex ?? 0) - (b.zIndex ?? 0);
  });
}

describe('Layer Ordering for Drag Interaction', () => {
  it('should render selected shapes on top of unselected shapes', () => {
    const shapes: ShapeBase[] = [
      { id: 'circle', type: 'circle', x: 100, y: 100, w: 50, h: 50, zIndex: 1 },
      { id: 'rect', type: 'rect', x: 120, y: 120, w: 100, h: 100, zIndex: 2 }, // On top
    ];
    const selectedIds = ['circle']; // Circle is selected but has lower zIndex
    
    const sorted = sortShapesForRendering(shapes, selectedIds);
    
    // Circle should be rendered last (on top) even though it has lower zIndex
    expect(sorted[sorted.length - 1].id).toBe('circle');
    expect(sorted[0].id).toBe('rect');
  });

  it('should maintain zIndex order for unselected shapes', () => {
    const shapes: ShapeBase[] = [
      { id: 'shape1', type: 'rect', x: 0, y: 0, w: 50, h: 50, zIndex: 3 },
      { id: 'shape2', type: 'rect', x: 0, y: 0, w: 50, h: 50, zIndex: 1 },
      { id: 'shape3', type: 'rect', x: 0, y: 0, w: 50, h: 50, zIndex: 2 },
    ];
    const selectedIds: string[] = []; // None selected
    
    const sorted = sortShapesForRendering(shapes, selectedIds);
    
    // Should be sorted by zIndex: 1, 2, 3
    expect(sorted[0].zIndex).toBe(1);
    expect(sorted[1].zIndex).toBe(2);
    expect(sorted[2].zIndex).toBe(3);
  });

  it('should maintain zIndex order among selected shapes', () => {
    const shapes: ShapeBase[] = [
      { id: 'circle1', type: 'circle', x: 0, y: 0, w: 50, h: 50, zIndex: 2 },
      { id: 'circle2', type: 'circle', x: 0, y: 0, w: 50, h: 50, zIndex: 1 },
      { id: 'rect', type: 'rect', x: 0, y: 0, w: 100, h: 100, zIndex: 5 },
    ];
    const selectedIds = ['circle1', 'circle2']; // Both circles selected
    
    const sorted = sortShapesForRendering(shapes, selectedIds);
    
    // Rect should be first (unselected)
    expect(sorted[0].id).toBe('rect');
    
    // Among selected shapes, lower zIndex should come first
    expect(sorted[1].id).toBe('circle2'); // zIndex: 1
    expect(sorted[2].id).toBe('circle1'); // zIndex: 2
  });

  it('should handle grouped shapes where some members are below other shapes', () => {
    const shapes: ShapeBase[] = [
      { id: 'circle1', type: 'circle', x: 100, y: 100, w: 50, h: 50, zIndex: 1 },
      { id: 'circle2', type: 'circle', x: 200, y: 100, w: 50, h: 50, zIndex: 1 },
      { id: 'loginForm', type: 'rect', x: 150, y: 120, w: 300, h: 200, zIndex: 10 }, // Overlaps both circles
    ];
    const selectedIds = ['circle1', 'circle2']; // User selected both circles (grouped)
    
    const sorted = sortShapesForRendering(shapes, selectedIds);
    
    // Login form should be rendered first (bottom)
    expect(sorted[0].id).toBe('loginForm');
    
    // Both circles should be on top (can be dragged)
    expect(sorted[1].id).toBe('circle1');
    expect(sorted[2].id).toBe('circle2');
  });

  it('should handle shapes with no zIndex (default to 0)', () => {
    const shapes: ShapeBase[] = [
      { id: 'shape1', type: 'rect', x: 0, y: 0, w: 50, h: 50 }, // No zIndex
      { id: 'shape2', type: 'rect', x: 0, y: 0, w: 50, h: 50, zIndex: 1 },
      { id: 'shape3', type: 'rect', x: 0, y: 0, w: 50, h: 50 }, // No zIndex
    ];
    const selectedIds = ['shape1']; // First shape selected
    
    const sorted = sortShapesForRendering(shapes, selectedIds);
    
    // shape2 (zIndex: 1) should be first
    // shape3 (no zIndex, unselected) should be second
    // shape1 (no zIndex, selected) should be on top
    expect(sorted[0].id).toBe('shape3');
    expect(sorted[1].id).toBe('shape2');
    expect(sorted[2].id).toBe('shape1');
  });

  it('should handle complex scenario with multiple layers and selections', () => {
    const shapes: ShapeBase[] = [
      { id: 'background', type: 'rect', x: 0, y: 0, w: 500, h: 500, zIndex: 0 },
      { id: 'circle', type: 'circle', x: 100, y: 100, w: 50, h: 50, zIndex: 2 },
      { id: 'star', type: 'star', x: 150, y: 150, w: 50, h: 50, zIndex: 3 },
      { id: 'template', type: 'rect', x: 120, y: 120, w: 200, h: 150, zIndex: 8 },
      { id: 'text', type: 'text', x: 130, y: 130, w: 100, h: 30, zIndex: 9 },
    ];
    const selectedIds = ['circle', 'star']; // User wants to drag circles and stars under the template
    
    const sorted = sortShapesForRendering(shapes, selectedIds);
    
    // Unselected shapes in zIndex order
    expect(sorted[0].id).toBe('background');
    expect(sorted[1].id).toBe('template');
    expect(sorted[2].id).toBe('text');
    
    // Selected shapes on top (in their zIndex order)
    expect(sorted[3].id).toBe('circle');
    expect(sorted[4].id).toBe('star');
  });
});

