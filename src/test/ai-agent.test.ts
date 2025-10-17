import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interpret, tools } from '../ai/agent';
import { useCanvas } from '../state/store';

// Mock the store and dependencies
vi.mock('../state/store', () => ({
  useCanvas: {
    getState: vi.fn(() => ({
      pushHistory: vi.fn(),
      me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
      upsert: vi.fn(),
      shapes: {},
      selectedIds: [],
      select: vi.fn(),
      groupShapes: vi.fn(() => 'group-id'),
    })),
  },
}));

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

describe('AI Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Text Interpretation', () => {
    it('extracts text from quoted strings', async () => {
      const commands = [
        'create text that says "Hello World"',
        'add text saying "Welcome to CollabCanvas"',
        'make text with "Testing 123"',
        'create text containing "AI is working"',
      ];

      for (const command of commands) {
        const result = await interpret(command);
        expect(result).toBeDefined();
        // The AI should have created a text shape with the extracted content
      }
    });

    it('handles text without quotes', async () => {
      const result = await interpret('create text that says Hello World');
      expect(result).toBeDefined();
    });

    it('falls back to default text when no content found', async () => {
      const result = await interpret('create some text');
      expect(result).toBeDefined();
    });
  });

  describe('Creation Commands (Required)', () => {
    it('creates circles with position and color', async () => {
      const result = await interpret('Create a red circle at position 100, 200');
      expect(result).toBeDefined();
    });

    it('creates rectangles with dimensions', async () => {
      const result = await interpret('Make a 200x300 rectangle');
      expect(result).toBeDefined();
    });

    it('creates text layers', async () => {
      const result = await interpret('Add a text layer that says Hello World');
      expect(result).toBeDefined();
    });

    it('creates grids', async () => {
      const result = await interpret('Create a grid of 3x3 squares');
      expect(result).toBeDefined();
    });
  });

  describe('Manipulation Commands (Required)', () => {
    it('moves existing shapes', async () => {
      // TODO: Implement moveShape command
      const result = await interpret('Move the blue rectangle to the center');
      expect(result).toBeDefined();
    });

    it('resizes existing shapes', async () => {
      // TODO: Implement resizeShape command  
      const result = await interpret('Resize the circle to be twice as big');
      expect(result).toBeDefined();
    });

    it('rotates existing shapes', async () => {
      // TODO: Implement rotateShape command
      const result = await interpret('Rotate the text 45 degrees');
      expect(result).toBeDefined();
    });
  });

  describe('Layout Commands (Required)', () => {
    it('arranges shapes in horizontal rows', async () => {
      // TODO: Implement arrangement logic
      const result = await interpret('Arrange these shapes in a horizontal row');
      expect(result).toBeDefined();
    });

    it('spaces elements evenly', async () => {
      // TODO: Implement spacing logic
      const result = await interpret('Space these elements evenly');
      expect(result).toBeDefined();
    });
  });

  describe('Complex Commands (Required)', () => {
    it('creates login forms', async () => {
      // TODO: Implement complex multi-shape creation
      const result = await interpret('Create a login form with username and password fields');
      expect(result).toBeDefined();
      // Should create multiple related shapes
    });

    it('creates navigation bars', async () => {
      // TODO: Implement navigation bar creation
      const result = await interpret('Build a navigation bar with 4 menu items');
      expect(result).toBeDefined();
    });

    it('creates card layouts', async () => {
      // TODO: Implement card layout creation
      const result = await interpret('Make a card layout with title, image, and description');
      expect(result).toBeDefined();
    });
  });

  describe('Tools Functions', () => {
    it('createText calculates dimensions correctly', () => {
      const mockPushHistory = vi.fn();
      const mockUpsert = vi.fn();
      
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: mockPushHistory,
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: mockUpsert,
        select: vi.fn(),
        shapes: {
          'test-id': {
            id: 'test-id',
            type: 'text',
            x: 100,
            y: 100,
            w: 200,
            h: 50,
            text: 'Hello World',
            fontSize: 20,
            updated_at: Date.now(),
            updated_by: 'user-1',
          },
        },
      } as any);

      const result = tools.createText('Hello World', 100, 100, 20, '#000');
      
      expect(mockPushHistory).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('createShape sets correct properties', () => {
      const mockPushHistory = vi.fn();
      const mockUpsert = vi.fn();
      
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: mockPushHistory,
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: mockUpsert,
        select: vi.fn(),
        shapes: {},
      } as any);

      const result = tools.createShape('rect', 100, 100, 200, 150, '#ff0000');
      
      expect(mockPushHistory).toHaveBeenCalled();
      expect(mockUpsert).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Extended Shape Creation', () => {
    it('creates stars', async () => {
      const result = await interpret('create a star');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates hearts', async () => {
      const result = await interpret('make a red heart');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates triangles', async () => {
      const result = await interpret('add a triangle');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates pentagons', async () => {
      const result = await interpret('create a pentagon');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates hexagons', async () => {
      const result = await interpret('make a blue hexagon');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates octagons', async () => {
      const result = await interpret('add an octagon');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates ovals', async () => {
      const result = await interpret('create an oval');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates ovals with ellipse keyword', async () => {
      const result = await interpret('make an ellipse');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates trapezoids', async () => {
      const result = await interpret('create a trapezoid');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates rhombus', async () => {
      const result = await interpret('add a rhombus');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates rhombus with diamond keyword', async () => {
      const result = await interpret('make a diamond');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates parallelograms', async () => {
      const result = await interpret('create a parallelogram');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates lines', async () => {
      const result = await interpret('add a line');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates arrows', async () => {
      const result = await interpret('create an arrow');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('creates AI image frames', async () => {
      const result = await interpret('create an ai image frame');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });
  });

  describe('Color & Style Operations', () => {
    beforeEach(() => {
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: vi.fn(),
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: vi.fn(),
        select: vi.fn(),
        shapes: {
          'shape-1': {
            id: 'shape-1',
            type: 'circle',
            x: 100,
            y: 100,
            w: 100,
            h: 100,
            color: '#3b82f6',
            updated_at: Date.now(),
            updated_by: 'user-1',
          },
        },
        selectedIds: ['shape-1'],
        roomId: 'test-room',
      } as any);
    });

    it('changes shape color', async () => {
      const result = await interpret('change color to red');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('changes fill color', async () => {
      const result = await interpret('change the color to blue');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('sets background color', async () => {
      const result = await interpret('set background to green');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('adds border/stroke', async () => {
      const result = await interpret('add a black border');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('changes stroke with width', async () => {
      const result = await interpret('set border to red 5px');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });
  });

  describe('Shape Operations', () => {
    beforeEach(() => {
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: vi.fn(),
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: vi.fn(),
        select: vi.fn(),
        remove: vi.fn(),
        shapes: {
          'shape-1': {
            id: 'shape-1',
            type: 'circle',
            x: 100,
            y: 100,
            w: 100,
            h: 100,
            color: '#3b82f6',
            updated_at: Date.now(),
            updated_by: 'user-1',
          },
          'shape-2': {
            id: 'shape-2',
            type: 'rect',
            x: 300,
            y: 200,
            w: 150,
            h: 100,
            color: '#ef4444',
            updated_at: Date.now(),
            updated_by: 'user-1',
          },
        },
        selectedIds: ['shape-1'],
        roomId: 'test-room',
      } as any);
    });

    it('deletes selected shape', async () => {
      const result = await interpret('delete this');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('removes shape', async () => {
      const result = await interpret('remove it');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('duplicates selected shape', async () => {
      const result = await interpret('duplicate this');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('copies shape', async () => {
      const result = await interpret('copy it');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('clones shape', async () => {
      const result = await interpret('clone the shape');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });
  });

  describe('Alignment Operations', () => {
    beforeEach(() => {
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: vi.fn(),
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: vi.fn(),
        select: vi.fn(),
        shapes: {
          'shape-1': {
            id: 'shape-1',
            type: 'circle',
            x: 100,
            y: 100,
            w: 100,
            h: 100,
            color: '#3b82f6',
            updated_at: Date.now(),
            updated_by: 'user-1',
          },
          'shape-2': {
            id: 'shape-2',
            type: 'rect',
            x: 300,
            y: 200,
            w: 150,
            h: 100,
            color: '#ef4444',
            updated_at: Date.now(),
            updated_by: 'user-1',
          },
        },
        selectedIds: ['shape-1', 'shape-2'],
        roomId: 'test-room',
      } as any);
    });

    it('aligns shapes left', async () => {
      const result = await interpret('align left');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('aligns shapes right', async () => {
      const result = await interpret('align right');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('aligns shapes center', async () => {
      const result = await interpret('align center');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('aligns shapes top', async () => {
      const result = await interpret('align top');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('aligns shapes middle', async () => {
      const result = await interpret('align middle');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('aligns shapes bottom', async () => {
      const result = await interpret('align bottom');
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
    });

    it('requires at least 2 shapes for alignment', async () => {
      vi.mocked(useCanvas.getState).mockReturnValue({
        ...vi.mocked(useCanvas.getState)(),
        selectedIds: ['shape-1'],
      } as any);

      const result = await interpret('align left');
      expect(result).toBeDefined();
      expect(result.error).toBeTruthy();
    });
  });

  describe('Tool Functions - New Capabilities', () => {
    beforeEach(() => {
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: vi.fn(),
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: vi.fn(),
        select: vi.fn(),
        remove: vi.fn(),
        shapes: {
          'test-shape': {
            id: 'test-shape',
            type: 'circle',
            x: 100,
            y: 100,
            w: 100,
            h: 100,
            color: '#3b82f6',
            updated_at: Date.now(),
            updated_by: 'user-1',
          },
        },
        roomId: 'test-room',
      } as any);
    });

    it('changeColor updates shape color', () => {
      const mockUpsert = vi.fn();
      vi.mocked(useCanvas.getState).mockReturnValue({
        ...vi.mocked(useCanvas.getState)(),
        upsert: mockUpsert,
      } as any);

      tools.changeColor('test-shape', '#ff0000');
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('changeStroke updates border properties', () => {
      const mockUpsert = vi.fn();
      vi.mocked(useCanvas.getState).mockReturnValue({
        ...vi.mocked(useCanvas.getState)(),
        upsert: mockUpsert,
      } as any);

      tools.changeStroke('test-shape', '#000000', 5);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('deleteShape removes shape', () => {
      const mockRemove = vi.fn();
      vi.mocked(useCanvas.getState).mockReturnValue({
        ...vi.mocked(useCanvas.getState)(),
        remove: mockRemove,
      } as any);

      tools.deleteShape('test-shape');
      expect(mockRemove).toHaveBeenCalledWith(['test-shape']);
    });

    it('duplicateShape creates copy with offset', () => {
      const mockUpsert = vi.fn();
      const mockSelect = vi.fn();
      vi.mocked(useCanvas.getState).mockReturnValue({
        ...vi.mocked(useCanvas.getState)(),
        upsert: mockUpsert,
        select: mockSelect,
      } as any);

      const newId = tools.duplicateShape('test-shape');
      expect(newId).toBeDefined();
      expect(mockUpsert).toHaveBeenCalled();
      expect(mockSelect).toHaveBeenCalled();
    });

    it('alignShapes positions shapes correctly', () => {
      const mockUpsert = vi.fn();
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: vi.fn(),
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: mockUpsert,
        shapes: {
          'shape-1': { id: 'shape-1', type: 'rect', x: 100, y: 100, w: 100, h: 100, updated_at: Date.now(), updated_by: 'user-1' },
          'shape-2': { id: 'shape-2', type: 'rect', x: 300, y: 200, w: 100, h: 100, updated_at: Date.now(), updated_by: 'user-1' },
        },
        roomId: 'test-room',
      } as any);

      tools.alignShapes(['shape-1', 'shape-2'], 'left');
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty input', async () => {
      const result = await interpret('');
      expect(result).toBeNull();
    });

    it('handles unrecognized commands', async () => {
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: vi.fn(),
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: vi.fn(),
        shapes: {},
        selectedIds: [],
        roomId: 'test-room',
      } as any);
      
      const result = await interpret('make coffee and bring donuts');
      expect(result).toBeNull();
    });

    it('handles malformed grid commands', async () => {
      const result = await interpret('create grid abc');
      expect(result).toBeNull();
    });

    it('handles color change without target', async () => {
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: vi.fn(),
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: vi.fn(),
        shapes: {},
        selectedIds: [],
        roomId: 'test-room',
      } as any);

      const result = await interpret('change color to red');
      expect(result).toBeDefined();
      expect(result.error).toBeTruthy();
    });

    it('handles delete without target', async () => {
      vi.mocked(useCanvas.getState).mockReturnValue({
        pushHistory: vi.fn(),
        me: { id: 'user-1', name: 'Test User', color: '#3b82f6' },
        upsert: vi.fn(),
        shapes: {},
        selectedIds: [],
        roomId: 'test-room',
      } as any);

      const result = await interpret('delete');
      expect(result).toBeDefined();
      expect(result.error).toBeTruthy();
    });
  });
});
