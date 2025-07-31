'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { CogIcon, BellIcon, ShieldCheckIcon, UserIcon } from '@heroicons/react/24/outline'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorDisplay } from '@/components/ui/ErrorDisplay'
import toast from 'react-hot-toast'

interface UserSettings {
  notifications: {
    email: boolean
    push: boolean
    weeklyReports: boolean
    goalReminders: boolean
    transactionAlerts: boolean
  }
  privacy: {
    dataSharing: boolean
    analyticsTracking: boolean
    marketingEmails: boolean
  }
  preferences: {
    currency: string
    dateFormat: string
    timeZone: string
    language: string
  }
  security: {
    twoFactorEnabled: boolean
    sessionTimeout: number
  }
}

export default function SettingsPage() {
  const { data: session } = useSession()
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true,
      push: true,
      weeklyReports: true,
      goalReminders: true,
      transactionAlerts: true
    },
    privacy: {
      dataSharing: false,
      analyticsTracking: true,
      marketingEmails: false
    },
    preferences: {
      currency: 'AUD',
      dateFormat: 'DD/MM/YYYY',
      timeZone: 'Australia/Sydney',
      language: 'en-AU'
    },
    security: {
      twoFactorEnabled: false,
      sessionTimeout: 30
    }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.id) {
      loadSettings()
    }
  }, [session?.user?.id])

  const loadSettings = async () => {
    if (!session?.user?.id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/user/settings?userId=${session.user.id}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setSettings(data)
        }
        setError(null)
      } else if (response.status !== 404) {
        setError('Failed to load settings')
      }
    } catch (err) {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!session?.user?.id) return

    try {
      setSaving(true)
      const response = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          ...settings
        })
      })

      if (response.ok) {
        toast.success('Settings saved successfully!')
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to save settings')
      }
    } catch (err) {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (section: keyof UserSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadSettings} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account preferences and security</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center"
        >
          {saving ? (
            <LoadingSpinner size="sm" />
          ) : (
            <CogIcon className="h-5 w-5 mr-2" />
          )}
          Save Settings
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center mb-4">
            <BellIcon className="h-6 w-6 text-gray-400 mr-3" />
            <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Email Notifications</label>
                <p className="text-xs text-gray-500">Receive notifications via email</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.email}
                onChange={(e) => updateSetting('notifications', 'email', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Push Notifications</label>
                <p className="text-xs text-gray-500">Receive push notifications in browser</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.push}
                onChange={(e) => updateSetting('notifications', 'push', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Weekly Reports</label>
                <p className="text-xs text-gray-500">Get weekly financial summaries</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.weeklyReports}
                onChange={(e) => updateSetting('notifications', 'weeklyReports', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Goal Reminders</label>
                <p className="text-xs text-gray-500">Reminders about your financial goals</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.goalReminders}
                onChange={(e) => updateSetting('notifications', 'goalReminders', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Transaction Alerts</label>
                <p className="text-xs text-gray-500">Alerts for large transactions</p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.transactionAlerts}
                onChange={(e) => updateSetting('notifications', 'transactionAlerts', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center mb-4">
            <ShieldCheckIcon className="h-6 w-6 text-gray-400 mr-3" />
            <h3 className="text-lg font-medium text-gray-900">Privacy</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Data Sharing</label>
                <p className="text-xs text-gray-500">Share anonymized data for insights</p>
              </div>
              <input
                type="checkbox"
                checked={settings.privacy.dataSharing}
                onChange={(e) => updateSetting('privacy', 'dataSharing', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Analytics Tracking</label>
                <p className="text-xs text-gray-500">Help improve the app with usage data</p>
              </div>
              <input
                type="checkbox"
                checked={settings.privacy.analyticsTracking}
                onChange={(e) => updateSetting('privacy', 'analyticsTracking', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Marketing Emails</label>
                <p className="text-xs text-gray-500">Receive promotional emails</p>
              </div>
              <input
                type="checkbox"
                checked={settings.privacy.marketingEmails}
                onChange={(e) => updateSetting('privacy', 'marketingEmails', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>
          </div>
        </div>

        {/* Preferences */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center mb-4">
            <UserIcon className="h-6 w-6 text-gray-400 mr-3" />
            <h3 className="text-lg font-medium text-gray-900">Preferences</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Currency
              </label>
              <select
                value={settings.preferences.currency}
                onChange={(e) => updateSetting('preferences', 'currency', e.target.value)}
                className="input-field"
              >
                <option value="AUD">Australian Dollar (AUD)</option>
                <option value="USD">US Dollar (USD)</option>
                <option value="EUR">Euro (EUR)</option>
                <option value="GBP">British Pound (GBP)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date Format
              </label>
              <select
                value={settings.preferences.dateFormat}
                onChange={(e) => updateSetting('preferences', 'dateFormat', e.target.value)}
                className="input-field"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY (Australian)</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Zone
              </label>
              <select
                value={settings.preferences.timeZone}
                onChange={(e) => updateSetting('preferences', 'timeZone', e.target.value)}
                className="input-field"
              >
                <option value="Australia/Sydney">Sydney (AEDT/AEST)</option>
                <option value="Australia/Melbourne">Melbourne (AEDT/AEST)</option>
                <option value="Australia/Brisbane">Brisbane (AEST)</option>
                <option value="Australia/Perth">Perth (AWST)</option>
                <option value="Australia/Adelaide">Adelaide (ACDT/ACST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <div className="flex items-center mb-4">
            <ShieldCheckIcon className="h-6 w-6 text-gray-400 mr-3" />
            <h3 className="text-lg font-medium text-gray-900">Security</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-900">Two-Factor Authentication</label>
                <p className="text-xs text-gray-500">Add extra security to your account</p>
              </div>
              <input
                type="checkbox"
                checked={settings.security.twoFactorEnabled}
                onChange={(e) => updateSetting('security', 'twoFactorEnabled', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Timeout (minutes)
              </label>
              <select
                value={settings.security.sessionTimeout}
                onChange={(e) => updateSetting('security', 'sessionTimeout', parseInt(e.target.value))}
                className="input-field"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
                <option value={480}>8 hours</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}