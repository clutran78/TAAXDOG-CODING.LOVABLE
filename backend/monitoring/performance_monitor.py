"""
Performance Monitoring and Analytics System for TAAXDOG
Tracks application performance, user behavior, and business metrics
"""

import os
import time
import uuid
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from functools import wraps
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import threading

try:
    import redis
    from prometheus_client import Counter, Histogram, Gauge, start_http_server
    import sentry_sdk
    from mixpanel import Mixpanel
except ImportError:
    # Graceful degradation if monitoring dependencies not available
    redis = None
    Counter = Histogram = Gauge = None
    sentry_sdk = None
    Mixpanel = None


@dataclass
class PerformanceMetric:
    """Individual performance metric data structure"""
    request_id: str
    endpoint: str
    method: str
    user_id: Optional[str]
    duration: float
    status_code: int
    timestamp: datetime
    memory_usage: Optional[float] = None
    cpu_usage: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'request_id': self.request_id,
            'endpoint': self.endpoint,
            'method': self.method,
            'user_id': self.user_id,
            'duration': self.duration,
            'status_code': self.status_code,
            'timestamp': self.timestamp.isoformat(),
            'memory_usage': self.memory_usage,
            'cpu_usage': self.cpu_usage
        }


@dataclass
class UserAnalytic:
    """User behavior analytics data structure"""
    user_id: str
    event_type: str
    event_data: Dict[str, Any]
    timestamp: datetime
    session_id: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization"""
        return {
            'user_id': self.user_id,
            'event_type': self.event_type,
            'event_data': self.event_data,
            'timestamp': self.timestamp.isoformat(),
            'session_id': self.session_id
        }


class PerformanceMonitor:
    """Advanced performance monitoring system"""
    
    def __init__(self):
        self.logger = logging.getLogger('taaxdog.performance')
        self.redis_client = self._setup_redis()
        self.metrics_buffer = deque(maxlen=1000)  # Buffer for metrics when Redis unavailable
        self.prometheus_metrics = self._setup_prometheus()
        self.current_requests = {}  # Track active requests
        self.lock = threading.Lock()
        
        # Start Prometheus metrics server
        if os.environ.get('ENABLE_PROMETHEUS', 'true').lower() == 'true':
            self._start_prometheus_server()
    
    def _setup_redis(self) -> Optional[redis.Redis]:
        """Setup Redis connection for metrics storage"""
        if not redis:
            self.logger.warning("Redis not available, using in-memory metrics buffer")
            return None
        
        try:
            redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
            client = redis.from_url(redis_url)
            client.ping()  # Test connection
            return client
        except Exception as e:
            self.logger.warning(f"Redis connection failed: {e}, using in-memory buffer")
            return None
    
    def _setup_prometheus(self) -> Dict[str, Any]:
        """Setup Prometheus metrics"""
        if not Counter:
            return {}
        
        return {
            'request_count': Counter('taaxdog_requests_total', 'Total requests', ['method', 'endpoint', 'status']),
            'request_duration': Histogram('taaxdog_request_duration_seconds', 'Request duration', ['method', 'endpoint']),
            'active_users': Gauge('taaxdog_active_users', 'Number of active users'),
            'receipt_processing': Counter('taaxdog_receipts_processed_total', 'Total receipts processed', ['status']),
            'gemini_api_calls': Counter('taaxdog_gemini_calls_total', 'Total Gemini API calls', ['status']),
            'error_count': Counter('taaxdog_errors_total', 'Total errors', ['error_type']),
        }
    
    def _start_prometheus_server(self):
        """Start Prometheus metrics server"""
        try:
            port = int(os.environ.get('PROMETHEUS_PORT', 8000))
            start_http_server(port)
            self.logger.info(f"Prometheus metrics server started on port {port}")
        except Exception as e:
            self.logger.error(f"Failed to start Prometheus server: {e}")
    
    def start_request_tracking(self, request_id: str, endpoint: str, method: str, user_id: Optional[str] = None):
        """Start tracking a new request"""
        with self.lock:
            self.current_requests[request_id] = {
                'start_time': time.time(),
                'endpoint': endpoint,
                'method': method,
                'user_id': user_id
            }
    
    def end_request_tracking(self, request_id: str, status_code: int, memory_usage: Optional[float] = None):
        """Complete request tracking and record metrics"""
        with self.lock:
            if request_id not in self.current_requests:
                self.logger.warning(f"Request {request_id} not found in tracking")
                return
            
            request_data = self.current_requests.pop(request_id)
            duration = time.time() - request_data['start_time']
            
            metric = PerformanceMetric(
                request_id=request_id,
                endpoint=request_data['endpoint'],
                method=request_data['method'],
                user_id=request_data['user_id'],
                duration=duration,
                status_code=status_code,
                timestamp=datetime.utcnow(),
                memory_usage=memory_usage
            )
            
            self._record_metric(metric)
    
    def _record_metric(self, metric: PerformanceMetric):
        """Record performance metric to storage"""
        # Update Prometheus metrics
        if self.prometheus_metrics:
            self.prometheus_metrics['request_count'].labels(
                method=metric.method,
                endpoint=metric.endpoint,
                status=str(metric.status_code)
            ).inc()
            
            self.prometheus_metrics['request_duration'].labels(
                method=metric.method,
                endpoint=metric.endpoint
            ).observe(metric.duration)
        
        # Store in Redis or buffer
        if self.redis_client:
            try:
                key = f"metrics:{datetime.utcnow().strftime('%Y-%m-%d')}"
                self.redis_client.lpush(key, json.dumps(metric.to_dict()))
                self.redis_client.expire(key, 86400 * 7)  # Keep for 7 days
            except Exception as e:
                self.logger.error(f"Failed to store metric in Redis: {e}")
                self.metrics_buffer.append(metric)
        else:
            self.metrics_buffer.append(metric)
        
        # Log slow requests
        if metric.duration > 5.0:
            self.logger.warning(f"Slow request detected: {metric.endpoint} took {metric.duration:.2f}s")
    
    def track_receipt_processing(self, success: bool, processing_time: float, error_type: Optional[str] = None):
        """Track receipt processing metrics"""
        status = 'success' if success else 'failure'
        
        if self.prometheus_metrics:
            self.prometheus_metrics['receipt_processing'].labels(status=status).inc()
        
        if not success and error_type and self.prometheus_metrics:
            self.prometheus_metrics['error_count'].labels(error_type=error_type).inc()
        
        self.logger.info(f"Receipt processing {status} in {processing_time:.2f}s")
    
    def track_gemini_api_call(self, success: bool, response_time: float):
        """Track Gemini API call metrics"""
        status = 'success' if success else 'failure'
        
        if self.prometheus_metrics:
            self.prometheus_metrics['gemini_api_calls'].labels(status=status).inc()
        
        if not success:
            self.logger.warning(f"Gemini API call failed, response time: {response_time:.2f}s")
    
    def get_performance_summary(self, hours: int = 24) -> Dict[str, Any]:
        """Get performance summary for the last N hours"""
        if not self.redis_client:
            # Use in-memory buffer for summary
            return self._get_buffer_summary(hours)
        
        try:
            # Get metrics from Redis
            end_time = datetime.utcnow()
            start_time = end_time - timedelta(hours=hours)
            
            metrics = []
            for day_offset in range(hours // 24 + 1):
                date = (end_time - timedelta(days=day_offset)).strftime('%Y-%m-%d')
                key = f"metrics:{date}"
                raw_metrics = self.redis_client.lrange(key, 0, -1)
                
                for raw_metric in raw_metrics:
                    try:
                        metric_data = json.loads(raw_metric)
                        metric_time = datetime.fromisoformat(metric_data['timestamp'])
                        if start_time <= metric_time <= end_time:
                            metrics.append(metric_data)
                    except Exception:
                        continue
            
            return self._analyze_metrics(metrics)
            
        except Exception as e:
            self.logger.error(f"Failed to get performance summary from Redis: {e}")
            return self._get_buffer_summary(hours)
    
    def _get_buffer_summary(self, hours: int) -> Dict[str, Any]:
        """Get performance summary from in-memory buffer"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        recent_metrics = [
            m for m in self.metrics_buffer 
            if m.timestamp >= cutoff_time
        ]
        
        return self._analyze_metrics([m.to_dict() for m in recent_metrics])
    
    def _analyze_metrics(self, metrics: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze metrics and generate summary"""
        if not metrics:
            return {
                'total_requests': 0,
                'average_response_time': 0,
                'error_rate': 0,
                'slowest_endpoints': [],
                'most_active_users': []
            }
        
        total_requests = len(metrics)
        response_times = [m['duration'] for m in metrics]
        error_count = len([m for m in metrics if m['status_code'] >= 400])
        
        # Endpoint analysis
        endpoint_stats = defaultdict(list)
        for metric in metrics:
            endpoint_stats[metric['endpoint']].append(metric['duration'])
        
        slowest_endpoints = sorted(
            [(endpoint, sum(times)/len(times)) for endpoint, times in endpoint_stats.items()],
            key=lambda x: x[1], reverse=True
        )[:5]
        
        # User activity analysis
        user_activity = defaultdict(int)
        for metric in metrics:
            if metric['user_id']:
                user_activity[metric['user_id']] += 1
        
        most_active_users = sorted(
            user_activity.items(), key=lambda x: x[1], reverse=True
        )[:10]
        
        return {
            'total_requests': total_requests,
            'average_response_time': sum(response_times) / len(response_times),
            'error_rate': (error_count / total_requests) * 100,
            'slowest_endpoints': slowest_endpoints,
            'most_active_users': most_active_users,
            'p95_response_time': sorted(response_times)[int(len(response_times) * 0.95)] if response_times else 0,
            'p99_response_time': sorted(response_times)[int(len(response_times) * 0.99)] if response_times else 0
        }


class UserAnalytics:
    """User behavior analytics system"""
    
    def __init__(self):
        self.logger = logging.getLogger('taaxdog.analytics')
        self.redis_client = self._setup_redis()
        self.mixpanel = self._setup_mixpanel()
        self.analytics_buffer = deque(maxlen=500)
    
    def _setup_redis(self) -> Optional[redis.Redis]:
        """Setup Redis connection for analytics storage"""
        if not redis:
            return None
        
        try:
            redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
            client = redis.from_url(redis_url)
            client.ping()
            return client
        except Exception:
            return None
    
    def _setup_mixpanel(self):
        """Setup Mixpanel for external analytics"""
        if not Mixpanel:
            return None
        
        token = os.environ.get('MIXPANEL_TOKEN')
        if not token:
            return None
        
        return Mixpanel(token)
    
    def track_user_event(self, user_id: str, event_type: str, event_data: Dict[str, Any], session_id: Optional[str] = None):
        """Track user behavior event"""
        analytic = UserAnalytic(
            user_id=user_id,
            event_type=event_type,
            event_data=event_data,
            timestamp=datetime.utcnow(),
            session_id=session_id
        )
        
        # Store locally
        self._store_analytic(analytic)
        
        # Send to Mixpanel
        if self.mixpanel:
            try:
                self.mixpanel.track(user_id, event_type, {
                    **event_data,
                    'timestamp': analytic.timestamp.isoformat(),
                    'session_id': session_id
                })
            except Exception as e:
                self.logger.error(f"Failed to send event to Mixpanel: {e}")
        
        self.logger.info(f"User event tracked: {event_type} for user {user_id}")
    
    def _store_analytic(self, analytic: UserAnalytic):
        """Store analytic data"""
        if self.redis_client:
            try:
                key = f"analytics:{analytic.timestamp.strftime('%Y-%m-%d')}"
                self.redis_client.lpush(key, json.dumps(analytic.to_dict()))
                self.redis_client.expire(key, 86400 * 30)  # Keep for 30 days
            except Exception as e:
                self.logger.error(f"Failed to store analytic in Redis: {e}")
                self.analytics_buffer.append(analytic)
        else:
            self.analytics_buffer.append(analytic)
    
    def track_receipt_upload(self, user_id: str, success: bool, processing_time: float, categories_found: List[str]):
        """Track receipt upload and processing"""
        self.track_user_event(user_id, 'receipt_upload', {
            'success': success,
            'processing_time': processing_time,
            'categories_found': categories_found,
            'category_count': len(categories_found)
        })
    
    def track_feature_usage(self, user_id: str, feature: str, usage_data: Dict[str, Any]):
        """Track feature usage"""
        self.track_user_event(user_id, 'feature_usage', {
            'feature': feature,
            **usage_data
        })
    
    def track_tax_categorization(self, user_id: str, original_category: str, suggested_category: str, user_accepted: bool):
        """Track tax categorization accuracy"""
        self.track_user_event(user_id, 'tax_categorization', {
            'original_category': original_category,
            'suggested_category': suggested_category,
            'user_accepted': user_accepted,
            'accuracy': user_accepted
        })


# Global instances
performance_monitor = PerformanceMonitor()
user_analytics = UserAnalytics()


def monitor_performance(func):
    """Decorator to monitor function performance"""
    @wraps(func)
    def wrapper(*args, **kwargs):
        request_id = str(uuid.uuid4())
        start_time = time.time()
        
        try:
            result = func(*args, **kwargs)
            duration = time.time() - start_time
            
            # Log performance data
            logging.getLogger('taaxdog.performance').info(
                f"Function {func.__name__} executed in {duration:.3f}s"
            )
            
            return result
        except Exception as e:
            duration = time.time() - start_time
            logging.getLogger('taaxdog.performance').error(
                f"Function {func.__name__} failed after {duration:.3f}s: {e}"
            )
            raise
    
    return wrapper 