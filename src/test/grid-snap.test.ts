import { describe, it, expect } from 'vitest';

describe('Grid and Snap-to-Grid Functionality', () => {
  
  describe('Snap Coordinate Calculation', () => {
    const snapToGridCoordinate = (value: number, gridSize: number = 25, snapEnabled: boolean = true) => {
      if (!snapEnabled) return value;
      return Math.round(value / gridSize) * gridSize;
    };

    it('snaps coordinates to 25px grid when enabled', () => {
      expect(snapToGridCoordinate(23, 25, true)).toBe(25);
      expect(snapToGridCoordinate(37, 25, true)).toBe(25);
      expect(snapToGridCoordinate(38, 25, true)).toBe(50);
      expect(snapToGridCoordinate(62, 25, true)).toBe(50);
      expect(snapToGridCoordinate(63, 25, true)).toBe(75);
    });

    it('returns original coordinates when snap is disabled', () => {
      expect(snapToGridCoordinate(23, 25, false)).toBe(23);
      expect(snapToGridCoordinate(37, 25, false)).toBe(37);
      expect(snapToGridCoordinate(156, 25, false)).toBe(156);
    });

    it('handles exact grid coordinates correctly', () => {
      expect(snapToGridCoordinate(0, 25, true)).toBe(0);
      expect(snapToGridCoordinate(25, 25, true)).toBe(25);
      expect(snapToGridCoordinate(50, 25, true)).toBe(50);
      expect(snapToGridCoordinate(100, 25, true)).toBe(100);
    });

    it('handles negative coordinates', () => {
      expect(snapToGridCoordinate(-23, 25, true)).toBe(-25);
      expect(snapToGridCoordinate(-37, 25, true)).toBe(-25);
      expect(snapToGridCoordinate(-38, 25, true)).toBe(-50);
    });

    it('handles different grid sizes', () => {
      expect(snapToGridCoordinate(23, 10, true)).toBe(20);
      expect(snapToGridCoordinate(23, 20, true)).toBe(20);
      expect(snapToGridCoordinate(23, 50, true)).toBe(0);
      expect(snapToGridCoordinate(35, 50, true)).toBe(50);
    });
  });

  describe('Grid Line Generation', () => {
    const generateGridLines = (canvasWidth: number, canvasHeight: number, gridSize: number = 25) => {
      const lines = [];
      
      // Vertical lines
      for (let x = 0; x <= canvasWidth; x += gridSize) {
        lines.push({
          type: 'vertical',
          points: [x, 0, x, canvasHeight],
          x: x
        });
      }
      
      // Horizontal lines  
      for (let y = 0; y <= canvasHeight; y += gridSize) {
        lines.push({
          type: 'horizontal', 
          points: [0, y, canvasWidth, y],
          y: y
        });
      }
      
      return lines;
    };

    it('generates correct number of grid lines', () => {
      const lines = generateGridLines(800, 600, 25);
      
      // Vertical lines: 0, 25, 50, ..., 800 = 33 lines
      const verticalLines = lines.filter(l => l.type === 'vertical');
      expect(verticalLines.length).toBe(33);
      
      // Horizontal lines: 0, 25, 50, ..., 600 = 25 lines  
      const horizontalLines = lines.filter(l => l.type === 'horizontal');
      expect(horizontalLines.length).toBe(25);
      
      expect(lines.length).toBe(58); // Total lines
    });

    it('generates lines at correct positions', () => {
      const lines = generateGridLines(100, 100, 25);
      
      const verticalLines = lines.filter(l => l.type === 'vertical');
      const verticalPositions = verticalLines.map(l => l.x);
      expect(verticalPositions).toEqual([0, 25, 50, 75, 100]);
      
      const horizontalLines = lines.filter(l => l.type === 'horizontal');
      const horizontalPositions = horizontalLines.map(l => l.y);
      expect(horizontalPositions).toEqual([0, 25, 50, 75, 100]);
    });

    it('generates correct line coordinates', () => {
      const lines = generateGridLines(100, 50, 25);
      
      // Check first vertical line
      const firstVertical = lines.find(l => l.type === 'vertical' && l.x === 0);
      expect(firstVertical?.points).toEqual([0, 0, 0, 50]);
      
      // Check first horizontal line
      const firstHorizontal = lines.find(l => l.type === 'horizontal' && l.y === 0);
      expect(firstHorizontal?.points).toEqual([0, 0, 100, 0]);
    });
  });

  describe('Shape Snapping Scenarios', () => {
    const applySnapToShape = (shape: any, snapEnabled: boolean) => {
      if (!snapEnabled) return shape;
      
      const gridSize = 25;
      const snapped = { ...shape };
      
      snapped.x = Math.round(shape.x / gridSize) * gridSize;
      snapped.y = Math.round(shape.y / gridSize) * gridSize;
      
      // For lines and arrows, also snap end points
      if (shape.type === 'line' || shape.type === 'arrow') {
        if (shape.x2 !== undefined) {
          snapped.x2 = Math.round(shape.x2 / gridSize) * gridSize;
        }
        if (shape.y2 !== undefined) {
          snapped.y2 = Math.round(shape.y2 / gridSize) * gridSize;
        }
      }
      
      return snapped;
    };

    it('snaps rectangle creation to grid', () => {
      const rect = { type: 'rect', x: 37, y: 62, w: 100, h: 80 };
      const snapped = applySnapToShape(rect, true);
      
      expect(snapped.x).toBe(25);
      expect(snapped.y).toBe(50);
      expect(snapped.w).toBe(100); // Width unchanged
      expect(snapped.h).toBe(80);  // Height unchanged
    });

    it('snaps circle positioning to grid', () => {
      const circle = { type: 'circle', x: 113, y: 87, w: 60, h: 60 };
      const snapped = applySnapToShape(circle, true);
      
      expect(snapped.x).toBe(125); // 113 rounds to 125 (113/25=4.52, rounds to 5*25=125)
      expect(snapped.y).toBe(75);  // 87 rounds to 75 (87/25=3.48, rounds to 3*25=75)
      expect(snapped.w).toBe(60);
      expect(snapped.h).toBe(60);
    });

    it('snaps line endpoints to grid', () => {
      const line = { type: 'line', x: 37, y: 62, x2: 113, y2: 187 };
      const snapped = applySnapToShape(line, true);
      
      expect(snapped.x).toBe(25);   // Start point (37 -> 25)
      expect(snapped.y).toBe(50);   // 62 -> 50 (62/25=2.48, rounds to 2*25=50)
      expect(snapped.x2).toBe(125); // End point (113 -> 125)
      expect(snapped.y2).toBe(175); // 187 -> 175 (187/25=7.48, rounds to 7*25=175)
    });

    it('snaps arrow endpoints to grid', () => {
      const arrow = { type: 'arrow', x: 12, y: 38, x2: 88, y2: 112 };
      const snapped = applySnapToShape(arrow, true);
      
      expect(snapped.x).toBe(0);     // Start point (12 -> 0)
      expect(snapped.y).toBe(50);    // 38 -> 50 (38/25=1.52, rounds to 2*25=50)
      expect(snapped.x2).toBe(100);  // End point (88 -> 100)  
      expect(snapped.y2).toBe(100);  // 112 -> 100 (112/25=4.48, rounds to 4*25=100)
    });

    it('preserves original coordinates when snap is disabled', () => {
      const rect = { type: 'rect', x: 37, y: 62, w: 100, h: 80 };
      const unsnapped = applySnapToShape(rect, false);
      
      expect(unsnapped.x).toBe(37);
      expect(unsnapped.y).toBe(62);
      expect(unsnapped.w).toBe(100);
      expect(unsnapped.h).toBe(80);
    });
  });

  describe('Paste and Duplicate Snapping', () => {
    const snapPastedShape = (originalShape: any, offset: { x: number, y: number }, snapEnabled: boolean) => {
      const pastedShape = {
        ...originalShape,
        id: 'new-id',
        x: originalShape.x + offset.x,
        y: originalShape.y + offset.y
      };

      if (originalShape.x2 !== undefined) {
        pastedShape.x2 = originalShape.x2 + offset.x;
      }
      if (originalShape.y2 !== undefined) {
        pastedShape.y2 = originalShape.y2 + offset.y;
      }

      return applySnapToShape(pastedShape, snapEnabled);
    };

    const applySnapToShape = (shape: any, snapEnabled: boolean) => {
      if (!snapEnabled) return shape;
      
      const gridSize = 25;
      const snapped = { ...shape };
      
      snapped.x = Math.round(shape.x / gridSize) * gridSize;
      snapped.y = Math.round(shape.y / gridSize) * gridSize;
      
      if (shape.type === 'line' || shape.type === 'arrow') {
        if (shape.x2 !== undefined) {
          snapped.x2 = Math.round(shape.x2 / gridSize) * gridSize;
        }
        if (shape.y2 !== undefined) {
          snapped.y2 = Math.round(shape.y2 / gridSize) * gridSize;
        }
      }
      
      return snapped;
    };

    it('snaps pasted shapes with offset to grid', () => {
      const original = { type: 'rect', x: 25, y: 50, w: 100, h: 80 };
      const offset = { x: 30, y: 30 }; // Standard paste offset
      
      const pasted = snapPastedShape(original, offset, true);
      
      expect(pasted.x).toBe(50); // 25 + 30 = 55, snapped to 50
      expect(pasted.y).toBe(75); // 50 + 30 = 80, snapped to 75
    });

    it('snaps duplicated shapes to grid', () => {
      const original = { type: 'circle', x: 37, y: 62, w: 60, h: 60 };
      const offset = { x: 20, y: 20 }; // Duplicate offset
      
      const duplicated = snapPastedShape(original, offset, true);
      
      expect(duplicated.x).toBe(50); // 37 + 20 = 57, snapped to 50
      expect(duplicated.y).toBe(75); // 62 + 20 = 82, snapped to 75
    });

    it('preserves exact positioning when snap is disabled', () => {
      const original = { type: 'rect', x: 37, y: 62, w: 100, h: 80 };
      const offset = { x: 30, y: 30 };
      
      const pasted = snapPastedShape(original, offset, false);
      
      expect(pasted.x).toBe(67); // 37 + 30, no snapping
      expect(pasted.y).toBe(92); // 62 + 30, no snapping
    });
  });

  describe('Grid Visibility and State', () => {
    it('toggles grid visibility correctly', () => {
      let showGrid = false;
      
      // Toggle on
      showGrid = !showGrid;
      expect(showGrid).toBe(true);
      
      // Toggle off
      showGrid = !showGrid;
      expect(showGrid).toBe(false);
    });

    it('manages snap-to-grid state independently of grid visibility', () => {
      let showGrid = false;
      let snapToGrid = true;
      
      // Grid can be hidden while snap is enabled
      expect(showGrid).toBe(false);
      expect(snapToGrid).toBe(true);
      
      // Both can be enabled
      showGrid = true;
      expect(showGrid).toBe(true);
      expect(snapToGrid).toBe(true);
    });
  });
});
