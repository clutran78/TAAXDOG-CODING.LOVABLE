"""
Security Middleware for TAAXDOG Production
Implements rate limiting, CSRF protection, input validation, and security headers
"""

import os
import time
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from functools import wraps
from flask import Flask, request, jsonify, g, abort
from werkzeug.exceptions import TooManyRequests
import re
import json

try:
    import redis
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    from flask_talisman import Talisman
except ImportError:
    redis = None
    Limiter = None
    Talisman = None


class SecurityConfig:
    """Security configuration settings"""
    
    # Rate limiting settings
    DEFAULT_RATE_LIMIT = "60 per minute"
    STRICT_RATE_LIMIT = "30 per minute"
    PREMIUM_RATE_LIMIT = "200 per minute"
    
    # Security patterns
    SUSPICIOUS_PATTERNS = [
        r'<script[^>]*>.*?</script>',  # XSS attempts
        r'javascript:',  # JavaScript protocol
        r'data:text/html',  # Data URI XSS
        r'vbscript:',  # VBScript protocol
        r'on\w+\s*=',  # Event handlers
        r'(union|select|insert|update|delete|drop|create|alter)\s+',  # SQL injection
        r'(\||&|;|\$\(|\`)',  # Command injection
        r'\.\./',  # Directory traversal
        r'file://',  # File protocol
        r'php://filter',  # PHP filter
    ]
    
    # Blocked user agents
    BLOCKED_USER_AGENTS = [
        'sqlmap',
        'nmap',
        'nikto',
        'w3af',
        'acunetix',
        'netsparker',
        'masscan'
    ]
    
    # Sensitive endpoints requiring extra protection
    SENSITIVE_ENDPOINTS = [
        '/api/auth',
        '/api/upload',
        '/api/banking',
        '/api/financial',
        '/api/user'
    ]


class RateLimiter:
    """Advanced rate limiting with Redis backend"""
    
    def __init__(self, app: Optional[Flask] = None):
        self.app = app
        self.redis_client = None
        self.logger = logging.getLogger('taaxdog.security')
        
        if app:
            self.init_app(app)
    
    def init_app(self, app: Flask):
        """Initialize rate limiter with Flask app"""
        self.app = app
        
        # Setup Redis connection
        if redis:
            try:
                redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/1')  # Use DB 1 for rate limiting
                self.redis_client = redis.from_url(redis_url)
                self.redis_client.ping()
                self.logger.info("Redis rate limiter initialized")
            except Exception as e:
                self.logger.warning(f"Redis unavailable for rate limiting: {e}")
        
        # Setup Flask-Limiter if available
        if Limiter and self.redis_client:
            self.limiter = Limiter(
                app,
                key_func=self._get_limiter_key,
                storage_uri=os.environ.get('REDIS_URL', 'redis://localhost:6379/1'),
                default_limits=["1000 per hour", "60 per minute"]
            )
        else:
            self.limiter = None
    
    def _get_limiter_key(self) -> str:
        """Get rate limiting key based on user or IP"""
        # Try to get user ID first
        user_id = getattr(g, 'user_id', None) or request.headers.get('X-User-ID')
        if user_id:
            return f"user:{user_id}"
        
        # Fall back to IP address
        return f"ip:{get_remote_address()}"
    
    def is_rate_limited(self, key: str, limit: int, window: int) -> bool:
        """Check if key is rate limited"""
        if not self.redis_client:
            return False  # No rate limiting if Redis unavailable
        
        try:
            current_time = int(time.time())
            window_start = current_time - window
            
            # Clean old entries
            self.redis_client.zremrangebyscore(key, 0, window_start)
            
            # Count current requests
            current_count = self.redis_client.zcard(key)
            
            if current_count >= limit:
                return True
            
            # Add current request
            self.redis_client.zadd(key, {str(current_time): current_time})
            self.redis_client.expire(key, window)
            
            return False
            
        except Exception as e:
            self.logger.error(f"Rate limiting check failed: {e}")
            return False  # Fail open
    
    def apply_rate_limit(self, limit: str = None):
        """Decorator to apply rate limiting to endpoints"""
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                if self.limiter and limit:
                    # Use Flask-Limiter if available
                    try:
                        self.limiter.limit(limit)(func)(*args, **kwargs)
                    except TooManyRequests:
                        return jsonify({
                            'error': 'Rate limit exceeded',
                            'retry_after': 60
                        }), 429
                else:
                    # Manual rate limiting
                    key = self._get_limiter_key()
                    if self.is_rate_limited(key, 60, 60):  # 60 requests per minute
                        return jsonify({
                            'error': 'Rate limit exceeded',
                            'retry_after': 60
                        }), 429
                
                return func(*args, **kwargs)
            return wrapper
        return decorator


