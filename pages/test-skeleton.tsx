import React from 'react';
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTransactionRow,
  SkeletonStatsCard,
  SkeletonTable,
  SkeletonForm,
  SkeletonBankAccount,
  SkeletonBudgetItem,
  SkeletonDashboardGrid,
  LoadingOverlay,
  InlineLoader,
  LoadingButton,
  ProgressBar,
} from '@/components/ui/SkeletonLoaders';

export default function TestSkeletonPage() {
  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Skeleton Loader Test Page</h1>

      {/* Basic Skeleton */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Basic Skeleton</h2>
        <div className="space-y-2">
          <Skeleton />
          <Skeleton
            width={200}
            height={30}
            rounded
          />
          <Skeleton
            width={100}
            height={100}
            circle
          />
        </div>
      </section>

      {/* Skeleton Text */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Skeleton Text</h2>
        <SkeletonText lines={4} />
      </section>

      {/* Skeleton Card */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Skeleton Card</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </section>

      {/* Transaction Row */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Transaction Rows</h2>
        <div className="bg-white rounded-lg shadow">
          <SkeletonTransactionRow />
          <SkeletonTransactionRow />
          <SkeletonTransactionRow />
        </div>
      </section>

      {/* Stats Cards */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Stats Cards</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SkeletonStatsCard />
          <SkeletonStatsCard />
          <SkeletonStatsCard />
          <SkeletonStatsCard />
        </div>
      </section>

      {/* Table */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Table Skeleton</h2>
        <SkeletonTable
          rows={5}
          columns={4}
        />
      </section>

      {/* Form */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Form Skeleton</h2>
        <div className="max-w-md">
          <SkeletonForm fields={4} />
        </div>
      </section>

      {/* Bank Account */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Bank Account</h2>
        <div className="max-w-2xl space-y-3">
          <SkeletonBankAccount />
          <SkeletonBankAccount />
        </div>
      </section>

      {/* Budget Item */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Budget Items</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonBudgetItem />
          <SkeletonBudgetItem />
        </div>
      </section>

      {/* Loading Components */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Loading Components</h2>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <InlineLoader size="sm" />
            <InlineLoader size="md" />
            <InlineLoader size="lg" />
          </div>

          <div className="space-x-4">
            <LoadingButton loading={true}>Loading Button</LoadingButton>
            <LoadingButton loading={false}>Normal Button</LoadingButton>
          </div>

          <div className="max-w-md">
            <ProgressBar
              progress={65}
              message="Processing..."
            />
          </div>
        </div>
      </section>

      {/* Dashboard Grid */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Dashboard Grid</h2>
        <SkeletonDashboardGrid />
      </section>

      {/* Animation Test */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Animation Test</h2>
        <p className="text-sm text-gray-600 mb-4">
          All skeleton elements should have a pulsing animation effect.
        </p>
        <div className="bg-gray-200 animate-pulse h-8 w-full rounded mb-2"></div>
        <div className="bg-gray-200 animate-pulse h-8 w-3/4 rounded mb-2"></div>
        <div className="bg-gray-200 animate-pulse h-8 w-1/2 rounded"></div>
      </section>
    </div>
  );
}
