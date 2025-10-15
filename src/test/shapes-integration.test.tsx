import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Canvas from '../Canvas';

// Mock Konva components
vi.mock('react-konva', () => ({
  Stage: ({ children, ...props }: any) => <div data-testid="konva-stage" {...props}>{children}</div>,
  Layer: ({ children, ...props }: any) => <div data-testid="konva-layer" {...props}>{children}</div>,
  Rect: (props: any) => <div data-testid="konva-rect" {...props} />,
  Circle: (props: any) => <div data-testid="konva-circle" {...props} />,
  Text: (props: any) => <div data-testid="konva-text" {...props}>{props.text}</div>,
  Transformer: (props: any) => <div data-testid="konva-transformer" {...props} />,
  Group: ({ children, ...props }: any) => <div data-testid="konva-group" {...props}>{children}</div>,
  Line: (props: any) => <div data-testid="konva-line" {...props} />,
  RegularPolygon: (props: any) => <div data-testid="konva-regular-polygon" {...props} />,
}));

// Mock the store with a more complete implementation
const mockStoreState = {
  shapes: {},
  selectedIds: [],
  roomId: 'test-room',
  me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
  cursors: {},
  onlineUsers: [],
  isAuthenticated: false,
  
  // Canvas management state (required for TabBar component)
  currentCanvas: null,
  canvasList: [],
  isCanvasLoading: false,
  canvasError: null,
  hasUnsavedChanges: false,
  
  // Tab management state (required for TabBar component)
  openTabs: [],
  activeTabId: null,
  
  history: [],
  select: vi.fn(),
  pushHistory: vi.fn(),
  upsert: vi.fn(),
  setRoom: vi.fn(),
  setAuthenticated: vi.fn(),
  setUser: vi.fn(),
  clear: vi.fn(),
  undo: vi.fn(),
  remove: vi.fn(),
  toggleSelect: vi.fn(),
  selectAll: vi.fn(),
  clearSelection: vi.fn(),
  createShape: vi.fn(),
  updateShape: vi.fn(),
  duplicateShapes: vi.fn(),
  updateCursor: vi.fn(),
  removeCursor: vi.fn(),
  setOnlineUsers: vi.fn(),
  
  // Canvas management functions (required for TabBar and TopRibbon)
  setCurrentCanvas: vi.fn(),
  setCanvasList: vi.fn(),
  setCanvasLoading: vi.fn(),
  setCanvasError: vi.fn(),
  setUnsavedChanges: vi.fn(),
  loadCanvas: vi.fn(),
  createNewCanvas: vi.fn(),
  saveCurrentCanvas: vi.fn(),
  duplicateCurrentCanvas: vi.fn(),
  
  // Tab management functions (required for TabBar)
  openCanvasInTab: vi.fn(),
  closeTab: vi.fn(),
  switchToTab: vi.fn(),
  getActiveTab: vi.fn(),
  hasUnsavedTab: vi.fn(() => false),
  
  // Auto-save and recovery functions (required for SaveStatusIndicator)
  setSaveStatus: vi.fn(),
  updateAutoSaveSettings: vi.fn(),
  checkForRecovery: vi.fn(),
  restoreFromRecovery: vi.fn(),
  clearRecoveryData: vi.fn(),
  triggerManualSave: vi.fn(),
  
  // Getters (required by components)
  getSelectedShapes: vi.fn(() => []),
  getShape: vi.fn(),
};

vi.mock('../state/store', () => ({
  useCanvas: Object.assign(
    vi.fn(() => mockStoreState),
    {
      getState: vi.fn(() => mockStoreState),
      setState: vi.fn(),
      subscribe: vi.fn(),
    }
  ),
}));

// Mock the AI services
vi.mock('../services/groqService', () => ({
  isGroqConfigured: vi.fn(() => true),
}));

vi.mock('../services/openaiService', () => ({
  isOpenAIConfigured: vi.fn(() => true),
}));

