"""
Enhanced Authentication Middleware for TAAXDOG API
Implements secure Firebase token validation with rate limiting and security monitoring
"""

from functools import wraps
from flask import request, jsonify, g
from firebase_admin import auth
import logging
import time
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
import redis
import os
import json

# Setup logging with security event formatting
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [SECURITY] %(levelname)s: %(message)s'
)
logger = logging.getLogger(__name__)

# Security configuration
class SecurityConfig:
    # Rate limiting (requests per minute per user/IP)
    RATE_LIMIT_AUTHENTICATED = 200
    RATE_LIMIT_ANONYMOUS = 60
    RATE_LIMIT_WINDOW = 60  # seconds
    
    # Token validation settings
    TOKEN_MIN_LENGTH = 32
    TOKEN_CACHE_TTL = 3600  # 1 hour
    
    # Blocked patterns
    SUSPICIOUS_PATTERNS = [
        'sqlmap', 'nmap', 'nikto', 'w3af', 'acunetix'
    ]

# Redis connection for rate limiting and token caching
try:
    redis_client = redis.from_url(
        os.environ.get('REDIS_URL', 'redis://localhost:6379/2')
    )
    redis_client.ping()
    logger.info("Redis connected for authentication middleware")
except Exception as e:
    logger.warning(f"Redis unavailable, using memory cache: {e}")
    redis_client = None

# In-memory cache fallback
memory_cache = {}
rate_limit_cache = {}

def get_cache(key: str) -> Optional[str]:
    """Get value from cache (Redis preferred, memory fallback)"""
    if redis_client:
        try:
            return redis_client.get(key)
        except Exception:
            pass
    return memory_cache.get(key)

def set_cache(key: str, value: Any, ttl: int = 3600):
    """Set value in cache with TTL"""
    if redis_client:
        try:
            redis_client.setex(key, ttl, str(value))
            return
        except Exception:
            pass
    
    # Memory cache with expiration
    memory_cache[key] = {
        'value': value,
        'expires': time.time() + ttl
    }

def get_client_ip() -> str:
    """Get client IP with proxy support"""
    # Check forwarded headers from load balancer
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip
    
    return request.remote_addr or '127.0.0.1'

def check_rate_limit(identifier: str, limit: int) -> bool:
    """Check if identifier exceeds rate limit"""
    current_time = int(time.time())
    window_start = current_time - SecurityConfig.RATE_LIMIT_WINDOW
    
    # Rate limit key
    rate_key = f"rate_limit:{identifier}:{current_time // 60}"  # Per minute buckets
    
    if redis_client:
        try:
            # Increment counter and set expiration
            count = redis_client.incr(rate_key)
            if count == 1:
                redis_client.expire(rate_key, SecurityConfig.RATE_LIMIT_WINDOW)
            
            return count <= limit
        except Exception:
            pass
    
    # Memory fallback
    if identifier not in rate_limit_cache:
        rate_limit_cache[identifier] = []
    
    # Clean old entries
    rate_limit_cache[identifier] = [
        timestamp for timestamp in rate_limit_cache[identifier]
        if timestamp > window_start
    ]
    
    # Check limit
    if len(rate_limit_cache[identifier]) >= limit:
        return False
    
    # Add current request
    rate_limit_cache[identifier].append(current_time)
    return True

def log_security_event(event_type: str, level: str, details: Dict[str, Any]):
    """Log security event with standardized format"""
    log_data = {
        'timestamp': datetime.now().isoformat(),
        'event': event_type,
        'level': level,
        'ip': get_client_ip(),
        'user_agent': request.headers.get('User-Agent', 'Unknown'),
        'endpoint': request.endpoint,
        'method': request.method,
        **details
    }
    
    if level == 'error':
        logger.error(f"Security Event: {event_type} - {details}")
    elif level == 'warning':
        logger.warning(f"Security Event: {event_type} - {details}")
    else:
        logger.info(f"Security Event: {event_type} - {details}")

def validate_firebase_token(token: str) -> Optional[Dict[str, Any]]:
    """Validate Firebase token with caching"""
    if not token or len(token) < SecurityConfig.TOKEN_MIN_LENGTH:
        return None
    
    # Check cache first
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    cache_key = f"validated_token:{token_hash}"
    
    cached_result = get_cache(cache_key)
    if cached_result:
        try:
            # Return cached user data if valid
            user_data = json.loads(cached_result)
            return user_data
        except Exception:
            pass
    
    try:
        # Verify with Firebase
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']
        
        # Create user data object
        user_data = {
            'user_id': user_id,
            'email': decoded_token.get('email'),
            'email_verified': decoded_token.get('email_verified', False),
            'auth_time': decoded_token.get('auth_time'),
            'iss': decoded_token.get('iss'),
            'aud': decoded_token.get('aud'),
            'exp': decoded_token.get('exp')
        }
        
        # Cache valid token for performance
        set_cache(cache_key, json.dumps(user_data), SecurityConfig.TOKEN_CACHE_TTL)
        
        log_security_event('token_validated', 'info', {
            'user_id': user_id,
            'email_verified': user_data['email_verified']
        })
        
        return user_data
        
    except auth.ExpiredIdTokenError as e:
        log_security_event('expired_token', 'warning', {
            'error': 'Expired ID token',
            'token_length': len(token)
        })
        return None
        
    except auth.InvalidIdTokenError as e:
        log_security_event('invalid_token', 'warning', {
            'error': 'Invalid ID token',
            'token_length': len(token)
        })
        return None
        
    except Exception as e:
        log_security_event('token_validation_error', 'error', {
            'error': str(e),
            'token_length': len(token)
        })
        return None

