import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import BankConnectionWidget from '@/components/basiq/BankConnectionWidget';
import AccountSummary from '@/components/basiq/AccountSummary';
import TransactionList from '@/components/basiq/TransactionList';
import { Tab } from '@headlessui/react';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function BankingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  const tabs = [
    { name: 'Overview', component: AccountSummary },
    { name: 'Bank Connections', component: BankConnectionWidget },
    { name: 'Transactions', component: TransactionList },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Banking & Transactions</h1>
          <p className="mt-2 text-gray-600">
            Connect your Australian bank accounts to automatically import and categorize transactions for tax purposes.
          </p>
        </div>

        <Tab.Group>
          <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 mb-8">
            {tabs.map((tab) => (
              <Tab
                key={tab.name}
                className={({ selected }) =>
                  classNames(
                    'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                    'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                    selected
                      ? 'bg-white text-blue-700 shadow'
                      : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                  )
                }
              >
                {tab.name}
              </Tab>
            ))}
          </Tab.List>

          <Tab.Panels>
            <Tab.Panel>
              <AccountSummary />
            </Tab.Panel>

            <Tab.Panel>
              <BankConnectionWidget 
                onConnectionSuccess={() => {
                  // Refresh the page or show success message
                  window.location.reload();
                }}
                onConnectionError={(error) => {
                  console.error('Connection error:', error);
                }}
              />
            </Tab.Panel>

            <Tab.Panel>
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold mb-4">Select Account</h2>
                  <select
                    value={selectedAccountId || ''}
                    onChange={(e) => setSelectedAccountId(e.target.value || null)}
                    className="w-full md:w-auto px-4 py-2 border rounded-md"
                  >
                    <option value="">Select an account to view transactions</option>
                    {/* This will be populated from the API */}
                  </select>
                </div>

                {selectedAccountId && (
                  <TransactionList 
                    accountId={selectedAccountId}
                    onTransactionUpdate={(transactionId, updates) => {
                      console.log('Transaction updated:', transactionId, updates);
                    }}
                  />
                )}
              </div>
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>

        {/* Security Notice */}
        <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Bank-Level Security</h3>
          <ul className="space-y-2 text-blue-800">
            <li>• Your banking credentials are encrypted and transmitted directly to your bank</li>
            <li>• We use BASIQ's secure API infrastructure compliant with Australian banking standards</li>
            <li>• We never store your banking passwords on our servers</li>
            <li>• All data is stored in Australian data centers in compliance with privacy laws</li>
            <li>• You can revoke access at any time through your bank's security settings</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}