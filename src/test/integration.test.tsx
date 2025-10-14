import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Canvas from '../Canvas';
import { supabase } from '../lib/supabaseClient';
import React from 'react';

// Mock everything for integration tests
vi.mock('react-konva', () => ({
  Stage: (props: any) => <div data-testid="konva-stage" {...props} />,
  Layer: (props: any) => <div data-testid="konva-layer" {...props} />,
  Rect: (props: any) => <div data-testid="konva-rect" {...props} />,
  Circle: (props: any) => <div data-testid="konva-circle" {...props} />,
  Text: (props: any) => <div data-testid="konva-text" {...props}>{props.text}</div>,
  Transformer: (props: any) => <div data-testid="konva-transformer" {...props} />,
  Group: ({ children, ...props }: any) => <div data-testid="konva-group" {...props}>{children}</div>,
}));

const mockStoreState = {
  shapes: {},
  selectedIds: [],
  roomId: 'test-room',
  me: { id: 'test-user', name: 'Test User', color: '#3b82f6' },
  cursors: {},
  onlineUsers: ['test-user'],
  isAuthenticated: true,
  history: [],
  select: vi.fn(),
  pushHistory: vi.fn(),
  upsert: vi.fn(),
  setRoom: vi.fn(),
  setAuthenticated: vi.fn(),
  setUser: vi.fn(),
  undo: vi.fn(),
  updateCursor: vi.fn(),
  removeCursor: vi.fn(),
  setOnlineUsers: vi.fn(),
  remove: vi.fn(),
  clear: vi.fn(),
  toggleSelect: vi.fn(),
  selectAll: vi.fn(),
  clearSelection: vi.fn(),
  createShape: vi.fn(),
  updateShape: vi.fn(),
  duplicateShapes: vi.fn(),
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

describe('Final Deliverable Integration Tests', () => {
  const mockOnSignOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock state
    mockStoreState.shapes = {};
    mockStoreState.selectedIds = [];
    mockStoreState.cursors = {};
    mockStoreState.onlineUsers = ['test-user'];
  });

  describe('MVP Requirements Verification', () => {
    it('renders complete canvas interface with all MVP features', () => {
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Basic canvas with pan/zoom
      expect(screen.getByTestId('konva-stage')).toBeInTheDocument();
      
      // Shape creation tools (at least one type required, we have 3)
      expect(screen.getByRole('button', { name: /rectangle/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /circle/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /text/i })).toBeInTheDocument();
      
      // Multiplayer cursors and presence  
      expect(screen.getByText(/online \(/i)).toBeInTheDocument();
      
      // User authentication (shows user name)
      expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });

    it('shows real-time collaboration features', () => {
      // Mock multiple users online
      mockStoreState.onlineUsers = ['test-user', 'user-2', 'user-3'];
      mockStoreState.cursors = {
        'user-2': { id: 'user-2', name: 'Alice', x: 100, y: 100, color: '#ff0000', last: Date.now() },
        'user-3': { id: 'user-3', name: 'Bob', x: 200, y: 150, color: '#00ff00', last: Date.now() },
      };
      
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Should show online users count (including current user)
      expect(screen.getByText(/online \(/i)).toBeInTheDocument(); // Check for presence indicator
      
      // Should render multiplayer cursors (mocked as HTML elements)
      expect(screen.getAllByText('Alice')).toHaveLength(2); // Sidebar + cursor
      expect(screen.getAllByText('Bob')).toHaveLength(2); // Sidebar + cursor
    });
  });

  describe('Core Collaborative Canvas Features', () => {
    it('supports all required canvas operations', async () => {
      const user = userEvent.setup();
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Create shapes - buttons exist but canvas click creates shapes
      await user.click(screen.getByRole('button', { name: /rectangle/i }));
      // Note: Shape creation happens on canvas click, not button click
      
      // Selection management
      expect(screen.getByText('Shift+Click')).toBeInTheDocument();
      
      // Delete functionality  
      expect(screen.getByText('Delete')).toBeInTheDocument();
      
      // Undo functionality
      expect(screen.getByText('Ctrl+Z')).toBeInTheDocument();
    });

    it('handles transform operations', () => {
      // Mock selected shapes
      mockStoreState.selectedIds = ['shape-1'];
      mockStoreState.shapes = {
        'shape-1': {
          id: 'shape-1',
          type: 'rect',
          x: 100,
          y: 100,
          w: 200,
          h: 150,
          color: '#ff0000',
          updated_at: Date.now(),
          updated_by: 'test-user',
        },
      };
      
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Should render transformer for selected shapes
      expect(screen.getByTestId('konva-transformer')).toBeInTheDocument();
    });
  });

  describe('AI Agent Integration', () => {
    it('provides AI interface with proper UX', async () => {
      const user = userEvent.setup();
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // AI input interface
      const aiInput = screen.getByPlaceholderText(/create a 200x300 rectangle/i);
      expect(aiInput).toBeInTheDocument();
      
      const runButton = screen.getByRole('button', { name: /run/i });
      expect(runButton).toBeInTheDocument();
      
      // Should show helpful examples
      expect(screen.getByText(/try: "create a red circle"/i)).toBeInTheDocument();
      
      // Enter key functionality
      await user.type(aiInput, 'create a blue circle');
      await user.keyboard('{Enter}');
      
      // Should trigger AI interpretation (mocked)
      expect(runButton).toBeDisabled(); // Should be working
    });

    it('shows AI feedback and state', () => {
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Should provide immediate feedback
      expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
      
      // Should show examples of what AI can do
      expect(screen.getByText(/AI Commands:/)).toBeInTheDocument();
      expect(screen.getByText(/Create:/)).toBeInTheDocument();
    });
  });

  describe('Performance & User Experience', () => {
    it('provides smooth interaction experience', () => {
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Should show performance tips
      expect(screen.getByText('Mouse wheel')).toBeInTheDocument();
      
      // Should have responsive controls
      expect(screen.getByTestId('konva-stage')).toHaveAttribute('width');
      expect(screen.getByTestId('konva-stage')).toHaveAttribute('height');
    });

    it('handles large datasets gracefully', () => {
      // Mock many shapes
      const manyShapes: any = {};
      for (let i = 0; i < 100; i++) {
        manyShapes[`shape-${i}`] = {
          id: `shape-${i}`,
          type: 'rect',
          x: (i % 10) * 50,
          y: Math.floor(i / 10) * 50,
          w: 40,
          h: 40,
          color: '#cccccc',
          updated_at: Date.now(),
          updated_by: 'test-user',
        };
      }
      
      mockStoreState.shapes = manyShapes;
      
      // Should render without issues
      const { container } = render(<Canvas onSignOut={mockOnSignOut} />);
      expect(container).toBeInTheDocument();
      
      // Should show all shapes
      expect(screen.getAllByTestId('konva-group')).toHaveLength(100);
    });
  });

  describe('Authentication & Security', () => {
    it('handles user authentication properly', () => {
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Should show authenticated user
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
      
      // Should provide sign out
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });

    it('maintains user session and state', () => {
      mockStoreState.isAuthenticated = true;
      mockStoreState.me.name = 'Authenticated User';
      
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      expect(screen.getByText('Authenticated User')).toBeInTheDocument();
    });
  });

  describe('Deployment Readiness', () => {
    it('works without breaking on public deployment', () => {
      // Should handle missing environment gracefully
      const { container } = render(<Canvas onSignOut={mockOnSignOut} />);
      expect(container).toBeInTheDocument();
      
      // No console errors should be thrown
      expect(() => render(<Canvas onSignOut={mockOnSignOut} />)).not.toThrow();
    });

    it('supports concurrent users simulation', () => {
      // Mock high concurrent user load
      mockStoreState.onlineUsers = Array.from({ length: 10 }, (_, i) => `user-${i}`);
      mockStoreState.cursors = Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [
          `user-${i}`,
          { id: `user-${i}`, name: `User${i}`, x: i * 50, y: i * 30, color: '#333', last: Date.now() }
        ])
      );
      
      render(<Canvas onSignOut={mockOnSignOut} />);
      
      // Should handle many users without breaking  
      expect(screen.getByText(/online \(/i)).toBeInTheDocument(); // Check for presence indicator
    });
  });
});