class InputValidator:
    """Input validation and sanitization"""
    
    def __init__(self):
        self.logger = logging.getLogger('taaxdog.security')
        self.suspicious_patterns = [re.compile(pattern, re.IGNORECASE) for pattern in SecurityConfig.SUSPICIOUS_PATTERNS]
    
    def validate_input(self, data: Any, field_name: str = "input") -> bool:
        """Validate input data for security threats"""
        if isinstance(data, dict):
            return all(self.validate_input(v, k) for k, v in data.items())
        elif isinstance(data, list):
            return all(self.validate_input(item, field_name) for item in data)
        elif isinstance(data, str):
            return self._validate_string(data, field_name)
        else:
            return True  # Other types are generally safe
    
    def _validate_string(self, text: str, field_name: str) -> bool:
        """Validate string input"""
        # Check for suspicious patterns
        for pattern in self.suspicious_patterns:
            if pattern.search(text):
                self.logger.warning(f"Suspicious pattern detected in {field_name}: {pattern.pattern}")
                return False
        
        # Check for excessively long input
        if len(text) > 10000:  # 10KB limit
            self.logger.warning(f"Oversized input detected in {field_name}: {len(text)} characters")
            return False
        
        return True
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to prevent directory traversal"""
        # Remove directory separators and other dangerous characters
        safe_filename = re.sub(r'[^\w\-_\.]', '', filename)
        
        # Prevent hidden files and relative paths
        if safe_filename.startswith('.') or '..' in safe_filename:
            safe_filename = 'file_' + safe_filename.replace('..', '').replace('.', '_')
        
        # Ensure filename is not empty
        if not safe_filename:
            safe_filename = f"file_{int(time.time())}"
        
        return safe_filename
    
    def validate_file_upload(self, file_data: bytes, filename: str, allowed_types: List[str]) -> Dict[str, Any]:
        """Validate file upload"""
        result = {
            'valid': True,
            'errors': [],
            'sanitized_filename': self.sanitize_filename(filename)
        }
        
        # Check file size (10MB limit)
        if len(file_data) > 10 * 1024 * 1024:
            result['valid'] = False
            result['errors'].append('File too large (max 10MB)')
        
        # Check file type by extension
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        if file_ext not in allowed_types:
            result['valid'] = False
            result['errors'].append(f'File type not allowed: {file_ext}')
        
        # Basic magic number validation for images
        if file_ext in ['jpg', 'jpeg', 'png', 'gif', 'pdf']:
            if not self._validate_file_magic(file_data, file_ext):
                result['valid'] = False
                result['errors'].append('File content does not match extension')
        
        return result
    
    def _validate_file_magic(self, file_data: bytes, file_ext: str) -> bool:
        """Validate file magic numbers"""
        if len(file_data) < 10:
            return False
        
        magic_numbers = {
            'jpg': [b'\xff\xd8\xff'],
            'jpeg': [b'\xff\xd8\xff'],
            'png': [b'\x89\x50\x4e\x47'],
            'gif': [b'\x47\x49\x46\x38'],
            'pdf': [b'\x25\x50\x44\x46']
        }
        
        expected_magics = magic_numbers.get(file_ext, [])
        return any(file_data.startswith(magic) for magic in expected_magics)


class CSRFProtection:
    """CSRF protection implementation"""
    
    def __init__(self):
        self.logger = logging.getLogger('taaxdog.security')
        self.secret = os.environ.get('CSRF_SECRET', secrets.token_urlsafe(32))
    
    def generate_token(self, user_id: str = None) -> str:
        """Generate CSRF token"""
        timestamp = str(int(time.time()))
        user_data = user_id or get_remote_address()
        
        # Create token with timestamp and user data
        token_data = f"{timestamp}:{user_data}"
        token_hash = hashlib.hmac.new(
            self.secret.encode(),
            token_data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        return f"{timestamp}.{token_hash}"
    
    def validate_token(self, token: str, user_id: str = None, max_age: int = 3600) -> bool:
        """Validate CSRF token"""
        if not token or '.' not in token:
            return False
        
        try:
            timestamp_str, token_hash = token.split('.', 1)
            timestamp = int(timestamp_str)
            
            # Check token age
            if time.time() - timestamp > max_age:
                return False
            
            # Verify token
            user_data = user_id or get_remote_address()
            expected_data = f"{timestamp_str}:{user_data}"
            expected_hash = hashlib.hmac.new(
                self.secret.encode(),
                expected_data.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return secrets.compare_digest(token_hash, expected_hash)
            
        except (ValueError, IndexError):
            return False
    
    def require_csrf_token(self, func):
        """Decorator to require CSRF token"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
                token = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token')
                user_id = getattr(g, 'user_id', None)
                
                if not self.validate_token(token, user_id):
                    return jsonify({'error': 'Invalid CSRF token'}), 403
            
            return func(*args, **kwargs)
        return wrapper


