# TAAXDOG Receipt Processing Test Suite
# Comprehensive testing framework for receipt processing system

"""
TAAXDOG Receipt Processing Test Suite
====================================

This test suite provides comprehensive testing for the TAAXDOG receipt processing system,
covering all aspects of receipt upload, OCR processing, categorization, and database operations.

Test Categories:
- Unit tests for core functions
- Integration tests for API and database
- End-to-end workflow tests
- Performance and load tests
- Australian tax compliance tests

Usage:
    pytest tests/              # Run all tests
    pytest tests/unit/         # Run unit tests only
    pytest tests/integration/  # Run integration tests only
    pytest tests/e2e/          # Run end-to-end tests only
    pytest tests/performance/  # Run performance tests only
"""

import os
import sys

# Add project root to path for imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

__version__ = "1.0.0"
__author__ = "TAAXDOG Development Team" 