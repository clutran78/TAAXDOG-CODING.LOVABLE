'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';

export default function MobileSidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  return (
    <div className="top-[56px] align-self-start left-0 right-0 z-50 items-start py-2 md:hidden">
      <button
        className={`flex md:hidden w-8 h-8 p-0 btn btn-outline-secondary`}
        onClick={toggleMobileMenu}
      >
        <i className="fas fa-bars"></i>
      </button>

      {/* Full-Screen Overlay for Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 z-40 flex flex-col items-center justify-center text-white">
          {/* Close Button */}
          <button
            className="absolute top-20 right-4 btn btn-light "
            onClick={toggleMobileMenu}
          >
            <i className="fas fa-times"></i>
          </button>

          {/* Navigation Links */}
          <ul className="flex flex-col items-center space-y-6 text-lg">
            <li className="nav-item">
              <Link
                href="/dashboard"
                className={`nav-link ${
                  isActive('/dashboard') ? 'active fw-bold text-primary' : ''
                }`}
                onClick={toggleMobileMenu}
              >
                Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/data-dashboard"
                className={`nav-link ${
                  isActive('/data-dashboard') ? 'active fw-bold text-primary' : ''
                }`}
                onClick={toggleMobileMenu}
                id="data-dashboard-nav-link"
              >
                Data Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/net-income"
                className={`nav-link ${
                  isActive('/net-income') ? 'active fw-bold text-primary' : ''
                }`}
                onClick={toggleMobileMenu}
                id="net-income-nav-link"
              >
                Net Income
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/total-expenses"
                className={`nav-link ${
                  isActive('/total-expenses') ? 'active fw-bold text-primary' : ''
                }`}
                id="total-expenses-nav-link"
                onClick={toggleMobileMenu}
              >
                Total Expenses
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/net-balance"
                className={`nav-link ${
                  isActive('/net-balance') ? 'active fw-bold text-primary' : ''
                }`}
                id="net-balance-nav-link"
                onClick={toggleMobileMenu}
              >
                Net Balance
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/subscriptions"
                className={`nav-link ${
                  isActive('/subscriptions') ? 'active fw-bold text-primary' : ''
                }`}
                onClick={toggleMobileMenu}
              >
                Subscriptions
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/goals"
                className={`nav-link ${isActive('/goals') ? 'active fw-bold text-primary' : ''}`}
                id="goals-nav-link"
                onClick={toggleMobileMenu}
              >
                Goals
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/tax-profile"
                className={`nav-link ${
                  isActive('/tax-profile') ? 'active fw-bold text-primary' : ''
                }`}
                id="tax-profile-nav-link"
                onClick={toggleMobileMenu}
              >
                Your Tax Profile
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/receipt"
                className={`nav-link ${isActive('/receipt') ? 'active fw-bold text-primary' : ''}`}
                id="receipt-module-nav-link"
                onClick={toggleMobileMenu}
              >
                Receipt Module
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/connect-bank"
                className={`nav-link ${
                  isActive('/connect-bank') ? 'active fw-bold text-primary' : ''
                }`}
                id="receipt-module-nav-link"
                onClick={toggleMobileMenu}
              >
                Connect your bank
              </Link>
            </li>
            <li className="nav-item">
              <Link
                href="/financial-insights"
                className={`nav-link ${
                  isActive('/financial-insights') ? 'active fw-bold text-primary' : ''
                }`}
                id="financial-insights-tab"
                onClick={toggleMobileMenu}
              >
                AI Insights
              </Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
