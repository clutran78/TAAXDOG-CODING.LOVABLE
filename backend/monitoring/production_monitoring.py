"""
TAAXDOG Production Monitoring and Alerting System
================================================

Comprehensive production monitoring including:
- Real-time metrics collection and alerting
- Application performance monitoring (APM)
- Error tracking and notification system
- Infrastructure monitoring and health checks
- Australian timezone-aware logging and alerts
"""

import os
import sys
import time
import json
import logging
import smtplib
import threading
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import pytz

try:
    from email.mime.text import MimeText
    from email.mime.multipart import MimeMultipart
except ImportError:
    # Fallback for systems without email support
    MimeText = None
    MimeMultipart = None

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# Import performance utilities
try:
    from services.performance_optimizer import get_performance_metrics
    from database.production_setup import get_database_health, get_cache_stats
except ImportError:
    # Fallback functions
    def get_performance_metrics(): return {}
    def get_database_health(): return {'overall': 'unknown'}
    def get_cache_stats(): return {}

logger = logging.getLogger(__name__)

# Australian timezone for proper logging
AUSTRALIAN_TZ = pytz.timezone('Australia/Sydney')

@dataclass
class Alert:
    """Alert data structure"""
    id: str
    level: str  # 'info', 'warning', 'error', 'critical'
    title: str
    message: str
    timestamp: datetime
    component: str
    resolved: bool = False
    acknowledged: bool = False

@dataclass
class MetricThreshold:
    """Metric threshold configuration"""
    metric_name: str
    warning_threshold: float
    critical_threshold: float
    comparison: str = 'greater_than'  # 'greater_than', 'less_than'

