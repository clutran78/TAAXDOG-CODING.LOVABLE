'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DocumentTextIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { validateABN, validateTFN, formatABN, formatTFN } from '@/lib/utils'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorDisplay } from '@/components/ui/ErrorDisplay'
import toast from 'react-hot-toast'

interface TaxProfile {
  id?: string
  tfn: string
  abn: string
  businessName: string
  isGstRegistered: boolean
  gstRegistrationDate: string
  taxResidencyStatus: string
  financialYearEnd: string
  accountingMethod: string
  businessStructure: string
  industryCode: string
  businessAddress: {
    street: string
    suburb: string
    state: string
    postcode: string
  }
}

export default function TaxProfilePage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<TaxProfile>({
    tfn: '',
    abn: '',
    businessName: '',
    isGstRegistered: false,
    gstRegistrationDate: '',
    taxResidencyStatus: 'resident',
    financialYearEnd: '30-06',
    accountingMethod: 'cash',
    businessStructure: 'sole_trader',
    industryCode: '',
    businessAddress: {
      street: '',
      suburb: '',
      state: 'NSW',
      postcode: ''
    }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (session?.user?.id) {
      loadTaxProfile()
    }
  }, [session?.user?.id])

  const loadTaxProfile = async () => {
    if (!session?.user?.id) return

    try {
      setLoading(true)
      const response = await fetch(`/api/tax/profile?userId=${session.user.id}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data) {
          setProfile(data)
        }
        setError(null)
      } else if (response.status !== 404) {
        setError('Failed to load tax profile')
      }
    } catch (err) {
      setError('Failed to load tax profile')
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    // TFN validation
    if (profile.tfn && !validateTFN(profile.tfn)) {
      newErrors.tfn = 'Invalid TFN format'
    }

    // ABN validation
    if (profile.abn && !validateABN(profile.abn)) {
      newErrors.abn = 'Invalid ABN format'
    }

    // Business name required if ABN provided
    if (profile.abn && !profile.businessName.trim()) {
      newErrors.businessName = 'Business name is required when ABN is provided'
    }

    // GST registration date required if GST registered
    if (profile.isGstRegistered && !profile.gstRegistrationDate) {
      newErrors.gstRegistrationDate = 'GST registration date is required'
    }

    // Address validation
    if (profile.abn) {
      if (!profile.businessAddress.street.trim()) {
        newErrors['businessAddress.street'] = 'Street address is required for business'
      }
      if (!profile.businessAddress.suburb.trim()) {
        newErrors['businessAddress.suburb'] = 'Suburb is required for business'
      }
      if (!profile.businessAddress.postcode.trim()) {
        newErrors['businessAddress.postcode'] = 'Postcode is required for business'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors before saving')
      return
    }

    if (!session?.user?.id) return

    try {
      setSaving(true)
      const response = await fetch('/api/tax/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          ...profile
        })
      })

      if (response.ok) {
        toast.success('Tax profile saved successfully!')
        loadTaxProfile()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to save tax profile')
      }
    } catch (err) {
      toast.error('Failed to save tax profile')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.')
      setProfile(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof TaxProfile] as any,
          [child]: value
        }
      }))
    } else {
      setProfile(prev => ({ ...prev, [field]: value }))
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={loadTaxProfile} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Profile</h1>
          <p className="text-gray-600">Manage your Australian tax information</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center"
        >
          {saving ? (
            <LoadingSpinner size="sm" />
          ) : (
            <CheckCircleIcon className="h-5 w-5 mr-2" />
          )}
          Save Profile
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Tax Information */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Tax Information</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax File Number (TFN)
              </label>
              <input
                type="text"
                value={profile.tfn}
                onChange={(e) => handleInputChange('tfn', e.target.value)}
                placeholder="123 456 789"
                className={`input-field ${errors.tfn ? 'border-red-500' : ''}`}
              />
              {errors.tfn && (
                <p className="text-sm text-red-600 mt-1">{errors.tfn}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Your TFN is used for tax reporting and is kept secure
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Residency Status
              </label>
              <select
                value={profile.taxResidencyStatus}
                onChange={(e) => handleInputChange('taxResidencyStatus', e.target.value)}
                className="input-field"
              >
                <option value="resident">Australian Resident</option>
                <option value="non-resident">Non-Resident</option>
                <option value="working-holiday">Working Holiday Maker</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Financial Year End
              </label>
              <select
                value={profile.financialYearEnd}
                onChange={(e) => handleInputChange('financialYearEnd', e.target.value)}
                className="input-field"
              >
                <option value="30-06">30 June (Standard)</option>
                <option value="31-12">31 December</option>
                <option value="31-03">31 March</option>
                <option value="30-09">30 September</option>
              </select>
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="bg-white rounded-lg shadow-card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Australian Business Number (ABN)
              </label>
              <input
                type="text"
                value={profile.abn}
                onChange={(e) => handleInputChange('abn', e.target.value)}
                placeholder="12 345 678 901"
                className={`input-field ${errors.abn ? 'border-red-500' : ''}`}
              />
              {errors.abn && (
                <p className="text-sm text-red-600 mt-1">{errors.abn}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Name
              </label>
              <input
                type="text"
                value={profile.businessName}
                onChange={(e) => handleInputChange('businessName', e.target.value)}
                placeholder="Your Business Name"
                className={`input-field ${errors.businessName ? 'border-red-500' : ''}`}
              />
              {errors.businessName && (
                <p className="text-sm text-red-600 mt-1">{errors.businessName}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Business Structure
              </label>
              <select
                value={profile.businessStructure}
                onChange={(e) => handleInputChange('businessStructure', e.target.value)}
                className="input-field"
              >
                <option value="sole_trader">Sole Trader</option>
                <option value="partnership">Partnership</option>
                <option value="company">Company</option>
                <option value="trust">Trust</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="gstRegistered"
                checked={profile.isGstRegistered}
                onChange={(e) => handleInputChange('isGstRegistered', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="gstRegistered" className="ml-2 block text-sm text-gray-900">
                GST Registered
              </label>
            </div>

            {profile.isGstRegistered && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  GST Registration Date
                </label>
                <input
                  type="date"
                  value={profile.gstRegistrationDate}
                  onChange={(e) => handleInputChange('gstRegistrationDate', e.target.value)}
                  className={`input-field ${errors.gstRegistrationDate ? 'border-red-500' : ''}`}
                />
                {errors.gstRegistrationDate && (
                  <p className="text-sm text-red-600 mt-1">{errors.gstRegistrationDate}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Business Address */}
        {profile.abn && (
          <div className="bg-white rounded-lg shadow-card p-6 lg:col-span-2">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Business Address</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  value={profile.businessAddress.street}
                  onChange={(e) => handleInputChange('businessAddress.street', e.target.value)}
                  placeholder="123 Business Street"
                  className={`input-field ${errors['businessAddress.street'] ? 'border-red-500' : ''}`}
                />
                {errors['businessAddress.street'] && (
                  <p className="text-sm text-red-600 mt-1">{errors['businessAddress.street']}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suburb
                </label>
                <input
                  type="text"
                  value={profile.businessAddress.suburb}
                  onChange={(e) => handleInputChange('businessAddress.suburb', e.target.value)}
                  placeholder="Sydney"
                  className={`input-field ${errors['businessAddress.suburb'] ? 'border-red-500' : ''}`}
                />
                {errors['businessAddress.suburb'] && (
                  <p className="text-sm text-red-600 mt-1">{errors['businessAddress.suburb']}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State
                </label>
                <select
                  value={profile.businessAddress.state}
                  onChange={(e) => handleInputChange('businessAddress.state', e.target.value)}
                  className="input-field"
                >
                  <option value="NSW">NSW</option>
                  <option value="VIC">VIC</option>
                  <option value="QLD">QLD</option>
                  <option value="WA">WA</option>
                  <option value="SA">SA</option>
                  <option value="TAS">TAS</option>
                  <option value="ACT">ACT</option>
                  <option value="NT">NT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Postcode
                </label>
                <input
                  type="text"
                  value={profile.businessAddress.postcode}
                  onChange={(e) => handleInputChange('businessAddress.postcode', e.target.value)}
                  placeholder="2000"
                  className={`input-field ${errors['businessAddress.postcode'] ? 'border-red-500' : ''}`}
                />
                {errors['businessAddress.postcode'] && (
                  <p className="text-sm text-red-600 mt-1">{errors['businessAddress.postcode']}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}