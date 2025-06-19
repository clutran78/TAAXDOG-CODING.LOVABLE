"""
Advanced Savings Analytics for TAAXDOG

This module provides comprehensive analytics for savings patterns,
goal achievement tracking, transfer performance analysis, and 
financial insights generation.
"""

import sys
import os
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from enum import Enum
import statistics
from collections import defaultdict, Counter

# Add project paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))

try:
    from firebase_config import db
except ImportError:
    try:
        from backend.firebase_config import db
    except ImportError:
        print("Warning: Firebase config not available")
        db = None

try:
    from services.transfer_engine import get_transfer_engine
    from services.income_detector import get_income_detector
except ImportError:
    try:
        from backend.services.transfer_engine import get_transfer_engine
        from backend.services.income_detector import get_income_detector
    except ImportError:
        def get_transfer_engine():
            return None
        def get_income_detector():
            return None

# Configure logging
logger = logging.getLogger(__name__)


class AnalyticsTimeframe(Enum):
    """Time frames for analytics reporting."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    ALL_TIME = "all_time"


class TrendDirection(Enum):
    """Trend direction indicators."""
    INCREASING = "increasing"
    DECREASING = "decreasing"
    STABLE = "stable"
    VOLATILE = "volatile"


@dataclass
class SavingsMetrics:
    """Core savings metrics data class."""
    total_saved: float
    monthly_avg_saved: float
    goal_completion_rate: float
    transfer_success_rate: float
    avg_transfer_amount: float
    total_goals: int
    active_goals: int
    completed_goals: int
    longest_streak: int
    current_streak: int
    total_transfers: int
    failed_transfers: int


@dataclass
class GoalAnalytics:
    """Goal-specific analytics data class."""
    goal_id: str
    goal_name: str
    target_amount: float
    current_amount: float
    progress_percentage: float
    days_active: int
    projected_completion_date: Optional[datetime]
    avg_monthly_contribution: float
    total_transfers: int
    velocity_score: float  # How quickly goal is being achieved


@dataclass
class TrendAnalysis:
    """Trend analysis data class."""
    metric_name: str
    timeframe: AnalyticsTimeframe
    direction: TrendDirection
    percentage_change: float
    confidence_score: float
    data_points: List[Dict]
    insights: List[str]


class SavingsAnalytics:
    """
    Advanced analytics engine for savings and goal tracking.
    
    Provides comprehensive insights into user savings patterns,
    goal achievement trends, and financial behavior analysis.
    """
    
    def __init__(self, app=None):
        """Initialize the savings analytics service."""
        self.app = app
        self.db = db
        self.transfer_engine = get_transfer_engine()
        self.income_detector = get_income_detector()
        
        # Analytics configuration
        self.min_data_points = 3
        self.trend_confidence_threshold = 0.7
        self.volatility_threshold = 0.3
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize with Flask app configuration."""
        self.app = app
        
        # Register with app extensions
        if not hasattr(app, 'extensions'):
            app.extensions = {}
        app.extensions['savings_analytics'] = self
    
    # ==================== MAIN ANALYTICS METHODS ====================
    
    async def generate_comprehensive_analytics(self, user_id: str, timeframe: AnalyticsTimeframe = AnalyticsTimeframe.MONTHLY) -> Dict:
        """
        Generate comprehensive savings analytics for a user.
        
        Args:
            user_id: User ID
            timeframe: Analytics timeframe
            
        Returns:
            dict: Comprehensive analytics report
        """
        try:
            # Gather all data sources
            data_sources = await self._gather_analytics_data(user_id, timeframe)
            
            if not data_sources['success']:
                return {
                    'success': False,
                    'error': 'Unable to gather analytics data'
                }
            
            data = data_sources['data']
            
            # Generate core metrics
            savings_metrics = self._calculate_savings_metrics(data)
            
            # Generate goal analytics
            goal_analytics = self._analyze_goal_performance(data['goals'], data['transfers'])
            
            # Generate trend analysis
            trend_analysis = self._analyze_trends(data, timeframe)
            
            # Generate insights and recommendations
            insights = self._generate_analytics_insights(savings_metrics, goal_analytics, trend_analysis)
            
            # Calculate performance scores
            performance_scores = self._calculate_performance_scores(savings_metrics, goal_analytics)
            
            # Generate forecasts
            forecasts = self._generate_forecasts(data, timeframe)
            
            analytics_report = {
                'user_id': user_id,
                'timeframe': timeframe.value,
                'generated_at': datetime.now().isoformat(),
                'metrics': self._metrics_to_dict(savings_metrics),
                'goal_analytics': [self._goal_analytics_to_dict(ga) for ga in goal_analytics],
                'trends': [self._trend_to_dict(ta) for ta in trend_analysis],
                'insights': insights,
                'performance_scores': performance_scores,
                'forecasts': forecasts,
                'summary': self._generate_summary(savings_metrics, goal_analytics, trend_analysis)
            }
            
            # Cache analytics report
            await self._cache_analytics_report(user_id, analytics_report)
            
            logger.info(f"✅ Generated comprehensive analytics for user {user_id}")
            
            return {
                'success': True,
                'data': analytics_report
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to generate analytics for user {user_id}: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _gather_analytics_data(self, user_id: str, timeframe: AnalyticsTimeframe) -> Dict:
        """Gather all data sources needed for analytics."""
        try:
            # Calculate date range based on timeframe
            end_date = datetime.now()
            
            if timeframe == AnalyticsTimeframe.DAILY:
                start_date = end_date - timedelta(days=30)  # Last 30 days
            elif timeframe == AnalyticsTimeframe.WEEKLY:
                start_date = end_date - timedelta(weeks=12)  # Last 12 weeks
            elif timeframe == AnalyticsTimeframe.MONTHLY:
                start_date = end_date - timedelta(days=365)  # Last 12 months
            elif timeframe == AnalyticsTimeframe.QUARTERLY:
                start_date = end_date - timedelta(days=365 * 2)  # Last 2 years
            elif timeframe == AnalyticsTimeframe.YEARLY:
                start_date = end_date - timedelta(days=365 * 5)  # Last 5 years
            else:  # ALL_TIME
                start_date = datetime(2020, 1, 1)  # App launch date
            
            data = {
                'user_id': user_id,
                'timeframe': timeframe,
                'start_date': start_date,
                'end_date': end_date,
                'goals': [],
                'subaccounts': [],
                'transfers': [],
                'user_stats': {}
            }
            
            if not self.db:
                return {'success': False, 'error': 'Database not available'}
            
            # Get user goals
            goals_query = self.db.collection('goals').where('userId', '==', user_id)
            for doc in goals_query.stream():
                goal_data = doc.to_dict()
                goal_data['id'] = doc.id
                data['goals'].append(goal_data)
            
            # Get subaccounts
            subaccounts_query = self.db.collection('goal_subaccounts').where('userId', '==', user_id)
            for doc in subaccounts_query.stream():
                subaccount_data = doc.to_dict()
                data['subaccounts'].append(subaccount_data)
            
            # Get transfer history
            if self.transfer_engine:
                transfers_result = self.transfer_engine.get_transfer_history(
                    user_id, 
                    start_date=start_date.isoformat(),
                    end_date=end_date.isoformat(),
                    limit=1000
                )
                if transfers_result['success']:
                    data['transfers'] = transfers_result['data']
            
            # Get user statistics
            data['user_stats'] = await self._calculate_user_stats(user_id, data)
            
            return {
                'success': True,
                'data': data
            }
            
        except Exception as e:
            logger.error(f"❌ Failed to gather analytics data: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _calculate_savings_metrics(self, data: Dict) -> SavingsMetrics:
        """Calculate core savings metrics."""
        goals = data.get('goals', [])
        transfers = data.get('transfers', [])
        subaccounts = data.get('subaccounts', [])
        
        # Calculate total saved across all goals
        total_saved = sum(goal.get('currentAmount', 0) for goal in goals)
        
        # Calculate monthly average
        completed_transfers = [t for t in transfers if t.get('status') == 'completed']
        if completed_transfers:
            # Group transfers by month
            monthly_totals = defaultdict(float)
            for transfer in completed_transfers:
                transfer_date = datetime.fromisoformat(transfer.get('created_at', ''))
                month_key = transfer_date.strftime('%Y-%m')
                monthly_totals[month_key] += transfer.get('amount', 0)
            
            monthly_avg_saved = statistics.mean(monthly_totals.values()) if monthly_totals else 0
        else:
            monthly_avg_saved = 0
        
        # Calculate goal completion rate
        completed_goals = len([g for g in goals if g.get('currentAmount', 0) >= g.get('targetAmount', 1)])
        goal_completion_rate = (completed_goals / len(goals) * 100) if goals else 0
        
        # Calculate transfer success rate
        total_transfers = len(transfers)
        successful_transfers = len(completed_transfers)
        transfer_success_rate = (successful_transfers / total_transfers * 100) if total_transfers else 100
        
        # Calculate average transfer amount
        avg_transfer_amount = statistics.mean([t.get('amount', 0) for t in completed_transfers]) if completed_transfers else 0
        
        # Calculate streaks
        current_streak, longest_streak = self._calculate_transfer_streaks(transfers)
        
        return SavingsMetrics(
            total_saved=total_saved,
            monthly_avg_saved=monthly_avg_saved,
            goal_completion_rate=goal_completion_rate,
            transfer_success_rate=transfer_success_rate,
            avg_transfer_amount=avg_transfer_amount,
            total_goals=len(goals),
            active_goals=len([g for g in goals if g.get('currentAmount', 0) < g.get('targetAmount', 1)]),
            completed_goals=completed_goals,
            longest_streak=longest_streak,
            current_streak=current_streak,
            total_transfers=total_transfers,
            failed_transfers=total_transfers - successful_transfers
        )
    
    def _analyze_goal_performance(self, goals: List[Dict], transfers: List[Dict]) -> List[GoalAnalytics]:
        """Analyze performance of individual goals."""
        goal_analytics = []
        
        for goal in goals:
            goal_id = goal.get('id')
            goal_name = goal.get('name', 'Unnamed Goal')
            target_amount = goal.get('targetAmount', 0)
            current_amount = goal.get('currentAmount', 0)
            created_date = goal.get('createdAt')
            
            if target_amount <= 0:
                continue
            
            # Calculate progress
            progress_percentage = (current_amount / target_amount) * 100
            
            # Calculate days active
            if created_date:
                created_dt = datetime.fromisoformat(created_date)
                days_active = (datetime.now() - created_dt).days
            else:
                days_active = 0
            
            # Get goal-specific transfers
            goal_transfers = [t for t in transfers if t.get('goal_id') == goal_id and t.get('status') == 'completed']
            
            # Calculate monthly contribution average
            if goal_transfers and days_active > 0:
                total_contributed = sum(t.get('amount', 0) for t in goal_transfers)
                months_active = max(days_active / 30, 1)
                avg_monthly_contribution = total_contributed / months_active
            else:
                avg_monthly_contribution = 0
            
            # Project completion date
            projected_completion_date = None
            if avg_monthly_contribution > 0 and progress_percentage < 100:
                remaining_amount = target_amount - current_amount
                months_to_completion = remaining_amount / avg_monthly_contribution
                projected_completion_date = datetime.now() + timedelta(days=months_to_completion * 30)
            
            # Calculate velocity score (0-100)
            if days_active > 0:
                expected_progress = (days_active / 365) * 100  # Assume 1 year to complete
                velocity_score = min(progress_percentage / max(expected_progress, 1) * 100, 100)
            else:
                velocity_score = 0
            
            goal_analytics.append(GoalAnalytics(
                goal_id=goal_id,
                goal_name=goal_name,
                target_amount=target_amount,
                current_amount=current_amount,
                progress_percentage=progress_percentage,
                days_active=days_active,
                projected_completion_date=projected_completion_date,
                avg_monthly_contribution=avg_monthly_contribution,
                total_transfers=len(goal_transfers),
                velocity_score=velocity_score
            ))
        
        return goal_analytics
    
    def _analyze_trends(self, data: Dict, timeframe: AnalyticsTimeframe) -> List[TrendAnalysis]:
        """Analyze trends in savings data."""
        trends = []
        transfers = data.get('transfers', [])
        
        if len(transfers) < self.min_data_points:
            return trends
        
        # Analyze transfer amount trends
        transfer_trend = self._analyze_transfer_amount_trend(transfers, timeframe)
        if transfer_trend:
            trends.append(transfer_trend)
        
        # Analyze transfer frequency trends
        frequency_trend = self._analyze_transfer_frequency_trend(transfers, timeframe)
        if frequency_trend:
            trends.append(frequency_trend)
        
        # Analyze goal progress trends
        goal_trend = self._analyze_goal_progress_trend(data.get('goals', []), timeframe)
        if goal_trend:
            trends.append(goal_trend)
        
        return trends
    
    def _analyze_transfer_amount_trend(self, transfers: List[Dict], timeframe: AnalyticsTimeframe) -> Optional[TrendAnalysis]:
        """Analyze trends in transfer amounts."""
        try:
            completed_transfers = [t for t in transfers if t.get('status') == 'completed']
            if len(completed_transfers) < self.min_data_points:
                return None
            
            # Group transfers by time period
            time_groups = self._group_transfers_by_time(completed_transfers, timeframe)
            
            if len(time_groups) < self.min_data_points:
                return None
            
            # Calculate average amount per period
            amounts = []
            data_points = []
            
            for period, period_transfers in sorted(time_groups.items()):
                avg_amount = statistics.mean([t.get('amount', 0) for t in period_transfers])
                amounts.append(avg_amount)
                data_points.append({
                    'period': period,
                    'value': avg_amount,
                    'count': len(period_transfers)
                })
            
            # Calculate trend direction and confidence
            direction, percentage_change, confidence = self._calculate_trend_metrics(amounts)
            
            # Generate insights
            insights = []
            if direction == TrendDirection.INCREASING:
                insights.append(f"Your transfer amounts have increased by {percentage_change:.1f}% over time")
                insights.append("This indicates improving savings habits")
            elif direction == TrendDirection.DECREASING:
                insights.append(f"Your transfer amounts have decreased by {abs(percentage_change):.1f}% over time")
                insights.append("Consider reviewing your budget to increase savings")
            else:
                insights.append("Your transfer amounts have remained relatively stable")
                
            return TrendAnalysis(
                metric_name="transfer_amounts",
                timeframe=timeframe,
                direction=direction,
                percentage_change=percentage_change,
                confidence_score=confidence,
                data_points=data_points,
                insights=insights
            )
            
        except Exception as e:
            logger.error(f"Error analyzing transfer amount trend: {e}")
            return None
    
    def _analyze_transfer_frequency_trend(self, transfers: List[Dict], timeframe: AnalyticsTimeframe) -> Optional[TrendAnalysis]:
        """Analyze trends in transfer frequency."""
        try:
            completed_transfers = [t for t in transfers if t.get('status') == 'completed']
            if len(completed_transfers) < self.min_data_points:
                return None
            
            # Group transfers by time period
            time_groups = self._group_transfers_by_time(completed_transfers, timeframe)
            
            if len(time_groups) < self.min_data_points:
                return None
            
            # Calculate frequency per period
            frequencies = []
            data_points = []
            
            for period, period_transfers in sorted(time_groups.items()):
                frequency = len(period_transfers)
                frequencies.append(frequency)
                data_points.append({
                    'period': period,
                    'value': frequency,
                    'total_amount': sum(t.get('amount', 0) for t in period_transfers)
                })
            
            # Calculate trend metrics
            direction, percentage_change, confidence = self._calculate_trend_metrics(frequencies)
            
            # Generate insights
            insights = []
            avg_frequency = statistics.mean(frequencies)
            
            if direction == TrendDirection.INCREASING:
                insights.append(f"Your transfer frequency has increased by {percentage_change:.1f}%")
                insights.append("More frequent transfers indicate better savings consistency")
            elif direction == TrendDirection.DECREASING:
                insights.append(f"Your transfer frequency has decreased by {abs(percentage_change):.1f}%")
                insights.append("Consider setting up more automated transfers for consistency")
            
            if avg_frequency < 4:  # Less than 4 transfers per period
                insights.append("Consider increasing transfer frequency for better savings momentum")
                
            return TrendAnalysis(
                metric_name="transfer_frequency",
                timeframe=timeframe,
                direction=direction,
                percentage_change=percentage_change,
                confidence_score=confidence,
                data_points=data_points,
                insights=insights
            )
            
        except Exception as e:
            logger.error(f"Error analyzing transfer frequency trend: {e}")
            return None
    
    def _analyze_goal_progress_trend(self, goals: List[Dict], timeframe: AnalyticsTimeframe) -> Optional[TrendAnalysis]:
        """Analyze trends in overall goal progress."""
        try:
            if not goals:
                return None
            
            # Calculate overall progress metrics
            total_progress = sum(
                (goal.get('currentAmount', 0) / goal.get('targetAmount', 1)) * 100 
                for goal in goals if goal.get('targetAmount', 0) > 0
            )
            avg_progress = total_progress / len(goals) if goals else 0
            
            # This is a simplified version - in a real implementation,
            # you'd track historical progress data
            data_points = [{
                'period': 'current',
                'value': avg_progress,
                'total_goals': len(goals),
                'completed_goals': len([g for g in goals if g.get('currentAmount', 0) >= g.get('targetAmount', 1)])
            }]
            
            insights = []
            if avg_progress > 75:
                insights.append("Excellent goal progress! Most goals are near completion")
            elif avg_progress > 50:
                insights.append("Good progress on your savings goals")
            elif avg_progress > 25:
                insights.append("Steady progress - consider increasing transfer amounts")
            else:
                insights.append("Goals need more attention - review your savings strategy")
                
            return TrendAnalysis(
                metric_name="goal_progress",
                timeframe=timeframe,
                direction=TrendDirection.STABLE,  # Would need historical data for real trend
                percentage_change=0,
                confidence_score=0.5,
                data_points=data_points,
                insights=insights
            )
            
        except Exception as e:
            logger.error(f"Error analyzing goal progress trend: {e}")
            return None
    
    # ==================== HELPER METHODS ====================
    
    def _group_transfers_by_time(self, transfers: List[Dict], timeframe: AnalyticsTimeframe) -> Dict[str, List[Dict]]:
        """Group transfers by time period."""
        time_groups = defaultdict(list)
        
        for transfer in transfers:
            transfer_date = datetime.fromisoformat(transfer.get('created_at', ''))
            
            if timeframe == AnalyticsTimeframe.DAILY:
                period_key = transfer_date.strftime('%Y-%m-%d')
            elif timeframe == AnalyticsTimeframe.WEEKLY:
                # Use ISO week
                period_key = transfer_date.strftime('%Y-W%U')
            elif timeframe == AnalyticsTimeframe.MONTHLY:
                period_key = transfer_date.strftime('%Y-%m')
            elif timeframe == AnalyticsTimeframe.QUARTERLY:
                quarter = (transfer_date.month - 1) // 3 + 1
                period_key = f"{transfer_date.year}-Q{quarter}"
            else:  # YEARLY or ALL_TIME
                period_key = transfer_date.strftime('%Y')
            
            time_groups[period_key].append(transfer)
        
        return time_groups
    
    def _calculate_trend_metrics(self, values: List[float]) -> Tuple[TrendDirection, float, float]:
        """Calculate trend direction, percentage change, and confidence."""
        if len(values) < 2:
            return TrendDirection.STABLE, 0.0, 0.0
        
        # Calculate linear regression slope
        n = len(values)
        x_vals = list(range(n))
        
        # Simple linear regression
        x_mean = statistics.mean(x_vals)
        y_mean = statistics.mean(values)
        
        numerator = sum((x_vals[i] - x_mean) * (values[i] - y_mean) for i in range(n))
        denominator = sum((x_vals[i] - x_mean) ** 2 for i in range(n))
        
        if denominator == 0:
            return TrendDirection.STABLE, 0.0, 0.0
        
        slope = numerator / denominator
        
        # Calculate percentage change
        if values[0] != 0:
            percentage_change = ((values[-1] - values[0]) / values[0]) * 100
        else:
            percentage_change = 0
        
        # Calculate confidence based on R-squared
        ss_tot = sum((v - y_mean) ** 2 for v in values)
        ss_res = sum((values[i] - (slope * x_vals[i] + (y_mean - slope * x_mean))) ** 2 for i in range(n))
        
        r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0
        confidence = max(r_squared, 0)
        
        # Determine trend direction
        if abs(percentage_change) < 5:  # Less than 5% change
            direction = TrendDirection.STABLE
        elif confidence < self.trend_confidence_threshold:
            direction = TrendDirection.VOLATILE
        elif slope > 0:
            direction = TrendDirection.INCREASING
        else:
            direction = TrendDirection.DECREASING
        
        return direction, percentage_change, confidence
    
    def _calculate_transfer_streaks(self, transfers: List[Dict]) -> Tuple[int, int]:
        """Calculate current and longest transfer streaks."""
        if not transfers:
            return 0, 0
        
        # Sort transfers by date
        sorted_transfers = sorted(transfers, key=lambda t: t.get('created_at', ''))
        
        current_streak = 0
        longest_streak = 0
        temp_streak = 0
        last_date = None
        
        for transfer in sorted_transfers:
            if transfer.get('status') != 'completed':
                continue
                
            transfer_date = datetime.fromisoformat(transfer.get('created_at', '')).date()
            
            if last_date is None:
                temp_streak = 1
            elif (transfer_date - last_date).days <= 7:  # Within a week
                temp_streak += 1
            else:
                longest_streak = max(longest_streak, temp_streak)
                temp_streak = 1
            
            last_date = transfer_date
        
        longest_streak = max(longest_streak, temp_streak)
        
        # Current streak is the streak ending today (within last week)
        if last_date and (datetime.now().date() - last_date).days <= 7:
            current_streak = temp_streak
        
        return current_streak, longest_streak
    
    async def _calculate_user_stats(self, user_id: str, data: Dict) -> Dict:
        """Calculate user statistics for achievements."""
        goals = data.get('goals', [])
        transfers = data.get('transfers', [])
        
        completed_transfers = [t for t in transfers if t.get('status') == 'completed']
        current_streak, longest_streak = self._calculate_transfer_streaks(transfers)
        
        return {
            'total_goals': len(goals),
            'completed_goals': len([g for g in goals if g.get('currentAmount', 0) >= g.get('targetAmount', 1)]),
            'total_saved': sum(goal.get('currentAmount', 0) for goal in goals),
            'total_transfers': len(completed_transfers),
            'transfer_streak': current_streak,
            'longest_streak': longest_streak,
            'active_rules': len(data.get('transfer_rules', [])),
            'avg_transfer_amount': statistics.mean([t.get('amount', 0) for t in completed_transfers]) if completed_transfers else 0
        }
    
    # ==================== INSIGHT GENERATION ====================
    
    def _generate_analytics_insights(self, metrics: SavingsMetrics, goal_analytics: List[GoalAnalytics], trends: List[TrendAnalysis]) -> List[Dict]:
        """Generate actionable insights from analytics data."""
        insights = []
        
        # Performance insights
        if metrics.transfer_success_rate < 85:
            insights.append({
                'type': 'performance',
                'title': 'Improve Transfer Reliability',
                'message': f'Your transfer success rate is {metrics.transfer_success_rate:.1f}%. Review failed transfers and ensure sufficient account balance.',
                'priority': 'high',
                'actionable': True
            })
        
        if metrics.goal_completion_rate < 50:
            insights.append({
                'type': 'goal_management',
                'title': 'Focus on Goal Completion',
                'message': f'Only {metrics.goal_completion_rate:.1f}% of your goals are completed. Consider focusing on fewer goals at once.',
                'priority': 'medium',
                'actionable': True
            })
        
        # Goal-specific insights
        slow_goals = [ga for ga in goal_analytics if ga.velocity_score < 30]
        if slow_goals:
            insights.append({
                'type': 'goal_velocity',
                'title': 'Accelerate Slow Goals',
                'message': f'{len(slow_goals)} goals are progressing slowly. Consider increasing transfer amounts or frequency.',
                'priority': 'medium',
                'actionable': True,
                'affected_goals': [g.goal_name for g in slow_goals]
            })
        
        # Trend insights
        for trend in trends:
            if trend.confidence_score > self.trend_confidence_threshold:
                insights.extend(trend.insights)
        
        # Positive reinforcement
        if metrics.current_streak >= 7:
            insights.append({
                'type': 'achievement',
                'title': 'Great Consistency!',
                'message': f'You\'re on a {metrics.current_streak}-day transfer streak. Keep it up!',
                'priority': 'low',
                'actionable': False
            })
        
        return insights
    
    def _calculate_performance_scores(self, metrics: SavingsMetrics, goal_analytics: List[GoalAnalytics]) -> Dict:
        """Calculate various performance scores."""
        # Consistency score (0-100)
        consistency_score = min(metrics.transfer_success_rate, 100)
        
        # Progress score (0-100)
        if goal_analytics:
            avg_progress = statistics.mean([ga.progress_percentage for ga in goal_analytics])
            progress_score = min(avg_progress, 100)
        else:
            progress_score = 0
        
        # Velocity score (0-100)
        if goal_analytics:
            avg_velocity = statistics.mean([ga.velocity_score for ga in goal_analytics])
            velocity_score = min(avg_velocity, 100)
        else:
            velocity_score = 0
        
        # Overall score (weighted average)
        overall_score = (
            consistency_score * 0.3 +
            progress_score * 0.4 +
            velocity_score * 0.3
        )
        
        return {
            'overall_score': round(overall_score, 1),
            'consistency_score': round(consistency_score, 1),
            'progress_score': round(progress_score, 1),
            'velocity_score': round(velocity_score, 1),
            'grade': self._calculate_grade(overall_score)
        }
    
    def _calculate_grade(self, score: float) -> str:
        """Convert score to letter grade."""
        if score >= 90:
            return 'A+'
        elif score >= 85:
            return 'A'
        elif score >= 80:
            return 'A-'
        elif score >= 75:
            return 'B+'
        elif score >= 70:
            return 'B'
        elif score >= 65:
            return 'B-'
        elif score >= 60:
            return 'C+'
        elif score >= 55:
            return 'C'
        elif score >= 50:
            return 'C-'
        else:
            return 'D'
    
    def _generate_forecasts(self, data: Dict, timeframe: AnalyticsTimeframe) -> Dict:
        """Generate forecasts for goals and savings."""
        goals = data.get('goals', [])
        transfers = data.get('transfers', [])
        
        forecasts = {
            'goal_completion_dates': {},
            'projected_savings': {},
            'recommendations': []
        }
        
        # Forecast goal completion dates
        for goal in goals:
            goal_id = goal.get('id')
            current_amount = goal.get('currentAmount', 0)
            target_amount = goal.get('targetAmount', 0)
            
            if current_amount >= target_amount:
                continue
            
            # Calculate monthly contribution rate
            goal_transfers = [t for t in transfers if t.get('goal_id') == goal_id and t.get('status') == 'completed']
            
            if goal_transfers:
                monthly_rate = statistics.mean([t.get('amount', 0) for t in goal_transfers[-12:]]) * 4  # Assume weekly transfers
                
                if monthly_rate > 0:
                    months_to_complete = (target_amount - current_amount) / monthly_rate
                    completion_date = datetime.now() + timedelta(days=months_to_complete * 30)
                    
                    forecasts['goal_completion_dates'][goal_id] = {
                        'goal_name': goal.get('name'),
                        'projected_date': completion_date.isoformat(),
                        'months_remaining': round(months_to_complete, 1),
                        'monthly_rate': round(monthly_rate, 2)
                    }
        
        return forecasts
    
    def _generate_summary(self, metrics: SavingsMetrics, goal_analytics: List[GoalAnalytics], trends: List[TrendAnalysis]) -> Dict:
        """Generate executive summary of analytics."""
        summary = {
            'headline': '',
            'key_metrics': {
                'total_saved': f"${metrics.total_saved:,.2f}",
                'monthly_average': f"${metrics.monthly_avg_saved:,.2f}",
                'success_rate': f"{metrics.transfer_success_rate:.1f}%",
                'active_goals': metrics.active_goals
            },
            'status': 'good',  # good, fair, needs_attention
            'next_actions': []
        }
        
        # Generate headline
        if metrics.goal_completion_rate > 80:
            summary['headline'] = "Excellent savings performance! You're crushing your goals."
            summary['status'] = 'excellent'
        elif metrics.goal_completion_rate > 60:
            summary['headline'] = "Good progress on your savings journey. Keep it up!"
            summary['status'] = 'good'
        elif metrics.goal_completion_rate > 30:
            summary['headline'] = "Steady progress, but there's room for improvement."
            summary['status'] = 'fair'
        else:
            summary['headline'] = "Your savings strategy needs attention."
            summary['status'] = 'needs_attention'
        
        # Generate next actions
        if metrics.transfer_success_rate < 90:
            summary['next_actions'].append("Review and fix failed transfers")
        
        if metrics.current_streak == 0:
            summary['next_actions'].append("Start a new transfer streak")
        
        slow_goals = [ga for ga in goal_analytics if ga.velocity_score < 50]
        if slow_goals:
            summary['next_actions'].append(f"Increase contributions to {len(slow_goals)} slow-progressing goals")
        
        return summary
    
    # ==================== DATA CONVERSION METHODS ====================
    
    def _metrics_to_dict(self, metrics: SavingsMetrics) -> Dict:
        """Convert SavingsMetrics to dictionary."""
        return {
            'total_saved': metrics.total_saved,
            'monthly_avg_saved': metrics.monthly_avg_saved,
            'goal_completion_rate': metrics.goal_completion_rate,
            'transfer_success_rate': metrics.transfer_success_rate,
            'avg_transfer_amount': metrics.avg_transfer_amount,
            'total_goals': metrics.total_goals,
            'active_goals': metrics.active_goals,
            'completed_goals': metrics.completed_goals,
            'longest_streak': metrics.longest_streak,
            'current_streak': metrics.current_streak,
            'total_transfers': metrics.total_transfers,
            'failed_transfers': metrics.failed_transfers
        }
    
    def _goal_analytics_to_dict(self, ga: GoalAnalytics) -> Dict:
        """Convert GoalAnalytics to dictionary."""
        return {
            'goal_id': ga.goal_id,
            'goal_name': ga.goal_name,
            'target_amount': ga.target_amount,
            'current_amount': ga.current_amount,
            'progress_percentage': ga.progress_percentage,
            'days_active': ga.days_active,
            'projected_completion_date': ga.projected_completion_date.isoformat() if ga.projected_completion_date else None,
            'avg_monthly_contribution': ga.avg_monthly_contribution,
            'total_transfers': ga.total_transfers,
            'velocity_score': ga.velocity_score
        }
    
    def _trend_to_dict(self, ta: TrendAnalysis) -> Dict:
        """Convert TrendAnalysis to dictionary."""
        return {
            'metric_name': ta.metric_name,
            'timeframe': ta.timeframe.value,
            'direction': ta.direction.value,
            'percentage_change': ta.percentage_change,
            'confidence_score': ta.confidence_score,
            'data_points': ta.data_points,
            'insights': ta.insights
        }
    
    # ==================== CACHING ====================
    
    async def _cache_analytics_report(self, user_id: str, report: Dict) -> None:
        """Cache analytics report for future retrieval."""
        try:
            if not self.db:
                return
            
            # Store in Firebase with expiration
            doc_id = f"{user_id}_{datetime.now().strftime('%Y%m%d')}"
            self.db.collection('analytics_reports').document(doc_id).set({
                'user_id': user_id,
                'report': report,
                'created_at': datetime.now().isoformat(),
                'expires_at': (datetime.now() + timedelta(hours=24)).isoformat()
            })
            
            logger.info(f"✅ Cached analytics report for user {user_id}")
            
        except Exception as e:
            logger.error(f"❌ Failed to cache analytics report: {str(e)}")


# Global analytics instance
savings_analytics = None

def init_savings_analytics(app):
    """Initialize the global savings analytics with Flask app."""
    global savings_analytics
    savings_analytics = SavingsAnalytics(app)
    return savings_analytics

def get_savings_analytics():
    """Get the global savings analytics instance."""
    return savings_analytics 