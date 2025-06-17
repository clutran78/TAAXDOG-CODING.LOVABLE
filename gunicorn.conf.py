"""
Gunicorn Configuration for TAAXDOG Production
Optimized for performance, security, and Australian users
"""

import os
import multiprocessing

# Server socket
bind = f"0.0.0.0:{os.environ.get('PORT', 8080)}"
backlog = 2048

# Worker processes
workers = int(os.environ.get('GUNICORN_WORKERS', multiprocessing.cpu_count() * 2 + 1))
worker_class = "gevent"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50

# Restart workers after this many requests to prevent memory leaks
max_requests = 1000
max_requests_jitter = 100

# Timeout settings
timeout = 30
keepalive = 2
graceful_timeout = 30

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = os.environ.get('LOG_LEVEL', 'info').lower()
access_log_format = (
    '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s '
    '"%(f)s" "%(a)s" %(D)s %(p)s'
)

# Process naming
proc_name = 'taaxdog'

# Server mechanics
daemon = False
pidfile = '/tmp/taaxdog.pid'
user = None  # Run as the user specified in Dockerfile
group = None
tmp_upload_dir = None

# SSL (if using HTTPS termination at application level)
keyfile = os.environ.get('SSL_KEYFILE')
certfile = os.environ.get('SSL_CERTFILE')

# Performance tuning for Australian users
preload_app = True  # Load application code before forking workers
sendfile = True     # Use sendfile() for static files

# Worker lifecycle callbacks
def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("Starting TAAXDOG server...")

def on_reload(server):
    """Called to recycle workers during a reload via SIGHUP."""
    server.log.info("Reloading TAAXDOG server...")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info("TAAXDOG server is ready. Listening on: %s", server.address)

def worker_int(worker):
    """Called just after a worker exited on SIGINT or SIGQUIT."""
    worker.log.info("Worker %s interrupted", worker.pid)

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    server.log.info("Worker spawned (pid: %s)", worker.pid)

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info("Worker ready (pid: %s)", worker.pid)

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    worker.log.info("Worker initialized (pid: %s)", worker.pid)

def worker_abort(worker):
    """Called when a worker received the SIGABRT signal."""
    worker.log.info("Worker aborted (pid: %s)", worker.pid)

# Environment-specific settings
if os.environ.get('FLASK_ENV') == 'development':
    # Development settings
    reload = True
    workers = 1
    loglevel = 'debug'
elif os.environ.get('FLASK_ENV') == 'production':
    # Production settings
    preload_app = True
    worker_tmp_dir = '/dev/shm'  # Use tmpfs for better performance
    
    # Enable Prometheus metrics if available
    if os.environ.get('ENABLE_PROMETHEUS', 'true').lower() == 'true':
        def child_exit(server, worker):
            """Clean up Prometheus metrics on worker exit."""
            pass 