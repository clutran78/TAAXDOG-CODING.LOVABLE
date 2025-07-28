import Head from 'next/head';

export default function TestPage() {
  return (
    <>
      <Head>
        <title>Test Page - TaxReturnPro</title>
      </Head>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Test Page</h1>
          <p className="text-lg text-gray-600 mb-8">
            This is a simple test page without authentication.
          </p>
          <p className="text-sm text-gray-500">
            Server Time: {new Date().toISOString()}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Environment: {process.env.NODE_ENV || 'development'}
          </p>
        </div>
      </div>
    </>
  );
}

// Export getServerSideProps to verify SSR is working
export async function getServerSideProps() {
  return {
    props: {
      serverTime: new Date().toISOString(),
    },
  };
}