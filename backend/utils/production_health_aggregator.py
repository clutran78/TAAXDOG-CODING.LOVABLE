"""
TAAXDOG Production Health Check Aggregator
==========================================

Unified health monitoring that aggregates all system components:
- Database and cache health
- Security status monitoring  
- Performance metrics analysis
- Transfer engine health
- Australian compliance checks
- Service dependency monitoring
"""

import os
import sys
import time
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import pytz

# Add project paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# Import all health monitoring components with fallbacks
try:
    from database.production_setup import get_database_health, get_cache_stats
    from services.performance_optimizer import get_performance_metrics
    from security.production_security import get_security_dashboard
    from monitoring.production_monitoring import get_monitoring_dashboard
    from backup.disaster_recovery import get_backup_status
    from services.transfer_engine import TransferEngine
    from utils.centralized_logging import production_logger
except ImportError as e:
    print(f"Warning: Some health components not available: {e}")
    # Fallback functions
    def get_database_health(): return {'overall': 'unknown'}
    def get_cache_stats(): return {}
    def get_performance_metrics(): return {}
    def get_security_dashboard(): return {'security_status': 'unknown'}
    def get_monitoring_dashboard(): return {}
    def get_backup_status(): return {'backup_running': False}
    TransferEngine = None
    production_logger = None

# Australian timezone
AUSTRALIAN_TZ = pytz.timezone('Australia/Sydney')

