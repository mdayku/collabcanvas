import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Auth from '../Auth';
import { supabase } from '../lib/supabaseClient';

// Mock the store
vi.mock('../state/store', () => ({
  randomColor: vi.fn(() => '#3b82f6'),
}));

describe('Auth Component', () => {
  const mockOnAuthSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form by default', () => {
    render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('switches to signup form when clicking signup link', async () => {
    const user = userEvent.setup();
    render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const signupLink = screen.getByText("Don't have an account? Sign up");
    await user.click(signupLink);
    
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
  });

  it('handles login form submission', async () => {
    const user = userEvent.setup();
    const mockUser = { 
      id: 'user-1', 
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2023-01-01T00:00:00Z'
    };
    const mockProfile = { id: 'user-1', display_name: 'Test User', avatar_color: '#3b82f6' };
    
    // Mock successful login
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: mockUser, session: null },
      error: null,
    });
    
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
        }),
      }),
    } as any);

    render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
    
    await waitFor(() => {
      expect(mockOnAuthSuccess).toHaveBeenCalledWith(mockUser, mockProfile);
    });
  });

  it('displays error message on login failure', async () => {
    const user = userEvent.setup();
    
    // Mock failed login
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' } as any,
    });

    render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
  });

  it('has password minimum length requirement', async () => {
    const user = userEvent.setup();
    render(<Auth onAuthSuccess={mockOnAuthSuccess} />);
    
    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(passwordInput, '123'); // Less than 6 characters
    
    // Check that the input has the minLength attribute
    expect(passwordInput).toHaveAttribute('minlength', '6');
    expect(passwordInput).toHaveValue('123');
  });
});
