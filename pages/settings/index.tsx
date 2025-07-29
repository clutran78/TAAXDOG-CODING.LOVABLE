import { useState, useEffect } from 'react';

import { useRouter } from 'next/router';

import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { FiUser, FiSettings, FiShield, FiDollarSign, FiSave, FiCamera } from 'react-icons/fi';
import { z } from 'zod';

import { Card } from '../../components/dashboard/Card';
import Layout from '../../components/Layout';

// Australian phone number validation
const australianPhoneSchema = z.string().regex(
  /^(\+61|0)?4\d{8}$/,
  'Please enter a valid Australian mobile number'
);

// ABN validation
const abnSchema = z.string().regex(
  /^\d{11}$/,
  'ABN must be 11 digits'
);

// Profile schema
const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional().refine(
    (val) => !val || australianPhoneSchema.safeParse(val).success,
    'Invalid Australian phone number'
  ),
  abn: z.string().optional().refine(
    (val) => !val || abnSchema.safeParse(val).success,
    'Invalid ABN format'
  ),
  businessName: z.string().optional(),
  taxFileNumber: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.enum(['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT', '']).optional(),
  postcode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits').optional(),
});

// Preferences schema
const preferencesSchema = z.object({
  currency: z.enum(['AUD', 'USD', 'EUR', 'GBP']),
  taxYear: z.enum(['current', 'previous']),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  marketingEmails: z.boolean(),
  autoSync: z.boolean(),
  syncFrequency: z.enum(['daily', 'weekly', 'monthly']),
  theme: z.enum(['light', 'dark', 'system']),
});

