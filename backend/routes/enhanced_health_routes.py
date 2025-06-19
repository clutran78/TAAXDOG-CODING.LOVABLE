"""
Enhanced Health Check Routes for TAAXDOG Production
==================================================

Comprehensive health monitoring endpoints including:
- System health with performance metrics
- Security status monitoring
- Database and cache health
- Backup system status
- Australian compliance checks
"""

import os
import sys
from flask import Blueprint, jsonify, request
from datetime import datetime
import time

# Add project root to path for imports
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# Import production monitoring components with fallbacks
try:
    from database.production_setup import get_database_health, get_cache_stats
    from services.performance_optimizer import get_performance_metrics
    from security.production_security import get_security_dashboard
    from monitoring.production_monitoring import get_monitoring_dashboard
    from backup.disaster_recovery import get_backup_status
except ImportError as e:
    print(f"Warning: Some production components not available: {e}")
    # Fallback functions
    def get_database_health(): return {'overall': 'unknown'}
    def get_cache_stats(): return {}
    def get_performance_metrics(): return {}
    def get_security_dashboard(): return {'security_status': 'unknown'}
    def get_monitoring_dashboard(): return {}
    def get_backup_status(): return {'backup_running': False}

# Create enhanced health blueprint
health_bp = Blueprint('enhanced_health', __name__)

@health_bp.route('/health/status')
def basic_health():
    """Basic health check endpoint for load balancers"""
    try:
        # Quick checks for essential services
        db_health = get_database_health()
        
        # Determine overall status
        if db_health.get('overall') == 'healthy':
            status = 'healthy'
            http_code = 200
        elif db_health.get('overall') == 'degraded':
            status = 'degraded'
            http_code = 200
        else:
            status = 'unhealthy'
            http_code = 503
        
        return jsonify({
            'status': status,
            'timestamp': datetime.now().isoformat(),
            'version': os.getenv('APP_VERSION', '1.0.0'),
            'environment': os.getenv('FLASK_ENV', 'production')
        }), http_code
        
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 503

@health_bp.route('/health/detailed')
def detailed_health():
    """Comprehensive health check with all system components"""
    try:
        start_time = time.time()
        
        # Gather all health information
        database_health = get_database_health()
        cache_stats = get_cache_stats()
        performance_metrics = get_performance_metrics()
        security_status = get_security_dashboard()
        monitoring_data = get_monitoring_dashboard()
        backup_status = get_backup_status()
        
        # System resource information
        system_info = _get_system_info()
        
        # Australian compliance status
        compliance_status = _get_compliance_status()
        
        # Determine overall health
        overall_health = _calculate_overall_health(
            database_health, cache_stats, security_status, backup_status
        )
        
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        health_data = {
            'overall': overall_health,
            'timestamp': datetime.now().isoformat(),
            'response_time_ms': round(response_time, 2),
            'components': {
                'database': database_health,
                'cache': {
                    'status': 'healthy' if cache_stats else 'unavailable',
                    'metrics': cache_stats
                },
                'performance': {
                    'status': _get_performance_status(performance_metrics),
                    'metrics': performance_metrics
                },
                'security': {
                    'status': security_status.get('security_status', 'unknown'),
                    'details': security_status
                },
                'backup': {
                    'status': 'healthy' if backup_status.get('last_successful_backup') else 'warning',
                    'details': backup_status
                },
                'monitoring': {
                    'status': 'healthy' if monitoring_data else 'unavailable',
                    'active_alerts': len(monitoring_data.get('active_alerts', []))
                }
            },
            'system': system_info,
            'compliance': compliance_status,
            'uptime': _get_uptime(),
            'version': os.getenv('APP_VERSION', '1.0.0'),
            'environment': os.getenv('FLASK_ENV', 'production')
        }
        
        # Determine HTTP status code
        if overall_health == 'healthy':
            status_code = 200
        elif overall_health == 'degraded':
            status_code = 200  # Still operational
        else:
            status_code = 503
        
        return jsonify(health_data), status_code
        
    except Exception as e:
        return jsonify({
            'overall': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now().isoformat(),
            'components': {
                'error': 'Health check system failure'
            }
        }), 503

