#!/usr/bin/env python3
"""
UK Veterans Support App Backend API Testing
Tests the peer support registration and admin endpoints
"""

import requests
import json
from datetime import datetime
import uuid

# Backend URL from frontend environment
BACKEND_URL = "https://radio-check-redesign.preview.emergentagent.com/api"

# Test data
TEST_EMAILS = [
    "veteran.test@example.com",
    "john.doe.veteran@gmail.com", 
    "support.seeker@email.co.uk"
]

INVALID_EMAILS = [
    "invalid-email",
    "missing@",
    "@missing-local.com",
    "",
    "spaces in@email.com"
]

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        })
        self.test_results = []
        self.failed_tests = []
        
    def log_test(self, test_name, success, details, response=None):
        """Log test result"""
        result = {
            'test': test_name,
            'success': success,
            'details': details,
            'timestamp': datetime.now().isoformat()
        }
        if response:
            result['status_code'] = response.status_code
            result['response_headers'] = dict(response.headers)
        
        self.test_results.append(result)
        if not success:
            self.failed_tests.append(result)
            
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
        print(f"   Details: {details}")
        if response:
            print(f"   Status Code: {response.status_code}")
        print()

    def test_root_endpoint(self):
        """Test GET /api/ endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "UK Veterans Support" in data["message"]:
                    self.log_test(
                        "Root endpoint", 
                        True, 
                        f"Returns welcome message: {data['message']}", 
                        response
                    )
                else:
                    self.log_test(
                        "Root endpoint", 
                        False, 
                        f"Unexpected response format: {data}", 
                        response
                    )
            else:
                self.log_test(
                    "Root endpoint", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}", 
                    response
                )
        except Exception as e:
            self.log_test("Root endpoint", False, f"Connection error: {str(e)}")

    def test_peer_support_registration_valid(self):
        """Test POST /api/peer-support/register with valid emails"""
        for email in TEST_EMAILS:
            try:
                payload = {"email": email}
                response = self.session.post(
                    f"{BACKEND_URL}/peer-support/register", 
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    required_fields = ['id', 'email', 'timestamp']
                    
                    if all(field in data for field in required_fields):
                        if data['email'] == email:
                            self.log_test(
                                f"Register valid email ({email})", 
                                True, 
                                f"Registration successful with ID: {data['id']}", 
                                response
                            )
                        else:
                            self.log_test(
                                f"Register valid email ({email})", 
                                False, 
                                f"Email mismatch. Sent: {email}, Got: {data['email']}", 
                                response
                            )
                    else:
                        missing = [f for f in required_fields if f not in data]
                        self.log_test(
                            f"Register valid email ({email})", 
                            False, 
                            f"Missing required fields: {missing}", 
                            response
                        )
                else:
                    self.log_test(
                        f"Register valid email ({email})", 
                        False, 
                        f"HTTP {response.status_code}: {response.text}", 
                        response
                    )
            except Exception as e:
                self.log_test(f"Register valid email ({email})", False, f"Error: {str(e)}")

    def test_duplicate_email_registration(self):
        """Test duplicate email registration should return 400"""
        test_email = TEST_EMAILS[0]  # Use first email which should already exist
        
        try:
            payload = {"email": test_email}
            response = self.session.post(
                f"{BACKEND_URL}/peer-support/register", 
                json=payload
            )
            
            if response.status_code == 400:
                data = response.json()
                if "already registered" in data.get("detail", "").lower():
                    self.log_test(
                        "Duplicate email registration", 
                        True, 
                        f"Correctly rejected duplicate: {data['detail']}", 
                        response
                    )
                else:
                    self.log_test(
                        "Duplicate email registration", 
                        False, 
                        f"Wrong error message: {data.get('detail')}", 
                        response
                    )
            else:
                self.log_test(
                    "Duplicate email registration", 
                    False, 
                    f"Expected 400, got {response.status_code}: {response.text}", 
                    response
                )
        except Exception as e:
            self.log_test("Duplicate email registration", False, f"Error: {str(e)}")

    def test_invalid_email_registration(self):
        """Test POST /api/peer-support/register with invalid emails"""
        for invalid_email in INVALID_EMAILS:
            try:
                payload = {"email": invalid_email}
                response = self.session.post(
                    f"{BACKEND_URL}/peer-support/register", 
                    json=payload
                )
                
                if response.status_code == 422:  # FastAPI validation error
                    self.log_test(
                        f"Register invalid email ({invalid_email})", 
                        True, 
                        "Correctly rejected invalid email format", 
                        response
                    )
                elif response.status_code == 400:
                    self.log_test(
                        f"Register invalid email ({invalid_email})", 
                        True, 
                        "Correctly rejected invalid email", 
                        response
                    )
                else:
                    self.log_test(
                        f"Register invalid email ({invalid_email})", 
                        False, 
                        f"Expected 422/400, got {response.status_code}: {response.text}", 
                        response
                    )
            except Exception as e:
                self.log_test(f"Register invalid email ({invalid_email})", False, f"Error: {str(e)}")

    def test_empty_email_registration(self):
        """Test registration with empty/missing email field"""
        test_cases = [
            {},  # Missing email field
            {"email": ""},  # Empty email
            {"email": None},  # Null email
        ]
        
        for i, payload in enumerate(test_cases):
            try:
                response = self.session.post(
                    f"{BACKEND_URL}/peer-support/register", 
                    json=payload
                )
                
                if response.status_code in [400, 422]:
                    self.log_test(
                        f"Empty email test case {i+1}", 
                        True, 
                        f"Correctly rejected empty/missing email", 
                        response
                    )
                else:
                    self.log_test(
                        f"Empty email test case {i+1}", 
                        False, 
                        f"Expected 400/422, got {response.status_code}: {response.text}", 
                        response
                    )
            except Exception as e:
                self.log_test(f"Empty email test case {i+1}", False, f"Error: {str(e)}")

    def test_get_registrations(self):
        """Test GET /api/peer-support/registrations"""
        try:
            response = self.session.get(f"{BACKEND_URL}/peer-support/registrations")
            
            if response.status_code == 200:
                data = response.json()
                
                if isinstance(data, list):
                    if len(data) >= len(TEST_EMAILS):
                        # Check if data is sorted by timestamp (newest first)
                        if len(data) > 1:
                            timestamps = [item['timestamp'] for item in data if 'timestamp' in item]
                            if len(timestamps) > 1:
                                is_sorted = all(
                                    timestamps[i] >= timestamps[i+1] 
                                    for i in range(len(timestamps)-1)
                                )
                                if is_sorted:
                                    self.log_test(
                                        "Get registrations", 
                                        True, 
                                        f"Retrieved {len(data)} registrations, properly sorted by timestamp", 
                                        response
                                    )
                                else:
                                    self.log_test(
                                        "Get registrations", 
                                        False, 
                                        f"Retrieved {len(data)} registrations but not sorted by timestamp", 
                                        response
                                    )
                            else:
                                self.log_test(
                                    "Get registrations", 
                                    True, 
                                    f"Retrieved {len(data)} registrations (sorting not verifiable)", 
                                    response
                                )
                        else:
                            self.log_test(
                                "Get registrations", 
                                True, 
                                f"Retrieved {len(data)} registration (sorting not applicable)", 
                                response
                            )
                    else:
                        self.log_test(
                            "Get registrations", 
                            False, 
                            f"Expected at least {len(TEST_EMAILS)} registrations, got {len(data)}", 
                            response
                        )
                else:
                    self.log_test(
                        "Get registrations", 
                        False, 
                        f"Expected array response, got: {type(data)}", 
                        response
                    )
            else:
                self.log_test(
                    "Get registrations", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}", 
                    response
                )
        except Exception as e:
            self.log_test("Get registrations", False, f"Error: {str(e)}")

    def verify_mongodb_storage(self):
        """Verify that registrations are actually stored in MongoDB"""
        try:
            # Get registrations to verify storage
            response = self.session.get(f"{BACKEND_URL}/peer-support/registrations")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if our test emails are stored
                stored_emails = [reg['email'] for reg in data if 'email' in reg]
                found_emails = [email for email in TEST_EMAILS if email in stored_emails]
                
                if len(found_emails) >= len(TEST_EMAILS):
                    self.log_test(
                        "MongoDB storage verification", 
                        True, 
                        f"All {len(found_emails)} test emails found in database", 
                        response
                    )
                else:
                    self.log_test(
                        "MongoDB storage verification", 
                        False, 
                        f"Only {len(found_emails)}/{len(TEST_EMAILS)} test emails found in database", 
                        response
                    )
            else:
                self.log_test(
                    "MongoDB storage verification", 
                    False, 
                    f"Could not retrieve registrations: HTTP {response.status_code}", 
                    response
                )
        except Exception as e:
            self.log_test("MongoDB storage verification", False, f"Error: {str(e)}")

    def run_all_tests(self):
        """Run all API tests"""
        print("="*70)
        print("UK VETERANS SUPPORT APP - BACKEND API TESTING")
        print("="*70)
        print(f"Testing backend at: {BACKEND_URL}")
        print(f"Test started at: {datetime.now().isoformat()}")
        print()
        
        # Test in logical order
        self.test_root_endpoint()
        self.test_peer_support_registration_valid()
        self.test_duplicate_email_registration()
        self.test_invalid_email_registration()
        self.test_empty_email_registration()
        self.test_get_registrations()
        self.verify_mongodb_storage()
        
        # Print summary
        print("="*70)
        print("TEST SUMMARY")
        print("="*70)
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t['success']])
        failed_tests = len(self.failed_tests)
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if self.failed_tests:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for test in self.failed_tests:
                print(f"  - {test['test']}: {test['details']}")
        else:
            print(f"\n🎉 ALL TESTS PASSED!")
            
        return len(self.failed_tests) == 0

if __name__ == "__main__":
    tester = APITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)