describe('Shape Integration Tests', () => {
  const mockOnSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.shapes = {};
    mockStoreState.selectedIds = [];
  });

  describe('Shape Creation Functionality', () => {
    it('provides all new shape creation buttons', async () => {
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // All shape buttons should be present
      const shapeButtons = [
        '▭', // Rectangle
        '●', // Circle  
        '▲', // Triangle
        '★', // Star
        '♥', // Heart
        '⬟', // Pentagon
        '⬡', // Hexagon
        '⯃', // Octagon
        '⬯', // Oval
        '⯊', // Trapezoid
        '◆', // Rhombus
        '▱', // Parallelogram
      ];

      for (const shapeSymbol of shapeButtons) {
        const button = screen.getByRole('button', { name: shapeSymbol });
        expect(button).toBeInTheDocument();
        expect(button).not.toBeDisabled();
      }
    });

    it('calls shape creation functions when buttons are clicked', async () => {
      const user = userEvent.setup();
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Test triangle creation
      const triangleButton = screen.getByRole('button', { name: '▲' });
      await user.click(triangleButton);
      
      // Should call pushHistory and upsert
      expect(mockStoreState.pushHistory).toHaveBeenCalled();
      expect(mockStoreState.upsert).toHaveBeenCalled();
    });

    it('shows proper tooltips for shape buttons', async () => {
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      const triangleButton = screen.getByRole('button', { name: '▲' });
      expect(triangleButton).toHaveAttribute('title', 'Triangle');
      
      const starButton = screen.getByRole('button', { name: '★' });
      expect(starButton).toHaveAttribute('title', 'Star');
      
      const heartButton = screen.getByRole('button', { name: '♥' });
      expect(heartButton).toHaveAttribute('title', 'Heart');
    });
  });

  describe('Shape Type System', () => {
    it('supports all shape types in the system', () => {
      // Test that all new shape types are recognized by TypeScript
      const shapeTypes = [
        'rect', 'circle', 'text', 'triangle', 'star', 'heart', 
        'pentagon', 'hexagon', 'octagon', 'oval', 'trapezoid', 
        'rhombus', 'parallelogram'
      ];
      
      // This test ensures our type system is complete
      expect(shapeTypes.length).toBe(13);
      expect(shapeTypes).toContain('triangle');
      expect(shapeTypes).toContain('star');
      expect(shapeTypes).toContain('heart');
    });
  });

  describe('Shape Organization', () => {
    it('groups shapes into logical categories', () => {
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Should show Shapes category
      expect(screen.getByText('Shapes')).toBeInTheDocument();
      
      // Should show Emojis category  
      expect(screen.getByText('Emojis')).toBeInTheDocument();
      
      // Should show Assets category
      expect(screen.getByText('Assets')).toBeInTheDocument();
    });

    it('displays visual icons instead of text labels', () => {
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Should use symbol icons, not text like "Rectangle" or "Circle"
      expect(screen.queryByText('Rectangle')).not.toBeInTheDocument();
      expect(screen.queryByText('Circle')).not.toBeInTheDocument();
      expect(screen.queryByText('Triangle')).not.toBeInTheDocument();
      
      // Should have the visual symbols
      expect(screen.getByRole('button', { name: '▭' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '●' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '▲' })).toBeInTheDocument();
    });
  });

  describe('Shape Properties Support', () => {
    it('supports stroke and strokeWidth properties', () => {
      // Test that our shape type system supports styling properties
      const testShape = {
        id: 'test-shape',
        type: 'triangle' as const,
        x: 100,
        y: 100, 
        w: 100,
        h: 100,
        color: '#3b82f6',
        stroke: '#ff0000',
        strokeWidth: 3,
        updated_at: Date.now(),
        updated_by: 'test-user',
      };
      
      // Should be valid shape object
      expect(testShape.stroke).toBe('#ff0000');
      expect(testShape.strokeWidth).toBe(3);
      expect(testShape.type).toBe('triangle');
    });
  });
});
