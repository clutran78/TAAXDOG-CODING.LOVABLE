'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import {
  XMarkIcon,
  HomeIcon,
  BanknotesIcon,
  ChartBarIcon,
  DocumentTextIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Net Income', href: '/net-income', icon: ChartBarIcon },
  { name: 'Total Expenses', href: '/total-expenses', icon: BanknotesIcon },
  { name: 'Net Balance', href: '/net-balance', icon: ChartBarIcon },
  { name: 'Goals', href: '/goals', icon: DocumentTextIcon },
  { name: 'Bank Accounts', href: '/bank-accounts', icon: BanknotesIcon },
  { name: 'Tax Profile', href: '/tax-profile', icon: DocumentTextIcon },
  { name: 'Receipt Module', href: '/receipt', icon: DocumentTextIcon },
  { name: 'Connect Bank', href: '/connect-bank', icon: BanknotesIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
]

interface SidebarProps {
  open: boolean
  setOpen: (open: boolean) => void
}

export function Sidebar({ open, setOpen }: SidebarProps) {
  const pathname = usePathname()
  const { data: session } = useSession()

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' })
  }

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                  <button
                    type="button"
                    className="-m-2.5 p-2.5"
                    onClick={() => setOpen(false)}
                  >
                    <XMarkIcon className="h-6 w-6 text-white" />
                  </button>
                </div>
                <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-2">
                  <div className="flex h-16 shrink-0 items-center">
                    <span className="text-xl font-bold text-primary-600">TaxReturnPro</span>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="-mx-2 space-y-1">
                          {navigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                href={item.href}
                                className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                                  pathname === item.href
                                    ? 'bg-primary-50 text-primary-600'
                                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                                }`}
                              >
                                <item.icon className="h-6 w-6 shrink-0" />
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                      <li className="mt-auto">
                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex items-center gap-x-3 px-2 py-2">
                            <UserCircleIcon className="h-8 w-8 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {session?.user?.name || 'User'}
                              </p>
                              <p className="text-xs text-gray-500 truncate">
                                {session?.user?.email}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={handleSignOut}
                            className="group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 hover:text-red-600 hover:bg-red-50"
                          >
                            <ArrowRightOnRectangleIcon className="h-6 w-6 shrink-0" />
                            Sign out
                          </button>
                        </div>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6">
          <div className="flex h-16 shrink-0 items-center">
            <span className="text-xl font-bold text-primary-600">TaxReturnPro</span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold ${
                          pathname === item.href
                            ? 'bg-primary-50 text-primary-600'
                            : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                        }`}
                      >
                        <item.icon className="h-6 w-6 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto">
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-x-3 px-2 py-2">
                    <UserCircleIcon className="h-8 w-8 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {session?.user?.name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {session?.user?.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="group flex w-full gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 hover:text-red-600 hover:bg-red-50"
                  >
                    <ArrowRightOnRectangleIcon className="h-6 w-6 shrink-0" />
                    Sign out
                  </button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  )
}
export default Sidebar;
