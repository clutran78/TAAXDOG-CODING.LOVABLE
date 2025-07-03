"""
TAAXDOG Enhanced Security Middleware
Prevents HTTP request smuggling, validates requests, and implements security headers
"""

import os
import time
import hashlib
import secrets
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Tuple
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

# Configure security logging
security_logger = logging.getLogger('taaxdog.security')
security_logger.setLevel(logging.INFO)

class SecurityConfig:
    """Security configuration constants"""
    
    # Request limits to prevent smuggling
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB
    MAX_HEADER_COUNT = 50
    MAX_HEADER_SIZE = 8192
    MAX_URL_LENGTH = 2048
    
    # Rate limiting
    RATE_LIMIT_MAX = 100  # requests per minute
    RATE_LIMIT_WINDOW = 60  # seconds
    
    # Dangerous HTTP methods
    DANGEROUS_METHODS = ['TRACE', 'TRACK', 'CONNECT']
    
    # Blocked user agents
    BLOCKED_USER_AGENTS = [
        'sqlmap', 'nmap', 'nikto', 'w3af', 'acunetix', 'netsparker',
        'masscan', 'zap', 'burp', 'vega'
    ]

# In-memory rate limiting store (use Redis in production)
rate_limit_store: Dict[str, Dict[str, List[float]]] = {}

def get_client_ip() -> str:
    """Get client IP with proxy support"""
    forwarded = request.headers.get('X-Forwarded-For')
    if forwarded:
        return forwarded.split(',')[0].strip()
    
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip
    
    return request.remote_addr or '127.0.0.1'

def log_security_event(event: str, level: str, details: Optional[Dict] = None):
    """Log security events with standardized format"""
    log_data = {
        'timestamp': time.time(),
        'event': event,
        'level': level,
        'ip': get_client_ip(),
        'user_agent': request.headers.get('User-Agent', ''),
        'path': request.path,
        'method': request.method,
        'details': details or {}
    }
    
    if level == 'error':
        security_logger.error(f"Security Event: {event}", extra=log_data)
    elif level == 'warn':
        security_logger.warning(f"Security Event: {event}", extra=log_data)
    else:
        security_logger.info(f"Security Event: {event}", extra=log_data)

def check_rate_limit(ip: str) -> bool:
    """Check if IP is within rate limits"""
    now = time.time()
    window_start = now - SecurityConfig.RATE_LIMIT_WINDOW
    
    if ip not in rate_limit_store:
        rate_limit_store[ip] = {'requests': [now]}
        return True
    
    # Clean old requests
    requests_list = rate_limit_store[ip]['requests']
    filtered_requests = [req_time for req_time in requests_list if req_time > window_start]
    
    if len(filtered_requests) >= SecurityConfig.RATE_LIMIT_MAX:
        return False
    
    filtered_requests.append(now)
    rate_limit_store[ip] = {'requests': filtered_requests}
    return True

def detect_request_smuggling() -> Tuple[bool, str]:
    """
    CRITICAL: Detect HTTP request smuggling attempts
    Returns (is_smuggling, reason)
    """
    
    # Check for multiple Content-Length headers
    content_length_headers = request.headers.getlist('Content-Length')
    if len(content_length_headers) > 1:
        return True, "Multiple Content-Length headers detected"
    
    # Check for Transfer-Encoding and Content-Length conflict
    transfer_encoding = request.headers.get('Transfer-Encoding')
    content_length = request.headers.get('Content-Length')
    if transfer_encoding and content_length:
        return True, "Transfer-Encoding and Content-Length conflict"
    
    # Check for dangerous HTTP methods
    if request.method in SecurityConfig.DANGEROUS_METHODS:
        return True, f"Dangerous HTTP method: {request.method}"
    
    # Check header count
    if len(request.headers) > SecurityConfig.MAX_HEADER_COUNT:
        return True, f"Too many headers: {len(request.headers)}"
    
    # Check for header injection (CRLF injection)
    for header_name, header_value in request.headers:
        if any(char in str(header_value) for char in ['\r', '\n', '\x00']):
            return True, f"Header injection detected in {header_name}"
        
        # Check header size
        if len(header_name) + len(str(header_value)) > SecurityConfig.MAX_HEADER_SIZE:
            return True, f"Header too large: {header_name}"
    
    # Check for folded headers (deprecated in HTTP/1.1)
    for header_name, header_value in request.headers:
        if str(header_value).startswith(' ') or str(header_value).startswith('\t'):
            return True, f"Folded header detected: {header_name}"
    
    # Check URL length
    if len(request.url) > SecurityConfig.MAX_URL_LENGTH:
        return True, f"URL too long: {len(request.url)}"
    
    # Check for null bytes in URL
    if '\x00' in request.url:
        return True, "Null byte in URL"
    
    return False, ""

