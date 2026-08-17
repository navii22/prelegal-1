/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function TestHarness({
  onError,
}: {
  onError?: (err: Error) => void;
}) {
  const { user, loading, demoLogin, signin, signup } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user-email">{user?.email ?? 'anonymous'}</div>
      <button onClick={() => demoLogin('Alice').catch((e) => onError?.(e))}>
        Continue as Demo User
      </button>
      <button onClick={() => signin('test@example.com', 'password123').catch((e) => onError?.(e))}>
        Sign In
      </button>
      <button onClick={() => signup('test@example.com', 'password123').catch((e) => onError?.(e))}>
        Sign Up
      </button>
    </div>
  );
}

describe('demo login (KAN-12)', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('demoLogin calls /api/auth/demo and sets the demo user', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/auth/me') {
        return { ok: false, json: async () => ({ detail: 'Not authenticated' }) };
      }
      return {
        ok: true,
        json: async () => ({
          user: { id: 99, email: 'demo.522b276a356b@prelegal.local' },
          message: 'Signed in as demo user',
        }),
      };
    });

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    const button = screen.getByText('Continue as Demo User');
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/demo',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Alice' }),
        })
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('user-email').textContent).toBe('demo.522b276a356b@prelegal.local');
    });
  });

  it('surfaces an error when demo login fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ detail: 'Demo login failed' }),
    });

    render(
      <AuthProvider>
        <TestHarness />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Continue as Demo User'));

    await waitFor(() => {
      expect(screen.getByTestId('user-email').textContent).toBe('anonymous');
    });
  });

  it('handles non-JSON 500 error gracefully without throwing JSON parse error', async () => {
    let capturedError: Error | null = null;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => {
        throw new SyntaxError("Unexpected token 'I', \"Internal S\"... is not valid JSON");
      },
    });

    render(
      <AuthProvider>
        <TestHarness onError={(e) => { capturedError = e; }} />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Continue as Demo User'));

    await waitFor(() => {
      expect(capturedError).not.toBeNull();
      expect(capturedError?.message).toContain('Server error (500)');
    });
  });

  it('handles non-JSON error in signin and signup gracefully', async () => {
    let capturedError: Error | null = null;
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new SyntaxError("Unexpected token '<', \"<html>\"... is not valid JSON");
      },
    });

    render(
      <AuthProvider>
        <TestHarness onError={(e) => { capturedError = e; }} />
      </AuthProvider>
    );

    fireEvent.click(screen.getByText('Sign In'));

    await waitFor(() => {
      expect(capturedError).not.toBeNull();
      expect(capturedError?.message).toContain('Server error (502)');
    });

    capturedError = null;
    fireEvent.click(screen.getByText('Sign Up'));

    await waitFor(() => {
      expect(capturedError).not.toBeNull();
      expect(capturedError?.message).toContain('Server error (502)');
    });
  });
});