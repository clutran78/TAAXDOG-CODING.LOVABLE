"""
TAAXDOG Production Security Hardening
====================================

Security implementation including:
- Rate limiting and DDoS protection  
- Input validation and sanitization
- Authentication middleware
- Security event monitoring
"""

import os
import sys
import time
import re
import json
import logging
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from functools import wraps
import ipaddress

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

# Import Flask components with fallback
try:
    from flask import request, jsonify, abort, g
    from werkzeug.exceptions import TooManyRequests, BadRequest
except ImportError:
    print("Warning: Flask not available")
    
# Import cache utilities
try:
    from database.production_setup import cache_get, cache_set
except ImportError:
    def cache_get(key: str, namespace: str = 'default'): return None
    def cache_set(key: str, value: Any, ttl: int = 3600, namespace: str = 'default'): pass

logger = logging.getLogger(__name__)

@dataclass
class SecurityEvent:
    """Security event data structure"""
    event_type: str
    severity: str  # 'low', 'medium', 'high', 'critical'
    source_ip: str
    user_id: Optional[str]
    timestamp: datetime
    details: Dict[str, Any]

@dataclass
class RateLimitRule:
    """Rate limiting rule configuration"""
    name: str
    requests_per_minute: int
    requests_per_hour: int
    block_duration: int  # seconds

