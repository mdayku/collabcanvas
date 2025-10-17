/**
 * AI AGENT COMPREHENSIVE OBJECT COVERAGE TESTS
 * 
 * Tests that the AI agent can handle ALL object types from the toolbar:
 * - Lines & Arrows
 * - All Shapes (rect, circle, triangle, star, heart, pentagon, hexagon, octagon, oval, trapezoid, rhombus, parallelogram)
 * - Emojis (😊 👍 🔥 💡 🚀 🎉 💻 🎵 🌟 🎨 📚 🏆)
 * - Icons (⚙️ 🏠 📧 📞 🔒 🔍 💾 📁)
 * 
 * For each object type, tests:
 * - Create single
 * - Create grid (NxM)
 * - Move
 * - Resize
 * - Rotate (where applicable)
 * - Delete
 * - Duplicate
 * - Align
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { interpret, tools } from '../ai/agent';
import { useCanvas } from '../state/store';

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

describe('AI Agent - Comprehensive Object Coverage', () => {
  beforeEach(() => {
    // Reset canvas state
    useCanvas.setState({
      shapes: {},
      selectedIds: [],
      me: { id: 'test-user', name: 'Test User', color: '#ff0000' }
    });
  });

  // ========================================================================
  // EMOJI CREATION TESTS
  // ========================================================================
  
  describe('Emoji Creation', () => {
    it('should create a single rocket emoji', async () => {
      const result = await interpret('create a rocket emoji');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(1);
      expect(shapes[0].type).toBe('image');
      expect(shapes[0].imageUrl).toContain('1f680'); // Rocket emoji code
    });

    it('should create a fire emoji', async () => {
      const result = await interpret('create a fire emoji');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes[0].imageUrl).toContain('1f525'); // Fire emoji code
    });

    it('should create a thumbs up emoji', async () => {
      const result = await interpret('create a thumbs up emoji');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes[0].imageUrl).toContain('1f44d'); // Thumbs up code
    });
  });

  // ========================================================================
  // ICON CREATION TESTS
  // ========================================================================
  
  describe('Icon Creation', () => {
    it('should create a settings icon', async () => {
      const result = await interpret('create a settings icon');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(1);
      expect(shapes[0].type).toBe('image');
      expect(shapes[0].imageUrl).toContain('2699'); // Settings gear code
    });

    it('should create a home icon', async () => {
      const result = await interpret('create a home icon');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes[0].imageUrl).toContain('1f3e0'); // Home code
    });

    it('should create a search icon', async () => {
      const result = await interpret('create a search icon');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes[0].imageUrl).toContain('1f50d'); // Magnifying glass code
    });
  });

  // ========================================================================
  // GRID CREATION TESTS - ALL OBJECT TYPES
  // ========================================================================
  
  describe('Grid Creation - Emojis', () => {
    it('should create a 6x5 grid of rocket emojis', async () => {
      const result = await interpret('create a 6x5 grid of rocket emojis');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(30); // 6 * 5 = 30
      shapes.forEach(shape => {
        expect(shape.type).toBe('image');
        expect(shape.imageUrl).toContain('1f680'); // All rockets
      });
    });

    it('should create a 3x3 grid of fire emojis', async () => {
      const result = await interpret('create a 3x3 grid of fire emojis');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(9);
      shapes.forEach(shape => {
        expect(shape.imageUrl).toContain('1f525'); // All fire
      });
    });

    it('should create a 4x4 grid of party emojis', async () => {
      const result = await interpret('create a 4x4 grid of party emojis');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(16);
    });
  });

  describe('Grid Creation - Icons', () => {
    it('should create a 3x3 grid of settings icons', async () => {
      const result = await interpret('create a 3x3 grid of settings icons');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(9);
      shapes.forEach(shape => {
        expect(shape.type).toBe('image');
        expect(shape.imageUrl).toContain('2699');
      });
    });

    it('should create a 2x4 grid of home icons', async () => {
      const result = await interpret('create a 2x4 grid of home icons');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(8);
    });
  });

  describe('Grid Creation - Shapes', () => {
    it('should create a 3x3 grid of stars', async () => {
      const result = await interpret('create a 3x3 grid of stars');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(9);
      shapes.forEach(shape => {
        expect(shape.type).toBe('star');
      });
    });

    it('should create a 4x2 grid of hearts', async () => {
      const result = await interpret('create a 4x2 grid of hearts');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(8);
      shapes.forEach(shape => {
        expect(shape.type).toBe('heart');
      });
    });

    it('should create a 2x2 grid of circles', async () => {
      const result = await interpret('create a 2x2 grid of circles');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(4);
      shapes.forEach(shape => {
        expect(shape.type).toBe('circle');
      });
    });

    it('should create a 3x3 grid of triangles', async () => {
      const result = await interpret('create a 3x3 grid of triangles');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(9);
      shapes.forEach(shape => {
        expect(shape.type).toBe('triangle');
      });
    });
  });

  describe('Grid Creation - Lines & Arrows', () => {
    it('should create a 3x3 grid of lines', async () => {
      const result = await interpret('create a 3x3 grid of lines');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(9);
      shapes.forEach(shape => {
        expect(shape.type).toBe('line');
      });
    });

    it('should create a 2x3 grid of arrows', async () => {
      const result = await interpret('create a 2x3 grid of arrows');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(6);
      shapes.forEach(shape => {
        expect(shape.type).toBe('arrow');
      });
    });
  });

  // ========================================================================
  // MOVE/RESIZE/ROTATE TESTS - ALL OBJECTS
  // ========================================================================
  
  describe('Operations on Emojis', () => {
    it('should move an emoji', async () => {
      // Create emoji first
      const id = tools.createEmoji('🚀', 100, 100);
      useCanvas.getState().select([id!]);
      
      const result = await interpret('move right 50');
      expect(result.ok).toBe(true);
      
      const shape = useCanvas.getState().shapes[id!];
      expect(shape.x).toBe(150); // Moved 50px right
    });

    it('should resize an emoji', async () => {
      const id = tools.createEmoji('🚀', 100, 100);
      useCanvas.getState().select([id!]);
      
      const result = await interpret('resize to 100x100');
      expect(result.ok).toBe(true);
      
      const shape = useCanvas.getState().shapes[id!];
      expect(shape.w).toBe(100);
      expect(shape.h).toBe(100);
    });

    it('should delete an emoji', async () => {
      const id = tools.createEmoji('🚀', 100, 100);
      useCanvas.getState().select([id!]);
      
      const result = await interpret('delete');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(0);
    });

    it('should duplicate an emoji', async () => {
      const id = tools.createEmoji('🚀', 100, 100);
      useCanvas.getState().select([id!]);
      
      const result = await interpret('duplicate');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(2);
    });
  });

  describe('Operations on Icons', () => {
    it('should move an icon', async () => {
      const id = tools.createIcon('⚙️', 100, 100);
      useCanvas.getState().select([id!]);
      
      const result = await interpret('move down 30');
      expect(result.ok).toBe(true);
      
      const shape = useCanvas.getState().shapes[id!];
      expect(shape.y).toBe(130);
    });

    it('should delete an icon', async () => {
      const id = tools.createIcon('⚙️', 100, 100);
      useCanvas.getState().select([id!]);
      
      const result = await interpret('delete');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(0);
    });
  });

  // ========================================================================
  // ALIGNMENT TESTS - ALL OBJECTS
  // ========================================================================
  
  describe('Alignment - Mixed Objects', () => {
    it('should align emojis horizontally', async () => {
      // Create multiple emojis
      const id1 = tools.createEmoji('🚀', 100, 100);
      const id2 = tools.createEmoji('🔥', 200, 150);
      const id3 = tools.createEmoji('👍', 300, 200);
      
      useCanvas.getState().select([id1!, id2!, id3!]);
      
      const result = await interpret('align left');
      expect(result.ok).toBe(true);
      
      // All should have same x coordinate
      const shape1 = useCanvas.getState().shapes[id1!];
      const shape2 = useCanvas.getState().shapes[id2!];
      const shape3 = useCanvas.getState().shapes[id3!];
      expect(shape1.x).toBe(shape2.x);
      expect(shape2.x).toBe(shape3.x);
    });

    it('should align icons vertically', async () => {
      const id1 = tools.createIcon('⚙️', 100, 100);
      const id2 = tools.createIcon('🏠', 200, 150);
      
      useCanvas.getState().select([id1!, id2!]);
      
      const result = await interpret('align top');
      expect(result.ok).toBe(true);
      
      const shape1 = useCanvas.getState().shapes[id1!];
      const shape2 = useCanvas.getState().shapes[id2!];
      expect(shape1.y).toBe(shape2.y);
    });
  });

  // ========================================================================
  // COMPLEX SCENARIOS
  // ========================================================================
  
  describe('Complex Scenarios', () => {
    it('should create and manipulate a mixed grid', async () => {
      // Create grid of stars
      await interpret('create a 3x3 grid of stars');
      expect(Object.keys(useCanvas.getState().shapes).length).toBe(9);
      
      // Select all and change color
      const allIds = Object.keys(useCanvas.getState().shapes);
      useCanvas.getState().select(allIds);
      
      const result = await interpret('change color to red');
      expect(result.ok).toBe(true);
      
      // At least one star should have its color changed
      const shapesWithColor = Object.values(useCanvas.getState().shapes).filter(s => s.color);
      expect(shapesWithColor.length).toBeGreaterThan(0);
    });

    it('should handle emoji grid + duplicate', async () => {
      // Create 2x2 grid of rockets
      await interpret('create a 2x2 grid of rocket emojis');
      const initialCount = Object.keys(useCanvas.getState().shapes).length;
      expect(initialCount).toBe(4);
      
      // Duplicate one emoji
      const firstId = Object.keys(useCanvas.getState().shapes)[0];
      useCanvas.getState().select([firstId]);
      const result = await interpret('duplicate');
      expect(result.ok).toBe(true);
      
      // Should have at least 1 more now
      expect(Object.keys(useCanvas.getState().shapes).length).toBeGreaterThan(initialCount);
    });
  });

  // ========================================================================
  // EDGE CASES
  // ========================================================================
  
  describe('Edge Cases', () => {
    it('should handle empty canvas operations gracefully', async () => {
      const result = await interpret('delete all');
      // Should not crash, might return error or confirmation
      expect(result).toBeDefined();
    });

    it('should handle unrecognized emoji names', async () => {
      const result = await interpret('create a unicorn emoji');
      // Should either create default emoji or ask for clarification
      expect(result).toBeDefined();
    });

    it('should handle very large grids', async () => {
      const result = await interpret('create a 10x10 grid of circles');
      expect(result.ok).toBe(true);
      
      const shapes = Object.values(useCanvas.getState().shapes);
      expect(shapes.length).toBe(100);
    });
  });
});

