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
  Image: (props: any) => <div data-testid="konva-image" {...props} />,
}));

// Mock the theme context
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    showFPS: false,
    setShowFPS: vi.fn(),
    showGrid: false,
    setShowGrid: vi.fn(),
    halloweenMode: false,
    setHalloweenMode: vi.fn(),
    colors: {
      bg: '#ffffff',
      text: '#000000',
      primary: '#3b82f6',
      buttonBg: '#f3f4f6',
      buttonHover: '#e5e7eb',
      border: '#d1d5db',
      canvasBg: '#ffffff',
      bgSecondary: '#f9fafb',
      textSecondary: '#6b7280',
      textMuted: '#9ca3af',
      error: '#ef4444'
    }
  }),
  ThemeProvider: ({ children }: any) => children
}));

// Mock Supabase
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ error: null }),
      track: vi.fn().mockResolvedValue({ error: null }),
      untrack: vi.fn().mockResolvedValue({ error: null }),
      unsubscribe: vi.fn().mockResolvedValue({ error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    }
  }
}));

// Mock the store with a more complete implementation
const mockStoreState = {
  shapes: {},
  selectedIds: [],
  roomId: 'test-room',
  me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
  isAuthenticated: true,
  history: [],
  cursors: {},
  onlineUsers: [],
  currentCanvas: { id: 'test-canvas', title: 'Test Canvas', room_id: 'test-room', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: 'test-user' },
  canvasList: [],
  isCanvasLoading: false,
  canvasError: null,
  hasUnsavedChanges: false,
  openTabs: [],
  activeTabId: null,
  saveStatus: 'idle' as const,
  saveMessage: null,
  autoSaveSettings: { enabled: true, intervalMs: 30000 },
  hasRecoveryData: false,
};

const mockStoreActions = {
  setRoom: vi.fn(),
  setAuthenticated: vi.fn(),
  setUser: vi.fn(),
  pushHistory: vi.fn(),
  undo: vi.fn(),
  updateCursor: vi.fn(),
  removeCursor: vi.fn(),
  setOnlineUsers: vi.fn(),
  upsert: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  select: vi.fn(),
  toggleSelect: vi.fn(),
  selectAll: vi.fn(),
  clearSelection: vi.fn(),
  createShape: vi.fn(),
  updateShape: vi.fn(),
  duplicateShapes: vi.fn(),
  setCurrentCanvas: vi.fn(),
  loadCanvases: vi.fn(),
  createCanvas: vi.fn(),
  saveCanvas: vi.fn(),
  deleteCanvas: vi.fn(),
  duplicateCanvas: vi.fn(),
  openTab: vi.fn(),
  closeTab: vi.fn(),
  switchTab: vi.fn(),
  setSaveStatus: vi.fn(),
  updateAutoSaveSettings: vi.fn(),
  checkForRecovery: vi.fn(),
  restoreFromRecovery: vi.fn(),
  clearRecoveryData: vi.fn(),
  triggerManualSave: vi.fn(),
};

const mockStoreStateComplete = {
  ...mockStoreState,
  ...mockStoreActions,
};

// Mock the store
vi.mock('../state/store', () => ({
  useCanvas: Object.assign(
    vi.fn(() => mockStoreStateComplete),
    {
      getState: vi.fn(() => mockStoreStateComplete),
      setState: vi.fn(),
      subscribe: vi.fn(),
    }
  ),
}));

// Mock AI services
vi.mock('../services/groqService', () => ({
  isGroqConfigured: () => true,
  callGroq: vi.fn()
}));

vi.mock('../services/openaiService', () => ({
  isOpenAIConfigured: () => true,
  callOpenAI: vi.fn()
}));

// Mock auto-save service
vi.mock('../services/autoSaveService', () => ({
  AutoSaveService: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    startAutoSaveTimer: vi.fn(),
    stopAutoSaveTimer: vi.fn(),
    updateSettings: vi.fn(),
    saveBackup: vi.fn(),
    checkForRecovery: vi.fn().mockResolvedValue(false),
    restoreFromBackup: vi.fn(),
    clearRecoveryData: vi.fn(),
    clearBackup: vi.fn(),
  })),
  autoSaveService: {
    init: vi.fn(),
    startAutoSaveTimer: vi.fn(),
    stopAutoSaveTimer: vi.fn(),
    updateSettings: vi.fn(),
    saveBackup: vi.fn(),
    checkForRecovery: vi.fn().mockResolvedValue(false),
    restoreFromBackup: vi.fn(),
    clearRecoveryData: vi.fn(),
    clearBackup: vi.fn(),
  }
}));

