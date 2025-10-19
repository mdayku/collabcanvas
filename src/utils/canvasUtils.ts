import type { ShapeBase } from '../types';

/**
 * Find an empty area on the canvas to place a new shape without overlapping existing shapes
 */
export function findBlankArea(shapes: Record<string, ShapeBase>, width: number, height: number): { x: number; y: number } {
  const canvasWidth = 1200; // Canvas visible area width
  const canvasHeight = 800; // Canvas visible area height
  const margin = 20; // Minimum distance from other shapes
  const maxAttempts = 50; // Prevent infinite loops
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const x = margin + Math.random() * (canvasWidth - width - margin * 2);
    const y = margin + Math.random() * (canvasHeight - height - margin * 2);
    
    // Check if this position overlaps with any existing shape
    let hasCollision = false;
    for (const shape of Object.values(shapes)) {
      if (x < shape.x + shape.w + margin &&
          x + width + margin > shape.x &&
          y < shape.y + shape.h + margin &&
          y + height + margin > shape.y) {
        hasCollision = true;
        break;
      }
    }
    
    if (!hasCollision) {
      return { x, y };
    }
  }
  
  // Fallback to random position if no blank area found
  return {
    x: 100 + Math.random() * 200,
    y: 100 + Math.random() * 200
  };
}