class SecurityMiddleware:
    """Main security middleware class"""
    
    def __init__(self, app: Flask = None):
        self.app = app
        self.logger = logging.getLogger('taaxdog.security')
        self.rate_limiter = RateLimiter()
        self.input_validator = InputValidator()
        self.csrf_protection = CSRFProtection()
        
        if app:
            self.init_app(app)
    
    def init_app(self, app: Flask):
        """Initialize security middleware with Flask app"""
        self.app = app
        self.rate_limiter.init_app(app)
        
        # Setup Talisman for security headers
        if Talisman:
            Talisman(
                app,
                force_https=os.environ.get('FORCE_HTTPS', 'true').lower() == 'true',
                strict_transport_security=True,
                content_security_policy={
                    'default-src': "'self'",
                    'script-src': "'self' 'unsafe-inline' https://cdn.jsdelivr.net",
                    'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
                    'font-src': "'self' https://fonts.gstatic.com",
                    'img-src': "'self' data: https:",
                    'connect-src': "'self' https://api.taaxdog.com"
                }
            )
        
        # Register middleware functions
        app.before_request(self.before_request)
        app.after_request(self.after_request)
    
    def before_request(self):
        """Security checks before each request"""
        # Check user agent
        user_agent = request.headers.get('User-Agent', '').lower()
        for blocked_agent in SecurityConfig.BLOCKED_USER_AGENTS:
            if blocked_agent in user_agent:
                self.logger.warning(f"Blocked user agent: {user_agent}")
                abort(403)
        
        # Validate input data
        if request.is_json and request.get_json():
            if not self.input_validator.validate_input(request.get_json()):
                self.logger.warning(f"Malicious input detected from {get_remote_address()}")
                abort(400, "Invalid input data")
        
        # Check for suspicious query parameters
        for param, value in request.args.items():
            if not self.input_validator.validate_input(value, param):
                self.logger.warning(f"Suspicious query parameter: {param}={value}")
                abort(400, "Invalid query parameter")
        
        # Generate request ID for tracking
        g.request_id = secrets.token_urlsafe(16)
        g.start_time = time.time()
    
    def after_request(self, response):
        """Security headers and logging after each request"""
        # Add security headers
        response.headers['X-Request-ID'] = getattr(g, 'request_id', '')
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Log request
        duration = time.time() - getattr(g, 'start_time', time.time())
        self.logger.info(
            f"Request {g.request_id}: {request.method} {request.path} - "
            f"{response.status_code} in {duration:.3f}s"
        )
        
        return response
    
    def require_auth(self, func):
        """Decorator to require authentication"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                return jsonify({'error': 'Authentication required'}), 401
            
            # Extract and validate token (implement according to your auth system)
            token = auth_header.split(' ')[1]
            user_id = self._validate_auth_token(token)
            
            if not user_id:
                return jsonify({'error': 'Invalid or expired token'}), 401
            
            g.user_id = user_id
            return func(*args, **kwargs)
        return wrapper
    
    def _validate_auth_token(self, token: str) -> Optional[str]:
        """Validate authentication token (implement according to your auth system)"""
        # This is a placeholder - implement according to your Firebase auth
        # For now, just return a dummy user ID
        if token and len(token) > 10:
            return "dummy_user_id"
        return None
    
    def require_premium(self, func):
        """Decorator to require premium subscription"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            user_id = getattr(g, 'user_id', None)
            if not user_id:
                return jsonify({'error': 'Authentication required'}), 401
            
            # Check if user has premium subscription
            if not self._check_premium_status(user_id):
                return jsonify({
                    'error': 'Premium subscription required',
                    'upgrade_url': '/upgrade'
                }), 402
            
            return func(*args, **kwargs)
        return wrapper
    
    def _check_premium_status(self, user_id: str) -> bool:
        """Check if user has premium subscription"""
        # This is a placeholder - implement according to your subscription system
        return True  # For now, allow all users


# Global security middleware instance
security_middleware = SecurityMiddleware()


def apply_security(rate_limit: str = None, require_auth: bool = False, require_premium: bool = False, require_csrf: bool = False):
    """Decorator to apply multiple security measures"""
    def decorator(func):
        # Apply decorators in order
        if require_csrf:
            func = security_middleware.csrf_protection.require_csrf_token(func)
        
        if require_premium:
            func = security_middleware.require_premium(func)
        
        if require_auth:
            func = security_middleware.require_auth(func)
        
        if rate_limit:
            func = security_middleware.rate_limiter.apply_rate_limit(rate_limit)(func)
        
        return func
    return decorator 