class ProductionMonitoring:
    """
    Main production monitoring and alerting system
    Handles metrics collection, alerting, and health monitoring
    """
    
    def __init__(self):
        self.alerts = []
        self.metrics_history = []
        self.alert_callbacks = []
        self.is_monitoring = False
        self.monitoring_thread = None
        
        # Define metric thresholds for Australian business hours
        self.thresholds = [
            MetricThreshold('response_time', 2.0, 5.0),  # seconds
            MetricThreshold('memory_usage', 80.0, 95.0),  # percentage
            MetricThreshold('cpu_usage', 80.0, 95.0),     # percentage
            MetricThreshold('cache_hit_rate', 60.0, 40.0, 'less_than'),  # percentage
            MetricThreshold('error_rate', 5.0, 10.0),     # percentage
            MetricThreshold('database_connections', 80.0, 95.0),  # percentage of pool
        ]
        
        self._setup_email_alerts()
        self.start_monitoring()
    
    def _setup_email_alerts(self):
        """Setup email alert configuration"""
        self.smtp_config = {
            'server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
            'port': int(os.getenv('SMTP_PORT', 587)),
            'username': os.getenv('EMAIL_USER'),
            'password': os.getenv('EMAIL_PASSWORD'),
            'from_email': os.getenv('EMAIL_USER', 'alerts@taaxdog.com'),
            'admin_emails': os.getenv('ADMIN_EMAILS', '').split(',')
        }
    
    def start_monitoring(self):
        """Start the monitoring system"""
        if self.is_monitoring:
            return
        
        self.is_monitoring = True
        self.monitoring_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitoring_thread.start()
        logger.info("✅ Production monitoring started")
    
    def stop_monitoring(self):
        """Stop the monitoring system"""
        self.is_monitoring = False
        if self.monitoring_thread:
            self.monitoring_thread.join(timeout=5)
        logger.info("🔄 Production monitoring stopped")
    
    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_monitoring:
            try:
                # Collect current metrics
                current_metrics = self._collect_metrics()
                
                # Store metrics history
                self._store_metrics(current_metrics)
                
                # Check thresholds and generate alerts
                self._check_thresholds(current_metrics)
                
                # Check application health
                self._check_application_health()
                
                # Clean up old data
                self._cleanup_old_data()
                
                # Sleep for 60 seconds before next check
                time.sleep(60)
                
            except Exception as e:
                logger.error(f"Monitoring loop error: {e}")
                time.sleep(60)
    
    def _collect_metrics(self) -> Dict[str, Any]:
        """Collect comprehensive system metrics"""
        current_time = datetime.now(AUSTRALIAN_TZ)
        
        # Get performance metrics
        perf_metrics = get_performance_metrics()
        
        # Get database health
        db_health = get_database_health()
        
        # Get cache statistics
        cache_stats = get_cache_stats()
        
        # Get system metrics
        system_metrics = self._get_system_metrics()
        
        # Get application-specific metrics
        app_metrics = self._get_application_metrics()
        
        return {
            'timestamp': current_time.isoformat(),
            'timezone': 'Australia/Sydney',
            'performance': perf_metrics,
            'database': db_health,
            'cache': cache_stats,
            'system': system_metrics,
            'application': app_metrics,
            'business_hours': self._is_business_hours(current_time)
        }
    
    def _get_system_metrics(self) -> Dict[str, Any]:
        """Get system-level metrics"""
        try:
            import psutil
            
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            cpu_count = psutil.cpu_count()
            
            # Memory metrics
            memory = psutil.virtual_memory()
            
            # Disk metrics
            disk = psutil.disk_usage('/')
            
            # Network metrics
            network = psutil.net_io_counters()
            
            return {
                'cpu': {
                    'percent': cpu_percent,
                    'count': cpu_count,
                    'load_average': os.getloadavg() if hasattr(os, 'getloadavg') else None
                },
                'memory': {
                    'total': memory.total,
                    'available': memory.available,
                    'percent': memory.percent,
                    'used': memory.used
                },
                'disk': {
                    'total': disk.total,
                    'used': disk.used,
                    'free': disk.free,
                    'percent': disk.percent
                },
                'network': {
                    'bytes_sent': network.bytes_sent,
                    'bytes_recv': network.bytes_recv,
                    'packets_sent': network.packets_sent,
                    'packets_recv': network.packets_recv
                }
            }
            
        except ImportError:
            return {'error': 'psutil not available'}
        except Exception as e:
            return {'error': str(e)}
    
    def _get_application_metrics(self) -> Dict[str, Any]:
        """Get TAAXDOG-specific application metrics"""
        try:
            # Try to import database models for counting
            try:
                from database.models import db
                # Would implement actual database queries here
                db_available = True
            except ImportError:
                db_available = False
            
            # Get error counts from logs
            error_count = self._count_recent_errors()
            
            # Get API endpoint usage
            endpoint_stats = self._get_endpoint_statistics()
            
            return {
                'active_users_24h': 0,  # Placeholder - implement actual user tracking
                'total_goals_created': 0,  # Placeholder
                'total_transfers_processed': 0,  # Placeholder
                'recent_errors': error_count,
                'endpoint_usage': endpoint_stats,
                'receipt_processing_queue': 0,  # Placeholder
                'notification_queue': 0,  # Placeholder
                'database_available': db_available
            }
            
        except Exception as e:
            return {'error': str(e)}
    
    def _count_recent_errors(self) -> int:
        """Count errors in the last hour"""
        # This would typically read from log files or error tracking system
        # Placeholder implementation
        return 0
    
    def _get_endpoint_statistics(self) -> Dict[str, int]:
        """Get API endpoint usage statistics"""
        # Placeholder - would typically come from request logging
        return {
            '/api/goals': 0,
            '/api/receipts/upload': 0,
            '/api/basiq/sync': 0,
            '/api/notifications': 0
        }
    
    def _is_business_hours(self, current_time: datetime) -> bool:
        """Check if current time is within Australian business hours"""
        # Australian business hours: 9 AM - 6 PM AEST/AEDT, Mon-Fri
        if current_time.weekday() >= 5:  # Saturday = 5, Sunday = 6
            return False
        
        hour = current_time.hour
        return 9 <= hour <= 18
    
    def _store_metrics(self, metrics: Dict[str, Any]):
        """Store metrics in history for trend analysis"""
        self.metrics_history.append(metrics)
        
        # Keep only last 24 hours of metrics (1440 minutes)
        if len(self.metrics_history) > 1440:
            self.metrics_history = self.metrics_history[-1440:]
    
    def _check_thresholds(self, metrics: Dict[str, Any]):
        """Check metrics against defined thresholds and generate alerts"""
        for threshold in self.thresholds:
            try:
                # Extract metric value from nested structure
                metric_value = self._extract_metric_value(metrics, threshold.metric_name)
                
                if metric_value is None:
                    continue
                
                # Check threshold based on comparison type
                alert_level = None
                
                if threshold.comparison == 'greater_than':
                    if metric_value >= threshold.critical_threshold:
                        alert_level = 'critical'
                    elif metric_value >= threshold.warning_threshold:
                        alert_level = 'warning'
                else:  # less_than
                    if metric_value <= threshold.critical_threshold:
                        alert_level = 'critical'
                    elif metric_value <= threshold.warning_threshold:
                        alert_level = 'warning'
                
                # Generate alert if threshold exceeded
                if alert_level:
                    self._generate_alert(
                        level=alert_level,
                        title=f"{threshold.metric_name.title()} Threshold Exceeded",
                        message=f"{threshold.metric_name} is {metric_value} "
                               f"(threshold: {threshold.warning_threshold}/"
                               f"{threshold.critical_threshold})",
                        component=threshold.metric_name
                    )
                    
            except Exception as e:
                logger.error(f"Error checking threshold for {threshold.metric_name}: {e}")
    
    def _extract_metric_value(self, metrics: Dict[str, Any], metric_name: str) -> Optional[float]:
        """Extract metric value from nested metrics structure"""
        # Map metric names to actual paths in metrics structure
        metric_paths = {
            'response_time': ['performance', 'metrics', 'avg_response_time'],
            'memory_usage': ['system', 'memory', 'percent'],
            'cpu_usage': ['system', 'cpu', 'percent'],
            'cache_hit_rate': ['cache', 'hit_rate'],
            'error_rate': ['application', 'recent_errors'],
            'database_connections': ['database', 'details', 'connections_used']
        }
        
        path = metric_paths.get(metric_name)
        if not path:
            return None
        
        try:
            value = metrics
            for key in path:
                value = value[key]
            return float(value)
        except (KeyError, TypeError, ValueError):
            return None
    
    def _check_application_health(self):
        """Check overall application health and generate alerts"""
        db_health = get_database_health()
        
        # Check database health
        if db_health.get('overall') == 'unhealthy':
            self._generate_alert(
                level='critical',
                title='Database Health Critical',
                message=f"Database health check failed: {db_health.get('database', {}).get('details', {})}",
                component='database'
            )
        elif db_health.get('overall') == 'degraded':
            self._generate_alert(
                level='warning',
                title='Database Performance Degraded',
                message='Database is experiencing performance issues',
                component='database'
            )
        
        # Check cache health
        cache_health = db_health.get('cache', {}).get('status')
        if cache_health == 'unhealthy':
            self._generate_alert(
                level='warning',
                title='Cache System Unavailable',
                message='Redis cache system is not responding',
                component='cache'
            )
    
    def _generate_alert(self, level: str, title: str, message: str, component: str):
        """Generate and process an alert"""
        alert_id = f"{component}_{level}_{int(time.time())}"
        
        # Check if similar alert already exists and is not resolved
        existing_alert = next(
            (alert for alert in self.alerts 
             if alert.component == component and alert.level == level and not alert.resolved),
            None
        )
        
        if existing_alert:
            # Update existing alert timestamp
            existing_alert.timestamp = datetime.now(AUSTRALIAN_TZ)
            return
        
        # Create new alert
        alert = Alert(
            id=alert_id,
            level=level,
            title=title,
            message=message,
            timestamp=datetime.now(AUSTRALIAN_TZ),
            component=component
        )
        
        self.alerts.append(alert)
        
        # Process alert (send notifications, etc.)
        self._process_alert(alert)
        
        logger.warning(f"🚨 Alert Generated: {title} - {message}")
    
    def _process_alert(self, alert: Alert):
        """Process an alert by sending notifications"""
        # Send email alerts for critical issues or during business hours
        current_time = datetime.now(AUSTRALIAN_TZ)
        
        if (alert.level == 'critical' or 
            (alert.level == 'warning' and self._is_business_hours(current_time))):
            self._send_email_alert(alert)
        
        # Call registered alert callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")
    
    def _send_email_alert(self, alert: Alert):
        """Send email notification for alert"""
        try:
            if not self.smtp_config['username'] or not self.smtp_config['admin_emails'][0]:
                logger.warning("Email alerts not configured")
                return
            
            # Check if email classes are available
            if MimeMultipart is None or MimeText is None:
                logger.warning("Email classes not available, cannot send alert")
                return
            
            # Create email message
            msg = MimeMultipart()
            msg['From'] = self.smtp_config['from_email']
            msg['To'] = ', '.join(self.smtp_config['admin_emails'])
            msg['Subject'] = f"TAAXDOG Alert [{alert.level.upper()}]: {alert.title}"
            
            # Email body
            body = f"""
TAAXDOG Production Alert

Level: {alert.level.upper()}
Component: {alert.component}
Time: {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S %Z')}

Title: {alert.title}
Message: {alert.message}

Alert ID: {alert.id}

Please investigate immediately if this is a critical alert.

---
TAAXDOG Monitoring System
            """.strip()
            
            msg.attach(MimeText(body, 'plain'))
            
            # Send email
            with smtplib.SMTP(self.smtp_config['server'], self.smtp_config['port']) as server:
                server.starttls()
                server.login(self.smtp_config['username'], self.smtp_config['password'])
                server.send_message(msg)
            
            logger.info(f"📧 Email alert sent for: {alert.title}")
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
    
    def _cleanup_old_data(self):
        """Clean up old alerts and metrics"""
        current_time = datetime.now(AUSTRALIAN_TZ)
        
        # Remove resolved alerts older than 7 days
        cutoff_time = current_time - timedelta(days=7)
        self.alerts = [
            alert for alert in self.alerts
            if not (alert.resolved and alert.timestamp < cutoff_time)
        ]
        
        # Keep only last 24 hours of metrics (handled in _store_metrics)
    
    def get_monitoring_dashboard(self) -> Dict[str, Any]:
        """Get comprehensive monitoring dashboard data"""
        current_metrics = self._collect_metrics() if self.metrics_history else {}
        
        # Get recent alerts (last 24 hours)
        recent_alerts = [
            asdict(alert) for alert in self.alerts
            if alert.timestamp > datetime.now(AUSTRALIAN_TZ) - timedelta(hours=24)
        ]
        
        # Calculate trend data
        trends = self._calculate_trends()
        
        return {
            'current_metrics': current_metrics,
            'recent_alerts': recent_alerts,
            'active_alerts': [asdict(alert) for alert in self.alerts if not alert.resolved],
            'trends': trends,
            'monitoring_status': {
                'is_running': self.is_monitoring,
                'last_check': self.metrics_history[-1]['timestamp'] if self.metrics_history else None,
                'total_checks': len(self.metrics_history),
                'total_alerts': len(self.alerts)
            }
        }
    
    def _calculate_trends(self) -> Dict[str, Any]:
        """Calculate metric trends over time"""
        if len(self.metrics_history) < 2:
            return {}
        
        # Calculate trends for last hour vs previous hour
        current_hour_metrics = self.metrics_history[-60:] if len(self.metrics_history) >= 60 else self.metrics_history
        previous_hour_metrics = self.metrics_history[-120:-60] if len(self.metrics_history) >= 120 else []
        
        trends = {}
        
        # Calculate average response time trend
        if current_hour_metrics and previous_hour_metrics:
            current_avg_response = sum(
                m.get('performance', {}).get('metrics', {}).get('avg_response_time', 0)
                for m in current_hour_metrics
            ) / len(current_hour_metrics)
            
            previous_avg_response = sum(
                m.get('performance', {}).get('metrics', {}).get('avg_response_time', 0)
                for m in previous_hour_metrics
            ) / len(previous_hour_metrics)
            
            if previous_avg_response > 0:
                trend_percent = ((current_avg_response - previous_avg_response) / previous_avg_response) * 100
                trends['response_time'] = {
                    'current': current_avg_response,
                    'previous': previous_avg_response,
                    'trend_percent': trend_percent,
                    'direction': 'up' if trend_percent > 0 else 'down'
                }
        
        return trends
    
    def register_alert_callback(self, callback: Callable[[Alert], None]):
        """Register a callback function to be called when alerts are generated"""
        self.alert_callbacks.append(callback)
    
    def acknowledge_alert(self, alert_id: str):
        """Acknowledge an alert"""
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                logger.info(f"Alert acknowledged: {alert_id}")
                break
    
    def resolve_alert(self, alert_id: str):
        """Mark an alert as resolved"""
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.resolved = True
                logger.info(f"Alert resolved: {alert_id}")
                break


# Global monitoring instance
production_monitoring = ProductionMonitoring()

def get_monitoring_dashboard():
    """Get monitoring dashboard data"""
    return production_monitoring.get_monitoring_dashboard()

def register_alert_callback(callback: Callable[[Alert], None]):
    """Register alert callback"""
    production_monitoring.register_alert_callback(callback)

def acknowledge_alert(alert_id: str):
    """Acknowledge an alert"""
    production_monitoring.acknowledge_alert(alert_id)

def resolve_alert(alert_id: str):
    """Resolve an alert"""
    production_monitoring.resolve_alert(alert_id) 