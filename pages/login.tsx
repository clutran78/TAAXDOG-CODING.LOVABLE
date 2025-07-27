import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, test if credentials are valid
      const testResponse = await fetch('/api/test-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!testResponse.ok) {
        const data = await testResponse.json();
        setError(data.message || 'Invalid credentials');
        setLoading(false);
        return;
      }

      // If test passed, try NextAuth login
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Login failed. Please try again.');
      } else if (result?.ok) {
        // Force a hard redirect
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login - TaxReturnPro</title>
        <style>{`
          body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          * {
            box-sizing: border-box;
          }
        `}</style>
      </Head>

      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
            width: '100%',
            maxWidth: '400px',
            padding: '40px',
          }}
        >
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '20px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                fontWeight: 'bold',
                color: 'white',
                marginBottom: '20px',
              }}
            >
              T
            </div>
            <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#333' }}>Welcome Back</h1>
            <p style={{ margin: 0, color: '#666', fontSize: '16px' }}>Sign in to your account</p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                background: '#fee',
                border: '1px solid #fcc',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px',
                color: '#c33',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#333',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                onBlur={(e) => (e.target.style.borderColor = '#e0e0e0')}
                placeholder="you@example.com"
              />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#333',
                  fontSize: '14px',
                  fontWeight: '500',
                }}
              >
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '10px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#667eea')}
                onBlur={(e) => (e.target.style.borderColor = '#e0e0e0')}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: '600',
                color: 'white',
                background: loading ? '#999' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                borderRadius: '10px',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'transform 0.2s',
                marginBottom: '20px',
              }}
              onMouseOver={(e) =>
                !loading && (e.currentTarget.style.transform = 'translateY(-2px)')
              }
              onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Links */}
          <div style={{ textAlign: 'center', fontSize: '14px' }}>
            <a
              href="/auth/forgot-password"
              style={{
                color: '#667eea',
                textDecoration: 'none',
                marginBottom: '10px',
                display: 'block',
              }}
            >
              Forgot your password?
            </a>
            <p style={{ margin: '20px 0 0 0', color: '#666' }}>
              Don't have an account?{' '}
              <a
                href="/register"
                style={{
                  color: '#667eea',
                  textDecoration: 'none',
                  fontWeight: '500',
                }}
              >
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
