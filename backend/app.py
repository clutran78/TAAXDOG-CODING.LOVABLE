import os
import sys
from flask import Flask, send_from_directory, render_template, g, request, jsonify, Response
from flask_cors import CORS
from dotenv import load_dotenv
import logging
import time
import uuid
from flask_restx import Api
from typing import Dict, Any, Optional, Tuple, Union
from datetime import datetime

# Add project root and source directories to Python path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, 'src'))
sys.path.insert(0, os.path.join(project_root, 'backend'))
sys.path.insert(0, os.path.join(project_root, 'database'))

# Load environment variables from project root
load_dotenv(os.path.join(project_root, '.env'))

# Import custom types
try:
    from utils.types import JSON, APIResponse, ExtendedRequest
except ImportError:
    # Fallback type definitions
    JSON = Dict[str, Any]
    APIResponse = Tuple[JSON, int]
    ExtendedRequest = Any

# Import production components
try:
    from config.production_config import config_manager, config
    from monitoring.performance_monitor import performance_monitor, user_analytics
    from middleware.security_middleware import security_middleware
    import sentry_sdk
    from sentry_sdk.integrations.flask import FlaskIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
except ImportError as e:
    print(f"Warning: Some production components not available: {e}")
    config = None
    performance_monitor = None
    user_analytics = None
    security_middleware = None

# --- Flask App Setup ---
app = Flask(__name__, template_folder='../frontend', static_folder='../frontend')
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')

# Production configuration
if config:
    app.config.update({
        'SECRET_KEY': config.secret_key,
        'DEBUG': config.debug,
        'TESTING': config.testing,
        'MAX_CONTENT_LENGTH': 16 * 1024 * 1024,  # 16MB max upload
        'UPLOAD_FOLDER': os.path.join(os.path.dirname(__file__), 'uploads'),
        'SESSION_COOKIE_SECURE': True,
        'SESSION_COOKIE_HTTPONLY': True,
        'SESSION_COOKIE_SAMESITE': 'Lax',
        'PERMANENT_SESSION_LIFETIME': 3600,  # 1 hour
    })
else:
    # Development fallback
    app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')

# Optionally, create the folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Initialize Sentry for error tracking
sentry_dsn = os.environ.get('SENTRY_DSN')
if sentry_dsn:
    sentry_logging = LoggingIntegration(
        level=logging.INFO,
        event_level=logging.ERROR
    )
    
    sentry_sdk.init(
        dsn=sentry_dsn,
        integrations=[
            FlaskIntegration(transaction_style='endpoint'),
            sentry_logging,
        ],
        traces_sample_rate=0.1,  # Capture 10% of transactions for performance monitoring
        environment=os.environ.get('FLASK_ENV', 'production'),
        release=os.environ.get('APP_VERSION', '1.0.0'),
    )

# CORS configuration
if config:
    cors_config = config_manager.get_cors_config()
    CORS(app, **cors_config)
else:
    CORS(app, origins='*')

# Initialize security middleware
if security_middleware:
    security_middleware.init_app(app)

# --- Flask-RESTX API ---
api = Api(
    app,
    version='1.0',
    title='TAXXDOG API',
    description='API documentation for TAXXDOG backend',
    doc='/doc'
)

# --- Logging Setup ---
LOG_DIR = os.path.join(os.path.dirname(__file__), 'logs')
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)
LOG_FILE = os.path.join(LOG_DIR, 'app.log')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(name)s %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --- Initialize BASIQ Integration ---
try:
    from config.basiq_config import init_basiq_config
    from integrations.basiq_client import init_basiq_client
    from tasks.basiq_sync import init_basiq_scheduler
    
    # Initialize BASIQ configuration
    basiq_config = init_basiq_config(app)
    
    # Initialize BASIQ client
    basiq_client = init_basiq_client(app)
    
    # Initialize BASIQ sync scheduler (if not in testing mode)
    if not app.config.get('TESTING', False):
        basiq_scheduler = init_basiq_scheduler()
        logger.info("✅ BASIQ integration initialized successfully")
    else:
        logger.info("ℹ️ BASIQ scheduler disabled in testing mode")
        
except ImportError as e:
    logger.warning(f"⚠️ BASIQ integration not available: {e}")
except Exception as e:
    logger.error(f"❌ Failed to initialize BASIQ integration: {e}")

# --- Initialize Subaccount Manager ---
try:
    from services.subaccount_manager import init_subaccount_manager
    
    # Initialize subaccount manager
    subaccount_manager = init_subaccount_manager(app)
    logger.info("✅ Subaccount manager initialized successfully")
        
