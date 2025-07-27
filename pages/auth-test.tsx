import { useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { logger } from '@/lib/logger';

export default function AuthTestPage() {
  const { data: session, status } = useSession();
  const [email, setEmail] = useState('a.stroe.3022@gmail.com');
  const [password, setPassword] = useState('password123');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      setResult(res);
      logger.info('Login result:', res);
    } catch (error) {
      setResult({ error: error.message });
      logger.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Auth Test Page</h1>

      <div className="mb-6 p-4 bg-gray-100 rounded">
        <h2 className="font-semibold mb-2">Session Status:</h2>
        <pre>{JSON.stringify({ status, session }, null, 2)}</pre>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block mb-1">Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block mb-1">Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {loading ? 'Testing...' : 'Test Login'}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <h3 className="font-semibold mb-2">Result:</h3>
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}

        <div className="mt-6">
          <h3 className="font-semibold mb-2">Instructions:</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Click "Test Login" with the pre-filled credentials</li>
            <li>Check the browser console (F12) for detailed logs</li>
            <li>The result will show below the button</li>
            <li>If successful, session info will update above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
