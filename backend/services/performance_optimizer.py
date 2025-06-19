"""
TAAXDOG Performance Optimization Layer
=====================================

Production-ready performance optimization including:
- Request processing optimization and caching
- Database query optimization and batching
- Memory management and garbage collection
- API response compression and optimization
- Load balancing and request distribution
"""

import os
import sys
import time
import asyncio
import gzip
import json
import threading
from typing import Dict, Any, List, Optional, Callable, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from functools import wraps, lru_cache
from concurrent.futures import ThreadPoolExecutor, as_completed
import logging

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# Import database utilities
try:
    from database.production_setup import cache_get, cache_set, production_db
except ImportError:
    # Fallback for development
    def cache_get(key: str, namespace: str = 'default'): return None
    def cache_set(key: str, value: Any, ttl: int = 3600, namespace: str = 'default'): pass
    production_db = None

logger = logging.getLogger(__name__)

@dataclass
class PerformanceMetrics:
    """Performance metrics tracking"""
    request_count: int = 0
    total_response_time: float = 0.0
    cache_hits: int = 0
    cache_misses: int = 0
    database_queries: int = 0
    background_tasks: int = 0
    memory_usage: float = 0.0
    cpu_usage: float = 0.0
    
    @property
    def avg_response_time(self) -> float:
        return self.total_response_time / self.request_count if self.request_count > 0 else 0.0
    
    @property
    def cache_hit_rate(self) -> float:
        total = self.cache_hits + self.cache_misses
        return (self.cache_hits / total * 100) if total > 0 else 0.0

