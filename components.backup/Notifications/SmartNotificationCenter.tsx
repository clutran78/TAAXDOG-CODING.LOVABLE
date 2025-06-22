"use client";

import React, { useState, useEffect } from "react";
import { 
  FaBell, 
  FaCheckCircle, 
  FaTimes, 
  FaFilter, 
  FaStar, 
  FaChartLine, 
  FaBullseye, 
  FaBolt, 
  FaTrophy
} from "react-icons/fa";

interface Notification {
  id: string;
  type: 'transfer_success' | 'transfer_failed' | 'goal_achieved' | 'savings_recommendation' | 'opportunity_alert' | 'milestone_celebration' | 'smart_insight' | 'achievement_unlock';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  data: any;
  created_at: string;
  read_at?: string;
  is_implemented?: boolean;
}

interface NotificationPreferences {
  transfer_success: boolean;
  transfer_failed: boolean;
  goal_achieved: boolean;
  savings_recommendation: boolean;
  opportunity_alert: boolean;
  milestone_celebration: boolean;
  smart_insight: boolean;
  achievement_unlock: boolean;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
}

const SmartNotificationCenter: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    transfer_success: true,
    transfer_failed: true,
    goal_achieved: true,
    savings_recommendation: true,
    opportunity_alert: true,
    milestone_celebration: true,
    smart_insight: false,
    achievement_unlock: true,
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showPreferences, setShowPreferences] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
    loadPreferences();
  }, []);

  useEffect(() => {
    // Update unread count
    const unread = notifications.filter(n => !n.read_at).length;
    setUnreadCount(unread);
  }, [notifications]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || preferences);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  const updatePreferences = async (newPrefs: Partial<NotificationPreferences>) => {
    try {
      const updatedPrefs = { ...preferences, ...newPrefs };
      
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ preferences: updatedPrefs })
      });

      if (response.ok) {
        setPreferences(updatedPrefs);
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
      ));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const implementRecommendation = async (notificationId: string) => {
    try {
      await fetch(`/api/savings-recommendations/${notificationId}/implement`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, is_implemented: true } : n
      ));
    } catch (error) {
      console.error('Failed to implement recommendation:', error);
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = `w-5 h-5 ${priority === 'critical' ? 'text-red-500' : 
                                 priority === 'high' ? 'text-orange-500' : 
                                 priority === 'medium' ? 'text-blue-500' : 'text-gray-500'}`;

    switch (type) {
      case 'transfer_success':
        return <FaCheckCircle className={iconClass} />;
      case 'transfer_failed':
        return <FaTimes className={`${iconClass} text-red-500`} />;
      case 'goal_achieved':
        return <FaBullseye className={`${iconClass} text-green-500`} />;
      case 'savings_recommendation':
        return <FaStar className={iconClass} />;
      case 'opportunity_alert':
        return <FaChartLine className={iconClass} />;
      case 'milestone_celebration':
        return <FaTrophy className={`${iconClass} text-purple-500`} />;
      case 'achievement_unlock':
        return <FaTrophy className={`${iconClass} text-gold-500`} />;
      case 'smart_insight':
        return <FaBolt className={iconClass} />;
      default:
        return <FaBell className={iconClass} />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-blue-500 bg-blue-50';
      default: return 'border-l-gray-300 bg-gray-50';
    }
  };

  const filterNotifications = () => {
    if (selectedFilter === 'all') return notifications;
    if (selectedFilter === 'unread') return notifications.filter(n => !n.read_at);
    if (selectedFilter === 'recommendations') return notifications.filter(n => n.type === 'savings_recommendation');
    if (selectedFilter === 'achievements') return notifications.filter(n => ['goal_achieved', 'achievement_unlock', 'milestone_celebration'].includes(n.type));
    if (selectedFilter === 'transfers') return notifications.filter(n => ['transfer_success', 'transfer_failed'].includes(n.type));
    return notifications.filter(n => n.type === selectedFilter);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = filterNotifications();

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <BellRing className="w-8 h-8 text-blue-600" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Smart Notifications</h1>
            <p className="text-gray-600">Stay updated on your savings progress and opportunities</p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowPreferences(!showPreferences)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Settings</span>
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Preferences Panel */}
      {showPreferences && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Notification Types */}
            <div>
              <h4 className="font-medium mb-2">Notification Types</h4>
              <div className="space-y-2">
                {Object.entries(preferences).slice(0, 8).map(([key, value]) => (
                  <label key={key} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(e) => updatePreferences({ [key]: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm capitalize">{key.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Delivery Methods */}
            <div>
              <h4 className="font-medium mb-2">Delivery Methods</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences.email_enabled}
                    onChange={(e) => updatePreferences({ email_enabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Email</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences.push_enabled}
                    onChange={(e) => updatePreferences({ push_enabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Push</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={preferences.sms_enabled}
                    onChange={(e) => updatePreferences({ sms_enabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">SMS</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex space-x-1 mb-6 border-b border-gray-200">
        {[
          { key: 'all', label: 'All', count: notifications.length },
          { key: 'unread', label: 'Unread', count: unreadCount },
          { key: 'recommendations', label: 'Recommendations', count: notifications.filter(n => n.type === 'savings_recommendation').length },
          { key: 'achievements', label: 'Achievements', count: notifications.filter(n => ['goal_achieved', 'achievement_unlock', 'milestone_celebration'].includes(n.type)).length },
          { key: 'transfers', label: 'Transfers', count: notifications.filter(n => ['transfer_success', 'transfer_failed'].includes(n.type)).length }
        ].map(filter => (
          <button
            key={filter.key}
            onClick={() => setSelectedFilter(filter.key)}
            className={`px-4 py-2 rounded-t-lg font-medium ${
              selectedFilter === filter.key
                ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            {filter.label}
            {filter.count > 0 && (
              <span className={`ml-2 text-xs px-2 py-1 rounded-full ${
                selectedFilter === filter.key ? 'bg-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {filter.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No notifications found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-4 border-l-4 rounded-lg transition-all hover:shadow-md ${
                getPriorityColor(notification.priority)
              } ${!notification.read_at ? 'bg-white shadow-sm' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="mt-1">
                    {getNotificationIcon(notification.type, notification.priority)}
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`font-medium ${!notification.read_at ? 'text-gray-900' : 'text-gray-700'}`}>
                      {notification.title}
                    </h3>
                    <p className="text-gray-600 mt-1">{notification.message}</p>
                    
                    {/* Action Items for Recommendations */}
                    {notification.type === 'savings_recommendation' && notification.data?.action_items && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Action Items:</h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                          {notification.data.action_items.map((item: string, index: number) => (
                            <li key={index}>{item}</li>
                          ))}
                        </ul>
                        
                        {!notification.is_implemented && (
                          <button
                            onClick={() => implementRecommendation(notification.id)}
                            className="mt-3 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                          >
                            Mark as Implemented
                          </button>
                        )}
                      </div>
                    )}

                    {/* Potential Savings Display */}
                    {notification.data?.potential_savings > 0 && (
                      <div className="mt-2 text-sm text-green-600 font-medium">
                        💰 Potential savings: ${notification.data.potential_savings.toFixed(2)}
                      </div>
                    )}

                    {/* Achievement Badge Display */}
                    {notification.type === 'achievement_unlock' && notification.data?.badge && (
                      <div className="mt-2 text-lg">
                        {notification.data.badge} {notification.data.title}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <span className="text-xs text-gray-500">
                    {formatDate(notification.created_at)}
                  </span>
                  
                  {!notification.read_at && (
                    <button
                      onClick={() => markAsRead(notification.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Mark Read
                    </button>
                  )}
                  
                  {notification.is_implemented && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Implemented
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {filteredNotifications.length >= 20 && (
        <div className="text-center mt-6">
          <button className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default SmartNotificationCenter; 