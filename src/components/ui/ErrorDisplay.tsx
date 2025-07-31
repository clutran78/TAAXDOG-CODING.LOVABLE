import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface ErrorDisplayProps {
  title: string
  message: string
  onRetry?: () => void
  className?: string
}

export function ErrorDisplay({ title, message, onRetry, className = '' }: ErrorDisplayProps) {
  return (
    <div className={`text-center py-8 ${className}`}>
      <ExclamationTriangleIcon className="h-12 w-12 text-red-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
        >
          Try Again
        </button>
      )}
    </div>
  )
}