class PerformanceOptimizer:
    """
    Main performance optimization engine
    Handles caching, query optimization, and resource management
    """
    
    def __init__(self):
        self.metrics = PerformanceMetrics()
        self.request_cache = {}
        self.query_cache = {}
        self.background_tasks = []
        self.thread_pool = ThreadPoolExecutor(max_workers=10)
        self._start_background_monitoring()
    
    def _start_background_monitoring(self):
        """Start background performance monitoring"""
        def monitor_performance():
            while True:
                try:
                    self._update_system_metrics()
                    self._cleanup_expired_cache()
                    self._log_performance_metrics()
                    time.sleep(60)  # Monitor every minute
                except Exception as e:
                    logger.error(f"Performance monitoring error: {e}")
                    time.sleep(60)
        
        monitor_thread = threading.Thread(target=monitor_performance, daemon=True)
        monitor_thread.start()
        self.background_tasks.append(monitor_thread)
    
    def _update_system_metrics(self):
        """Update system resource metrics"""
        try:
            import psutil
            self.metrics.memory_usage = psutil.virtual_memory().percent
            self.metrics.cpu_usage = psutil.cpu_percent()
        except ImportError:
            pass  # psutil not available
    
    def _cleanup_expired_cache(self):
        """Clean up expired cache entries"""
        current_time = time.time()
        
        # Clean request cache (entries older than 5 minutes)
        expired_keys = [
            key for key, (value, timestamp) in self.request_cache.items()
            if current_time - timestamp > 300
        ]
        for key in expired_keys:
            del self.request_cache[key]
        
        # Clean query cache (entries older than 10 minutes)
        expired_queries = [
            key for key, (value, timestamp) in self.query_cache.items()
            if current_time - timestamp > 600
        ]
        for key in expired_queries:
            del self.query_cache[key]
    
    def _log_performance_metrics(self):
        """Log current performance metrics"""
        if self.metrics.request_count > 0:
            logger.info(f"📊 Performance - "
                       f"Avg Response: {self.metrics.avg_response_time:.3f}s, "
                       f"Cache Hit Rate: {self.metrics.cache_hit_rate:.1f}%, "
                       f"Requests: {self.metrics.request_count}, "
                       f"Memory: {self.metrics.memory_usage:.1f}%")
    
    def optimize_request(self, func: Callable) -> Callable:
        """
        Decorator to optimize request processing with caching and compression
        """
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            
            # Generate cache key from function name and arguments
            cache_key = self._generate_cache_key(func.__name__, args, kwargs)
            
            # Try to get from cache first
            cached_result = self._get_from_request_cache(cache_key)
            if cached_result is not None:
                self.metrics.cache_hits += 1
                return cached_result
            
            # Execute function if not cached
            self.metrics.cache_misses += 1
            result = func(*args, **kwargs)
            
            # Cache the result
            self._set_in_request_cache(cache_key, result)
            
            # Update metrics
            self.metrics.request_count += 1
            self.metrics.total_response_time += time.time() - start_time
            
            return result
        
        return wrapper
    
    def optimize_database_query(self, func: Callable) -> Callable:
        """
        Decorator to optimize database queries with intelligent caching
        """
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Generate query cache key
            query_key = self._generate_cache_key(f"query_{func.__name__}", args, kwargs)
            
            # Try Redis cache first
            cached_result = cache_get(query_key, namespace='db_queries')
            if cached_result is not None:
                return cached_result
            
            # Try local query cache
            local_cached = self._get_from_query_cache(query_key)
            if local_cached is not None:
                return local_cached
            
            # Execute query if not cached
            result = func(*args, **kwargs)
            
            # Cache in both Redis and local cache
            cache_set(query_key, result, ttl=600, namespace='db_queries')  # 10 minutes
            self._set_in_query_cache(query_key, result)
            
            self.metrics.database_queries += 1
            
            return result
        
        return wrapper
    
    def batch_database_operations(self, operations: List[Callable], batch_size: int = 50) -> List[Any]:
        """
        Execute database operations in optimized batches
        """
        results = []
        
        # Process operations in batches
        for i in range(0, len(operations), batch_size):
            batch = operations[i:i + batch_size]
            
            # Execute batch in parallel
            futures = [self.thread_pool.submit(op) for op in batch]
            
            # Collect results
            for future in as_completed(futures):
                try:
                    result = future.result(timeout=30)
                    results.append(result)
                except Exception as e:
                    logger.error(f"Batch operation failed: {e}")
                    results.append(None)
        
        return results
    
    def compress_response(self, data: Any, threshold: int = 1024) -> Tuple[bytes, Dict[str, str]]:
        """
        Compress response data if it exceeds threshold
        """
        # Serialize data
        if isinstance(data, (dict, list)):
            json_data = json.dumps(data, default=str).encode('utf-8')
        elif isinstance(data, str):
            json_data = data.encode('utf-8')
        else:
            json_data = str(data).encode('utf-8')
        
        headers = {}
        
        # Compress if data size exceeds threshold
        if len(json_data) > threshold:
            compressed_data = gzip.compress(json_data)
            headers['Content-Encoding'] = 'gzip'
            headers['Content-Length'] = str(len(compressed_data))
            return compressed_data, headers
        else:
            headers['Content-Length'] = str(len(json_data))
            return json_data, headers
    
    def optimize_api_response(self, data: Dict[str, Any], 
                             include_metadata: bool = True) -> Dict[str, Any]:
        """
        Optimize API response by removing unnecessary data and adding performance metadata
        """
        optimized_data = data.copy()
        
        # Remove null values to reduce payload size
        optimized_data = self._remove_null_values(optimized_data)
        
        # Add performance metadata if requested
        if include_metadata:
            optimized_data['_metadata'] = {
                'cache_hit_rate': f"{self.metrics.cache_hit_rate:.1f}%",
                'avg_response_time': f"{self.metrics.avg_response_time:.3f}s",
                'timestamp': datetime.now().isoformat(),
                'server_version': os.getenv('APP_VERSION', '1.0.0')
            }
        
        return optimized_data
    
    def _generate_cache_key(self, prefix: str, args: tuple, kwargs: dict) -> str:
        """Generate a cache key from function arguments"""
        import hashlib
        
        # Convert arguments to string representation
        args_str = str(args) + str(sorted(kwargs.items()))
        
        # Create hash of arguments
        hash_object = hashlib.md5(args_str.encode())
        hash_hex = hash_object.hexdigest()
        
        return f"{prefix}:{hash_hex}"
    
    def _get_from_request_cache(self, key: str) -> Optional[Any]:
        """Get value from request cache"""
        if key in self.request_cache:
            value, timestamp = self.request_cache[key]
            # Check if cache entry is still valid (5 minutes)
            if time.time() - timestamp < 300:
                return value
            else:
                del self.request_cache[key]
        return None
    
    def _set_in_request_cache(self, key: str, value: Any):
        """Set value in request cache"""
        self.request_cache[key] = (value, time.time())
        
        # Limit cache size to prevent memory issues
        if len(self.request_cache) > 1000:
            # Remove oldest entries
            oldest_keys = sorted(
                self.request_cache.keys(),
                key=lambda k: self.request_cache[k][1]
            )[:100]
            for old_key in oldest_keys:
                del self.request_cache[old_key]
    
    def _get_from_query_cache(self, key: str) -> Optional[Any]:
        """Get value from query cache"""
        if key in self.query_cache:
            value, timestamp = self.query_cache[key]
            # Check if cache entry is still valid (10 minutes)
            if time.time() - timestamp < 600:
                return value
            else:
                del self.query_cache[key]
        return None
    
    def _set_in_query_cache(self, key: str, value: Any):
        """Set value in query cache"""
        self.query_cache[key] = (value, time.time())
        
        # Limit cache size
        if len(self.query_cache) > 500:
            oldest_keys = sorted(
                self.query_cache.keys(),
                key=lambda k: self.query_cache[k][1]
            )[:50]
            for old_key in oldest_keys:
                del self.query_cache[old_key]
    
    def _remove_null_values(self, data: Any) -> Any:
        """Recursively remove null values from data structure"""
        if isinstance(data, dict):
            return {
                k: self._remove_null_values(v)
                for k, v in data.items()
                if v is not None and v != ""
            }
        elif isinstance(data, list):
            return [
                self._remove_null_values(item)
                for item in data
                if item is not None
            ]
        else:
            return data
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Get comprehensive performance report"""
        return {
            'metrics': asdict(self.metrics),
            'cache_stats': {
                'request_cache_size': len(self.request_cache),
                'query_cache_size': len(self.query_cache),
                'cache_hit_rate': self.metrics.cache_hit_rate
            },
            'system_resources': {
                'memory_usage': self.metrics.memory_usage,
                'cpu_usage': self.metrics.cpu_usage,
                'active_threads': len(self.background_tasks)
            },
            'recommendations': self._get_performance_recommendations()
        }
    
    def _get_performance_recommendations(self) -> List[str]:
        """Get performance optimization recommendations"""
        recommendations = []
        
        if self.metrics.avg_response_time > 2.0:
            recommendations.append("Consider implementing more aggressive caching")
        
        if self.metrics.cache_hit_rate < 70:
            recommendations.append("Cache hit rate is low, review cache strategy")
        
        if self.metrics.memory_usage > 80:
            recommendations.append("High memory usage detected, consider cleanup")
        
        if self.metrics.cpu_usage > 80:
            recommendations.append("High CPU usage, consider load balancing")
        
        if len(self.request_cache) > 800:
            recommendations.append("Request cache is large, consider reducing TTL")
        
        return recommendations
    
    def shutdown(self):
        """Graceful shutdown of performance optimizer"""
        logger.info("🔄 Shutting down performance optimizer...")
        
        # Shutdown thread pool
        self.thread_pool.shutdown(wait=True)
        
        # Clear caches
        self.request_cache.clear()
        self.query_cache.clear()
        
        logger.info("✅ Performance optimizer shutdown complete")


# Global performance optimizer instance
performance_optimizer = PerformanceOptimizer()

# Decorator functions for easy use
def optimize_request(func: Callable) -> Callable:
    """Decorator to optimize request processing"""
    return performance_optimizer.optimize_request(func)

def optimize_database_query(func: Callable) -> Callable:
    """Decorator to optimize database queries"""
    return performance_optimizer.optimize_database_query(func)

def get_performance_metrics() -> Dict[str, Any]:
    """Get current performance metrics"""
    return performance_optimizer.get_performance_report()

def batch_operations(operations: List[Callable], batch_size: int = 50) -> List[Any]:
    """Execute operations in optimized batches"""
    return performance_optimizer.batch_database_operations(operations, batch_size)

def compress_api_response(data: Any) -> Tuple[bytes, Dict[str, str]]:
    """Compress API response data"""
    return performance_optimizer.compress_response(data)

def optimize_response_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Optimize API response data"""
    return performance_optimizer.optimize_api_response(data) 