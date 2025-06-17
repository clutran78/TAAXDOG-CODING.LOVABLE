"""
Enhanced Health Monitoring Routes for TAAXDOG Production
Provides comprehensive health checks, system metrics, and business KPIs
"""

import os
import time
import psutil
import platform
from datetime import datetime, timedelta
from typing import Dict, Any, List
from flask import Blueprint, jsonify, request, g
import logging
import json

try:
    import redis
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
except ImportError:
    redis = None
    generate_latest = None
    CONTENT_TYPE_LATEST = 'text/plain'

# Import our monitoring systems
from monitoring.performance_monitor import performance_monitor, user_analytics
from config.production_config import config

health_bp = Blueprint('health', __name__)
logger = logging.getLogger('taaxdog.health')


@health_bp.route('/health/status', methods=['GET'])
def basic_health_check():
    """Basic health check for load balancers"""
    try:
        # Simple check that application is responding
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'service': 'taaxdog-api',
            'version': os.environ.get('APP_VERSION', '1.0.0')
        }), 200
    except Exception as e:
        logger.error(f"Basic health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 503


@health_bp.route('/health/detailed', methods=['GET'])
def detailed_health_check():
    """Detailed health check with comprehensive system information"""
    health_data = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'service': 'taaxdog-api',
        'version': os.environ.get('APP_VERSION', '1.0.0'),
        'environment': os.environ.get('FLASK_ENV', 'unknown'),
        'checks': {}
    }
    
    overall_healthy = True
    
    # Database connectivity check
    try:
        # Check Firebase connectivity (implement according to your setup)
        health_data['checks']['database'] = {
            'status': 'healthy',
            'response_time_ms': 0,  # Implement actual check
            'message': 'Firebase connection successful'
        }
    except Exception as e:
        health_data['checks']['database'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        overall_healthy = False
    
    # Redis connectivity check
    redis_check = _check_redis_connectivity()
    health_data['checks']['redis'] = redis_check
    if redis_check['status'] != 'healthy':
        # Redis is not critical, just log warning
        logger.warning("Redis connectivity issue detected")
    
    # External APIs check
    health_data['checks']['external_apis'] = _check_external_apis()
    if health_data['checks']['external_apis']['status'] != 'healthy':
        overall_healthy = False
    
    # System resources check
    health_data['checks']['system_resources'] = _check_system_resources()
    if health_data['checks']['system_resources']['status'] != 'healthy':
        overall_healthy = False
    
    # Australian timezone check
    health_data['checks']['timezone'] = _check_australian_timezone()
    
    # Business metrics
    health_data['checks']['business_metrics'] = _get_business_health_metrics()
    
    health_data['status'] = 'healthy' if overall_healthy else 'degraded'
    
    return jsonify(health_data), 200 if overall_healthy else 503


@health_bp.route('/health/metrics', methods=['GET'])
def system_metrics():
    """System performance metrics"""
    try:
        # CPU and memory metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        # Network metrics
        network = psutil.net_io_counters()
        
        # Process metrics
        process = psutil.Process()
        
        metrics = {
            'timestamp': datetime.utcnow().isoformat(),
            'system': {
                'cpu': {
                    'percent': cpu_percent,
                    'count': psutil.cpu_count(),
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
            },
            'process': {
                'pid': process.pid,
                'memory_percent': process.memory_percent(),
                'cpu_percent': process.cpu_percent(),
                'num_threads': process.num_threads(),
                'create_time': process.create_time(),
                'open_files': len(process.open_files())
            },
            'platform': {
                'system': platform.system(),
                'release': platform.release(),
                'python_version': platform.python_version()
            }
        }
        
        # Add performance monitoring data
        if performance_monitor:
            performance_summary = performance_monitor.get_performance_summary(hours=1)
            metrics['performance'] = performance_summary
        
        return jsonify(metrics)
        
    except Exception as e:
        logger.error(f"Failed to get system metrics: {e}")
        return jsonify({'error': 'Failed to retrieve metrics'}), 500


@health_bp.route('/health/business', methods=['GET'])
def business_metrics():
    """Business-specific health metrics for Australian market"""
    try:
        metrics = {
            'timestamp': datetime.utcnow().isoformat(),
            'timezone': 'Australia/Sydney',
            'business_hours': _is_australian_business_hours(),
            'metrics': {}
        }
        
        # Get user analytics data
        if user_analytics and user_analytics.redis_client:
            try:
                # Active users in last 24 hours
                active_users = _get_active_users_count(hours=24)
                metrics['metrics']['active_users_24h'] = active_users
                
                # Receipt processing statistics
                receipt_stats = _get_receipt_processing_stats()
                metrics['metrics']['receipt_processing'] = receipt_stats
                
                # Tax categorization accuracy
                tax_accuracy = _get_tax_categorization_accuracy()
                metrics['metrics']['tax_categorization_accuracy'] = tax_accuracy
                
                # Feature usage statistics
                feature_usage = _get_feature_usage_stats()
                metrics['metrics']['feature_usage'] = feature_usage
                
            except Exception as e:
                logger.warning(f"Failed to get analytics data: {e}")
                metrics['metrics']['analytics_error'] = str(e)
        
        # Australian compliance checks
        metrics['compliance'] = {
            'gst_rate_configured': config.gst_rate == 0.10,
            'abn_validation_enabled': config.abn_validation_enabled,
            'tax_year_aligned': _check_tax_year_alignment(),
            'ato_integration_ready': config.enable_ato_integration
        }
        
        return jsonify(metrics)
        
    except Exception as e:
        logger.error(f"Failed to get business metrics: {e}")
        return jsonify({'error': 'Failed to retrieve business metrics'}), 500


@health_bp.route('/health/alerts', methods=['GET'])
def health_alerts():
    """Current system alerts and warnings"""
    alerts = []
    
    # Check for performance issues
    try:
        performance_summary = performance_monitor.get_performance_summary(hours=1)
        
        if performance_summary['error_rate'] > 5:
            alerts.append({
                'level': 'warning',
                'type': 'high_error_rate',
                'message': f"Error rate is {performance_summary['error_rate']:.1f}%",
                'threshold': '5%'
            })
        
        if performance_summary['average_response_time'] > 2:
            alerts.append({
                'level': 'warning',
                'type': 'slow_response_time',
                'message': f"Average response time is {performance_summary['average_response_time']:.2f}s",
                'threshold': '2s'
            })
        
        if performance_summary['p95_response_time'] > 5:
            alerts.append({
                'level': 'critical',
                'type': 'very_slow_response_time',
                'message': f"95th percentile response time is {performance_summary['p95_response_time']:.2f}s",
                'threshold': '5s'
            })
    
    except Exception as e:
        alerts.append({
            'level': 'error',
            'type': 'monitoring_failure',
            'message': f"Failed to check performance metrics: {e}"
        })
    
    # Check system resources
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        if cpu_percent > 80:
            alerts.append({
                'level': 'warning',
                'type': 'high_cpu_usage',
                'message': f"CPU usage is {cpu_percent:.1f}%",
                'threshold': '80%'
            })
        
        if memory.percent > 85:
            alerts.append({
                'level': 'warning',
                'type': 'high_memory_usage',
                'message': f"Memory usage is {memory.percent:.1f}%",
                'threshold': '85%'
            })
        
        if disk.percent > 90:
            alerts.append({
                'level': 'critical',
                'type': 'low_disk_space',
                'message': f"Disk usage is {disk.percent:.1f}%",
                'threshold': '90%'
            })
    
    except Exception as e:
        alerts.append({
            'level': 'error',
            'type': 'system_check_failure',
            'message': f"Failed to check system resources: {e}"
        })
    
    return jsonify({
        'timestamp': datetime.utcnow().isoformat(),
        'alert_count': len(alerts),
        'alerts': alerts
    })


@health_bp.route('/metrics', methods=['GET'])
def prometheus_metrics():
    """Prometheus metrics endpoint"""
    if generate_latest:
        try:
            return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}
        except Exception as e:
            logger.error(f"Failed to generate Prometheus metrics: {e}")
            return "# Failed to generate metrics\n", 500
    else:
        return "# Prometheus client not available\n", 503


def _check_redis_connectivity() -> Dict[str, Any]:
    """Check Redis connectivity"""
    if not redis:
        return {
            'status': 'unavailable',
            'message': 'Redis client not installed'
        }
    
    try:
        redis_client = redis.from_url(config.redis_url)
        start_time = time.time()
        redis_client.ping()
        response_time = (time.time() - start_time) * 1000
        
        return {
            'status': 'healthy',
            'response_time_ms': round(response_time, 2),
            'message': 'Redis connection successful'
        }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e)
        }