def detect_malicious_patterns() -> Tuple[bool, str]:
    """Detect common attack patterns"""
    
    patterns = [
        (r'<script[^>]*>.*?</script>', 'XSS Script tag'),
        (r'javascript:', 'JavaScript protocol'),
        (r'vbscript:', 'VBScript protocol'),
        (r'on\w+\s*=', 'Event handler'),
        (r'(union|select|insert|update|delete|drop)\s+', 'SQL injection'),
        (r'file://', 'File protocol'),
        (r'\.\./|\.\.\/', 'Directory traversal'),
        (r'\x00', 'Null byte'),
        (r'%00', 'URL encoded null byte'),
        (r'(?i)(exec|eval|system|shell_exec)', 'Code execution'),
    ]
    
    # Check URL and query parameters
    test_strings = [
        request.url,
        request.path,
        str(request.args),
        request.headers.get('User-Agent', ''),
        request.headers.get('Referer', '')
    ]
    
    for test_string in test_strings:
        for pattern, description in patterns:
            if re.search(pattern, test_string, re.IGNORECASE):
                return True, f"{description} in {test_string[:100]}"
    
    return False, ""

def validate_request_integrity() -> Tuple[bool, str]:
    """Validate request integrity and structure"""
    
    # Check content length matches actual content
    if request.method in ['POST', 'PUT', 'PATCH']:
        content_length = request.headers.get('Content-Length')
        if content_length:
            try:
                declared_length = int(content_length)
                if hasattr(request, 'content_length') and request.content_length:
                    if declared_length != request.content_length:
                        return False, "Content-Length mismatch"
            except ValueError:
                return False, "Invalid Content-Length header"
    
    # Check for valid Content-Type for POST requests
    if request.method in ['POST', 'PUT', 'PATCH']:
        content_type = request.headers.get('Content-Type', '')
        if not content_type:
            return False, "Missing Content-Type header"
    
    return True, ""

def security_middleware():
    """Main security middleware function"""
    
    # Generate request ID for tracking
    g.request_id = secrets.token_hex(16)
    
    client_ip = get_client_ip()
    user_agent = request.headers.get('User-Agent', '')
    
    # 1. Block malicious user agents
    for blocked_agent in SecurityConfig.BLOCKED_USER_AGENTS:
        if blocked_agent.lower() in user_agent.lower():
            log_security_event(
                'blocked_user_agent', 
                'warn', 
                {'user_agent': user_agent, 'ip': client_ip}
            )
            return jsonify({'error': 'Access denied'}), 403
    
    # 2. Rate limiting
    if not check_rate_limit(client_ip):
        log_security_event(
            'rate_limit_exceeded', 
            'warn', 
            {'ip': client_ip}
        )
        return jsonify({'error': 'Rate limit exceeded'}), 429
    
    # 3. CRITICAL: Detect HTTP request smuggling
    is_smuggling, smuggling_reason = detect_request_smuggling()
    if is_smuggling:
        log_security_event(
            'http_request_smuggling_detected', 
            'error', 
            {
                'reason': smuggling_reason,
                'headers': dict(request.headers),
                'method': request.method,
                'ip': client_ip
            }
        )
        return jsonify({'error': 'Malformed request'}), 400
    
    # 4. Detect malicious patterns
    is_malicious, malicious_reason = detect_malicious_patterns()
    if is_malicious:
        log_security_event(
            'malicious_pattern_detected', 
            'error', 
            {
                'reason': malicious_reason,
                'ip': client_ip
            }
        )
        return jsonify({'error': 'Bad request'}), 400
    
    # 5. Validate request integrity
    is_valid, validation_reason = validate_request_integrity()
    if not is_valid:
        log_security_event(
            'request_integrity_violation', 
            'warn', 
            {
                'reason': validation_reason,
                'ip': client_ip
            }
        )
        return jsonify({'error': 'Invalid request format'}), 400
    
    # Log successful security check
    log_security_event('security_check_passed', 'info')

def add_security_headers(response):
    """Add security headers to response"""
    
    # Prevent HTTP request smuggling
    response.headers['Connection'] = 'close'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    
    # Additional security headers
    response.headers['X-Permitted-Cross-Domain-Policies'] = 'none'
    response.headers['Cross-Origin-Embedder-Policy'] = 'require-corp'
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    response.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
    
    # Request tracking
    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id
    
    # Remove server information
    response.headers.pop('Server', None)
    
    return response

def init_security_middleware(app: Flask):
    """Initialize security middleware for Flask app"""
    
    # Set maximum content length
    app.config['MAX_CONTENT_LENGTH'] = SecurityConfig.MAX_CONTENT_LENGTH
    
    # Add before_request middleware
    app.before_request(security_middleware)
    
    # Add after_request middleware for headers
    app.after_request(add_security_headers)
    
    security_logger.info("Security middleware initialized")

# Decorator for additional endpoint security
def require_security_validation(f):
    """Decorator for endpoints requiring additional security validation"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Additional CSRF protection for sensitive endpoints
        if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            csrf_token = request.headers.get('X-CSRF-Token')
            if not csrf_token:
                log_security_event('missing_csrf_token', 'warn')
                return jsonify({'error': 'CSRF token required'}), 403
        
        return f(*args, **kwargs)
    return decorated_function

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