except ImportError as e:
    logger.warning(f"⚠️ Subaccount manager not available: {e}")
except Exception as e:
    logger.error(f"❌ Failed to initialize subaccount manager: {e}")

# --- Initialize Automated Transfer Engine ---
try:
    from services.transfer_engine import init_transfer_engine
    from services.income_detector import init_income_detector
    
    # Initialize transfer engine
    transfer_engine = init_transfer_engine(app)
    
    # Initialize income detector
    income_detector = init_income_detector(app)
    
    logger.info("✅ Automated transfer engine initialized successfully")
        
except ImportError as e:
    logger.warning(f"⚠️ Automated transfer engine not available: {e}")
except Exception as e:
    logger.error(f"❌ Failed to initialize automated transfer engine: {e}")

# --- Initialize Transfer Processor (Background Jobs) ---
try:
    from jobs.transfer_processor import run_scheduler_daemon
    
    # Start transfer processor as daemon thread (if not in testing mode)
    if not app.config.get('TESTING', False):
        transfer_scheduler_thread = run_scheduler_daemon()
        logger.info("✅ Transfer processor scheduler started")
    else:
        logger.info("ℹ️ Transfer processor disabled in testing mode")
        
except ImportError as e:
    logger.warning(f"⚠️ Transfer processor not available: {e}")
except Exception as e:
    logger.error(f"❌ Failed to initialize transfer processor: {e}")

# --- Initialize Enhanced Notification and Analytics System ---
try:
    from services.savings_advisor import init_savings_advisor
    from services.savings_analytics import init_savings_analytics
    
    # Initialize savings advisor (Claude-powered recommendations)
    savings_advisor = init_savings_advisor(app)
    
    # Initialize savings analytics (comprehensive analytics engine)
    savings_analytics = init_savings_analytics(app)
    
    logger.info("✅ Enhanced notification and analytics system initialized successfully")
        
except ImportError as e:
    logger.warning(f"⚠️ Enhanced notification system not available: {e}")
except Exception as e:
    logger.error(f"❌ Failed to initialize enhanced notification system: {e}")

# --- Register Blueprints ---
from routes.auth_routes import auth_routes
from routes.user_routes import user_routes
from routes.banking_routes import banking_routes
from routes.receipt_routes import receipt_routes
from routes.financial_routes import financial_routes
from routes.budget_routes import budget_routes  # Import budget prediction routes
from routes.public_routes import public_bp
from routes.health_routes import health_bp  # Import health monitoring routes
from routes.enhanced_health_routes import health_bp as enhanced_health_bp  # Enhanced health monitoring
from routes.feedback_routes import feedback_bp  # User feedback system
from routes.notification_routes import notification_bp  # Notification system
from routes.insights_routes import insights_bp  # Smart insights system
from routes.subscription_routes import subscription_bp  # Subscription management
from routes.reports_routes import reports_bp  # Automated tax reports
from routes.team_routes import team_bp  # Team collaboration
from chatbot import chatbot_bp  # Import the chatbot blueprint

# Import goal transfer routes for direct debit functionality
try:
    from routes.goal_transfers import goal_transfers
    api.add_namespace(goal_transfers)
    logger.info("✅ Goal transfer routes registered")
except ImportError as e:
    logger.warning(f"⚠️ Goal transfer routes not available: {e}")

# Import subaccount routes for goal-specific savings isolation
try:
    from routes.subaccount_routes import subaccount_bp
    app.register_blueprint(subaccount_bp)
    logger.info("✅ Subaccount routes registered")
except ImportError as e:
    logger.warning(f"⚠️ Subaccount routes not available: {e}")

# Import automated transfer routes for savings automation
try:
    from routes.automated_transfers import create_automated_transfers_blueprint
    automated_transfers_bp = create_automated_transfers_blueprint()
    app.register_blueprint(automated_transfers_bp)
    logger.info("✅ Automated transfer routes registered")
except ImportError as e:
    logger.warning(f"⚠️ Automated transfer routes not available: {e}")

# Import enhanced notification and analytics routes
try:
    from routes.enhanced_notifications_routes import register_enhanced_notifications_routes
    enhanced_notifications_bp = register_enhanced_notifications_routes(app)
    logger.info("✅ Enhanced notification and analytics routes registered")
except ImportError as e:
    logger.warning(f"⚠️ Enhanced notification routes not available: {e}")
except Exception as e:
    logger.error(f"❌ Failed to register enhanced notification routes: {e}")

