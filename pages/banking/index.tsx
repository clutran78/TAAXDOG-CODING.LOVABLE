import { lazyLoadPage } from '@/lib/utils/lazyLoad';

// Lazy load the banking dashboard page
const BankingDashboard = lazyLoadPage(() => import('@/components/banking/BankingDashboard'));

export default function BankingPage() {
  return <BankingDashboard />;
}
