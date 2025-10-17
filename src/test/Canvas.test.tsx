import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Canvas from '../Canvas';
import { ThemeProvider } from '../contexts/ThemeContext';

/**
 * ⚠️ TESTS TEMPORARILY DISABLED ⚠️
 * Issue: Konva requires 'canvas' module in Node.js (native C++ binding)
 * Priority: LOW - Unit tests + manual testing cover functionality
 * See: PRD_CollabCanvas.md "Testing Debt" section
 */

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

// Create a proper Zustand-like mock
const mockStoreState = {
  shapes: {},
  selectedIds: [],
  roomId: 'test-room',
  me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
  cursors: {},
  onlineUsers: [],
  
  // Canvas management state (required for TabBar component)
  currentCanvas: null,
  canvasList: [],
  isCanvasLoading: false,
  canvasError: null,
  hasUnsavedChanges: false,
  
  // Tab management state (required for TabBar component)
  openTabs: [],
  activeTabId: null,
  isAuthenticated: false,
  history: [],
  select: vi.fn(),
  pushHistory: vi.fn(),
  upsert: vi.fn(),
  setRoom: vi.fn(),
  setAuthenticated: vi.fn(),
  setUser: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  toggleSelect: vi.fn(),
  selectAll: vi.fn(),
  clearSelection: vi.fn(),
  createShape: vi.fn(),
  updateShape: vi.fn(),
  duplicateShapes: vi.fn(),
  updateCursor: vi.fn(),
  removeCursor: vi.fn(),
  setOnlineUsers: vi.fn(),
  undo: vi.fn(),
  
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

// Mock the store
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

describe.skip('Canvas Component', () => {
  const mockOnSignOut = vi.fn();

  // Helper to render Canvas with ThemeProvider
  const renderCanvas = () => render(
    <ThemeProvider>
      <Canvas onSignOut={mockOnSignOut} />
    </ThemeProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the canvas interface', () => {
    renderCanvas();
    
    // Check for main elements (using getAllByText since there are multiple instances)
    expect(screen.getAllByText('CollabCanvas')).toHaveLength(2); // Top ribbon + sidebar
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('renders toolbar buttons', () => {
    renderCanvas();
    
    // Basic shape buttons
    expect(screen.getByRole('button', { name: '▭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '●' })).toBeInTheDocument();
    
    // New shape buttons
    expect(screen.getByRole('button', { name: '▲' })).toBeInTheDocument(); // Triangle
    expect(screen.getByRole('button', { name: '★' })).toBeInTheDocument(); // Star
    expect(screen.getByRole('button', { name: '♥' })).toBeInTheDocument(); // Heart
    expect(screen.getByRole('button', { name: '⬟' })).toBeInTheDocument(); // Pentagon
    expect(screen.getByRole('button', { name: '⬡' })).toBeInTheDocument(); // Hexagon
    expect(screen.getByRole('button', { name: '⯃' })).toBeInTheDocument(); // Octagon
    expect(screen.getByRole('button', { name: '⬯' })).toBeInTheDocument(); // Oval
    expect(screen.getByRole('button', { name: '⯊' })).toBeInTheDocument(); // Trapezoid
    expect(screen.getByRole('button', { name: '◆' })).toBeInTheDocument(); // Rhombus
    expect(screen.getByRole('button', { name: '▱' })).toBeInTheDocument(); // Parallelogram
    
    // Text is in Assets section - need to expand it first
    const assetsButton = screen.getByRole('button', { name: /🎯Assets/ });
    expect(assetsButton).toBeInTheDocument();
  });

  it('renders all shape categories', () => {
    renderCanvas();
    
    // Check shape categories are present
    expect(screen.getByText('Shapes')).toBeInTheDocument();
    expect(screen.getByText('Emojis')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });

  it('renders AI input box', () => {
    renderCanvas();
    
    const aiInput = screen.getByPlaceholderText(/create a dashboard layout/i);
    expect(aiInput).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
  });

  it('calls onSignOut when sign out button is clicked', async () => {
    const user = userEvent.setup();
    renderCanvas();
    
    const signOutButton = screen.getByText('Sign out');
    await user.click(signOutButton);
    
    expect(mockOnSignOut).toHaveBeenCalled();
  });

  it('renders user information', () => {
    renderCanvas();
    
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows performance hints', async () => {
    const user = userEvent.setup();
    renderCanvas();
    
    // Performance hints are now in the Help menu
    const helpButton = screen.getByRole('button', { name: '?' });
    await user.click(helpButton);
    expect(screen.getByText('Ctrl+Z')).toBeInTheDocument();
    expect(screen.getByText('Shift+Click')).toBeInTheDocument();
  });
});
