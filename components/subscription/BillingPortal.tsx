import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { formatCurrency } from '../../lib/stripe';

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  amount: number;
  status: string;
  pdfUrl: string;
  hostedUrl: string;
}

export const BillingPortal: React.FC = () => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'payment' | 'invoices'>('overview');

  useEffect(() => {
    if (session?.user) {
      fetchPaymentMethods();
      fetchBillingHistory();
    }
  }, [session]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/stripe/payment-methods');
      const data = await response.json();
      setPaymentMethods(data.paymentMethods);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      const response = await fetch('/api/stripe/billing-history');
      const data = await response.json();
      setInvoices(data.invoices);
    } catch (error) {
      console.error('Error fetching billing history:', error);
    }
  };

  const openCustomerPortal = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stripe/create-billing-portal-session', {
        method: 'POST',
      });
      const data = await response.json();
      window.location.href = data.url;
    } catch (error) {
      console.error('Error opening customer portal:', error);
    } finally {
      setLoading(false);
    }
  };

  const setDefaultPaymentMethod = async (paymentMethodId: string) => {
    try {
      await fetch('/api/stripe/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      });
      await fetchPaymentMethods();
    } catch (error) {
      console.error('Error setting default payment method:', error);
    }
  };

  const removePaymentMethod = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;
    
    try {
      await fetch(`/api/stripe/payment-methods?paymentMethodId=${paymentMethodId}`, {
        method: 'DELETE',
      });
      await fetchPaymentMethods();
    } catch (error) {
      console.error('Error removing payment method:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'overview'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('payment')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'payment'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Payment Methods
            </button>
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'invoices'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Invoices
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Billing Overview</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  Manage your subscription, payment methods, and download invoices through the Stripe Customer Portal.
                </p>
                <button
                  onClick={openCustomerPortal}
                  disabled={loading}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Open Customer Portal'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Payment Methods</h3>
              {paymentMethods.length === 0 ? (
                <p className="text-gray-500">No payment methods found.</p>
              ) : (
                <div className="space-y-4">
                  {paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className="border rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <div className="mr-4">
                          <svg className="w-10 h-10" viewBox="0 0 40 24">
                            <rect width="40" height="24" rx="4" fill="#E5E7EB" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium capitalize">
                            {method.brand} •••• {method.last4}
                          </p>
                          <p className="text-sm text-gray-500">
                            Expires {method.expMonth}/{method.expYear}
                          </p>
                          {method.isDefault && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Default
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {!method.isDefault && (
                          <button
                            onClick={() => setDefaultPaymentMethod(method.id)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Set as default
                          </button>
                        )}
                        <button
                          onClick={() => removePaymentMethod(method.id)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'invoices' && (
            <div>
              <h3 className="text-lg font-medium mb-4">Billing History</h3>
              {invoices.length === 0 ? (
                <p className="text-gray-500">No invoices found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Invoice Number
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {invoices.map((invoice) => (
                        <tr key={invoice.id}>
                          <td className="px-4 py-3 text-sm">
                            {new Date(invoice.date).toLocaleDateString('en-AU')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {invoice.invoiceNumber || invoice.id}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {formatCurrency(invoice.amount)}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span
                              className={`px-2 py-1 text-xs rounded-full ${
                                invoice.status === 'paid'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex space-x-2">
                              <a
                                href={`/api/stripe/tax-invoice?invoiceId=${invoice.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                Tax Invoice
                              </a>
                              {invoice.pdfUrl && (
                                <a
                                  href={invoice.pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  PDF
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};