'use client';

import React, { useState, useEffect, useRef, TouchEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  ChartBarIcon, 
  DocumentTextIcon, 
  CreditCardIcon, 
  BanknotesIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  PlusCircleIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Transition } from '@headlessui/react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';

const MobileChart = dynamic(() => import('./MobileChart'), {
  ssr: false,
  loading: () => <div className="h-48 bg-gray-100 animate-pulse rounded-lg" />
});

interface DashboardMetric {
  title: string;
  value: string | number;
  change: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  className?: string;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight,
  className = ''
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsMoving(true);
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!touchStart) return;
    const currentTouch = e.targetTouches[0].clientX;
    setTouchEnd(currentTouch);

    if (cardRef.current && isMoving) {
      const diff = currentTouch - touchStart;
      cardRef.current.style.transform = `translateX(${diff * 0.5}px)`;
      cardRef.current.style.opacity = `${1 - Math.abs(diff) / 300}`;
    }
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (cardRef.current) {
      cardRef.current.style.transform = '';
      cardRef.current.style.opacity = '';
    }

    if (isLeftSwipe && onSwipeLeft) {
      onSwipeLeft();
    }
    if (isRightSwipe && onSwipeRight) {
      onSwipeRight();
    }
    
    setIsMoving(false);
  };

  return (
    <div
      ref={cardRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={`transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
};

const QuickActionButton: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  color: string;
}> = ({ icon: Icon, label, onClick, color }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-4 rounded-2xl ${color} text-white shadow-lg transform transition-all duration-200 active:scale-95`}
  >
    <Icon className="h-8 w-8 mb-2" />
    <span className="text-xs font-medium">{label}</span>
  </button>
);

export default function MobileDashboard() {
  const router = useRouter();
  const { data: session } = useSession();
  const [showMenu, setShowMenu] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [refreshing, setRefreshing] = useState(false);

  const metrics: DashboardMetric[] = [
    {
      title: 'Total Income',
      value: '$12,458',
      change: 12.5,
      icon: BanknotesIcon,
      color: 'text-green-600'
    },
    {
      title: 'Tax Deductions',
      value: '$3,241',
      change: -5.2,
      icon: DocumentTextIcon,
      color: 'text-blue-600'
    },
    {
      title: 'Expenses',
      value: '$8,932',
      change: 8.1,
      icon: CreditCardIcon,
      color: 'text-red-600'
    },
    {
      title: 'Estimated Return',
      value: '$2,184',
      change: 15.3,
      icon: ArrowTrendingUpIcon,
      color: 'text-purple-600'
    }
  ];

  const quickActions = [
    { icon: DocumentTextIcon, label: 'Scan Receipt', onClick: () => router.push('/receipts/scan'), color: 'bg-blue-500' },
    { icon: CreditCardIcon, label: 'Add Expense', onClick: () => router.push('/expenses/new'), color: 'bg-purple-500' },
    { icon: BanknotesIcon, label: 'Add Income', onClick: () => router.push('/income/new'), color: 'bg-green-500' },
    { icon: ChartBarIcon, label: 'View Reports', onClick: () => router.push('/reports'), color: 'bg-orange-500' }
  ];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Dashboard refreshed');
    } catch (error) {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  const handlePullToRefresh = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (touch.clientY > 100 && window.scrollY === 0) {
      handleRefresh();
    }
  };

  useEffect(() => {
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    document.addEventListener('touchstart', preventZoom as any, { passive: false });
    return () => {
      document.removeEventListener('touchstart', preventZoom as any);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {showMenu ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
          </button>
          
          <h1 className="text-lg font-semibold">Dashboard</h1>
          
          <button
            onClick={() => router.push('/profile')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <UserCircleIcon className="h-6 w-6" />
          </button>
        </div>
      </header>

      {/* Slide-out Menu */}
      <Transition
        show={showMenu}
        enter="transition-transform duration-300"
        enterFrom="-translate-x-full"
        enterTo="translate-x-0"
        leave="transition-transform duration-300"
        leaveFrom="translate-x-0"
        leaveTo="-translate-x-full"
        className="fixed inset-y-0 left-0 z-40 w-64 bg-white shadow-xl"
      >
        <nav className="p-4 pt-20">
          <ul className="space-y-2">
            {['Dashboard', 'Transactions', 'Reports', 'Tax Documents', 'Settings'].map((item) => (
              <li key={item}>
                <button
                  onClick={() => {
                    setShowMenu(false);
                    router.push(`/${item.toLowerCase().replace(' ', '-')}`);
                  }}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </Transition>

      {/* Main Content */}
      <main 
        className="p-4 pb-20"
        onTouchStart={handlePullToRefresh}
      >
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}!
          </h2>
          <p className="text-gray-600 mt-1">Here's your tax summary</p>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['week', 'month', 'year'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded-full capitalize whitespace-nowrap transition-all ${
                selectedPeriod === period
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 border border-gray-300'
              }`}
            >
              This {period}
            </button>
          ))}
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {metrics.map((metric, index) => (
            <SwipeableCard
              key={metric.title}
              onSwipeLeft={() => console.log('Swiped left on', metric.title)}
              className="bg-white rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <metric.icon className={`h-8 w-8 ${metric.color}`} />
                <span className={`text-xs font-medium ${
                  metric.change > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metric.change > 0 ? '+' : ''}{metric.change}%
                </span>
              </div>
              <p className="text-gray-600 text-sm">{metric.title}</p>
              <p className="text-xl font-bold mt-1">{metric.value}</p>
            </SwipeableCard>
          ))}
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-6">
          <h3 className="text-lg font-semibold mb-4">Income vs Expenses</h3>
          <MobileChart period={selectedPeriod} />
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            {quickActions.map((action) => (
              <QuickActionButton key={action.label} {...action} />
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Recent Transactions</h3>
            <button
              onClick={() => router.push('/transactions')}
              className="text-blue-500 text-sm font-medium"
            >
              View all
            </button>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SwipeableCard
                key={i}
                onSwipeLeft={() => toast.success('Transaction archived')}
                onSwipeRight={() => toast.success('Transaction categorized')}
                className="border-b last:border-0 pb-3 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Coffee Shop</p>
                    <p className="text-sm text-gray-500">Today, 2:30 PM</p>
                  </div>
                  <p className="font-semibold text-red-600">-$4.50</p>
                </div>
              </SwipeableCard>
            ))}
          </div>
        </div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={() => router.push('/receipts/scan')}
        className="fixed bottom-6 right-6 bg-blue-500 text-white p-4 rounded-full shadow-lg transform transition-all duration-200 active:scale-95"
      >
        <PlusCircleIcon className="h-6 w-6" />
      </button>

      {/* Loading Overlay */}
      {refreshing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        </div>
      )}
    </div>
  );
}