def check_suspicious_activity() -> bool:
    """Check for suspicious user agents and patterns"""
    user_agent = request.headers.get('User-Agent', '').lower()
    
    # Check for blocked user agents
    for pattern in SecurityConfig.SUSPICIOUS_PATTERNS:
        if pattern in user_agent:
            log_security_event('suspicious_user_agent', 'warning', {
                'user_agent': user_agent,
                'pattern_matched': pattern
            })
            return True
    
    return False

def require_auth(roles: Optional[List[str]] = None, rate_limit: Optional[int] = None):
    """
    Enhanced decorator to require authentication for API endpoints.
    
    Args:
        roles: List of required roles (optional)
        rate_limit: Custom rate limit for this endpoint (optional)
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            client_ip = get_client_ip()
            
            # 1. Check for suspicious activity
            if check_suspicious_activity():
                return jsonify({
                    'success': False,
                    'error': 'Access denied'
                }), 403
            
            # 2. Rate limiting check (anonymous)
            if not check_rate_limit(f"ip:{client_ip}", SecurityConfig.RATE_LIMIT_ANONYMOUS):
                log_security_event('rate_limit_exceeded', 'warning', {
                    'ip': client_ip,
                    'limit_type': 'anonymous'
                })
                return jsonify({
                    'success': False,
                    'error': 'Rate limit exceeded'
                }), 429
            
            # 3. Get authorization header
            auth_header = request.headers.get('Authorization')
            
            if not auth_header:
                log_security_event('missing_auth_header', 'warning', {
                    'ip': client_ip,
                    'endpoint': request.endpoint
                })
                return jsonify({
                    'success': False,
                    'error': 'Authorization header required'
                }), 401
            
            # 4. Extract and validate token format
            if not auth_header.startswith('Bearer '):
                log_security_event('invalid_auth_format', 'warning', {
                    'ip': client_ip,
                    'auth_header_prefix': auth_header[:20]  # Log only prefix
                })
                return jsonify({
                    'success': False,
                    'error': 'Invalid authorization header format'
                }), 401
            
            token = auth_header.split(' ')[1]
            
            # 5. Validate Firebase token
            user_data = validate_firebase_token(token)
            
            if not user_data:
                log_security_event('invalid_token_attempt', 'warning', {
                    'ip': client_ip,
                    'token_length': len(token),
                    'endpoint': request.endpoint
                })
                return jsonify({
                    'success': False,
                    'error': 'Invalid or expired authentication token'
                }), 401
            
            # 6. Rate limiting check (authenticated user)
            user_id = user_data['user_id']
            auth_limit = rate_limit or SecurityConfig.RATE_LIMIT_AUTHENTICATED
            
            if not check_rate_limit(f"user:{user_id}", auth_limit):
                log_security_event('user_rate_limit_exceeded', 'warning', {
                    'user_id': user_id,
                    'limit': auth_limit
                })
                return jsonify({
                    'success': False,
                    'error': 'Rate limit exceeded for authenticated user'
                }), 429
            
            # 7. Role-based access control (if roles specified)
            if roles:
                user_roles = user_data.get('roles', [])
                if not any(role in user_roles for role in roles):
                    log_security_event('insufficient_permissions', 'warning', {
                        'user_id': user_id,
                        'required_roles': roles,
                        'user_roles': user_roles
                    })
                    return jsonify({
                        'success': False,
                        'error': 'Insufficient permissions'
                    }), 403
            
            # 8. Set user context for the request
            request.user_id = user_id
            request.user_data = user_data
            g.user_id = user_id
            g.user_data = user_data
            
            # 9. Log successful authentication
            log_security_event('auth_success', 'info', {
                'user_id': user_id,
                'endpoint': request.endpoint,
                'email_verified': user_data.get('email_verified', False)
            })
            
            return f(*args, **kwargs)
            
        return decorated_function
    return decorator

def require_admin(f):
    """Decorator to require admin role"""
    return require_auth(roles=['admin'])(f)

def require_premium(f):
    """Decorator to require premium subscription"""
    @wraps(f)
    @require_auth()
    def decorated_function(*args, **kwargs):
        user_id = g.user_id
        
        # Check premium status (implement based on your subscription system)
        # This is a placeholder - implement actual premium check
        is_premium = True  # Replace with actual premium check
        
        if not is_premium:
            log_security_event('premium_required', 'info', {
                'user_id': user_id,
                'endpoint': request.endpoint
            })
            return jsonify({
                'success': False,
                'error': 'Premium subscription required',
                'upgrade_url': '/upgrade'
            }), 402
        
        return f(*args, **kwargs)
    
    return decorated_function 