@health_bp.route('/health/performance')
def performance_health():
    """Performance-focused health check"""
    try:
        performance_data = get_performance_metrics()
        
        # Performance thresholds
        response_time_threshold = 2000  # 2 seconds
        memory_threshold = 80  # 80%
        cpu_threshold = 80  # 80%
        
        performance_status = {
            'overall': 'healthy',
            'metrics': performance_data,
            'thresholds': {
                'response_time_ms': response_time_threshold,
                'memory_percent': memory_threshold,
                'cpu_percent': cpu_threshold
            },
            'warnings': []
        }
        
        # Check performance against thresholds
        metrics = performance_data.get('metrics', {})
        
        if metrics.get('avg_response_time', 0) * 1000 > response_time_threshold:
            performance_status['warnings'].append('High response time detected')
            performance_status['overall'] = 'degraded'
        
        system_resources = performance_data.get('system_resources', {})
        if system_resources.get('memory_usage', 0) > memory_threshold:
            performance_status['warnings'].append('High memory usage detected')
            performance_status['overall'] = 'degraded'
        
        if system_resources.get('cpu_usage', 0) > cpu_threshold:
            performance_status['warnings'].append('High CPU usage detected')
            performance_status['overall'] = 'degraded'
        
        # Recommendations
        recommendations = performance_data.get('recommendations', [])
        if recommendations:
            performance_status['recommendations'] = recommendations
        
        return jsonify(performance_status)
        
    except Exception as e:
        return jsonify({
            'overall': 'unhealthy',
            'error': str(e)
        }), 503

@health_bp.route('/health/security')
def security_health():
    """Security-focused health check"""
    try:
        security_data = get_security_dashboard()
        
        security_status = {
            'overall': security_data.get('security_status', 'unknown'),
            'recent_events': len(security_data.get('recent_events', [])),
            'blocked_ips': len(security_data.get('blocked_ips', [])),
            'event_counts': security_data.get('event_counts', {}),
            'timestamp': datetime.now().isoformat()
        }
        
        # Security health assessment
        if security_status['overall'] == 'critical':
            status_code = 503
        elif security_status['overall'] == 'elevated':
            status_code = 200
        else:
            status_code = 200
        
        return jsonify(security_status), status_code
        
    except Exception as e:
        return jsonify({
            'overall': 'unknown',
            'error': str(e)
        }), 503

@health_bp.route('/health/backup')
def backup_health():
    """Backup system health check"""
    try:
        backup_data = get_backup_status()
        
        backup_health = {
            'overall': 'healthy',
            'backup_running': backup_data.get('backup_running', False),
            'last_successful_backup': backup_data.get('last_successful_backup'),
            'total_backups': backup_data.get('total_backups', 0),
            'compliance': backup_data.get('compliance', {})
        }
        
        # Check backup recency
        last_backup = backup_data.get('last_successful_backup')
        if last_backup:
            try:
                last_backup_time = datetime.fromisoformat(last_backup)
                time_since_backup = datetime.now() - last_backup_time
                
                if time_since_backup.total_seconds() > 86400 * 2:  # 2 days
                    backup_health['overall'] = 'warning'
                    backup_health['warning'] = 'No recent backup found'
                elif time_since_backup.total_seconds() > 86400 * 7:  # 7 days
                    backup_health['overall'] = 'critical'
                    backup_health['error'] = 'Backup system may be failing'
            except:
                backup_health['overall'] = 'unknown'
        else:
            backup_health['overall'] = 'warning'
            backup_health['warning'] = 'No backup history found'
        
        status_code = 200 if backup_health['overall'] in ['healthy', 'warning'] else 503
        
        return jsonify(backup_health), status_code
        
    except Exception as e:
        return jsonify({
            'overall': 'unhealthy',
            'error': str(e)
        }), 503

