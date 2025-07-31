interface StatCardProps {
  title: string
  value: string
  subtitle?: string
  icon?: string
  colorClass?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  loading?: boolean
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  colorClass = "text-gray-600",
  trend,
  loading = false,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-card p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-card hover:shadow-card-hover transition-shadow duration-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline space-x-2">
            <p className={`text-2xl font-bold tabular-nums ${colorClass}`}>
              {value}
            </p>
            {trend && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  trend.isPositive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value).toFixed(1)}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0">
            <span className="text-2xl">{icon}</span>
          </div>
        )}
      </div>
    </div>
  )
}