import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Banking', href: '/banking' },
    { name: 'Tax Returns', href: '/tax-returns' },
    { name: 'Documents', href: '/documents' },
    { name: 'Settings', href: '/settings' },
  ];

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/login');
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 bg-blue-600 text-white p-2 rounded"
      >
        Skip to main content
      </a>

      {/* Navigation */}
      <nav
        className="bg-white shadow relative z-10"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link
                  href="/dashboard"
                  className="text-xl font-bold text-blue-600 hover:text-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                  aria-label="TAAXDOG - Go to dashboard"
                >
                  TAAXDOG
                </Link>
              </div>
              {/* Desktop Navigation */}
              <nav
                className="hidden sm:ml-6 sm:flex sm:space-x-8"
                role="menubar"
                aria-label="Main menu"
              >
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      router.pathname === item.href
                        ? 'border-blue-500 text-gray-900'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:rounded`}
                    role="menuitem"
                    aria-current={router.pathname === item.href ? 'page' : undefined}
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Desktop User Menu */}
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <div className="ml-3 relative flex items-center space-x-4">
                <span
                  className="text-sm text-gray-700"
                  aria-label="Logged in as"
                >
                  {session?.user?.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label="Sign out of your account"
                >
                  Sign out
                </button>
              </div>
            </div>

            {/* Mobile Menu Button - Touch optimized */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors touch-manipulation"
                aria-controls="mobile-menu"
                aria-expanded={isMobileMenuOpen}
                aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                <span className="sr-only">
                  {isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}
                </span>
                {isMobileMenuOpen ? (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg
                    className="block h-6 w-6"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu, show/hide based on menu state */}
        <div
          className={`${
            isMobileMenuOpen ? 'block' : 'hidden'
          } sm:hidden absolute top-16 left-0 right-0 bg-white shadow-lg`}
          id="mobile-menu"
          role="menu"
          aria-label="Mobile navigation menu"
        >
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={closeMobileMenu}
                className={`${
                  router.pathname === item.href
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                } block pl-3 pr-4 py-3 min-h-[44px] border-l-4 text-base font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 touch-manipulation`}
                role="menuitem"
                aria-current={router.pathname === item.href ? 'page' : undefined}
              >
                {item.name}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-gray-200">
            <div className="flex items-center px-4">
              <div className="flex-shrink-0">
                <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-white font-medium">
                    {session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'U'}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <div
                  className="text-base font-medium text-gray-800"
                  id="user-name"
                >
                  {session?.user?.name || session?.user?.email}
                </div>
                {session?.user?.name && (
                  <div
                    className="text-sm font-medium text-gray-500"
                    id="user-email"
                  >
                    {session?.user?.email}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <button
                onClick={() => {
                  closeMobileMenu();
                  handleSignOut();
                }}
                className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 w-full text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                aria-label="Sign out of your account"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main
        className="flex-1"
        id="main-content"
        role="main"
      >
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
        </div>
      </main>

      {/* Optional Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © {new Date().getFullYear()} TAAXDOG. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
