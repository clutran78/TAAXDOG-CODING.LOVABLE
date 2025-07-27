import type { GetServerSideProps, NextPage } from 'next';
import { getSession } from 'next-auth/react';
import { ReceiptManagement } from '../components/receipts/ReceiptManagement';
import Head from 'next/head';

const ReceiptsPage: NextPage = () => {
  return (
    <>
      <Head>
        <title>Receipt Management - TaxReturnPro</title>
        <meta
          name="description"
          content="Upload and manage your tax receipts with AI-powered extraction"
        />
      </Head>
      <ReceiptManagement />
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

export default ReceiptsPage;
