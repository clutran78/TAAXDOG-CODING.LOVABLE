'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaTachometerAlt, FaMoneyBill, FaChartLine, FaCog, FaSignOutAlt, FaPiggyBank, FaUser, FaReceipt, FaLock } from 'react-icons/fa';

const menuItems = [
  { label: 'Dashboard', icon: <FaTachometerAlt />, path: '/' },
  { label: 'Data Dashboard', icon: <FaChartLine />, path: '/data-dashboard' },
  { label: 'Net Income', icon: <FaMoneyBill />, path: '/net-income' },
  { label: 'Total Expenses', icon: <FaMoneyBill />, path: '/total-expenses' },
  { label: 'Net Balance', icon: <FaChartLine />, path: '/net-balance' },
  { label: 'Subscriptions', icon: <FaPiggyBank />, path: '/subscriptions' },
  { label: 'Bank Accounts', icon: <FaPiggyBank />, path: '/bank-accounts' },
  { label: 'Goals', icon: <FaChartLine />, path: '/goals' },
  { label: 'Your Tax Profile', icon: <FaUser />, path: '/tax-profile' },
  { label: 'Security', icon: <FaLock />, path: '/security' },
  { label: 'Receipt Module', icon: <FaReceipt />, path: '/receipt-module' },
  { label: 'AI Insights', icon: <FaCog />, path: '/ai-insights' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="h-screen w-60 bg-white border-r p-5 flex flex-col justify-between">
      <div>
        <h1 className="text-xl font-bold mb-8">📘 TaaxDog</h1>
        <ul className="space-y-3">
          {menuItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition hover:bg-gray-100 ${
                  pathname === item.path ? 'bg-gray-200 font-semibold' : ''
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <button className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-100 rounded-md">
          <FaSignOutAlt />
          <span>Log Out</span>
        </button>
      </div>
    </div>
  );
}