# Import BASIQ admin routes
try:
    from routes.admin_routes import admin_routes
    api.add_namespace(admin_routes)
    logger.info("✅ BASIQ admin routes registered")
except ImportError as e:
    logger.warning(f"⚠️ BASIQ admin routes not available: {e}")

# Import production utilities (with fallback for development)
try:
    from utils.production_utils import logger as prod_logger, error_handler, set_request_context
except ImportError:
    prod_logger = None
    error_handler = None
    def set_request_context(user_id: Optional[str] = None, request_id: Optional[str] = None) -> None: 
        pass

api.add_namespace(auth_routes)
api.add_namespace(banking_routes)

app.register_blueprint(user_routes)
app.register_blueprint(receipt_routes)
app.register_blueprint(financial_routes)
app.register_blueprint(budget_routes)  # Register budget prediction routes
app.register_blueprint(public_bp)
# app.register_blueprint(health_bp, url_prefix='/api')  # Register health monitoring routes - commented out to avoid conflict
app.register_blueprint(enhanced_health_bp, url_prefix='/api', name='enhanced_health')  # Enhanced health monitoring
app.register_blueprint(feedback_bp, url_prefix='/api')  # User feedback system
# app.register_blueprint(notification_bp, url_prefix='/api')  # Notification system - commented out to avoid conflict with enhanced notifications
app.register_blueprint(insights_bp, url_prefix='/api')  # Smart insights system
app.register_blueprint(subscription_bp, url_prefix='/api')  # Subscription management
app.register_blueprint(reports_bp, url_prefix='/api')  # Automated tax reports
app.register_blueprint(team_bp, url_prefix='/api')  # Team collaboration
app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')  # Register chatbot blueprint

# --- Error Handling Helpers (for blueprints to import) ---
def api_error(message: str = "An error occurred", status: int = 500, details: Optional[Any] = None) -> APIResponse:
    """
    Create standardized API error response.
    
    Args:
        message: Error message for the user
        status: HTTP status code
        details: Additional error details
        
    Returns:
        Tuple of (response_dict, status_code)
    """
    logger.error(f"API Error: {message}" + (f" | Details: {details}" if details else ""))
    response: JSON = {"success": False, "error": message}
    if details:
        response["details"] = str(details)
    return response, status

# Type-safe request context helpers
def get_user_id_from_request() -> Optional[str]:
    """Safely extract user_id from request object."""
    return getattr(request, 'user_id', None)

def set_user_id_on_request(user_id: str) -> None:
    """Safely set user_id on request object."""
    setattr(request, 'user_id', user_id)

def get_correlation_id_from_request() -> Optional[str]:
    """Safely extract correlation_id from request object."""
    return getattr(request, 'correlation_id', None)

def set_correlation_id_on_request(correlation_id: str) -> None:
    """Safely set correlation_id on request object."""
    setattr(request, 'correlation_id', correlation_id)

@app.before_request
def before_request() -> None:
    """Set request context and start performance tracking"""
    # Generate request ID if not provided
    request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())
    user_id = request.headers.get('X-User-ID')
    
    # Set request context
    g.request_id = request_id
    g.start_time = time.time()
    g.user_id = user_id
    
    # Start performance monitoring
    if performance_monitor:
        performance_monitor.start_request_tracking(
            request_id=request_id,
            endpoint=request.endpoint or request.path,
            method=request.method,
            user_id=user_id
        )
    
    # Set request context for production logging (if available)
    try:
        set_request_context(
            user_id=user_id,
            request_id=request_id
        )
    except NameError:
        pass  # set_request_context not available


@app.after_request
def after_request(response: Response) -> Response:
    """Complete performance tracking and add security headers"""
    # Complete performance monitoring
    if performance_monitor and hasattr(g, 'request_id'):
        try:
            import psutil
            process = psutil.Process()
            memory_usage = process.memory_percent()
        except:
            memory_usage = None
        
        performance_monitor.end_request_tracking(
            request_id=g.request_id,
            status_code=response.status_code,
            memory_usage=memory_usage
        )
    
    # Add performance headers
    if hasattr(g, 'start_time'):
        duration = time.time() - g.start_time
        response.headers['X-Response-Time'] = f"{duration:.3f}s"
    
    if hasattr(g, 'request_id'):
        response.headers['X-Request-ID'] = g.request_id
    
    # Add security headers (if not already added by security middleware)
    if not security_middleware:
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
    
    return response

