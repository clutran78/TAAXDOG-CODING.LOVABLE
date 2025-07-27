import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import Login from '../Login';

// Mock dependencies
jest.mock('next/navigation');
jest.mock('@/providers/dark-mode-provider', () => ({
  useDarkMode: () => ({ darkMode: false }),
}));
jest.mock('@/hooks/useApiError', () => ({
  useApiError: () => ({
    error: null,
    isLoading: false,
    clearError: jest.fn(),
  }),
  parseErrorResponse: jest.fn((error) => error.message || 'An error occurred'),
}));
jest.mock('js-cookie', () => ({
  set: jest.fn(),
  get: jest.fn(),
}));

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  pathname: '/auth/login',
  query: {},
  asPath: '/auth/login',
};

describe('Login Component', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    global.fetch = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders login form correctly', () => {
    render(<Login />);
    
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/don't have an account/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    render(<Login />);
    
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });
  });

  it('validates email format', async () => {
    const user = userEvent.setup();
    render(<Login />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });

  it('handles successful login', async () => {
    const user = userEvent.setup();
    const mockResponse = {
      success: true,
      data: {
        user: {
          id: '123',
          email: 'test@example.com',
          name: 'Test User',
          role: 'USER',
        },
        token: 'mock-token',
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    render(<Login />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });
      
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles login error', async () => {
    const user = userEvent.setup();
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Invalid email or password',
        message: 'The email or password you entered is incorrect',
      }),
    });

    render(<Login />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);
    
    await waitFor(() => {
      const errorMessage = screen.getByText(/the email or password you entered is incorrect/i);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    render(<Login />);
    
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const toggleButton = screen.getByLabelText(/toggle password visibility/i);
    
    // Initially password should be hidden
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click to show password
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click again to hide password
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('disables form during submission', async () => {
    const user = userEvent.setup();
    
    (global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 1000))
    );

    render(<Login />);
    
    const emailInput = screen.getByPlaceholderText('Enter your email');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/signing in/i)).toBeInTheDocument();
  });

  it('navigates to signup page', async () => {
    const user = userEvent.setup();
    render(<Login />);
    
    const signupLink = screen.getByText(/sign up/i);
    await user.click(signupLink);
    
    expect(mockPush).toHaveBeenCalledWith('/auth/sign-up');
  });

  it('navigates to forgot password page', async () => {
    const user = userEvent.setup();
    render(<Login />);
    
    const forgotPasswordLink = screen.getByText(/forgot password/i);
    await user.click(forgotPasswordLink);
    
    expect(mockPush).toHaveBeenCalledWith('/auth/forgot-password');
  });
});