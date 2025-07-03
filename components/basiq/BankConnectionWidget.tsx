import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { BasiqInstitution, BasiqConnection } from '@/lib/basiq/types';

interface BankConnectionWidgetProps {
  onConnectionSuccess?: (connection: BasiqConnection) => void;
  onConnectionError?: (error: string) => void;
}

export default function BankConnectionWidget({ 
  onConnectionSuccess, 
  onConnectionError 
}: BankConnectionWidgetProps) {
  const { data: session } = useSession();
  const [institutions, setInstitutions] = useState<BasiqInstitution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<BasiqInstitution | null>(null);
  const [connections, setConnections] = useState<BasiqConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({
    loginId: '',
    password: '',
    securityCode: '',
  });
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);

  // Fetch institutions on component mount
  useEffect(() => {
    fetchInstitutions();
    fetchConnections();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const response = await fetch('/api/basiq/institutions');
      if (!response.ok) throw new Error('Failed to fetch institutions');
      const data = await response.json();
      setInstitutions(data.institutions);
    } catch (err: any) {
      console.error('Error fetching institutions:', err);
      setError('Failed to load banks');
    }
  };

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/basiq/connections');
      if (!response.ok) throw new Error('Failed to fetch connections');
      const data = await response.json();
      setConnections(data.connections || []);
    } catch (err: any) {
      console.error('Error fetching connections:', err);
    }
  };

  const handleInstitutionSelect = (institution: BasiqInstitution) => {
    setSelectedInstitution(institution);
    setShowCredentialsForm(true);
    setError(null);
  };

  const handleConnect = async () => {
    if (!selectedInstitution) return;

    setLoading(true);
    setError(null);

    try {
      // Check if BASIQ user exists, create if not
      const userResponse = await fetch('/api/basiq/users');
      if (!userResponse.ok) {
        // Create BASIQ user
        const createUserResponse = await fetch('/api/basiq/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session?.user?.email,
          }),
        });

        if (!createUserResponse.ok) {
          throw new Error('Failed to create BASIQ user');
        }
      }

      // Create connection
      const response = await fetch('/api/basiq/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institution: selectedInstitution.id,
          loginId: credentials.loginId,
          password: credentials.password,
          securityCode: credentials.securityCode || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to connect bank');
      }

      const data = await response.json();
      
      // Reset form
      setCredentials({ loginId: '', password: '', securityCode: '' });
      setShowCredentialsForm(false);
      setSelectedInstitution(null);

      // Refresh connections
      await fetchConnections();

      // Callback
      if (onConnectionSuccess) {
        onConnectionSuccess(data.connection);
      }

      // Sync accounts
      await syncAccounts();
    } catch (err: any) {
      setError(err.message);
      if (onConnectionError) {
        onConnectionError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const syncAccounts = async () => {
    try {
      await fetch('/api/basiq/accounts?sync=true');
    } catch (err) {
      console.error('Error syncing accounts:', err);
    }
  };

  const handleRefreshConnection = async (connectionId: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/basiq/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh connection');
      }

      await fetchConnections();
      await syncAccounts();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to remove this bank connection?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/basiq/connections?id=${connectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete connection');
      }

      await fetchConnections();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const popularInstitutions = institutions.filter(inst => inst.isPopular);
  const otherInstitutions = institutions.filter(inst => !inst.isPopular);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-6">Bank Connections</h2>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Existing Connections */}
      {connections.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-medium mb-4">Connected Banks</h3>
          <div className="space-y-3">
            {connections.map((connection) => (
              <div key={connection.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  {connection.institution.logo && (
                    <img 
                      src={connection.institution.logo.links.square} 
                      alt={connection.institution.name}
                      className="w-12 h-12 rounded"
                    />
                  )}
                  <div>
                    <p className="font-medium">{connection.institution.name}</p>
                    <p className="text-sm text-gray-500">
                      Status: <span className={`font-medium ${
                        connection.status === 'success' ? 'text-green-600' : 
                        connection.status === 'error' ? 'text-red-600' : 
                        'text-yellow-600'
                      }`}>{connection.status}</span>
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleRefreshConnection(connection.id)}
                    disabled={loading}
                    className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => handleDeleteConnection(connection.id)}
                    disabled={loading}
                    className="px-3 py-1 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add New Connection */}
      {!showCredentialsForm ? (
        <div>
          <h3 className="text-lg font-medium mb-4">Add Bank Connection</h3>
          
          {/* Popular Banks */}
          <div className="mb-6">
            <p className="text-sm text-gray-600 mb-3">Popular Australian Banks</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {popularInstitutions.map((institution) => (
                <button
                  key={institution.id}
                  onClick={() => handleInstitutionSelect(institution)}
                  className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
                >
                  {institution.logo && (
                    <img 
                      src={institution.logo.links.square} 
                      alt={institution.name}
                      className="w-16 h-16 mx-auto mb-2"
                    />
                  )}
                  <p className="text-sm font-medium text-center">{institution.shortName}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Other Banks */}
          <details className="cursor-pointer">
            <summary className="text-sm text-gray-600 mb-3 hover:text-gray-800">
              Other Banks ({otherInstitutions.length})
            </summary>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {otherInstitutions.map((institution) => (
                <button
                  key={institution.id}
                  onClick={() => handleInstitutionSelect(institution)}
                  className="p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                >
                  <p className="text-sm font-medium">{institution.name}</p>
                </button>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">Connect to {selectedInstitution?.name}</h3>
            <button
              onClick={() => {
                setShowCredentialsForm(false);
                setSelectedInstitution(null);
                setCredentials({ loginId: '', password: '', securityCode: '' });
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleConnect(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {selectedInstitution?.loginIdCaption || 'Login ID'}
              </label>
              <input
                type="text"
                value={credentials.loginId}
                onChange={(e) => setCredentials({ ...credentials, loginId: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {selectedInstitution?.passwordCaption || 'Password'}
              </label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {selectedInstitution?.features?.includes('security_code') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Security Code (if required)
                </label>
                <input
                  type="text"
                  value={credentials.securityCode}
                  onChange={(e) => setCredentials({ ...credentials, securityCode: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            )}

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || !credentials.loginId || !credentials.password}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Connecting...' : 'Connect Bank'}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Your credentials are encrypted and securely transmitted to your bank.
              We do not store your banking passwords.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}