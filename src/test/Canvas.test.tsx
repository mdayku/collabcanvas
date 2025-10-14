import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

// Create a proper Zustand-like mock
const mockStoreState = {
  shapes: {},
  selectedIds: [],
  roomId: 'test-room',
  me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
  cursors: {},
  onlineUsers: [],
  isAuthenticated: false,
  history: [],
  select: vi.fn(),
  pushHistory: vi.fn(),
  upsert: vi.fn(),
  setRoom: vi.fn(),
  setAuthenticated: vi.fn(),
  setUser: vi.fn(),
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

describe('Canvas Component', () => {
  const mockOnSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the canvas interface', () => {
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    // Check for main elements
    expect(screen.getByText('CollabCanvas')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
    expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
  });

  it('renders toolbar buttons', () => {
    render(<Canvas onSignOut={mockOnSignOut} />);
    
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
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    // Check shape categories are present
    expect(screen.getByText('Shapes')).toBeInTheDocument();
    expect(screen.getByText('Emojis')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();
  });

  it('renders AI input box', () => {
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    const aiInput = screen.getByPlaceholderText(/create a dashboard layout/i);
    expect(aiInput).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
  });

  it('calls onSignOut when sign out button is clicked', async () => {
    const user = userEvent.setup();
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    const signOutButton = screen.getByText('Sign out');
    await user.click(signOutButton);
    
    expect(mockOnSignOut).toHaveBeenCalled();
  });

  it('renders user information', () => {
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('shows performance hints', async () => {
    const user = userEvent.setup();
    render(<Canvas onSignOut={mockOnSignOut} />);
    
    // Performance hints are now in the Help menu
    const helpButton = screen.getByRole('button', { name: '?' });
    await user.click(helpButton);
    expect(screen.getByText('Ctrl+Z')).toBeInTheDocument();
    expect(screen.getByText('Shift+Click')).toBeInTheDocument();
  });
});
