"""
TAAXDOG Security Configuration
Centralized security settings for production environment
"""

import os
from typing import Dict, List, Any
from dataclasses import dataclass

@dataclass
class SecurityConfig:
    """Security configuration settings"""
    
    # Authentication settings
    JWT_SECRET_KEY: str = os.environ.get('JWT_SECRET_KEY', 'change-this-in-production')
    JWT_ACCESS_TOKEN_EXPIRES: int = int(os.environ.get('JWT_ACCESS_TOKEN_EXPIRES', 3600))  # 1 hour
    JWT_REFRESH_TOKEN_EXPIRES: int = int(os.environ.get('JWT_REFRESH_TOKEN_EXPIRES', 2592000))  # 30 days
    
    # Rate limiting settings
    RATE_LIMIT_ENABLED: bool = os.environ.get('ENABLE_RATE_LIMITING', 'true').lower() == 'true'
    RATE_LIMIT_STORAGE_URL: str = os.environ.get('REDIS_URL', 'redis://localhost:6379/1')
    RATE_LIMIT_ANONYMOUS: str = os.environ.get('RATE_LIMIT_ANONYMOUS', '60 per minute')
    RATE_LIMIT_AUTHENTICATED: str = os.environ.get('RATE_LIMIT_AUTHENTICATED', '200 per minute')
    RATE_LIMIT_PREMIUM: str = os.environ.get('RATE_LIMIT_PREMIUM', '500 per minute')
    
    # CSRF protection
    CSRF_ENABLED: bool = os.environ.get('ENABLE_CSRF_PROTECTION', 'true').lower() == 'true'
    CSRF_SECRET_KEY: str = os.environ.get('CSRF_SECRET_KEY', 'change-this-csrf-key')
    CSRF_TOKEN_TIMEOUT: int = int(os.environ.get('CSRF_TOKEN_TIMEOUT', 3600))
    
    # Security headers
    SECURITY_HEADERS_ENABLED: bool = os.environ.get('ENABLE_SECURITY_HEADERS', 'true').lower() == 'true'
    HSTS_MAX_AGE: int = int(os.environ.get('HSTS_MAX_AGE', 31536000))  # 1 year
    
    # CORS settings
    CORS_ORIGINS: List[str] = os.environ.get(
        'CORS_ORIGINS', 
        'https://taaxdog.com,https://www.taaxdog.com,https://app.taaxdog.com'
    ).split(',')
    CORS_METHODS: List[str] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    CORS_ALLOW_HEADERS: List[str] = ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID']
    
    # Session security
    SESSION_COOKIE_SECURE: bool = os.environ.get('SESSION_COOKIE_SECURE', 'true').lower() == 'true'
    SESSION_COOKIE_HTTPONLY: bool = os.environ.get('SESSION_COOKIE_HTTPONLY', 'true').lower() == 'true'
    SESSION_COOKIE_SAMESITE: str = os.environ.get('SESSION_COOKIE_SAMESITE', 'Strict')
    
    # IP whitelist for admin endpoints
    ADMIN_IP_WHITELIST: List[str] = os.environ.get('ADMIN_IP_WHITELIST', '').split(',') if os.environ.get('ADMIN_IP_WHITELIST') else []
    
    # Blocked user agents (security scanners, malicious bots)
    BLOCKED_USER_AGENTS: List[str] = [
        'sqlmap', 'nmap', 'nikto', 'w3af', 'acunetix', 'netsparker',
        'masscan', 'zmap', 'burpsuite', 'dirbuster', 'gobuster',
        'wfuzz', 'dirb', 'hydra', 'medusa', 'ncrack'
    ]
    
    # Suspicious patterns for request filtering
    SUSPICIOUS_PATTERNS: List[str] = [
        r'<script[^>]*>.*?</script>',  # XSS attempts
        r'javascript:',               # JavaScript protocol
        r'data:text/html',           # Data URI XSS
        r'vbscript:',                # VBScript protocol
        r'on\w+\s*=',                # Event handlers
        r'(union|select|insert|update|delete|drop|create|alter)\s+',  # SQL injection
        r'(\||&|;|\$\(|\`)',         # Command injection
        r'\.\./',                    # Directory traversal
        r'file://',                  # File protocol
        r'php://filter',             # PHP filter
        r'data://',                  # Data protocol
        r'gopher://',                # Gopher protocol
        r'ldap://',                  # LDAP protocol
        r'dict://',                  # Dict protocol
    ]
    
    # Content Security Policy
    CSP_POLICY: Dict[str, str] = {
        'default-src': "'self'",
        'script-src': "'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com",
        'style-src': "'self' 'unsafe-inline' https://fonts.googleapis.com",
        'font-src': "'self' https://fonts.gstatic.com",
        'img-src': "'self' data: https:",
        'connect-src': "'self' https://api.taaxdog.com https://identitytoolkit.googleapis.com https://*.firebaseapp.com https://*.basiq.io",
        'frame-ancestors': "'none'",
        'base-uri': "'self'",
        'form-action': "'self'",
        'upgrade-insecure-requests': "",
    }
    
    # File upload security
    MAX_CONTENT_LENGTH: int = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16MB
    ALLOWED_EXTENSIONS: List[str] = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'txt', 'csv', 'xlsx']
    UPLOAD_SCAN_ENABLED: bool = os.environ.get('ENABLE_UPLOAD_SCANNING', 'true').lower() == 'true'
    
    # Logging and monitoring
    SECURITY_LOG_LEVEL: str = os.environ.get('SECURITY_LOG_LEVEL', 'INFO')
    LOG_SECURITY_EVENTS: bool = os.environ.get('LOG_SECURITY_EVENTS', 'true').lower() == 'true'
    SECURITY_WEBHOOK_URL: str = os.environ.get('SECURITY_WEBHOOK_URL', '')
    SECURITY_ALERT_EMAIL: str = os.environ.get('SECURITY_ALERT_EMAIL', '')
    
    # Australian compliance settings
    DATA_RETENTION_DAYS: int = int(os.environ.get('DATA_RETENTION_DAYS', 2555))  # 7 years for ATO
    PRIVACY_POLICY_URL: str = os.environ.get('PRIVACY_POLICY_URL', 'https://taaxdog.com/privacy')
    TERMS_SERVICE_URL: str = os.environ.get('TERMS_SERVICE_URL', 'https://taaxdog.com/terms')
    
    # Performance settings
    CACHE_TIMEOUT: int = int(os.environ.get('CACHE_TIMEOUT', 3600))
    DATABASE_POOL_SIZE: int = int(os.environ.get('DATABASE_POOL_SIZE', 20))
    DATABASE_MAX_OVERFLOW: int = int(os.environ.get('DATABASE_MAX_OVERFLOW', 30))
    
    def get_security_headers(self) -> Dict[str, str]:
        """Get security headers for HTTP responses"""
        headers = {}
        
        if self.SECURITY_HEADERS_ENABLED:
            headers.update({
                'Strict-Transport-Security': f'max-age={self.HSTS_MAX_AGE}; includeSubDomains',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Content-Security-Policy': self._format_csp_policy(),
                'X-Permitted-Cross-Domain-Policies': 'none',
                'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
            })
        
        return headers
    
    def _format_csp_policy(self) -> str:
        """Format CSP policy as string"""
        return '; '.join(f"{key} {value}" for key, value in self.CSP_POLICY.items())
    
    def get_cors_config(self) -> Dict[str, Any]:
        """Get CORS configuration"""
        return {
            'origins': self.CORS_ORIGINS,
            'methods': self.CORS_METHODS,
            'allow_headers': self.CORS_ALLOW_HEADERS,
            'supports_credentials': True,
            'max_age': 3600,
        }
    
    def is_admin_ip(self, ip: str) -> bool:
        """Check if IP is in admin whitelist"""
        if not self.ADMIN_IP_WHITELIST:
            return True  # No whitelist configured, allow all
        return ip in self.ADMIN_IP_WHITELIST
    
    def is_blocked_user_agent(self, user_agent: str) -> bool:
        """Check if user agent is blocked"""
        if not user_agent:
            return False
        
        user_agent_lower = user_agent.lower()
        return any(blocked in user_agent_lower for blocked in self.BLOCKED_USER_AGENTS)
    
    def validate_file_upload(self, filename: str, content_length: int) -> tuple[bool, str]:
        """Validate file upload based on security rules"""
        # Check file size
        if content_length > self.MAX_CONTENT_LENGTH:
            return False, f"File size exceeds maximum allowed size of {self.MAX_CONTENT_LENGTH} bytes"
        
        # Check file extension
        if '.' not in filename:
            return False, "File must have an extension"
        
        file_ext = filename.rsplit('.', 1)[1].lower()
        if file_ext not in self.ALLOWED_EXTENSIONS:
            return False, f"File extension '{file_ext}' not allowed. Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}"
        
        # Check for suspicious patterns in filename
        import re
        for pattern in self.SUSPICIOUS_PATTERNS[:5]:  # Check first few patterns
            if re.search(pattern, filename, re.IGNORECASE):
                return False, "Filename contains suspicious patterns"
        
        return True, "Valid file"

# Global security configuration instance
security_config = SecurityConfig()

# Export commonly used settings
SECURITY_HEADERS = security_config.get_security_headers()
CORS_CONFIG = security_config.get_cors_config()
CSP_POLICY = security_config._format_csp_policy()

# Environment validation
def validate_production_config():
    """Validate critical production configuration"""
    required_vars = [
        'SECRET_KEY',
        'JWT_SECRET_KEY', 
        'FIREBASE_PROJECT_ID',
        'DATABASE_URL'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.environ.get(var) or os.environ.get(var) in ['change-this', 'your-secret-key']:
            missing_vars.append(var)
    
    if missing_vars:
        raise ValueError(
            f"Missing or default values for critical environment variables: {', '.join(missing_vars)}. "
            f"These must be set with secure values in production."
        )
    
    # Validate security settings
    if security_config.JWT_SECRET_KEY == 'change-this-in-production':
        raise ValueError("JWT_SECRET_KEY must be changed from default value")
    
    if security_config.CSRF_SECRET_KEY == 'change-this-csrf-key':
        raise ValueError("CSRF_SECRET_KEY must be changed from default value")
    
    print("✅ Security configuration validation passed")

if __name__ == "__main__":
    validate_production_config() 