@app.errorhandler(Exception)
def handle_exception(e: Exception) -> Tuple[Response, int]:
    """Enhanced error handling with user-friendly messages and monitoring"""
    error_id = str(uuid.uuid4())
    
    try:
        # Track error in performance monitoring
        if performance_monitor:
            try:
                performance_monitor.prometheus_metrics['error_count'].labels(
                    error_type=type(e).__name__
                ).inc()
            except:
                pass
        
        # Use production error handler for user-friendly errors
        if error_handler:
            error_context = error_handler.handle_error(e, context='main_app')
            
            # Log with production logger
            if prod_logger:
                prod_logger.error(
                    f"Unhandled exception in main app: {str(e)}",
                    error_type=type(e).__name__,
                    user_message=error_context.user_message,
                    technical_message=error_context.technical_message,
                    error_id=error_id
                )
            
            # Return user-friendly error response
            response_data: JSON = {
                "success": False,
                "error": error_context.user_message,
                "error_code": error_context.error_code,
                "error_id": error_id,
                "recovery_options": error_context.recovery_options,
                "retry_possible": error_context.retry_possible
            }
            
            if error_context.estimated_fix_time:
                response_data["estimated_fix_time"] = error_context.estimated_fix_time
                
            if error_context.contact_support:
                response_data["contact_support"] = True
            
            return jsonify(response_data), 500
        
        else:
            # Fallback when production error handler not available
            logger.exception(f"Unhandled exception (Error ID: {error_id}): {str(e)}")
            
            # Send to Sentry if available
            if 'sentry_sdk' in globals():
                sentry_sdk.capture_exception(e)
            
            # Determine if it's a user error or server error
            if isinstance(e, (ValueError, TypeError, KeyError)):
                error_message = "Invalid request data"
                status_code = 400
            else:
                error_message = "Internal server error"
                status_code = 500
            
            return jsonify({
                "success": False,
                "error": error_message,
                "error_id": error_id,
                "contact_support": status_code == 500,
                "retry_possible": status_code != 400
            }), status_code
        
    except Exception as fallback_error:
        # Critical fallback - something is very wrong
        logger.critical(f"Critical error in error handler (Error ID: {error_id}): {str(fallback_error)}")
        
        # Last resort error response
        return jsonify({
            "success": False,
            "error": "Critical system error",
            "error_id": error_id,
            "contact_support": True
        }), 500


# Add specific error handlers for common HTTP errors
@app.errorhandler(404)
def not_found(error: Any) -> Tuple[Response, int]:
    """Handle 404 errors"""
    return jsonify({
        "success": False,
        "error": "Endpoint not found",
        "available_endpoints": [
            "/api/health/status",
            "/api/auth/",
            "/api/receipts/",
            "/api/financial/",
            "/api/feedback/"
        ]
    }), 404


@app.errorhandler(429)
def rate_limit_exceeded(error: Any) -> Tuple[Response, int]:
    """Handle rate limit errors"""
    return jsonify({
        "success": False,
        "error": "Rate limit exceeded",
        "message": "Too many requests. Please try again later.",
        "retry_after": getattr(error, 'retry_after', 60)
    }), 429


@app.errorhandler(413)
def payload_too_large(error: Any) -> Tuple[Response, int]:
    """Handle payload too large errors"""
    return jsonify({
        "success": False,
        "error": "File too large",
        "message": "Maximum file size is 16MB",
        "max_size_mb": 16
    }), 413

# --- Static and HTML Routes ---
@app.route('/')
def index() -> str:
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/login')
def login_page() -> str:
    """Serve the login page"""
    return render_template('login.html')

@app.route('/register')
def register_page() -> str:
    """Serve the registration page"""
    return render_template('register.html')

@app.route('/firebase-config.js')
def serve_firebase_config() -> Response:
    """Serve Firebase configuration as JavaScript"""
    config_path = os.path.join(app.root_path, '..', 'static', 'firebase-config.js')
    return send_from_directory(os.path.dirname(config_path), 'firebase-config.js', mimetype='application/javascript')

@app.route('/<path:filename>')
def serve_static(filename: str) -> Response:
    """Serve static files"""
    static_folder = app.static_folder or os.path.join(app.root_path, 'static')
    return send_from_directory(static_folder, filename)

@app.route('/test')
def test_server() -> JSON:
    """Test endpoint to verify server is running"""
    return {
        "status": "Server is running",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }

if __name__ == "__main__":
    port = int(os.environ.get('FLASK_RUN_PORT', 8080))
    host = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    app.run(debug=True, host=host, port=port, threaded=True)