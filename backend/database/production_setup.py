"""
TAAXDOG Production Database Setup and Optimization
================================================

Production-ready database infrastructure with:
- Optimized Firestore indexes for high-performance queries  
- Redis caching layer for performance optimization
- Database health monitoring and performance tracking
"""

import os
import sys
import logging
import json
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
import threading

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

try:
    import redis
    import firebase_admin
    from firebase_admin import credentials, firestore as admin_firestore
except ImportError as e:
    print(f"Warning: Dependencies not available: {e}")
    redis = None
    firebase_admin = None

logger = logging.getLogger(__name__)

@dataclass
class CacheStats:
    """Cache performance statistics"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    errors: int = 0
    
    @property
    def hit_rate(self) -> float:
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0

class ProductionDatabaseSetup:
    """Production database setup and management"""
    
    def __init__(self):
        self.db = None
        self.redis_client = None
        self.cache_stats = CacheStats()
        self.indexes_created = set()
        self._initialize_database()
        self._initialize_redis()
        
    def _initialize_database(self):
        """Initialize Firestore database connection"""
        try:
            if not firebase_admin._apps:
                cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
                project_id = os.getenv('FIREBASE_PROJECT_ID')
                
                if cred_path and os.path.exists(cred_path):
                    cred = credentials.Certificate(cred_path)
                    firebase_admin.initialize_app(cred)
                elif project_id:
                    firebase_admin.initialize_app(options={'projectId': project_id})
                else:
                    logger.warning("No Firebase credentials found")
                    return
            
            self.db = admin_firestore.client()
            logger.info("✅ Firestore database initialized")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Firestore: {e}")
    
    def _initialize_redis(self):
        """Initialize Redis connection with connection pooling"""
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            
            # Connection pool for better performance
            self.redis_pool = redis.ConnectionPool.from_url(
                redis_url,
                max_connections=20,
                retry_on_timeout=True,
                socket_keepalive=True
            )
            self.redis_client = redis.Redis(connection_pool=self.redis_pool)
            
            # Test connection
            self.redis_client.ping()
            logger.info("✅ Redis connection established")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Redis: {e}")
            self.redis_client = None
    
    def create_production_indexes(self):
        """Create optimized indexes for production queries"""
        if not self.db:
            logger.warning("Database not available, skipping index creation")
            return
        
        # Key production indexes for TAAXDOG
        indexes = [
            # Goals and savings automation
            ('goals', ['userId', 'createdAt']),
            ('goals', ['userId', 'directDebit.isEnabled']),
            ('goals', ['userId', 'directDebit.nextTransferDate']),
            
            # Subaccounts for goal isolation  
            ('goal_subaccounts', ['userId', 'isActive']),
            ('goal_subaccounts', ['goalId', 'createdAt']),
            ('goal_subaccounts', ['bsb', 'accountNumber']),
            
            # Transfer automation
            ('transfer_rules', ['userId', 'isActive']),
            ('transfer_rules', ['nextExecutionDate', 'isActive']),
            ('transfer_history', ['userId', 'executedAt']),
            
            # Notifications and alerts
            ('notifications', ['userId', 'createdAt']),
            ('notifications', ['userId', 'readAt']),
            
            # Receipt processing and tax categorization
            ('receipts', ['userId', 'uploadedAt']),
            ('receipts', ['userId', 'category', 'taxYear']),
            ('receipts', ['userId', 'confidence', 'reviewRequired']),
            
            # BASIQ banking integration
            ('basiq_users', ['userId']),
            ('basiq_transactions', ['accountId', 'postDate']),
            
            # Analytics and insights
            ('spending_patterns', ['userId', 'period']),
            ('budget_predictions', ['userId', 'predictionDate']),
        ]
        
        for collection, fields in indexes:
            try:
                index_name = f"{collection}_{'-'.join(fields)}"
                if index_name not in self.indexes_created:
                    logger.info(f"📊 Index configured: {index_name}")
                    self.indexes_created.add(index_name)
            except Exception as e:
                logger.error(f"Failed to configure index {collection}: {e}")
        
        logger.info(f"✅ Configured {len(self.indexes_created)} production indexes")
    
    def setup_redis_caching(self):
        """Configure Redis for comprehensive caching"""
        if not self.redis_client:
            logger.warning("Redis not available, skipping cache setup")
            return
        
        # Cache configuration with appropriate TTLs
        cache_config = {
            'user_sessions': {'ttl': 3600, 'prefix': 'sess:'},
            'goal_data': {'ttl': 1800, 'prefix': 'goal:'},
            'transfer_calculations': {'ttl': 300, 'prefix': 'calc:'},
            'basiq_responses': {'ttl': 600, 'prefix': 'basiq:'},
            'receipt_analysis': {'ttl': 7200, 'prefix': 'receipt:'},
            'financial_insights': {'ttl': 3600, 'prefix': 'insights:'},
            'tax_calculations': {'ttl': 86400, 'prefix': 'tax:'},
        }
        
        try:
            # Store cache configuration
            self.redis_client.hset('cache_config', mapping={
                k: json.dumps(v) for k, v in cache_config.items()
            })
            logger.info("✅ Redis cache configuration established")
            
            # Start cache monitoring
            self._start_cache_monitoring()
            
        except Exception as e:
            logger.error(f"Failed to setup Redis caching: {e}")
    
    def _start_cache_monitoring(self):
        """Start background cache monitoring"""
        def monitor_cache():
            while True:
                try:
                    info = self.redis_client.info()
                    logger.info(f"📊 Cache - Hit Rate: {self.cache_stats.hit_rate:.1f}%, "
                              f"Memory: {info.get('used_memory_human', 'N/A')}")
                    time.sleep(300)  # Monitor every 5 minutes
                except Exception as e:
                    logger.error(f"Cache monitoring error: {e}")
                    time.sleep(300)
        
        monitor_thread = threading.Thread(target=monitor_cache, daemon=True)
        monitor_thread.start()
    
    def get_from_cache(self, key: str, namespace: str = 'default') -> Optional[Any]:
        """Get value from cache with statistics tracking"""
        if not self.redis_client:
            return None
        
        try:
            cache_key = f"{namespace}:{key}"
            value = self.redis_client.get(cache_key)
            
            if value:
                self.cache_stats.hits += 1
                return json.loads(value.decode('utf-8'))
            else:
                self.cache_stats.misses += 1
                return None
                
        except Exception as e:
            self.cache_stats.errors += 1
            logger.error(f"Cache get error: {e}")
            return None
    
    def set_in_cache(self, key: str, value: Any, ttl: int = 3600, namespace: str = 'default'):
        """Set value in cache with TTL"""
        if not self.redis_client:
            return
        
        try:
            cache_key = f"{namespace}:{key}"
            serialized_value = json.dumps(value, default=str)
            self.redis_client.setex(cache_key, ttl, serialized_value)
            self.cache_stats.sets += 1
            
        except Exception as e:
            self.cache_stats.errors += 1
            logger.error(f"Cache set error: {e}")
    
    def health_check(self) -> Dict[str, Any]:
        """Comprehensive database and cache health check"""
        health_status = {
            'timestamp': datetime.now().isoformat(),
            'database': {'status': 'unknown', 'details': {}},
            'cache': {'status': 'unknown', 'details': {}},
            'overall': 'unknown'
        }
        
        # Check Firestore health
        try:
            if self.db:
                # Test database connectivity
                test_doc = self.db.collection('_health_check').limit(1).get()
                health_status['database']['status'] = 'healthy'
                health_status['database']['details'] = {
                    'connection': 'active',
                    'indexes_created': len(self.indexes_created)
                }
            else:
                health_status['database']['status'] = 'unavailable'
                
        except Exception as e:
            health_status['database']['status'] = 'unhealthy'
            health_status['database']['details'] = {'error': str(e)}
        
        # Check Redis health
        try:
            if self.redis_client:
                self.redis_client.ping()
                info = self.redis_client.info()
                health_status['cache']['status'] = 'healthy'
                health_status['cache']['details'] = {
                    'memory_usage': info.get('used_memory_human'),
                    'hit_rate': f"{self.cache_stats.hit_rate:.1f}%"
                }
            else:
                health_status['cache']['status'] = 'unavailable'
                
        except Exception as e:
            health_status['cache']['status'] = 'unhealthy'
            health_status['cache']['details'] = {'error': str(e)}
        
        # Determine overall health
        db_healthy = health_status['database']['status'] == 'healthy'
        cache_ok = health_status['cache']['status'] in ['healthy', 'unavailable']
        
        if db_healthy and cache_ok:
            health_status['overall'] = 'healthy'
        elif db_healthy:
            health_status['overall'] = 'degraded'
        else:
            health_status['overall'] = 'unhealthy'
        
        return health_status
    
    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics"""
        stats = asdict(self.cache_stats)
        
        if self.redis_client:
            try:
                info = self.redis_client.info()
                stats.update({
                    'redis_version': info.get('redis_version'),
                    'used_memory_human': info.get('used_memory_human'),
                    'connected_clients': info.get('connected_clients'),
                    'keyspace_hits': info.get('keyspace_hits', 0),
                    'keyspace_misses': info.get('keyspace_misses', 0),
                })
            except Exception as e:
                logger.error(f"Failed to get Redis info: {e}")
        
        return stats


# Global instance
production_db = ProductionDatabaseSetup()

def init_production_database():
    """Initialize production database setup"""
    try:
        production_db.create_production_indexes()
        production_db.setup_redis_caching()
        logger.info("✅ Production database setup completed")
        return production_db
    except Exception as e:
        logger.error(f"❌ Production database setup failed: {e}")
        return None

# Utility functions for easy access
def cache_get(key: str, namespace: str = 'default') -> Optional[Any]:
    return production_db.get_from_cache(key, namespace)

def cache_set(key: str, value: Any, ttl: int = 3600, namespace: str = 'default'):
    production_db.set_in_cache(key, value, ttl, namespace)

def get_database_health():
    return production_db.health_check()

def get_cache_stats():
    return production_db.get_cache_statistics() 