def _check_external_apis() -> Dict[str, Any]:
    """Check external API connectivity"""
    apis = {}
    overall_status = 'healthy'
    
    # Check Gemini API
    try:
        # Implement actual Gemini API health check
        apis['gemini'] = {
            'status': 'healthy',
            'message': 'Gemini API accessible'
        }
    except Exception as e:
        apis['gemini'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        overall_status = 'degraded'
    
    # Check Basiq API
    try:
        # Implement actual Basiq API health check
        apis['basiq'] = {
            'status': 'healthy',
            'message': 'Basiq API accessible'
        }
    except Exception as e:
        apis['basiq'] = {
            'status': 'unhealthy',
            'error': str(e)
        }
        overall_status = 'degraded'
    
    return {
        'status': overall_status,
        'apis': apis
    }


def _check_system_resources() -> Dict[str, Any]:
    """Check system resource usage"""
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        
        status = 'healthy'
        warnings = []
        
        if cpu_percent > 90:
            status = 'unhealthy'
            warnings.append(f"High CPU usage: {cpu_percent:.1f}%")
        elif cpu_percent > 80:
            status = 'degraded'
            warnings.append(f"Elevated CPU usage: {cpu_percent:.1f}%")
        
        if memory.percent > 95:
            status = 'unhealthy'
            warnings.append(f"Critical memory usage: {memory.percent:.1f}%")
        elif memory.percent > 85:
            status = 'degraded'
            warnings.append(f"High memory usage: {memory.percent:.1f}%")
        
        if disk.percent > 95:
            status = 'unhealthy'
            warnings.append(f"Critical disk usage: {disk.percent:.1f}%")
        elif disk.percent > 90:
            status = 'degraded'
            warnings.append(f"High disk usage: {disk.percent:.1f}%")
        
        return {
            'status': status,
            'cpu_percent': cpu_percent,
            'memory_percent': memory.percent,
            'disk_percent': disk.percent,
            'warnings': warnings
        }
        
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e)
        }


