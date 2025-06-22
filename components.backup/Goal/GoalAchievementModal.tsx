"use client";

import React, { useState, useEffect } from "react";
import { 
  FaTrophy, 
  FaStar, 
  FaCalendarAlt, 
  FaDollarSign, 
  FaChartLine, 
  FaShare, 
  FaTwitter, 
  FaFacebook, 
  FaLinkedin,
  FaTimes,
  FaPlus
} from "react-icons/fa";

interface GoalData {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  createdAt: string;
  completedAt?: string;
  category: string;
  description?: string;
}

interface AchievementStats {
  timeTaken: number; // days
  totalSaved: number;
  averageMonthlyContribution: number;
  totalTransfers: number;
  consistencyScore: number;
  completionRank: string; // e.g., "Top 10% of savers"
}

interface SuggestedGoal {
  name: string;
  targetAmount: number;
  category: string;
  reason: string;
  timeline: string;
}

interface Achievement {
  id: string;
  title: string;
  description: string;
  badge: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt: string;
}

interface GoalAchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  goalData: GoalData;
  achievements?: Achievement[];
  onCreateNewGoal?: (goalData: Partial<GoalData>) => void;
}

const GoalAchievementModal: React.FC<GoalAchievementModalProps> = ({
  isOpen,
  onClose,
  goalData,
  achievements = [],
  onCreateNewGoal
}) => {
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [suggestedGoals, setSuggestedGoals] = useState<SuggestedGoal[]>([]);
  const [showAnimation, setShowAnimation] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && goalData) {
      setShowAnimation(true);
      loadAchievementStats();
      loadSuggestedGoals();
      
      // Step through celebration phases
      const timer = setTimeout(() => setCurrentStep(1), 500);
      const timer2 = setTimeout(() => setCurrentStep(2), 1500);
      const timer3 = setTimeout(() => setCurrentStep(3), 3000);
      
      return () => {
        clearTimeout(timer);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isOpen, goalData]);

  const loadAchievementStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/goals/${goalData.id}/achievement-stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load achievement stats:', error);
      // Fallback calculations
      const timeTaken = Math.floor((new Date().getTime() - new Date(goalData.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      setStats({
        timeTaken,
        totalSaved: goalData.targetAmount,
        averageMonthlyContribution: goalData.targetAmount / Math.max(timeTaken / 30, 1),
        totalTransfers: Math.floor(timeTaken / 7), // Estimate weekly transfers
        consistencyScore: 85,
        completionRank: "Top 25% of savers"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedGoals = async () => {
    try {
      const response = await fetch(`/api/goals/suggestions?completed_goal=${goalData.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestedGoals(data.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to load suggested goals:', error);
      // Fallback suggestions
      setSuggestedGoals([
        {
          name: "Emergency Fund Boost",
          targetAmount: goalData.targetAmount * 2,
          category: "Emergency",
          reason: "Build on your success with a larger emergency fund",
          timeline: "12 months"
        },
        {
          name: "Vacation Fund",
          targetAmount: goalData.targetAmount * 0.5,
          category: "Travel",
          reason: "Celebrate your achievement with a dream vacation",
          timeline: "6 months"
        }
      ]);
    }
  };

  const handleShare = (platform: string) => {
    const shareText = `🎉 Just achieved my savings goal: ${goalData.name}! Saved $${goalData.targetAmount.toLocaleString()} with TAAXDOG. #SavingsGoals #FinancialSuccess`;
    const shareUrl = window.location.origin;

    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}&summary=${encodeURIComponent(shareText)}`;
        break;
      default:
        // Generic share
        if (navigator.share) {
          navigator.share({
            title: 'Savings Goal Achieved!',
            text: shareText,
            url: shareUrl
          });
          return;
        }
    }

    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
  };

  const formatDuration = (days: number) => {
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} years`;
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'text-purple-600 bg-purple-100';
      case 'epic': return 'text-blue-600 bg-blue-100';
      case 'rare': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
        >
          <FaTimes className="w-6 h-6" />
        </button>

        {/* Celebration Header */}
        <div className="bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 text-white p-8 text-center relative overflow-hidden">
          {/* Animated Background Elements */}
          {showAnimation && (
            <>
              <div className="absolute inset-0 opacity-20">
                {[...Array(20)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute animate-bounce"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${2 + Math.random() * 2}s`
                    }}
                  >
                    ⭐
                  </div>
                ))}
              </div>
              
              <div className="absolute inset-0 opacity-30">
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute animate-pulse"
                    style={{
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 3}s`
                    }}
                  >
                    🎉
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="relative z-10">
            <div className={`transform transition-all duration-1000 ${currentStep >= 0 ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}>
              <FaTrophy className="w-20 h-20 mx-auto mb-4 text-yellow-300" />
            </div>
            
            <div className={`transform transition-all duration-1000 delay-500 ${currentStep >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <h1 className="text-4xl font-bold mb-2">Goal Achieved! 🎉</h1>
              <h2 className="text-2xl font-semibold">{goalData.name}</h2>
            </div>
            
            <div className={`transform transition-all duration-1000 delay-1000 ${currentStep >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <p className="text-xl mt-4">
                ${goalData.targetAmount.toLocaleString()} saved successfully!
              </p>
            </div>
          </div>
        </div>

        <div className="p-8">
          {/* Achievement Statistics */}
          {stats && (
            <div className={`transform transition-all duration-1000 delay-1500 ${currentStep >= 3 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
              <h3 className="text-2xl font-bold text-gray-800 mb-6">Your Achievement Stats</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg text-center">
                  <FaCalendarAlt className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-800">Time Taken</h4>
                  <p className="text-2xl font-bold text-blue-600">{formatDuration(stats.timeTaken)}</p>
                </div>
                
                <div className="bg-green-50 p-6 rounded-lg text-center">
                  <FaDollarSign className="w-8 h-8 text-green-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-800">Monthly Average</h4>
                  <p className="text-2xl font-bold text-green-600">${stats.averageMonthlyContribution.toFixed(0)}</p>
                </div>
                
                <div className="bg-purple-50 p-6 rounded-lg text-center">
                  <FaChartLine className="w-8 h-8 text-purple-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-800">Consistency Score</h4>
                  <p className="text-2xl font-bold text-purple-600">{stats.consistencyScore}%</p>
                </div>
                
                <div className="bg-orange-50 p-6 rounded-lg text-center">
                  <FaStar className="w-8 h-8 text-orange-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-800">Total Transfers</h4>
                  <p className="text-2xl font-bold text-orange-600">{stats.totalTransfers}</p>
                </div>
                
                <div className="bg-yellow-50 p-6 rounded-lg text-center">
                  <FaTrophy className="w-8 h-8 text-yellow-600 mx-auto mb-3" />
                  <h4 className="font-semibold text-gray-800">Your Rank</h4>
                  <p className="text-lg font-bold text-yellow-600">{stats.completionRank}</p>
                </div>
              </div>
            </div>
          )}

          {/* Achievements Unlocked */}
          {achievements.length > 0 && (
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Achievements Unlocked!</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className="border rounded-lg p-4 flex items-center space-x-4">
                    <div className="text-3xl">{achievement.badge}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">{achievement.title}</h4>
                      <p className="text-gray-600 text-sm">{achievement.description}</p>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getRarityColor(achievement.rarity)}`}>
                        {achievement.rarity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Social Sharing */}
          <div className="mb-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Share Your Success!</h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => handleShare('twitter')}
                className="flex items-center space-x-2 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
              >
                <FaTwitter className="w-5 h-5" />
                <span>Share on Twitter</span>
              </button>
              
              <button
                onClick={() => handleShare('facebook')}
                className="flex items-center space-x-2 bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-800 transition-colors"
              >
                <FaFacebook className="w-5 h-5" />
                <span>Share on Facebook</span>
              </button>
              
              <button
                onClick={() => handleShare('linkedin')}
                className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <FaLinkedin className="w-5 h-5" />
                <span>Share on LinkedIn</span>
              </button>
              
              <button
                onClick={() => handleShare('generic')}
                className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors"
              >
                <FaShare className="w-5 h-5" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Suggested Next Goals */}
          {suggestedGoals.length > 0 && (
            <div className="mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">What's Next? Suggested Goals</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {suggestedGoals.map((suggestion, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <h4 className="font-semibold text-gray-800 text-lg mb-2">{suggestion.name}</h4>
                    <p className="text-gray-600 mb-3">{suggestion.reason}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Target:</span>
                        <span className="font-semibold">${suggestion.targetAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Timeline:</span>
                        <span className="font-semibold">{suggestion.timeline}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Category:</span>
                        <span className="font-semibold">{suggestion.category}</span>
                      </div>
                    </div>
                    
                    {onCreateNewGoal && (
                      <button
                        onClick={() => onCreateNewGoal({
                          name: suggestion.name,
                          targetAmount: suggestion.targetAmount,
                          category: suggestion.category
                        })}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                      >
                        <FaPlus className="w-4 h-4" />
                        <span>Create This Goal</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {onCreateNewGoal && (
              <button
                onClick={() => onCreateNewGoal({})}
                className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
              >
                <FaPlus className="w-5 h-5" />
                <span>Create New Goal</span>
              </button>
            )}
            
            <button
              onClick={onClose}
              className="bg-gray-600 text-white px-8 py-3 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Continue Saving
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoalAchievementModal; 