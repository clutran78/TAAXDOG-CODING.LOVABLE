import os
from flask import Flask, send_from_directory, render_template
from flask_cors import CORS
from dotenv import load_dotenv
import logging
from flask_restx import Api

# Load environment variables
load_dotenv()

# --- Flask App Setup ---
app = Flask(__name__, template_folder='../frontend', static_folder='../frontend')
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key')
# Set the upload folder (choose a suitable path)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')

# Optionally, create the folder if it doesn't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

CORS(app, origins='*')

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

# --- Register Blueprints ---
from routes.auth_routes import auth_routes
from routes.user_routes import user_routes
from routes.banking_routes import banking_routes
from routes.receipt_routes import receipt_routes
from routes.financial_routes import financial_routes
from routes.public_routes import public_bp
from chatbot import chatbot_bp  # Import the chatbot blueprint

api.add_namespace(auth_routes)
api.add_namespace(banking_routes)

app.register_blueprint(user_routes)
app.register_blueprint(receipt_routes)
app.register_blueprint(financial_routes)
app.register_blueprint(public_bp)
app.register_blueprint(chatbot_bp, url_prefix='/api/chatbot')  # Register chatbot blueprint

# --- Error Handling Helpers (for blueprints to import) ---
def api_error(message="An error occurred", status=500, details=None):
    logger.error(f"API Error: {message}" + (f" | Details: {details}" if details else ""))
    response = {"success": False, "error": message}
    if details:
        response["details"] = str(details)
    # from flask import jsonify
    # return jsonify(response), status
    return response, status

@app.errorhandler(Exception)
def handle_exception(e):
    logger.exception("Unhandled Exception")
    return api_error("Internal server error", status=500)

# --- Static and HTML Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/register')
def register_page():
    return render_template('register.html')

@app.route('/firebase-config.js')
def serve_firebase_config():
    """
    Serve firebase-config.js from the frontend directory to fix 404 errors
    """
    return send_from_directory(app.static_folder, 'firebase-config.js')

@app.route('/<path:filename>')
def serve_static(filename):
    """
    Serve static files from the frontend directory
    """
    return send_from_directory(app.static_folder, filename)

if __name__ == "__main__":
    port = int(os.environ.get('FLASK_RUN_PORT', 8080))
    host = os.environ.get('FLASK_RUN_HOST', '127.0.0.1')
    app.run(debug=True, host=host, port=port, threaded=True)