"""
TAAXDOG Load Test for CI/CD Pipeline
===================================

Focused load testing for production deployment pipeline
"""

import json
import random
import time
from locust import HttpUser, task, between

class TAAXDOGUser(HttpUser):
    """Simulate basic TAAXDOG user behavior"""
    
    wait_time = between(1, 3)
    
    def on_start(self):
        self.user_id = f"test_user_{random.randint(1000, 9999)}"
    
    @task(10)
    def check_health(self):
        """Health check endpoint"""
        response = self.client.get("/api/health/status")
        if response.status_code != 200:
            print(f"Health check failed: {response.status_code}")
    
    @task(5)
    def upload_receipt(self):
        """Simulate receipt upload"""
        data = {
            "merchant": "Test Merchant",
            "amount": 50.00,
            "date": "2024-01-01"
        }
        headers = {"X-User-ID": self.user_id}
        response = self.client.post("/api/receipts/upload", json=data, headers=headers)
        
    @task(3)
    def get_dashboard(self):
        """Load dashboard data"""
        headers = {"X-User-ID": self.user_id}
        response = self.client.get("/api/financial/dashboard", headers=headers)
    
    @task(2)
    def create_goal(self):
        """Create savings goal"""
        data = {
            "name": f"Test Goal {random.randint(1, 100)}",
            "targetAmount": random.randint(1000, 10000)
        }
        headers = {"X-User-ID": self.user_id}
        response = self.client.post("/api/goals", json=data, headers=headers) 