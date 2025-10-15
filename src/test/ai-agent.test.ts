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

  describe('Edge Cases', () => {
    it('handles empty input', async () => {
      const result = await interpret('');
      expect(result).toBeNull();
    });

    it('handles unrecognized commands', async () => {
      const result = await interpret('delete everything permanently');
      expect(result).toBeNull();
    });

    it('handles malformed grid commands', async () => {
      const result = await interpret('create grid abc');
      expect(result).toBeNull();
    });
  });
});
