#!/usr/bin/env python3
"""
TAAXDOG API Testing Script

This script provides a simple way to test the API endpoints of the TAAXDOG web application.
It includes functions to test authentication, user profile, and other API endpoints.
"""

import requests
import json
import argparse
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Default server URL
DEFAULT_SERVER = "http://localhost:8080"

class TaaxdogApiTester:
    """Class to test TAAXDOG API endpoints"""
    
    def __init__(self, server_url=DEFAULT_SERVER):
        """Initialize with server URL"""
        self.server_url = server_url
        self.token = None
    
    def login(self, email, password):
        """Test login and get authentication token"""
        print(f"\n🔑 Testing login with email: {email}")
        
        # This is a mock implementation since we're using Firebase Authentication
        # In a real scenario, you would use Firebase client SDK to authenticate
        # and get the ID token
        print("Note: This is a mock login. In production, use Firebase Authentication.")
        print("For testing purposes, we'll use a direct API call to get a token.")
        
        try:
            # This endpoint might not exist in your actual implementation
            # It's just for demonstration purposes
            response = requests.post(
                f"{self.server_url}/api/auth/login",
                json={"email": email, "password": password}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("token")
                print("✅ Login successful!")
                print(f"Token: {self.token[:10]}...{self.token[-10:] if self.token else ''}")
                return True
            else:
                print(f"❌ Login failed: {response.status_code}")
                print(response.text)
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Error connecting to server: {e}")
            print("If you're using Firebase Authentication, you'll need to get a token manually.")
            self.token = input("Enter your Firebase ID token manually: ")
            return bool(self.token)
    
    def get_user_profile(self):
        """Test getting user profile"""
        print("\n👤 Testing get user profile")
        
        if not self.token:
            print("❌ No authentication token available. Please login first.")
            return False
        
        try:
            response = requests.get(
                f"{self.server_url}/api/users/profile",
                headers={"Authorization": f"Bearer {self.token}"}
            )
            
            print(f"Status code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ User profile retrieved successfully!")
                print(json.dumps(data, indent=2))
                return True
            else:
                print(f"❌ Failed to get user profile: {response.status_code}")
                print(response.text)
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Error connecting to server: {e}")
            return False
    
    def update_user_profile(self, profile_data):
        """Test updating user profile"""
        print("\n✏️ Testing update user profile")
        
        if not self.token:
            print("❌ No authentication token available. Please login first.")
            return False
        
        try:
            response = requests.put(
                f"{self.server_url}/api/users/profile",
                headers={"Authorization": f"Bearer {self.token}"},
                json=profile_data
            )
            
            print(f"Status code: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print("✅ User profile updated successfully!")
                print(json.dumps(data, indent=2))
                return True
            else:
                print(f"❌ Failed to update user profile: {response.status_code}")
                print(response.text)
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Error connecting to server: {e}")
            return False
    
    def verify_server(self):
        """Verify if the server is running"""
        print(f"\n🔍 Checking if server is running at {self.server_url}")
        
        try:
            response = requests.get(f"{self.server_url}/")
            
            if response.status_code == 200:
                print("✅ Server is running!")
                return True
            else:
                print(f"⚠️ Server returned status code: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            print(f"❌ Error connecting to server: {e}")
            print("Make sure the Flask server is running (./run_app.sh)")
            return False

def main():
    """Main function to run the API tests"""
    parser = argparse.ArgumentParser(description="Test TAAXDOG API endpoints")
    parser.add_argument("--server", default=DEFAULT_SERVER, help=f"Server URL (default: {DEFAULT_SERVER})")
    parser.add_argument("--email", help="Email for login test")
    parser.add_argument("--password", help="Password for login test")
    
    args = parser.parse_args()
    
    # Get email and password from arguments or environment variables
    email = args.email or os.environ.get("TEST_EMAIL")
    password = args.password or os.environ.get("TEST_PASSWORD")
    
    tester = TaaxdogApiTester(args.server)
    
    # Verify server is running
    if not tester.verify_server():
        return
    
    # If email and password are provided, test login
    if email and password:
        tester.login(email, password)
        
        # If login successful, test other endpoints
        if tester.token:
            tester.get_user_profile()
            
            # Example profile update
            profile_data = {
                "displayName": "Test User",
                "phoneNumber": "+1234567890"
            }
            tester.update_user_profile(profile_data)
    else:
        print("\n⚠️ No email/password provided. Skipping authentication tests.")
        print("To test authentication, run with:")
        print(f"python {__file__} --email your@email.com --password yourpassword")
        print("Or set TEST_EMAIL and TEST_PASSWORD environment variables.")

if __name__ == "__main__":
    main() 