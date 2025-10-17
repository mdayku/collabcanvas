import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interpret, tools } from '../ai/agent';
import { useCanvas } from '../state/store';
import type { ShapeBase } from '../types';

// Mock the store
vi.mock('../state/store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../state/store')>();
  return {
    ...actual,
    useCanvas: Object.assign(
      vi.fn(() => ({
        me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
        shapes: {},
        selectedIds: [],
        roomId: 'test-room',
        pushHistory: vi.fn(),
        upsert: vi.fn(),
        select: vi.fn(),
      })),
      {
        getState: vi.fn(() => ({
          me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
          shapes: {},
          selectedIds: [],
          pushHistory: vi.fn(),
          upsert: vi.fn(),
          select: vi.fn(),
          centerOnShape: null,
          setCenterOnShapeCallback: vi.fn(),
        })),
        setState: vi.fn(),
        subscribe: vi.fn(),
      }
    ),
  };
});

// Mock supabase for persistence
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      send: vi.fn(),
    })),
    from: vi.fn(() => ({
      upsert: vi.fn(),
    })),
  },
}));

describe('Advanced AI Agent Requirements', () => {
  let mockPushHistory: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPushHistory = vi.fn();
    mockUpsert = vi.fn();
    
    vi.mocked(useCanvas.getState).mockReturnValue({
      me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
      shapes: {},
      selectedIds: [],
      roomId: 'test-room',
      pushHistory: mockPushHistory,
      upsert: mockUpsert,
      select: vi.fn(),
      centerOnShape: null,
      setCenterOnShapeCallback: vi.fn(),
    } as any);
  });

  describe('AI Performance Targets (Required)', () => {
    it('responds to single-step commands under 2 seconds', async () => {
      // TODO: Measure actual AI response time - requirement: <2s
      const startTime = Date.now();
      
      const result = await interpret('create a red circle');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(2000); // 2 second requirement
      expect(result).toBeDefined();
    });

    it('handles breadth requirement: 6+ command types', async () => {
      // TODO: Verify all command types work - requirement: 6+ types
      const commandTypes = [
        'Create a red circle at position 100, 200',           // Creation
        'Make a 200x300 rectangle',                           // Creation
        'Add a text layer that says Hello World',             // Creation
        'Move the blue rectangle to the center',              // Manipulation
        'Resize the circle to be twice as big',               // Manipulation
        'Rotate the text 45 degrees',                         // Manipulation
        'Arrange these shapes in a horizontal row',           // Layout
        'Create a grid of 3x3 squares',                       // Layout
        'Create a login form with username and password',     // Complex
      ];

      // At least 6 different command types should be supported
      let supportedTypes = 0;
      const supportedCommands: string[] = [];
      
      for (const command of commandTypes) {
        try {
          const result = await interpret(command);
          if (result !== null) {
            supportedTypes++;
            supportedCommands.push(command);
          }
        } catch (error) {
          // Command not supported yet
        }
      }

      expect(supportedTypes).toBeGreaterThanOrEqual(6);
    });
  });

  describe('Context Awareness (Required)', () => {
    it('uses getCanvasState for context-aware commands', async () => {
      // TODO: Implement getCanvasState usage in AI commands
      const existingShapes: Record<string, ShapeBase> = {
        'rect-1': {
          id: 'rect-1',
          type: 'rect',
          x: 100,
          y: 100,
          w: 200,
          h: 150,
          color: '#0000ff', // blue
          updated_at: Date.now(),
          updated_by: 'test-user',
        },
      };

      vi.mocked(useCanvas.getState).mockReturnValue({
        me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
        shapes: existingShapes,
        selectedIds: [],
        roomId: 'test-room',
        pushHistory: mockPushHistory,
        upsert: mockUpsert,
        select: vi.fn(),
        centerOnShape: null,
        setCenterOnShapeCallback: vi.fn(),
      } as any);

      // This command should identify the blue rectangle by analyzing canvas state
      const result = await interpret('Move the blue rectangle to the center');
      
      expect(result).toBeDefined();
      // Should have used getCanvasState to find the blue rectangle
      expect(tools.getCanvasState()).toEqual(Object.values(existingShapes));
    });
  });

  describe('Multi-Step Operations (Required)', () => {
    it('executes complex multi-step login form creation', async () => {
      // TODO: Implement multi-step complex operations
      const result = await interpret('Create a login form with username and password fields');
      
      expect(result).toBeDefined();
      
      // Should create multiple shapes: labels, inputs, button  
      expect(mockUpsert).toHaveBeenCalledTimes(6); // 3 rectangles + 3 text labels (username, password, button)
      
      // Verify shapes are properly positioned relative to each other
      const calls = mockUpsert.mock.calls;
      const shapes = calls.map(call => call[0]);
      
      // Should have text labels and input fields
      const textShapes = shapes.filter(s => s.type === 'text');
      const rectShapes = shapes.filter(s => s.type === 'rect');
      
      expect(textShapes.length).toBeGreaterThanOrEqual(2); // Username, Password labels
      expect(rectShapes.length).toBeGreaterThanOrEqual(3); // 2 inputs + 1 button
    });

    it('creates navigation bar with proper layout', async () => {
      // TODO: Implement navigation bar creation
      const result = await interpret('Build a navigation bar with 4 menu items');
      
      expect(result).toBeDefined();
      
      // Should create 4 menu items properly spaced
      expect(mockUpsert).toHaveBeenCalledTimes(5); // 4 items + 1 container/background
      
      const calls = mockUpsert.mock.calls;
      const shapes = calls.map(call => call[0]);
      
      // Verify horizontal spacing
      const xPositions = shapes.map(s => s.x).sort((a, b) => a - b);
      
      // Menu items should be evenly spaced
      for (let i = 1; i < xPositions.length; i++) {
        const spacing = xPositions[i] - xPositions[i-1];
        expect(spacing).toBeGreaterThan(0); // Should have spacing
      }
    });

    it('creates card layout with title, image, and description', async () => {
      // TODO: Implement card layout creation
      const result = await interpret('Make a card layout with title, image, and description');
      
      expect(result).toBeDefined();
      
      // Should create at least 4 shapes: container, title, image placeholder, description
      expect(mockUpsert).toHaveBeenCalledTimes(4);
      
      const calls = mockUpsert.mock.calls;
      const shapes = calls.map(call => call[0]);
      
      // Should have proper vertical stacking (title at top, description at bottom)
      const yPositions = shapes.map(s => s.y);
      const minY = Math.min(...yPositions);
      const maxY = Math.max(...yPositions);
      
      expect(maxY).toBeGreaterThan(minY); // Vertical layout
    });
  });

  describe('Manipulation Commands (Critical Gap)', () => {
    it('identifies and moves existing shapes by color', async () => {
      // TODO: Implement shape identification and movement
      const blueRect: ShapeBase = {
        id: 'blue-rect',
        type: 'rect',
        x: 50,
        y: 50,
        w: 100,
        h: 100,
        color: '#0000ff',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      vi.mocked(useCanvas.getState).mockReturnValue({
        me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
        shapes: { 'blue-rect': blueRect },
        selectedIds: [],
        roomId: 'test-room',
        pushHistory: mockPushHistory,
        upsert: mockUpsert,
        select: vi.fn(),
        centerOnShape: null,
        setCenterOnShapeCallback: vi.fn(),
      } as any);

      const result = await interpret('Move the blue rectangle to position 200, 300');
      
      expect(result).toBeDefined();
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'blue-rect',
          x: 200,
          y: 300,
        })
      );
    });

    it('resizes shapes by factor', async () => {
      // TODO: Implement shape resizing
      const circle: ShapeBase = {
        id: 'test-circle',
        type: 'circle',
        x: 100,
        y: 100,
        w: 50,
        h: 50,
        color: '#ff0000',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      vi.mocked(useCanvas.getState).mockReturnValue({
        me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
        shapes: { 'test-circle': circle },
        selectedIds: [],
        roomId: 'test-room',
        pushHistory: mockPushHistory,
        upsert: mockUpsert,
        select: vi.fn(),
        centerOnShape: null,
        setCenterOnShapeCallback: vi.fn(),
      } as any);

      const result = await interpret('Make the red circle twice as big');
      
      expect(result).toBeDefined();
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-circle',
          w: 100, // 50 * 2
          h: 100, // 50 * 2
        })
      );
    });

    it('rotates shapes by degrees', async () => {
      // TODO: Implement shape rotation
      const textShape: ShapeBase = {
        id: 'test-text',
        type: 'text',
        x: 150,
        y: 150,
        w: 100,
        h: 30,
        text: 'Hello World',
        rotation: 0,
        color: '#000000',
        updated_at: Date.now(),
        updated_by: 'test-user',
      };

      vi.mocked(useCanvas.getState).mockReturnValue({
        me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
        shapes: { 'test-text': textShape },
        selectedIds: [],
        roomId: 'test-room',
        pushHistory: mockPushHistory,
        upsert: mockUpsert,
        select: vi.fn(),
        centerOnShape: null,
        setCenterOnShapeCallback: vi.fn(),
      } as any);

      const result = await interpret('Rotate the text 45 degrees');
      
      expect(result).toBeDefined();
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-text',
          rotation: 45,
        })
      );
    });
  });

  describe('Layout Commands (Critical Gap)', () => {
    it('arranges multiple shapes in horizontal row', async () => {
      // TODO: Implement layout arrangement
      const shapes = {
        'shape-1': { id: 'shape-1', type: 'rect', x: 10, y: 50, w: 50, h: 50, updated_at: Date.now(), updated_by: 'test-user' },
        'shape-2': { id: 'shape-2', type: 'circle', x: 200, y: 100, w: 40, h: 40, updated_at: Date.now(), updated_by: 'test-user' },
        'shape-3': { id: 'shape-3', type: 'rect', x: 75, y: 200, w: 60, h: 40, updated_at: Date.now(), updated_by: 'test-user' },
      };

      vi.mocked(useCanvas.getState).mockReturnValue({
        me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
        shapes,
        selectedIds: [],
        roomId: 'test-room',
        pushHistory: mockPushHistory,
        upsert: mockUpsert,
        select: vi.fn(),
        centerOnShape: null,
        setCenterOnShapeCallback: vi.fn(),
      } as any);

      const result = await interpret('Arrange all shapes in a horizontal row');
      
      expect(result).toBeDefined();
      expect(mockUpsert).toHaveBeenCalledTimes(3); // All shapes should be repositioned
      
      const calls = mockUpsert.mock.calls;
      const updatedShapes = calls.map(call => call[0]);
      
      // All shapes should have same y position (horizontal alignment)
      const yPositions = updatedShapes.map(s => s.y);
      const firstY = yPositions[0];
      yPositions.forEach(y => expect(y).toBe(firstY));
      
      // X positions should be evenly spaced
      const xPositions = updatedShapes.map(s => s.x).sort((a, b) => a - b);
      expect(xPositions[1] - xPositions[0]).toBeGreaterThan(50);
      expect(xPositions[2] - xPositions[1]).toBeGreaterThan(50);
    });

    it('spaces elements evenly', async () => {
      // TODO: Implement even spacing logic
      const result = await interpret('Space these three rectangles evenly');
      
      expect(result).toBeDefined();
      // Should identify rectangles and space them evenly
    });
  });

  describe('Shared AI State (Required)', () => {
    it('ensures AI results are visible to all users', async () => {
      // TODO: Verify AI changes broadcast to all users
      const result = await interpret('create a shared rectangle');
      
      expect(result).toBeDefined();
      expect(mockPushHistory).toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalled();
      
      // In real implementation, this would also call broadcast functions
    });

    it('handles simultaneous AI commands without conflict', async () => {
      // TODO: Test concurrent AI usage
      const commands = [
        'create a red circle',
        'create a blue rectangle',
        'add text saying hello',
      ];

      const results = await Promise.all(
        commands.map(cmd => interpret(cmd))
      );

      results.forEach(result => {
        expect(result).toBeDefined();
      });

      // Should have created 3 shapes total
      expect(mockUpsert).toHaveBeenCalledTimes(3);
    });
  });
});