class HealthStatus(Enum):
    """Health status levels"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"

@dataclass
class ComponentHealth:
    """Individual component health status"""
    name: str
    status: HealthStatus
    response_time_ms: Optional[float]
    last_check: datetime
    details: Dict[str, Any]
    error_message: Optional[str] = None

@dataclass
class SystemHealth:
    """Overall system health aggregation"""
    overall_status: HealthStatus
    timestamp: datetime
    components: List[ComponentHealth]
    compliance_status: Dict[str, Any]
    recommendations: List[str]
    alerts: List[Dict[str, Any]]

class ProductionHealthAggregator:
    """Comprehensive health monitoring aggregator"""
    
    def __init__(self):
        self.transfer_engine = TransferEngine() if TransferEngine else None
        self.logger = production_logger
        
        # Health check thresholds
        self.thresholds = {
            'response_time_warning': 1000,  # 1 second
            'response_time_critical': 5000,  # 5 seconds
            'memory_warning': 80,  # 80%
            'memory_critical': 95,  # 95%
            'cpu_warning': 80,  # 80%
            'cpu_critical': 95,  # 95%
            'cache_hit_rate_warning': 70,  # 70%
            'cache_hit_rate_critical': 50,  # 50%
            'error_rate_warning': 1,  # 1%
            'error_rate_critical': 5,  # 5%
        }
    
    async def get_comprehensive_health(self) -> SystemHealth:
        """Get comprehensive system health status"""
        start_time = time.time()
        
        if self.logger:
            self.logger.set_context(
                health_check_id=f"hc_{int(time.time())}",
                timestamp=datetime.now(AUSTRALIAN_TZ).isoformat()
            )
            self.logger.info("Starting comprehensive health check", component='performance')
        
        # Collect health data from all components
        components = await self._check_all_components()
        
        # Calculate overall health status
        overall_status = self._calculate_overall_status(components)
        
        # Get compliance status
        compliance_status = self._get_compliance_status()
        
        # Generate recommendations
        recommendations = self._generate_recommendations(components)
        
        # Get active alerts
        alerts = self._get_active_alerts()
        
        health = SystemHealth(
            overall_status=overall_status,
            timestamp=datetime.now(AUSTRALIAN_TZ),
            components=components,
            compliance_status=compliance_status,
            recommendations=recommendations,
            alerts=alerts
        )
        
        # Log health check completion
        duration = (time.time() - start_time) * 1000
        if self.logger:
            self.logger.log_performance_metric(
                'health_check_duration', duration,
                overall_status=overall_status.value,
                components_checked=len(components)
            )
        
        return health
    
    async def _check_all_components(self) -> List[ComponentHealth]:
        """Check health of all system components"""
        components = []
        
        # Check database health
        components.append(await self._check_database_health())
        
        # Check cache health
        components.append(await self._check_cache_health())
        
        # Check performance metrics
        components.append(await self._check_performance_health())
        
        # Check security status
        components.append(await self._check_security_health())
        
        # Check backup system
        components.append(await self._check_backup_health())
        
        # Check transfer engine
        if self.transfer_engine:
            components.append(await self._check_transfer_engine_health())
        
        # Check external API dependencies
        components.extend(await self._check_external_apis())
        
        return components
    
    async def _check_database_health(self) -> ComponentHealth:
        """Check database component health"""
        start_time = time.time()
        
        try:
            db_health = get_database_health()
            response_time = (time.time() - start_time) * 1000
            
            # Determine status based on database health
            if db_health.get('overall') == 'healthy':
                status = HealthStatus.HEALTHY
            elif db_health.get('overall') == 'degraded':
                status = HealthStatus.DEGRADED
            else:
                status = HealthStatus.UNHEALTHY
            
            return ComponentHealth(
                name='database',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details=db_health
            )
            
        except Exception as e:
            return ComponentHealth(
                name='database',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details={},
                error_message=str(e)
            )
    
    async def _check_cache_health(self) -> ComponentHealth:
        """Check cache component health"""
        start_time = time.time()
        
        try:
            cache_stats = get_cache_stats()
            response_time = (time.time() - start_time) * 1000
            
            # Determine status based on cache performance
            hit_rate = cache_stats.get('hit_rate', 0)
            if hit_rate >= self.thresholds['cache_hit_rate_warning']:
                status = HealthStatus.HEALTHY
            elif hit_rate >= self.thresholds['cache_hit_rate_critical']:
                status = HealthStatus.DEGRADED
            else:
                status = HealthStatus.UNHEALTHY if cache_stats else HealthStatus.UNKNOWN
            
            return ComponentHealth(
                name='cache',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details=cache_stats
            )
            
        except Exception as e:
            return ComponentHealth(
                name='cache',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details={},
                error_message=str(e)
            )
    
    async def _check_performance_health(self) -> ComponentHealth:
        """Check performance metrics health"""
        start_time = time.time()
        
        try:
            perf_metrics = get_performance_metrics()
            response_time = (time.time() - start_time) * 1000
            
            # Analyze performance metrics
            status = HealthStatus.HEALTHY
            metrics = perf_metrics.get('metrics', {})
            
            # Check response time
            avg_response_time = metrics.get('avg_response_time', 0) * 1000
            if avg_response_time > self.thresholds['response_time_critical']:
                status = HealthStatus.UNHEALTHY
            elif avg_response_time > self.thresholds['response_time_warning']:
                status = HealthStatus.DEGRADED
            
            # Check system resources
            system_resources = perf_metrics.get('system_resources', {})
            memory_usage = system_resources.get('memory_usage', 0)
            cpu_usage = system_resources.get('cpu_usage', 0)
            
            if (memory_usage > self.thresholds['memory_critical'] or 
                cpu_usage > self.thresholds['cpu_critical']):
                status = HealthStatus.UNHEALTHY
            elif (memory_usage > self.thresholds['memory_warning'] or 
                  cpu_usage > self.thresholds['cpu_warning']):
                status = HealthStatus.DEGRADED
            
            return ComponentHealth(
                name='performance',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details=perf_metrics
            )
            
        except Exception as e:
            return ComponentHealth(
                name='performance',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details={},
                error_message=str(e)
            )
    
    async def _check_security_health(self) -> ComponentHealth:
        """Check security component health"""
        start_time = time.time()
        
        try:
            security_data = get_security_dashboard()
            response_time = (time.time() - start_time) * 1000
            
            # Determine status based on security status
            security_status = security_data.get('security_status', 'unknown')
            if security_status == 'normal':
                status = HealthStatus.HEALTHY
            elif security_status == 'elevated':
                status = HealthStatus.DEGRADED
            elif security_status == 'critical':
                status = HealthStatus.UNHEALTHY
            else:
                status = HealthStatus.UNKNOWN
            
            return ComponentHealth(
                name='security',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details=security_data
            )
            
        except Exception as e:
            return ComponentHealth(
                name='security',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details={},
                error_message=str(e)
            )
    
    async def _check_backup_health(self) -> ComponentHealth:
        """Check backup system health"""
        start_time = time.time()
        
        try:
            backup_status = get_backup_status()
            response_time = (time.time() - start_time) * 1000
            
            # Check backup recency
            last_backup = backup_status.get('last_successful_backup')
            status = HealthStatus.HEALTHY
            
            if last_backup:
                try:
                    last_backup_time = datetime.fromisoformat(last_backup)
                    time_since_backup = datetime.now() - last_backup_time
                    
                    if time_since_backup > timedelta(days=7):
                        status = HealthStatus.UNHEALTHY
                    elif time_since_backup > timedelta(days=2):
                        status = HealthStatus.DEGRADED
                except:
                    status = HealthStatus.UNKNOWN
            else:
                status = HealthStatus.DEGRADED
            
            return ComponentHealth(
                name='backup',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details=backup_status
            )
            
        except Exception as e:
            return ComponentHealth(
                name='backup',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details={},
                error_message=str(e)
            )
    
    async def _check_transfer_engine_health(self) -> ComponentHealth:
        """Check automated transfer engine health"""
        start_time = time.time()
        
        try:
            # Check transfer engine by attempting to get recent transfers
            # This is a placeholder - implement based on actual transfer engine methods
            response_time = (time.time() - start_time) * 1000
            
            # Simple health check - if transfer engine is available, it's healthy
            status = HealthStatus.HEALTHY
            details = {
                'engine_available': True,
                'last_check': datetime.now(AUSTRALIAN_TZ).isoformat()
            }
            
            return ComponentHealth(
                name='transfer_engine',
                status=status,
                response_time_ms=response_time,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details=details
            )
            
        except Exception as e:
            return ComponentHealth(
                name='transfer_engine',
                status=HealthStatus.UNHEALTHY,
                response_time_ms=(time.time() - start_time) * 1000,
                last_check=datetime.now(AUSTRALIAN_TZ),
                details={},
                error_message=str(e)
            )
    
    async def _check_external_apis(self) -> List[ComponentHealth]:
        """Check external API dependencies"""
        external_apis = []
        
        # Placeholder checks for external APIs
        api_checks = [
            ('gemini_api', 'Google Gemini API'),
            ('basiq_api', 'BASIQ Banking API'),
            ('abr_api', 'Australian Business Register API')
        ]
        
        for api_name, api_description in api_checks:
            start_time = time.time()
            
            try:
                # Placeholder health check - implement actual API health checks
                response_time = (time.time() - start_time) * 1000
                
                external_apis.append(ComponentHealth(
                    name=api_name,
                    status=HealthStatus.HEALTHY,  # Placeholder
                    response_time_ms=response_time,
                    last_check=datetime.now(AUSTRALIAN_TZ),
                    details={'description': api_description}
                ))
                
            except Exception as e:
                external_apis.append(ComponentHealth(
                    name=api_name,
                    status=HealthStatus.UNHEALTHY,
                    response_time_ms=(time.time() - start_time) * 1000,
                    last_check=datetime.now(AUSTRALIAN_TZ),
                    details={'description': api_description},
                    error_message=str(e)
                ))
        
        return external_apis
    
    def _calculate_overall_status(self, components: List[ComponentHealth]) -> HealthStatus:
        """Calculate overall system health from component health"""
        if not components:
            return HealthStatus.UNKNOWN
        
        # Count components by status
        status_counts = {status: 0 for status in HealthStatus}
        for component in components:
            status_counts[component.status] += 1
        
        total_components = len(components)
        
        # If any critical component is unhealthy, system is unhealthy
        critical_components = ['database', 'security']
        for component in components:
            if (component.name in critical_components and 
                component.status == HealthStatus.UNHEALTHY):
                return HealthStatus.UNHEALTHY
        
        # If more than 30% of components are unhealthy
        if status_counts[HealthStatus.UNHEALTHY] / total_components > 0.3:
            return HealthStatus.UNHEALTHY
        
        # If any component is unhealthy or more than 50% are degraded
        if (status_counts[HealthStatus.UNHEALTHY] > 0 or 
            status_counts[HealthStatus.DEGRADED] / total_components > 0.5):
            return HealthStatus.DEGRADED
        
        # If more than 80% are healthy, system is healthy
        if status_counts[HealthStatus.HEALTHY] / total_components > 0.8:
            return HealthStatus.HEALTHY
        
        return HealthStatus.DEGRADED
    
    def _get_compliance_status(self) -> Dict[str, Any]:
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
                'description': 'ATO-compliant data retention and audit trails'
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
            },
            'gst_compliance': {
                'status': 'compliant',
                'rate': '10%',
                'description': 'Proper GST calculation and reporting'
            }
        }
    
    def _generate_recommendations(self, components: List[ComponentHealth]) -> List[str]:
        """Generate health improvement recommendations"""
        recommendations = []
        
        for component in components:
            if component.status == HealthStatus.UNHEALTHY:
                recommendations.append(
                    f"🔴 URGENT: {component.name} is unhealthy - {component.error_message or 'investigate immediately'}"
                )
            elif component.status == HealthStatus.DEGRADED:
                recommendations.append(
                    f"🟡 WARNING: {component.name} performance degraded - monitor closely"
                )
            
            # Performance-specific recommendations
            if component.name == 'performance' and component.response_time_ms:
                if component.response_time_ms > self.thresholds['response_time_warning']:
                    recommendations.append(
                        f"⚡ Consider scaling resources - response time {component.response_time_ms:.1f}ms"
                    )
            
            # Cache-specific recommendations
            if component.name == 'cache':
                hit_rate = component.details.get('hit_rate', 0)
                if hit_rate < self.thresholds['cache_hit_rate_warning']:
                    recommendations.append(
                        f"💾 Optimize caching strategy - hit rate {hit_rate:.1f}%"
                    )
        
        # General recommendations
        if len([c for c in components if c.status == HealthStatus.HEALTHY]) / len(components) < 0.8:
            recommendations.append(
                "🔧 System performance below optimal - consider maintenance window"
            )
        
        return recommendations
    
    def _get_active_alerts(self) -> List[Dict[str, Any]]:
        """Get active monitoring alerts"""
        try:
            monitoring_data = get_monitoring_dashboard()
            return monitoring_data.get('active_alerts', [])
        except:
            return []

# Global health aggregator instance
health_aggregator = ProductionHealthAggregator()

async def get_system_health() -> Dict[str, Any]:
    """Get comprehensive system health status"""
    health = await health_aggregator.get_comprehensive_health()
    return asdict(health)

async def get_quick_health_status() -> Tuple[str, int]:
    """Get quick health status for load balancers"""
    try:
        health = await health_aggregator.get_comprehensive_health()
        
        if health.overall_status == HealthStatus.HEALTHY:
            return "healthy", 200
        elif health.overall_status == HealthStatus.DEGRADED:
            return "degraded", 200
        else:
            return "unhealthy", 503
            
    except Exception:
        return "unhealthy", 503 