"""
Health Monitoring Routes for TAAXDOG
===================================

Production health monitoring endpoints including:
- Service health checks for external APIs
- Overall system status monitoring
- Performance metrics tracking
- Database connectivity checks
- Error rate monitoring
"""

from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
import time
import os
from typing import Dict, Any

import sys
import os

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

# Import production utilities with fallback
try:
    from utils.production_utils import (
        health_monitor, 
        logger, 
        measure_performance, 
        set_request_context,
        ServiceStatus
    )
except ImportError:
    # Fallback for development mode
    class ServiceStatus:
        HEALTHY = "healthy"
        DEGRADED = "degraded"
        UNHEALTHY = "unhealthy"
    logger = None
    health_monitor = None
    def measure_performance(func): return func
    def set_request_context(**kwargs): pass

try:
    from firebase_config import db
except ImportError:
    db = None

# Create blueprint for health monitoring
health_bp = Blueprint('health', __name__)

@health_bp.before_request
def before_request():
    """Set request context for logging"""
    set_request_context(
        user_id=request.headers.get('X-User-ID'),
        request_id=request.headers.get('X-Request-ID')
    )

@health_bp.route('/health', methods=['GET'])
@measure_performance
def basic_health_check():
    """
    Basic health check endpoint
    Returns simple OK status for load balancers
    """
    try:
        return jsonify({
            'status': 'OK',
            'timestamp': datetime.now().isoformat(),
            'service': 'TAAXDOG',
            'version': '1.0.0'
        }), 200
    except Exception as e:
        logger.error("Basic health check failed", error=str(e))
        return jsonify({
            'status': 'ERROR',
            'error': 'Health check failed'
        }), 500

@health_bp.route('/health/detailed', methods=['GET'])
@measure_performance
def detailed_health_check():
    """
    Detailed health check with all service statuses
    Includes response times and error messages
    """
    try:
        health_data = health_monitor.get_overall_health()
        
        # Determine HTTP status code based on overall health
        if health_data['overall_status'] == ServiceStatus.HEALTHY.value:
            status_code = 200
        elif health_data['overall_status'] == ServiceStatus.DEGRADED.value:
            status_code = 206  # Partial Content
        else:
            status_code = 503  # Service Unavailable
        
        logger.info(
            "Detailed health check completed",
            overall_status=health_data['overall_status'],
            healthy_services=health_data['summary']['healthy'],
            total_services=health_data['summary']['total_services']
        )
        
        return jsonify(health_data), status_code
        
    except Exception as e:
        logger.error("Detailed health check failed", error=str(e))
        return jsonify({
            'status': 'ERROR',
            'error': 'Health check failed',
            'timestamp': datetime.now().isoformat()
        }), 500

@health_bp.route('/health/services/<service_name>', methods=['GET'])
@measure_performance
def individual_service_health(service_name: str):
    """
    Check health of individual service
    
    Args:
        service_name: Name of service to check (gemini_api, firebase, basiq_api, abr_api)
    """
    try:
        # Map service names to health check methods
        service_checks = {
            'gemini_api': health_monitor.check_gemini_health,
            'firebase': health_monitor.check_firebase_health,
            'basiq_api': health_monitor.check_basiq_health,
            'abr_api': health_monitor.check_abr_health
        }
        
        if service_name not in service_checks:
            return jsonify({
                'error': 'Service not found',
                'available_services': list(service_checks.keys())
            }), 404
        
        # Run health check for specific service
        health = service_checks[service_name]()
        health_data = {
            'service_name': health.service_name,
            'status': health.status.value,
            'response_time_ms': health.response_time_ms,
            'last_check': health.last_check.isoformat(),
            'error_message': health.error_message
        }
        
        # Determine status code
        if health.status == ServiceStatus.HEALTHY:
            status_code = 200
        elif health.status == ServiceStatus.DEGRADED:
            status_code = 206
        else:
            status_code = 503
        
        logger.info(
            f"Health check for {service_name} completed",
            service=service_name,
            status=health.status.value,
            response_time_ms=health.response_time_ms
        )
        
        return jsonify(health_data), status_code
        
    except Exception as e:
        logger.error(f"Health check for {service_name} failed", error=str(e))
        return jsonify({
            'error': 'Health check failed',
            'service': service_name
        }), 500

@health_bp.route('/health/database', methods=['GET'])
@measure_performance
def database_health_check():
    """
    Check database connectivity and performance
    Tests Firebase Firestore connection
    """
    try:
        start_time = time.time()
        
        # Test database connection
        if db:
            # Simple read operation to test connectivity
            test_collection = db.collection('health_check')
            
            # Try to read a document (or get empty result)
            docs = test_collection.limit(1).get()
            
            # Calculate response time
            response_time = (time.time() - start_time) * 1000
            
            # Determine status based on response time
            if response_time < 1000:  # 1 second
                status = 'healthy'
                status_code = 200
            elif response_time < 3000:  # 3 seconds
                status = 'degraded'
                status_code = 206
            else:
                status = 'slow'
                status_code = 503
            
            result = {
                'status': status,
                'response_time_ms': response_time,
                'timestamp': datetime.now().isoformat(),
                'database': 'Firebase Firestore',
                'connected': True
            }
            
            logger.info(
                "Database health check completed",
                status=status,
                response_time_ms=response_time
            )
            
            return jsonify(result), status_code
        else:
            logger.error("Database connection not available")
            return jsonify({
                'status': 'unhealthy',
                'connected': False,
                'error': 'Database connection not initialized'
            }), 503
            
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return jsonify({
            'status': 'unhealthy',
            'connected': False,
            'error': str(e),
            'timestamp': datetime.now().isoformat()
        }), 503

