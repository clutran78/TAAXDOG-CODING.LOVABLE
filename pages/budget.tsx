import type { GetServerSideProps, NextPage } from 'next';
import { getSession } from 'next-auth/react';
import { BudgetDashboard } from '../components/budget/BudgetDashboard';
import Head from 'next/head';

const BudgetPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Budget & Insights - TaxReturnPro</title>
        <meta
          name="description"
          content="AI-powered budget management and financial insights"
        />
      </Head>
      <BudgetDashboard />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/auth/signin',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};

export default BudgetPage;
