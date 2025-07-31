import React from 'react';
import { Skeleton } from './skeleton';

export const SkeletonBudgetItem = () => (
  <div className="p-4 space-y-3">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-3 w-1/2" />
    <Skeleton className="h-8 w-full" />
  </div>
);

export const SkeletonCard = () => (
  <div className="bg-white rounded-lg shadow p-6 space-y-4">
    <Skeleton className="h-6 w-1/3" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-5/6" />
  </div>
);

export { Skeleton };
