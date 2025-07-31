import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Currency formatting for Australian dollars
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Date formatting for Australian format
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(dateObj)
}

// Date and time formatting
export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj)
}

// Relative time formatting (e.g., "2 days ago")
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

  if (diffInSeconds < 60) return 'Just now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`
  return `${Math.floor(diffInSeconds / 31536000)} years ago`
}

// Percentage calculation
export function calculatePercentageChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

// Australian Business Number (ABN) validation
export function validateABN(abn: string): boolean {
  // Remove spaces and hyphens
  const cleanABN = abn.replace(/[\s-]/g, '')
  
  // Check if it's 11 digits
  if (!/^\d{11}$/.test(cleanABN)) return false
  
  // ABN validation algorithm
  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]
  let sum = 0
  
  // Subtract 1 from the first digit
  const firstDigit = parseInt(cleanABN[0]) - 1
  sum += firstDigit * weights[0]
  
  // Add weighted sum of remaining digits
  for (let i = 1; i < 11; i++) {
    sum += parseInt(cleanABN[i]) * weights[i]
  }
  
  return sum % 89 === 0
}

// Australian Tax File Number (TFN) validation
export function validateTFN(tfn: string): boolean {
  // Remove spaces and hyphens
  const cleanTFN = tfn.replace(/[\s-]/g, '')
  
  // Check if it's 8 or 9 digits
  if (!/^\d{8,9}$/.test(cleanTFN)) return false
  
  // TFN validation algorithm
  const weights = [1, 4, 3, 7, 5, 8, 6, 9, 10]
  let sum = 0
  
  for (let i = 0; i < cleanTFN.length; i++) {
    sum += parseInt(cleanTFN[i]) * weights[i]
  }
  
  return sum % 11 === 0
}

// Format ABN with spaces
export function formatABN(abn: string): string {
  const cleanABN = abn.replace(/[\s-]/g, '')
  if (cleanABN.length === 11) {
    return `${cleanABN.slice(0, 2)} ${cleanABN.slice(2, 5)} ${cleanABN.slice(5, 8)} ${cleanABN.slice(8)}`
  }
  return abn
}

// Format TFN with spaces
export function formatTFN(tfn: string): string {
  const cleanTFN = tfn.replace(/[\s-]/g, '')
  if (cleanTFN.length === 8) {
    return `${cleanTFN.slice(0, 3)} ${cleanTFN.slice(3, 6)} ${cleanTFN.slice(6)}`
  } else if (cleanTFN.length === 9) {
    return `${cleanTFN.slice(0, 3)} ${cleanTFN.slice(3, 6)} ${cleanTFN.slice(6)}`
  }
  return tfn
}

// Generate random ID
export function generateId(): string {
  return Math.random().toString(36).substr(2, 9)
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean = false
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Capitalize first letter
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

// Truncate text
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

// Sleep function for delays
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Check if value is empty
export function isEmpty(value: any): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim().length === 0
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value).length === 0
  return false
}

// Australian financial year calculation
export function getFinancialYear(date?: Date): { start: Date; end: Date; label: string } {
  const currentDate = date || new Date()
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth()
  
  // Australian financial year runs from July 1 to June 30
  let fyStartYear: number
  let fyEndYear: number
  
  if (currentMonth >= 6) { // July onwards
    fyStartYear = currentYear
    fyEndYear = currentYear + 1
  } else { // January to June
    fyStartYear = currentYear - 1
    fyEndYear = currentYear
  }
  
  return {
    start: new Date(fyStartYear, 6, 1), // July 1
    end: new Date(fyEndYear, 5, 30), // June 30
    label: `FY${fyStartYear.toString().slice(-2)}-${fyEndYear.toString().slice(-2)}`
  }
}

// Tax bracket calculation for Australia (2023-24)
export function calculateTaxBracket(income: number): {
  bracket: string
  rate: number
  taxOwed: number
} {
  const brackets = [
    { min: 0, max: 18200, rate: 0, base: 0 },
    { min: 18201, max: 45000, rate: 0.19, base: 0 },
    { min: 45001, max: 120000, rate: 0.325, base: 5092 },
    { min: 120001, max: 180000, rate: 0.37, base: 29467 },
    { min: 180001, max: Infinity, rate: 0.45, base: 51667 },
  ]
  
  for (const bracket of brackets) {
    if (income >= bracket.min && income <= bracket.max) {
      const taxableIncome = income - bracket.min
      const taxOwed = bracket.base + (taxableIncome * bracket.rate)
      
      return {
        bracket: bracket.max === Infinity 
          ? `${bracket.min.toLocaleString()}+` 
          : `${bracket.min.toLocaleString()} - ${bracket.max.toLocaleString()}`,
        rate: bracket.rate,
        taxOwed: Math.max(0, taxOwed)
      }
    }
  }
  
  return { bracket: 'Unknown', rate: 0, taxOwed: 0 }
}