// Security schema
const securitySchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function Settings() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Profile state
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    abn: '',
    businessName: '',
    taxFileNumber: '',
    address: '',
    city: '',
    state: '',
    postcode: '',
  });

  // Preferences state
  const [preferences, setPreferences] = useState({
    currency: 'AUD',
    taxYear: 'current',
    emailNotifications: true,
    smsNotifications: false,
    marketingEmails: false,
    autoSync: true,
    syncFrequency: 'weekly',
    theme: 'light',
  });

  // Security state
  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/login');
      return;
    }

    // Load user data
    loadUserSettings();
  }, [session, status]);

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        if (data.profile) setProfile(data.profile);
        if (data.preferences) setPreferences(data.preferences);
        if (data.security) setTwoFactorEnabled(data.security.twoFactorEnabled);
        if (data.profileImage) setProfileImage(data.profileImage);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = profileSchema.parse(profile);
      
      const response = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Profile updated successfully');
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Failed to update profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = preferencesSchema.parse(preferences);
      
      const response = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validatedData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Preferences updated successfully');
      } else {
        toast.error(data.error || 'Failed to update preferences');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Failed to update preferences');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSecuritySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = securitySchema.parse(security);
      
      const response = await fetch('/api/settings/security', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: validatedData.currentPassword,
          newPassword: validatedData.newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Password updated successfully');
        setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        toast.error(data.error || 'Failed to update password');
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Failed to update password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch('/api/settings/profile-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setProfileImage(data.imageUrl);
        toast.success('Profile image updated');
      } else {
        toast.error(data.error || 'Failed to upload image');
      }
    } catch (error) {
      toast.error('Failed to upload image');
    }
  };

  const toggle2FA = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !twoFactorEnabled }),
      });

      const data = await response.json();

      if (response.ok) {
        setTwoFactorEnabled(!twoFactorEnabled);
        toast.success(twoFactorEnabled ? '2FA disabled' : '2FA enabled');
      } else {
        toast.error(data.error || 'Failed to update 2FA settings');
      }
    } catch (error) {
      toast.error('Failed to update 2FA settings');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: FiUser },
    { id: 'preferences', label: 'Preferences', icon: FiSettings },
    { id: 'security', label: 'Security', icon: FiShield },
    { id: 'billing', label: 'Billing', icon: FiDollarSign },
  ];

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

          {/* Tab Navigation */}
          <div className="mb-8 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`
                    flex items-center py-2 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon className="mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card>
              <form className="space-y-6" onSubmit={handleProfileSubmit}>
                {/* Profile Image */}
                <div className="flex items-center space-x-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden">
                      {profileImage ? (
                        <img alt="Profile" className="w-full h-full object-cover" src={profileImage} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FiUser className="w-12 h-12 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-primary-500 text-white p-2 rounded-full cursor-pointer hover:bg-primary-600">
                      <FiCamera className="w-4 h-4" />
                      <input
                        accept="image/*"
                        className="hidden"
                        type="file"
                        onChange={handleImageUpload}
                      />
                    </label>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Profile Photo</h3>
                    <p className="text-sm text-gray-500">JPG, PNG. Max size 5MB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <input
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      placeholder="0400 000 000"
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    />
                  </div>

                  {/* ABN */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">ABN</label>
                    <input
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      placeholder="12345678901"
                      type="text"
                      value={profile.abn}
                      onChange={(e) => setProfile({ ...profile, abn: e.target.value })}
                    />
                  </div>

                  {/* Business Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Business Name</label>
                    <input
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="text"
                      value={profile.businessName}
                      onChange={(e) => setProfile({ ...profile, businessName: e.target.value })}
                    />
                  </div>

                  {/* Tax File Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tax File Number</label>
                    <input
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="text"
                      value={profile.taxFileNumber}
                      onChange={(e) => setProfile({ ...profile, taxFileNumber: e.target.value })}
                    />
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Address</label>
                    <input
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="text"
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">City</label>
                    <input
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="text"
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">State</label>
                    <select
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      value={profile.state}
                      onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                    >
                      <option value="">Select State</option>
                      <option value="NSW">New South Wales</option>
                      <option value="VIC">Victoria</option>
                      <option value="QLD">Queensland</option>
                      <option value="WA">Western Australia</option>
                      <option value="SA">South Australia</option>
                      <option value="TAS">Tasmania</option>
                      <option value="NT">Northern Territory</option>
                      <option value="ACT">Australian Capital Territory</option>
                    </select>
                  </div>

                  {/* Postcode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Postcode</label>
                    <input
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      placeholder="2000"
                      type="text"
                      value={profile.postcode}
                      onChange={(e) => setProfile({ ...profile, postcode: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    disabled={loading}
                    type="submit"
                  >
                    <FiSave className="mr-2" />
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <Card>
              <form className="space-y-6" onSubmit={handlePreferencesSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Currency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Currency</label>
                    <select
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      value={preferences.currency}
                      onChange={(e) => setPreferences({ ...preferences, currency: e.target.value as any })}
                    >
                      <option value="AUD">Australian Dollar (AUD)</option>
                      <option value="USD">US Dollar (USD)</option>
                      <option value="EUR">Euro (EUR)</option>
                      <option value="GBP">British Pound (GBP)</option>
                    </select>
                  </div>

                  {/* Tax Year */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tax Year</label>
                    <select
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      value={preferences.taxYear}
                      onChange={(e) => setPreferences({ ...preferences, taxYear: e.target.value as any })}
                    >
                      <option value="current">Current Tax Year (2024-25)</option>
                      <option value="previous">Previous Tax Year (2023-24)</option>
                    </select>
                  </div>

                  {/* Theme */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Theme</label>
                    <select
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      value={preferences.theme}
                      onChange={(e) => setPreferences({ ...preferences, theme: e.target.value as any })}
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>

                  {/* Sync Frequency */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Auto-Sync Frequency</label>
                    <select
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      disabled={!preferences.autoSync}
                      value={preferences.syncFrequency}
                      onChange={(e) => setPreferences({ ...preferences, syncFrequency: e.target.value as any })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                  
                  {/* Email Notifications */}
                  <label className="flex items-center">
                    <input
                      checked={preferences.emailNotifications}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      type="checkbox"
                      onChange={(e) => setPreferences({ ...preferences, emailNotifications: e.target.checked })}
                    />
                    <span className="ml-2 text-sm text-gray-700">Email notifications for important updates</span>
                  </label>

                  {/* SMS Notifications */}
                  <label className="flex items-center">
                    <input
                      checked={preferences.smsNotifications}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      type="checkbox"
                      onChange={(e) => setPreferences({ ...preferences, smsNotifications: e.target.checked })}
                    />
                    <span className="ml-2 text-sm text-gray-700">SMS notifications for urgent alerts</span>
                  </label>

                  {/* Marketing Emails */}
                  <label className="flex items-center">
                    <input
                      checked={preferences.marketingEmails}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      type="checkbox"
                      onChange={(e) => setPreferences({ ...preferences, marketingEmails: e.target.checked })}
                    />
                    <span className="ml-2 text-sm text-gray-700">Marketing emails and promotions</span>
                  </label>

                  {/* Auto Sync */}
                  <label className="flex items-center">
                    <input
                      checked={preferences.autoSync}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      type="checkbox"
                      onChange={(e) => setPreferences({ ...preferences, autoSync: e.target.checked })}
                    />
                    <span className="ml-2 text-sm text-gray-700">Automatically sync bank transactions</span>
                  </label>
                </div>

                <div className="flex justify-end">
                  <button
                    className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                    disabled={loading}
                    type="submit"
                  >
                    <FiSave className="mr-2" />
                    {loading ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Password */}
              <Card>
                <h3 className="text-lg font-medium text-gray-900 mb-6">Change Password</h3>
                <form className="space-y-6" onSubmit={handleSecuritySubmit}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                    <input
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="password"
                      value={security.currentPassword}
                      onChange={(e) => setSecurity({ ...security, currentPassword: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <input
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="password"
                      value={security.newPassword}
                      onChange={(e) => setSecurity({ ...security, newPassword: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input
                      required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
                      type="password"
                      value={security.confirmPassword}
                      onChange={(e) => setSecurity({ ...security, confirmPassword: e.target.value })}
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                      disabled={loading}
                      type="submit"
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </Card>

              {/* Two-Factor Authentication */}
              <Card>
                <h3 className="text-lg font-medium text-gray-900 mb-6">Two-Factor Authentication</h3>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Add an extra layer of security to your account by enabling two-factor authentication.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      2FA is currently {twoFactorEnabled ? 'enabled' : 'disabled'}
                    </span>
                    <button
                      className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        twoFactorEnabled
                          ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                          : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                      } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50`}
                      disabled={loading}
                      onClick={toggle2FA}
                    >
                      {loading ? 'Processing...' : (twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA')}
                    </button>
                  </div>
                </div>
              </Card>

              {/* Login Sessions */}
              <Card>
                <h3 className="text-lg font-medium text-gray-900 mb-6">Active Sessions</h3>
                <p className="text-sm text-gray-600 mb-4">
                  These are the devices currently logged into your account.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900">Current Device</p>
                      <p className="text-sm text-gray-500">Last active: Just now</p>
                    </div>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">Active</span>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <Card>
              <h3 className="text-lg font-medium text-gray-900 mb-6">Subscription & Billing</h3>
              <div className="space-y-6">
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">TAAX Pro</h4>
                      <p className="text-sm text-gray-600">$18.99/month (incl. GST)</p>
                    </div>
                    <span className="text-xs text-green-600 bg-green-100 px-3 py-1 rounded-full">Active</span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>Next billing date: July 1, 2024</p>
                    <p>Payment method: •••• 4242</p>
                  </div>
                  <div className="mt-4 flex space-x-4">
                    <button className="text-sm text-primary-600 hover:text-primary-700">
                      Update Payment Method
                    </button>
                    <button className="text-sm text-red-600 hover:text-red-700">
                      Cancel Subscription
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Billing History</h4>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Description
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Invoice
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            June 1, 2024
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            TAAX Pro Monthly
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            $18.99
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <a className="text-primary-600 hover:text-primary-700" href="#">
                              Download
                            </a>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Australian Tax Compliance</h4>
                  <p className="text-sm text-blue-700">
                    All prices include 10% GST. Tax invoices are automatically generated for all payments
                    and can be downloaded from your billing history.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}