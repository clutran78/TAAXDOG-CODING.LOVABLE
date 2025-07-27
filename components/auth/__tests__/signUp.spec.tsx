import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';
import SignUp from '../SignUp';
import * as authApi from '@/lib/api/auth';

// Mock dependencies
jest.mock('next/router');
jest.mock('@/lib/api/auth');

const mockPush = jest.fn();
const mockRegister = authApi.register as jest.MockedFunction<typeof authApi.register>;

describe('SignUp Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('renders signup form correctly', () => {
    render(<SignUp />);

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByText(/already have an account/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    render(<SignUp />);
    const user = userEvent.setup();

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      expect(screen.getAllByText(/password is required/i)).toHaveLength(2);
    });
  });

  it('validates email format', async () => {
    render(<SignUp />);
    const user = userEvent.setup();

    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, 'invalid-email');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
    });
  });

  it('validates password strength', async () => {
    render(<SignUp />);
    const user = userEvent.setup();

    const passwordInput = screen.getByLabelText(/^password$/i);
    await user.type(passwordInput, 'weak');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('validates password confirmation match', async () => {
    render(<SignUp />);
    const user = userEvent.setup();

    const passwordInput = screen.getByLabelText(/^password$/i);
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

    await user.type(passwordInput, 'Password123!');
    await user.type(confirmPasswordInput, 'Password456!');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('successfully creates account', async () => {
    mockRegister.mockResolvedValueOnce({
      success: true,
      user: { id: '123', email: 'test@example.com', name: 'Test User' },
    });

    render(<SignUp />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
      });
      expect(screen.getByText(/account created successfully/i)).toBeInTheDocument();
      expect(mockPush).toHaveBeenCalledWith('/auth/verify-email');
    });
  });

  it('handles registration error', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Email already exists'));

    render(<SignUp />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/email address/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('shows loading state during submission', async () => {
    mockRegister.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)),
    );

    render(<SignUp />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/full name/i), 'Test User');
    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');

    const submitButton = screen.getByRole('button', { name: /create account/i });
    await user.click(submitButton);

    expect(screen.getByText(/creating account/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByText(/creating account/i)).not.toBeInTheDocument();
    });
  });

  it('accepts terms and conditions', async () => {
    render(<SignUp />);
    const user = userEvent.setup();

    const termsCheckbox = screen.getByRole('checkbox', { name: /i agree to the terms/i });
    expect(termsCheckbox).not.toBeChecked();

    await user.click(termsCheckbox);
    expect(termsCheckbox).toBeChecked();
  });

  it('shows password strength indicator', async () => {
    render(<SignUp />);
    const user = userEvent.setup();

    const passwordInput = screen.getByLabelText(/^password$/i);

    // Weak password
    await user.type(passwordInput, 'weak');
    expect(screen.getByText(/weak password/i)).toBeInTheDocument();

    // Medium password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'Medium123');
    expect(screen.getByText(/medium password/i)).toBeInTheDocument();

    // Strong password
    await user.clear(passwordInput);
    await user.type(passwordInput, 'Strong123!@#');
    expect(screen.getByText(/strong password/i)).toBeInTheDocument();
  });
});