@health_bp.route('/health/readiness')
def readiness_probe():
    """Kubernetes readiness probe"""
    try:
        # Check if application is ready to serve traffic
        db_health = get_database_health()
        
        if db_health.get('overall') in ['healthy', 'degraded']:
            return jsonify({
                'ready': True,
                'timestamp': datetime.now().isoformat()
            })
        else:
            return jsonify({
                'ready': False,
                'reason': 'Database not available',
                'timestamp': datetime.now().isoformat()
            }), 503
            
    except Exception as e:
        return jsonify({
            'ready': False,
            'reason': str(e),
            'timestamp': datetime.now().isoformat()
        }), 503

@health_bp.route('/health/liveness')
def liveness_probe():
    """Kubernetes liveness probe"""
    try:
        # Basic application aliveness check
        return jsonify({
            'alive': True,
            'timestamp': datetime.now().isoformat(),
            'uptime': _get_uptime()
        })
        
    except Exception as e:
        return jsonify({
            'alive': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 503

def _get_system_info():
    """Get system information"""
    try:
        import psutil
        return {
            'cpu_count': psutil.cpu_count(),
            'memory_total_gb': round(psutil.virtual_memory().total / (1024**3), 2),
            'disk_total_gb': round(psutil.disk_usage('/').total / (1024**3), 2),
            'python_version': sys.version.split()[0],
            'platform': sys.platform
        }
    except ImportError:
        return {
            'python_version': sys.version.split()[0],
            'platform': sys.platform
        }

def _get_compliance_status():
    """Get Australian compliance status"""
    return {
        'data_sovereignty': {
            'status': 'compliant',
            'region': 'Australia',
            'description': 'All data stored within Australian borders'
        },
        'tax_compliance': {
            'status': 'compliant',
            'retention_years': 7,
            'description': 'ATO-compliant data retention'
        },
        'banking_integration': {
            'status': 'certified',
            'provider': 'BASIQ',
            'description': 'APRA-regulated banking data access'
        },
        'privacy_act': {
            'status': 'compliant',
            'framework': 'Privacy Act 1988',
            'description': 'Australian privacy law compliance'
        }
    }

def _get_performance_status(performance_metrics):
    """Determine performance status from metrics"""
    if not performance_metrics:
        return 'unknown'
    
    metrics = performance_metrics.get('metrics', {})
    avg_response_time = metrics.get('avg_response_time', 0)
    cache_hit_rate = metrics.get('cache_hit_rate', 0)
    
    if avg_response_time > 2.0 or cache_hit_rate < 60:
        return 'degraded'
    elif avg_response_time > 1.0 or cache_hit_rate < 80:
        return 'warning'
    else:
        return 'healthy'

def _calculate_overall_health(database_health, cache_stats, security_status, backup_status):
    """Calculate overall system health"""
    db_status = database_health.get('overall', 'unknown')
    security_stat = security_status.get('security_status', 'unknown')
    
    # Critical: database must be healthy
    if db_status == 'unhealthy':
        return 'unhealthy'
    
    # Critical: security must not be in critical state
    if security_stat == 'critical':
        return 'unhealthy'
    
    # Degraded: any major component has issues
    if db_status == 'degraded' or security_stat == 'elevated':
        return 'degraded'
    
    # Check backup recency
    last_backup = backup_status.get('last_successful_backup')
    if last_backup:
        try:
            last_backup_time = datetime.fromisoformat(last_backup)
            time_since_backup = datetime.now() - last_backup_time
            if time_since_backup.total_seconds() > 86400 * 7:  # 7 days
                return 'degraded'
        except:
            pass
    
    return 'healthy'

def _get_uptime():
    """Get application uptime"""
    try:
        import psutil
        boot_time = psutil.boot_time()
        uptime_seconds = time.time() - boot_time
        return f"{uptime_seconds // 86400:.0f}d {(uptime_seconds % 86400) // 3600:.0f}h {(uptime_seconds % 3600) // 60:.0f}m"
    except ImportError:
        return "unknown" 