import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';
import ForgotPassword from '../ForgotPassword';

// Mock the API call
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock router
jest.mock('next/router');
const mockPush = jest.fn();

describe('ForgotPassword Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('renders forgot password form correctly', () => {
    render(<ForgotPassword />);

    expect(screen.getByText(/reset your password/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    expect(screen.getByText(/back to login/i)).toBeInTheDocument();
  });

  it('validates email format', async () => {
    render(<ForgotPassword />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    await user.type(emailInput, 'invalid-email');
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
    });
  });

  it('requires email field', async () => {
    render(<ForgotPassword />);
    const user = userEvent.setup();

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
  });

  it('successfully sends reset link', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Reset link sent' }),
    });

    render(<ForgotPassword />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      expect(screen.getByText(/reset link sent/i)).toBeInTheDocument();
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'User not found' }),
    });

    render(<ForgotPassword />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'nonexistent@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/user not found/i)).toBeInTheDocument();
    });
  });

  it('handles network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    render(<ForgotPassword />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ message: 'Reset link sent' }),
              }),
            100,
          ),
        ),
    );

    render(<ForgotPassword />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    await user.click(submitButton);

    expect(screen.getByText(/sending/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText(/sending/i)).not.toBeInTheDocument();
    });
  });

  it('prevents multiple submissions', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Reset link sent' }),
    });

    render(<ForgotPassword />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });

    // Double click
    await user.click(submitButton);
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it('navigates back to login', async () => {
    render(<ForgotPassword />);
    const user = userEvent.setup();

    const backLink = screen.getByText(/back to login/i);
    await user.click(backLink);

    expect(mockPush).toHaveBeenCalledWith('/auth/login');
  });

  it('shows resend option after successful submission', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Reset link sent' }),
    });

    render(<ForgotPassword />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'test@example.com');

    const submitButton = screen.getByRole('button', { name: /send reset link/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/didn't receive the email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /resend/i })).toBeInTheDocument();
    });
  });
});