@health_bp.route('/health/metrics', methods=['GET'])
@measure_performance
def health_metrics():
    """
    Get system performance metrics
    Includes response times, error rates, and service availability
    """
    try:
        # Get recent health checks
        services_data = health_monitor.last_checks
        
        # Calculate metrics
        metrics = {
            'timestamp': datetime.now().isoformat(),
            'uptime_checks': {},
            'average_response_times': {},
            'service_availability': {},
            'system_info': {
                'python_version': os.environ.get('PYTHON_VERSION', 'unknown'),
                'environment': os.environ.get('FLASK_ENV', 'production'),
                'server_time': datetime.now().isoformat()
            }
        }
        
        # Process each service's metrics
        for service_name, health in services_data.items():
            metrics['uptime_checks'][service_name] = {
                'status': health.status.value,
                'last_check': health.last_check.isoformat(),
                'response_time_ms': health.response_time_ms
            }
            
            metrics['average_response_times'][service_name] = health.response_time_ms
            
            metrics['service_availability'][service_name] = {
                'available': health.status in [ServiceStatus.HEALTHY, ServiceStatus.DEGRADED],
                'degraded': health.status == ServiceStatus.DEGRADED,
                'error_message': health.error_message
            }
        
        logger.info("Health metrics retrieved", service_count=len(services_data))
        
        return jsonify(metrics), 200
        
    except Exception as e:
        logger.error("Failed to retrieve health metrics", error=str(e))
        return jsonify({
            'error': 'Failed to retrieve metrics',
            'timestamp': datetime.now().isoformat()
        }), 500

@health_bp.route('/health/readiness', methods=['GET'])
@measure_performance
def readiness_check():
    """
    Kubernetes-style readiness check
    Returns OK only if all critical services are available
    """
    try:
        health_data = health_monitor.get_overall_health()
        
        # Critical services that must be healthy for readiness
        critical_services = ['firebase']
        
        # Check if all critical services are at least degraded (not unhealthy)
        ready = True
        for service_name, health in health_data['services'].items():
            if service_name in critical_services:
                if health['status'] == ServiceStatus.UNHEALTHY.value:
                    ready = False
                    break
        
        if ready:
            logger.info("Readiness check passed")
            return jsonify({
                'status': 'ready',
                'timestamp': datetime.now().isoformat()
            }), 200
        else:
            logger.warning("Readiness check failed - critical services unhealthy")
            return jsonify({
                'status': 'not_ready',
                'reason': 'Critical services unavailable',
                'timestamp': datetime.now().isoformat()
            }), 503
            
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        return jsonify({
            'status': 'not_ready',
            'error': str(e)
        }), 503

@health_bp.route('/health/liveness', methods=['GET'])
@measure_performance
def liveness_check():
    """
    Kubernetes-style liveness check
    Returns OK if the application is running and can handle requests
    """
    try:
        # Simple check that the application is responsive
        start_time = time.time()
        
        # Basic application functionality test
        test_result = True  # Could add more complex checks here
        
        response_time = (time.time() - start_time) * 1000
        
        if test_result and response_time < 5000:  # 5 second timeout
            logger.debug("Liveness check passed")
            return jsonify({
                'status': 'alive',
                'response_time_ms': response_time,
                'timestamp': datetime.now().isoformat()
            }), 200
        else:
            logger.warning("Liveness check failed - slow response")
            return jsonify({
                'status': 'slow',
                'response_time_ms': response_time
            }), 503
            
    except Exception as e:
        logger.error("Liveness check failed", error=str(e))
        return jsonify({
            'status': 'dead',
            'error': str(e)
        }), 503

# Error handlers for health routes
@health_bp.errorhandler(404)
def health_not_found(error):
    """Handle 404 errors in health routes"""
    return jsonify({
        'error': 'Health endpoint not found',
        'available_endpoints': [
            '/health',
            '/health/detailed', 
            '/health/database',
            '/health/metrics',
            '/health/readiness',
            '/health/liveness',
            '/health/services/<service_name>'
        ]
    }), 404

@health_bp.errorhandler(500)
def health_server_error(error):
    """Handle 500 errors in health routes"""
    logger.error("Internal server error in health endpoint", error=str(error))
    return jsonify({
        'error': 'Internal server error',
        'timestamp': datetime.now().isoformat()
    }), 500 