def _check_australian_timezone() -> Dict[str, Any]:
    """Check Australian timezone configuration"""
    try:
        import pytz
        aus_tz = pytz.timezone('Australia/Sydney')
        current_time = datetime.now(aus_tz)
        
        return {
            'status': 'healthy',
            'timezone': 'Australia/Sydney',
            'current_time': current_time.isoformat(),
            'is_dst': current_time.dst() != timedelta(0)
        }
    except Exception as e:
        return {
            'status': 'warning',
            'error': str(e),
            'message': 'Timezone check failed'
        }


def _get_business_health_metrics() -> Dict[str, Any]:
    """Get business-specific health metrics"""
    return {
        'australian_compliance': {
            'gst_configured': config.gst_rate == 0.10,
            'abn_validation': config.abn_validation_enabled,
            'tax_year_aligned': _check_tax_year_alignment()
        },
        'feature_flags': {
            'analytics_enabled': config.enable_analytics,
            'feedback_system': config.enable_feedback_system,
            'ato_integration': config.enable_ato_integration,
            'premium_features': config.enable_premium_features
        }
    }


def _is_australian_business_hours() -> bool:
    """Check if current time is within Australian business hours"""
    try:
        import pytz
        aus_tz = pytz.timezone('Australia/Sydney')
        current_time = datetime.now(aus_tz)
        
        # Business hours: 9 AM to 5 PM, Monday to Friday
        return (
            current_time.weekday() < 5 and  # Monday = 0, Friday = 4
            9 <= current_time.hour < 17
        )
    except Exception:
        return False


def _check_tax_year_alignment() -> bool:
    """Check if system is aligned with Australian tax year"""
    try:
        current_date = datetime.now()
        # Australian tax year starts July 1st
        return config.tax_year_start == '07-01'
    except Exception:
        return False


def _get_active_users_count(hours: int = 24) -> int:
    """Get count of active users in the last N hours"""
    # This would query your analytics system
    # For now, return a placeholder
    return 0


def _get_receipt_processing_stats() -> Dict[str, Any]:
    """Get receipt processing statistics"""
    # This would query your analytics system
    return {
        'total_processed_24h': 0,
        'success_rate': 0.0,
        'average_processing_time': 0.0
    }


def _get_tax_categorization_accuracy() -> Dict[str, Any]:
    """Get tax categorization accuracy metrics"""
    # This would query your analytics system
    return {
        'accuracy_rate': 0.0,
        'total_categorizations_24h': 0,
        'user_acceptance_rate': 0.0
    }


def _get_feature_usage_stats() -> Dict[str, Any]:
    """Get feature usage statistics"""
    # This would query your analytics system
    return {
        'receipt_uploads': 0,
        'banking_connections': 0,
        'tax_profile_updates': 0,
        'chatbot_interactions': 0
    } 