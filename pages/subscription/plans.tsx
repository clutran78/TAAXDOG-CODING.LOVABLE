import React from 'react';
import { SubscriptionPlans } from '../../components/subscription/SubscriptionPlans';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { prisma } from '../../lib/prisma';

interface PlansPageProps {
  hasActiveSubscription: boolean;
}

export default function PlansPage({ hasActiveSubscription }: PlansPageProps) {
  if (hasActiveSubscription) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              You already have an active subscription
            </h2>
            <p className="mt-4 text-gray-600">
              To change or manage your subscription, please visit your account settings.
            </p>
            <a
              href="/account/subscription"
              className="mt-6 inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              Manage Subscription
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SubscriptionPlans />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user?.id) {
    return {
      props: {
        hasActiveSubscription: false,
      },
    };
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });

  const hasActiveSubscription =
    subscription?.status === 'ACTIVE' || subscription?.status === 'TRIALING';

  return {
    props: {
      hasActiveSubscription,
    },
  };
};
