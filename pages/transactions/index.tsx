import { withAuth } from '@/lib/auth/middleware';
import { lazyLoadPage } from '@/lib/utils/lazyLoad';
import Layout from '@/components/Layout';
import Head from 'next/head';

// Lazy load the transactions dashboard
const TransactionsDashboard = lazyLoadPage(
  () => import('@/components/transactions/TransactionsDashboard'),
);

function TransactionsPage() {
  return (
    <>
      <Head>
        <title>Transactions - TaxReturnPro</title>
        <meta
          name="description"
          content="Manage your financial transactions"
        />
      </Head>
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="mt-1 text-sm text-gray-600">
              View and manage all your financial transactions
            </p>
          </div>
          <TransactionsDashboard />
        </div>
      </Layout>
    </>
  );
}

export default withAuth(TransactionsPage);