describe('Lines and Arrows', () => {
  const mockOnSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders lines and arrows toolbar section', () => {
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    expect(screen.getByText('Lines & Arrows')).toBeInTheDocument();
    expect(screen.getByText('─')).toBeInTheDocument(); // Line button
    expect(screen.getByText('→')).toBeInTheDocument(); // Arrow button
  });

  it('creates a line when line button is clicked', async () => {
    const user = userEvent.setup();
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    const lineButton = screen.getByText('─');
    await user.click(lineButton);
    
    // Verify that upsert was called (shape creation)
    expect(mockStoreActions.upsert).toHaveBeenCalled();
    
    // Verify that the created shape has line properties
    const createdShape = mockStoreActions.upsert.mock.calls[0][0];
    expect(createdShape.type).toBe('line');
    expect(createdShape).toHaveProperty('x2');
    expect(createdShape).toHaveProperty('y2');
    expect(createdShape).toHaveProperty('stroke');
    expect(createdShape).toHaveProperty('strokeWidth');
    expect(createdShape.arrowHead).toBe('none');
  });

  it('creates an arrow when arrow button is clicked', async () => {
    const user = userEvent.setup();
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    const arrowButton = screen.getByText('→');
    await user.click(arrowButton);
    
    // Verify that upsert was called (shape creation)
    expect(mockStoreActions.upsert).toHaveBeenCalled();
    
    // Verify that the created shape has arrow properties
    const createdShape = mockStoreActions.upsert.mock.calls[0][0];
    expect(createdShape.type).toBe('arrow');
    expect(createdShape).toHaveProperty('x2');
    expect(createdShape).toHaveProperty('y2');
    expect(createdShape).toHaveProperty('stroke');
    expect(createdShape).toHaveProperty('strokeWidth');
    expect(createdShape.arrowHead).toBe('end');
  });

  it('line shape has correct default properties', async () => {
    const user = userEvent.setup();
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    const lineButton = screen.getByText('─');
    await user.click(lineButton);
    
    const createdShape = mockStoreActions.upsert.mock.calls[0][0];
    
    // Check that it has required properties
    expect(createdShape).toHaveProperty('id');
    expect(createdShape).toHaveProperty('x');
    expect(createdShape).toHaveProperty('y');
    expect(createdShape).toHaveProperty('x2');
    expect(createdShape).toHaveProperty('y2');
    expect(createdShape).toHaveProperty('updated_at');
    expect(createdShape).toHaveProperty('updated_by');
    
    // Check default values
    expect(createdShape.strokeWidth).toBe(3);
    expect(createdShape.stroke).toBeDefined();
    expect(createdShape.arrowHead).toBe('none');
  });

  it('arrow shape has correct default properties', async () => {
    const user = userEvent.setup();
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    const arrowButton = screen.getByText('→');
    await user.click(arrowButton);
    
    const createdShape = mockStoreActions.upsert.mock.calls[0][0];
    
    // Check that it has required properties
    expect(createdShape).toHaveProperty('id');
    expect(createdShape).toHaveProperty('x');
    expect(createdShape).toHaveProperty('y');
    expect(createdShape).toHaveProperty('x2');
    expect(createdShape).toHaveProperty('y2');
    expect(createdShape).toHaveProperty('updated_at');
    expect(createdShape).toHaveProperty('updated_by');
    
    // Check default values
    expect(createdShape.strokeWidth).toBe(3);
    expect(createdShape.stroke).toBeDefined();
    expect(createdShape.arrowHead).toBe('end');
  });

  it('line and arrow creation triggers history push', async () => {
    const user = userEvent.setup();
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    // Test line creation
    const lineButton = screen.getByText('─');
    await user.click(lineButton);
    
    expect(mockStoreActions.pushHistory).toHaveBeenCalled();
    
    // Clear mocks and test arrow creation
    vi.clearAllMocks();
    
    const arrowButton = screen.getByText('→');
    await user.click(arrowButton);
    
    expect(mockStoreActions.pushHistory).toHaveBeenCalled();
  });

  it('line and arrow creation triggers shape selection', async () => {
    const user = userEvent.setup();
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    // Test line creation
    const lineButton = screen.getByText('─');
    await user.click(lineButton);
    
    expect(mockStoreActions.select).toHaveBeenCalled();
    const selectedIds = mockStoreActions.select.mock.calls[0][0];
    expect(selectedIds).toHaveLength(1);
    expect(typeof selectedIds[0]).toBe('string'); // Should be a shape ID
    
    // Clear mocks and test arrow creation
    vi.clearAllMocks();
    
    const arrowButton = screen.getByText('→');
    await user.click(arrowButton);
    
    expect(mockStoreActions.select).toHaveBeenCalled();
    const arrowSelectedIds = mockStoreActions.select.mock.calls[0][0];
    expect(arrowSelectedIds).toHaveLength(1);
    expect(typeof arrowSelectedIds[0]).toBe('string');
  });

  it('lines and arrows category is expanded by default', () => {
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    const linesArrowsSection = screen.getByText('Lines & Arrows').closest('div');
    const lineButton = screen.getByText('─');
    const arrowButton = screen.getByText('→');
    
    // Both buttons should be visible (category expanded)
    expect(lineButton).toBeVisible();
    expect(arrowButton).toBeVisible();
  });

  it('line and arrow buttons have correct tooltips', async () => {
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    const lineButton = screen.getByText('─');
    const arrowButton = screen.getByText('→');
    
    expect(lineButton).toHaveAttribute('title', 'Line');
    expect(arrowButton).toHaveAttribute('title', 'Arrow');
  });
});
