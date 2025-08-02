'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export default function Sidebar({ isCollapsed, onToggleSidebar }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav
      id="sidebar"
      className={`md:flex hidden col-md-3 col-lg-2 d-md-block  ${
        isCollapsed ? 'collapsed-sidebar' : 'sidebar'
      }`}
    >
      <div className="sidebar-sticky">
        <ul className="nav flex-column">
          <li className="nav-item">
            <Link
              href="/dashboard"
              className={`nav-link ${isActive('/dashboard') ? 'active fw-bold text-primary' : ''}`}
            >
              <i className="fas fa-tachometer-alt"></i> Dashboard
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/data-dashboard"
              className={`nav-link ${
                isActive('/data-dashboard') ? 'active fw-bold text-primary' : ''
              }`}
              id="data-dashboard-nav-link"
            >
              <i className="fas fa-chart-bar text-primary"></i> Data Dashboard
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/net-income"
              className={`nav-link ${isActive('/net-income') ? 'active fw-bold text-primary' : ''}`}
              id="net-income-nav-link"
            >
              <i className="fas fa-money-bill-wave text-success"></i> Net Income
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/total-expenses"
              className={`nav-link ${
                isActive('/total-expenses') ? 'active fw-bold text-primary' : ''
              }`}
              id="total-expenses-nav-link"
            >
              <i className="fas fa-arrow-circle-down text-danger"></i> Total Expenses
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/net-balance"
              className={`nav-link ${
                isActive('/net-balance') ? 'active fw-bold text-primary' : ''
              }`}
              id="net-balance-nav-link"
            >
              <i className="fas fa-balance-scale text-primary"></i> Net Balance
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/subscriptions"
              className={`nav-link ${
                isActive('/subscriptions') ? 'active fw-bold text-primary' : ''
              }`}
              id="subscriptions-nav-link"
            >
              <i className="fas fa-repeat text-primary"></i> Subscriptions
            </Link>
          </li>
          {/* <li className="nav-item">
            <Link
              href="/bank-accounts"
              className={`nav-link ${isActive("/bank-accounts") ? "active fw-bold text-primary" : ""}`}
              id="bank-accounts-nav-link"
            >
              <i className="fas fa-university text-success"></i> Bank Accounts
            </Link>
          </li> */}
          <li className="nav-item">
            <Link
              href="/goals"
              className={`nav-link ${isActive('/goals') ? 'active fw-bold text-primary' : ''}`}
              id="goals-nav-link"
            >
              <i className="fas fa-bullseye me-2"></i> Goals
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/tax-profile"
              className={`nav-link ${
                isActive('/tax-profile') ? 'active fw-bold text-primary' : ''
              }`}
              id="tax-profile-nav-link"
            >
              <i className="fas fa-file-invoice-dollar me-2"></i> Your Tax Profile
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/receipt"
              className={`nav-link ${isActive('/receipt') ? 'active fw-bold text-primary' : ''}`}
              id="receipt-module-nav-link"
            >
              <i className="fas fa-file-invoice text-primary"></i> Receipt Module
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/connect-bank"
              className={`nav-link ${
                isActive('/connect-bank') ? 'active fw-bold text-primary' : ''
              }`}
              id="receipt-module-nav-link"
            >
              <i className="fas fa-university text-success"></i> Connect your bank
            </Link>
          </li>
          <li className="nav-item">
            <Link
              href="/financial-insights"
              className={`nav-link ${
                isActive('/financial-insights') ? 'active fw-bold text-primary' : ''
              }`}
              id="financial-insights-tab"
            >
              <i className="fas fa-robot"></i> Dobbie Agent
            </Link>
          </li>
        </ul>
      </div>
      <button
        className={`collapse-button w-8 h-8 p-0 ${
          isCollapsed ? 'btn btn-outline-secondary' : 'btn btn-light border-1 border-dark-subtle'
        }`}
        onClick={onToggleSidebar}
      >
        {isCollapsed ? <i className="fas fa-bars"></i> : <i className="fas fa-chevron-left"></i>}
      </button>
    </nav>
  );
}