class ProductionSecurity:
    """Production security system with rate limiting and validation"""
    
    def __init__(self):
        self.security_events = []
        self.blocked_ips = set()
        
        # Rate limiting rules for Australian business users
        self.rate_limits = {
            'anonymous': RateLimitRule('anonymous', 30, 300, 300),  # 5 min block
            'authenticated': RateLimitRule('authenticated', 60, 1000, 180),  # 3 min block
            'premium': RateLimitRule('premium', 200, 5000, 60),  # 1 min block
        }
        
        # Malicious patterns for detection
        self.suspicious_patterns = [
            r'<script[^>]*>.*?</script>',  # XSS attempts
            r'union\s+select',             # SQL injection
            r'drop\s+table',               # SQL injection
            r'../../../',                  # Directory traversal
            r'eval\(',                     # Code injection
        ]
    
    def rate_limit_middleware(self, user_type: str = 'anonymous'):
        """Rate limiting middleware decorator"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                client_ip = self._get_client_ip()
                user_id = self._get_user_id()
                
                # Check if IP is blocked
                if self._is_ip_blocked(client_ip):
                    self._log_security_event(
                        'blocked_access', 'medium', client_ip, user_id,
                        {'reason': 'IP blocked'}
                    )
                    abort(429, description="Access temporarily blocked")
                
                # Check rate limits
                if not self._check_rate_limit(client_ip, user_id, user_type):
                    self._log_security_event(
                        'rate_limit_exceeded', 'medium', client_ip, user_id,
                        {'user_type': user_type}
                    )
                    abort(429, description="Rate limit exceeded")
                
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    def input_validation_middleware(self, validation_rules: Dict[str, str]):
        """Input validation middleware decorator"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Validate JSON request data
                if request.is_json:
                    data = request.get_json()
                    if data:
                        validation_errors = self._validate_input(data, validation_rules)
                        if validation_errors:
                            self._log_security_event(
                                'input_validation_failed', 'low',
                                self._get_client_ip(), self._get_user_id(),
                                {'errors': validation_errors}
                            )
                            abort(400, description="Invalid input data")
                
                # Check for malicious patterns
                if hasattr(request, 'data') and self._contains_malicious_patterns(request.data):
                    self._log_security_event(
                        'malicious_input_detected', 'high',
                        self._get_client_ip(), self._get_user_id(),
                        {'payload_size': len(request.data)}
                    )
                    abort(400, description="Malicious input detected")
                
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    def authentication_required(self, roles: Optional[List[str]] = None):
        """Authentication middleware decorator"""
        def decorator(func: Callable) -> Callable:
            @wraps(func)
            def wrapper(*args, **kwargs):
                # Check for authentication header
                auth_header = request.headers.get('Authorization')
                if not auth_header or not auth_header.startswith('Bearer '):
                    self._log_security_event(
                        'unauthorized_access', 'medium',
                        self._get_client_ip(), None,
                        {'endpoint': str(request.endpoint)}
                    )
                    abort(401, description="Authentication required")
                
                # Validate token (placeholder implementation)
                token = auth_header.split(' ')[1]
                user_data = self._validate_auth_token(token)
                if not user_data:
                    abort(401, description="Invalid authentication token")
                
                # Set user context
                g.current_user = user_data
                
                return func(*args, **kwargs)
            return wrapper
        return decorator
    
    def _get_client_ip(self) -> str:
        """Get client IP address with proxy support"""
        # Check forwarded headers from load balancer
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            return forwarded_for.split(',')[0].strip()
        
        real_ip = request.headers.get('X-Real-IP')
        if real_ip:
            return real_ip
        
        return request.remote_addr or '127.0.0.1'
    
    def _get_user_id(self) -> Optional[str]:
        """Get user ID from request context"""
        return getattr(g, 'current_user', {}).get('user_id') or request.headers.get('X-User-ID')
    
    def _is_ip_blocked(self, ip: str) -> bool:
        """Check if IP address is blocked"""
        if ip in self.blocked_ips:
            return True
        
        # Check cache for temporarily blocked IPs
        blocked_until = cache_get(f"blocked_ip:{ip}", namespace='security')
        if blocked_until:
            try:
                if datetime.fromisoformat(blocked_until) > datetime.now():
                    return True
            except ValueError:
                pass
        
        return False
    
    def _check_rate_limit(self, ip: str, user_id: Optional[str], user_type: str) -> bool:
        """Check rate limits for IP/user combination"""
        rule = self.rate_limits.get(user_type, self.rate_limits['anonymous'])
        current_time = time.time()
        
        # Create rate limit key
        limit_key = f"rate_limit:{user_type}:{user_id or ip}"
        
        # Get current rate limit data
        rate_data = cache_get(limit_key, namespace='security') or {
            'requests_per_minute': [],
            'requests_per_hour': []
        }
        
        # Clean old entries
        minute_threshold = current_time - 60
        hour_threshold = current_time - 3600
        
        rate_data['requests_per_minute'] = [
            req_time for req_time in rate_data['requests_per_minute']
            if req_time > minute_threshold
        ]
        rate_data['requests_per_hour'] = [
            req_time for req_time in rate_data['requests_per_hour']
            if req_time > hour_threshold
        ]
        
        # Check limits
        if (len(rate_data['requests_per_minute']) >= rule.requests_per_minute or
            len(rate_data['requests_per_hour']) >= rule.requests_per_hour):
            
            # Block IP temporarily
            block_until = datetime.now() + timedelta(seconds=rule.block_duration)
            cache_set(f"blocked_ip:{ip}", block_until.isoformat(), 
                     ttl=rule.block_duration, namespace='security')
            
            return False
        
        # Add current request
        rate_data['requests_per_minute'].append(current_time)
        rate_data['requests_per_hour'].append(current_time)
        
        # Update cache
        cache_set(limit_key, rate_data, ttl=3600, namespace='security')
        
        return True
    
    def _validate_input(self, data: Dict[str, Any], rules: Dict[str, str]) -> List[str]:
        """Validate input data against rules"""
        errors = []
        
        for field, rule in rules.items():
            value = data.get(field)
            
            if rule == 'required' and not value:
                errors.append(f"Field '{field}' is required")
            
            elif rule == 'email' and value:
                email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
                if not re.match(email_pattern, str(value)):
                    errors.append(f"Field '{field}' must be a valid email")
            
            elif rule == 'abn' and value:
                # Australian Business Number validation
                abn_pattern = r'^\d{11}$'
                if not re.match(abn_pattern, str(value).replace(' ', '')):
                    errors.append(f"Field '{field}' must be a valid ABN")
            
            elif rule == 'currency' and value:
                # Australian currency validation
                try:
                    amount = float(value)
                    if amount < 0 or amount > 999999.99:
                        errors.append(f"Field '{field}' must be a valid currency amount")
                except (ValueError, TypeError):
                    errors.append(f"Field '{field}' must be a valid number")
        
        return errors
    
    def _contains_malicious_patterns(self, data: bytes) -> bool:
        """Check if data contains malicious patterns"""
        try:
            data_str = data.decode('utf-8', errors='ignore').lower()
            
            for pattern in self.suspicious_patterns:
                if re.search(pattern, data_str, re.IGNORECASE):
                    return True
            
            return False
        except Exception:
            return False
    
    def _validate_auth_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Validate authentication token (placeholder)"""
        try:
            # Basic token validation
            if len(token) < 32:
                return None
            
            # Check if token is revoked
            revoked = cache_get(f"revoked_token:{token}", namespace='security')
            if revoked:
                return None
            
            # Return placeholder user data
            return {
                'user_id': 'placeholder_user',
                'roles': ['user'],
                'exp': time.time() + 3600
            }
            
        except Exception as e:
            logger.error(f"Token validation error: {e}")
            return None
    
    def _log_security_event(self, event_type: str, severity: str, source_ip: str, 
                           user_id: Optional[str], details: Dict[str, Any]):
        """Log security event"""
        event = SecurityEvent(
            event_type=event_type,
            severity=severity,
            source_ip=source_ip,
            user_id=user_id,
            timestamp=datetime.now(),
            details=details
        )
        
        self.security_events.append(event)
        
        # Log to application logger
        logger.warning(f"🔒 Security Event: {event_type} from {source_ip} - {details}")
        
        # Store in cache for monitoring
        event_data = asdict(event)
        event_data['timestamp'] = event.timestamp.isoformat()
        cache_set(f"security_event:{int(time.time())}", event_data, 
                 ttl=86400, namespace='security')
    
    def get_security_dashboard(self) -> Dict[str, Any]:
        """Get security monitoring dashboard data"""
        recent_events = [
            asdict(event) for event in self.security_events
            if event.timestamp > datetime.now() - timedelta(hours=24)
        ]
        
        # Convert timestamps to ISO format
        for event in recent_events:
            event['timestamp'] = event['timestamp'].isoformat()
        
        return {
            'recent_events': recent_events,
            'blocked_ips': list(self.blocked_ips),
            'event_counts': {
                'last_hour': len([e for e in self.security_events 
                                if e.timestamp > datetime.now() - timedelta(hours=1)]),
                'last_24h': len(recent_events)
            },
            'security_status': self._get_security_status()
        }
    
    def _get_security_status(self) -> str:
        """Get overall security status"""
        recent_critical = len([e for e in self.security_events 
                             if e.timestamp > datetime.now() - timedelta(minutes=30) 
                             and e.severity == 'critical'])
        
        if recent_critical > 5:
            return 'critical'
        elif len(self.blocked_ips) > 10:
            return 'elevated'
        else:
            return 'normal'


# Global security instance
production_security = ProductionSecurity()

# Export decorators
rate_limit = production_security.rate_limit_middleware
input_validation = production_security.input_validation_middleware
auth_required = production_security.authentication_required

def get_security_dashboard():
    """Get security dashboard data"""
    return production_security.get_security_dashboard()

def block_ip(ip: str, duration: int = 3600):
    """Manually block an IP address"""
    production_security.blocked_ips.add(ip)
    block_until = datetime.now() + timedelta(seconds=duration)
    cache_set(f"blocked_ip:{ip}", block_until.isoformat(), ttl=duration, namespace='security') 