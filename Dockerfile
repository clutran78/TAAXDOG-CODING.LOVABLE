# TAAXDOG Production Dockerfile
# Multi-stage build for optimized production image

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

# Install dependencies for Node.js builds
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app/frontend

# Copy package files
COPY next-frontend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy frontend source
COPY next-frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Python base image
FROM python:3.11-slim AS python-base

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -r taaxdog && useradd -r -g taaxdog taaxdog

# Stage 3: Dependencies
FROM python-base AS deps

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements-production.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-production.txt

# Stage 4: Production image
FROM python-base AS production

# Copy dependencies from deps stage
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Set working directory
WORKDIR /app

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/frontend/out ./frontend/

# Copy backend source code
COPY backend/ ./backend/
COPY database/ ./database/
COPY ai/ ./ai/

# Copy configuration files
COPY production.env .env
COPY gunicorn.conf.py .

# Create necessary directories
RUN mkdir -p logs uploads backend/logs backend/uploads

# Set ownership to non-root user
RUN chown -R taaxdog:taaxdog /app

# Switch to non-root user
USER taaxdog

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health/status || exit 1

# Expose port
EXPOSE 8080

# Default command
CMD ["gunicorn", "--config", "gunicorn.conf.py", "backend.app:app"] 