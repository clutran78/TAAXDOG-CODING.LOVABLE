'use client'

import { Bars3Icon } from '@heroicons/react/24/outline'
import { useSession } from 'next-auth/react'

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export function Header({ setSidebarOpen }: HeaderProps) {
  const { data: session } = useSession()

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        <Bars3Icon className="h-6 w-6" />
      </button>

      <div className="h-6 w-px bg-gray-200 lg:hidden" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" />
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6 ml-auto">
          <div className="flex items-center gap-x-2">
            <span className="text-sm font-medium text-gray-900">
              Welcome back, {session?.user?.name?.split(' ')[0] || 'User'}!
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}