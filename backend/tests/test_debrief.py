"""
Debrief Portal API Tests - Anonymous Feedback System for Radio Check Beta Testing

Tests cover:
- GET /api/debrief-portal - Standalone HTML page
- POST /api/debrief/submit - Submit anonymous feedback
- GET /api/debrief/submissions - Get all submissions
- GET /api/debrief/summary - Get aggregated statistics
- GET /api/debrief/export/csv - Export CSV
- GET /api/debrief/export/pdf - Export PDF report
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDebriefPortal:
    """Test the standalone HTML portal endpoint"""
    
    def test_debrief_portal_loads(self):
        """GET /api/debrief-portal should return HTML page"""
        response = requests.get(f"{BASE_URL}/api/debrief-portal")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/html" in response.headers.get("content-type", "")
        assert "Debrief" in response.text
        assert "Radio Check" in response.text
        print("PASS: Debrief portal loads correctly")
    
    def test_debrief_portal_contains_all_sections(self):
        """Portal HTML should contain all 6 sections"""
        response = requests.get(f"{BASE_URL}/api/debrief-portal")
        assert response.status_code == 200
        
        # Check for all section titles
        sections = [
            "About You",
            "First Impressions", 
            "AI Companions",
            "Safety & Trust",
            "Support & Resources",
            "Open Feedback"
        ]
        for section in sections:
            assert section in response.text, f"Missing section: {section}"
        print("PASS: All 6 sections present in portal HTML")
    
    def test_debrief_portal_contains_form_elements(self):
        """Portal should have rating buttons, dropdowns, textareas, chips"""
        response = requests.get(f"{BASE_URL}/api/debrief-portal")
        assert response.status_code == 200
        
        # Check for form element types
        assert 'class="rating"' in response.text, "Missing rating buttons"
        assert '<select' in response.text, "Missing dropdown selects"
        assert '<textarea' in response.text, "Missing textareas"
        assert 'class="chips"' in response.text, "Missing persona chips"
        assert 'data-field=' in response.text, "Missing data-field attributes"
        print("PASS: All form element types present")


class TestDebriefSubmission:
    """Test feedback submission endpoint"""
    
    def test_submit_minimal_feedback(self):
        """POST /api/debrief/submit with minimal data"""
        payload = {
            "ease_of_navigation": 4,
            "felt_safe": 5
        }
        response = requests.post(
            f"{BASE_URL}/api/debrief/submit",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "id" in data
        assert data["id"].startswith("debrief_")
        print(f"PASS: Minimal submission created with id: {data['id']}")
    
    def test_submit_full_feedback(self):
        """POST /api/debrief/submit with all fields"""
        unique_id = str(uuid.uuid4())[:8]
        payload = {
            # Section 1 - About You
            "service_branch": "Army",
            "service_length": "4-8 years",
            "time_since_service": "1-3 years",
            # Section 2 - First Impressions
            "how_heard": "Word of mouth",
            "ease_of_navigation": 5,
            "first_impression": f"TEST_{unique_id} - Great first impression",
            "device_used": "Mobile phone",
            # Section 3 - AI Companions
            "personas_used": ["Tommy", "Grace", "Bob"],
            "conversation_natural": 4,
            "ai_understood": 5,
            "ai_response_wrong": "No",
            "ai_response_wrong_detail": None,
            "ai_felt_like_talking_to": "Like talking to a mate",
            "how_felt_after": "Better than before",
            "ai_personality_fit": 4,
            # Section 4 - Safety & Trust
            "felt_safe": 5,
            "felt_private": 5,
            "crisis_overlay_experience": "I didn't see one",
            "would_open_up": 4,
            "trust_with_sensitive": 4,
            # Section 5 - Support & Resources
            "explored_support_pages": "Yes, several",
            "resources_useful": 4,
            "found_what_needed": "Yes, found everything",
            "would_use_again": "Definitely",
            "would_recommend": 5,
            "net_promoter": 9,
            # Section 6 - Open Feedback
            "what_done_well": f"TEST_{unique_id} - AI companions are excellent",
            "what_improve": "More personas would be nice",
            "missing_feature": "Video chat option",
            "anything_else": "Keep up the great work!"
        }
        response = requests.post(
            f"{BASE_URL}/api/debrief/submit",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "Thank you" in data["message"]
        assert "id" in data
        print(f"PASS: Full submission created with id: {data['id']}")
        return data["id"]
    
    def test_submit_with_rating_validation(self):
        """Ratings should be validated (1-5 for most, 0-10 for NPS)"""
        # Valid ratings
        payload = {
            "ease_of_navigation": 5,
            "net_promoter": 10
        }
        response = requests.post(
            f"{BASE_URL}/api/debrief/submit",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        print("PASS: Valid ratings accepted")
    
    def test_submit_with_invalid_rating(self):
        """Invalid ratings should be rejected"""
        payload = {
            "ease_of_navigation": 10  # Max is 5
        }
        response = requests.post(
            f"{BASE_URL}/api/debrief/submit",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        # Pydantic validation should reject this
        assert response.status_code == 422, f"Expected 422 for invalid rating, got {response.status_code}"
        print("PASS: Invalid rating correctly rejected with 422")
    
    def test_submit_with_personas_list(self):
        """personas_used should accept a list of strings"""
        payload = {
            "personas_used": ["Tommy", "Grace", "Frankie", "Bob"],
            "conversation_natural": 4
        }
        response = requests.post(
            f"{BASE_URL}/api/debrief/submit",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 200
        print("PASS: Personas list accepted correctly")


class TestDebriefSubmissions:
    """Test submissions retrieval endpoint"""
    
    def test_get_all_submissions(self):
        """GET /api/debrief/submissions returns list"""
        response = requests.get(f"{BASE_URL}/api/debrief/submissions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "submissions" in data
        assert "total" in data
        assert isinstance(data["submissions"], list)
        assert data["total"] >= 0
        print(f"PASS: Retrieved {data['total']} submissions")
    
    def test_submissions_exclude_mongo_id(self):
        """Submissions should not include MongoDB _id field"""
        response = requests.get(f"{BASE_URL}/api/debrief/submissions")
        assert response.status_code == 200
        data = response.json()
        if data["submissions"]:
            first_submission = data["submissions"][0]
            assert "_id" not in first_submission, "MongoDB _id should be excluded"
            print("PASS: MongoDB _id correctly excluded from response")
        else:
            print("SKIP: No submissions to check _id exclusion")
    
    def test_submissions_have_required_fields(self):
        """Each submission should have id and submitted_at"""
        response = requests.get(f"{BASE_URL}/api/debrief/submissions")
        assert response.status_code == 200
        data = response.json()
        if data["submissions"]:
            for sub in data["submissions"][:3]:  # Check first 3
                assert "id" in sub, "Missing id field"
                assert "submitted_at" in sub, "Missing submitted_at field"
            print("PASS: Submissions have required id and submitted_at fields")
        else:
            print("SKIP: No submissions to verify fields")


class TestDebriefSummary:
    """Test summary statistics endpoint"""
    
    def test_get_summary(self):
        """GET /api/debrief/summary returns aggregated stats"""
        response = requests.get(f"{BASE_URL}/api/debrief/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "total" in data
        assert "averages" in data
        assert "distributions" in data
        print(f"PASS: Summary returned with {data['total']} total responses")
    
    def test_summary_averages_structure(self):
        """Averages should include all numeric rating fields"""
        response = requests.get(f"{BASE_URL}/api/debrief/summary")
        assert response.status_code == 200
        data = response.json()
        
        expected_avg_fields = [
            "ease_of_navigation", "conversation_natural", "ai_understood",
            "ai_personality_fit", "felt_safe", "felt_private", "would_open_up",
            "trust_with_sensitive", "resources_useful", "would_recommend", "net_promoter"
        ]
        for field in expected_avg_fields:
            assert field in data["averages"], f"Missing average field: {field}"
        print("PASS: All expected average fields present")
    
    def test_summary_distributions_structure(self):
        """Distributions should include categorical fields"""
        response = requests.get(f"{BASE_URL}/api/debrief/summary")
        assert response.status_code == 200
        data = response.json()
        
        # personas_used should always be in distributions
        assert "personas_used" in data["distributions"], "Missing personas_used distribution"
        print("PASS: Distributions structure correct")


class TestDebriefExports:
    """Test CSV and PDF export endpoints"""
    
    def test_export_csv(self):
        """GET /api/debrief/export/csv returns CSV file"""
        response = requests.get(f"{BASE_URL}/api/debrief/export/csv")
        # May return 404 if no submissions, or 200 with CSV
        if response.status_code == 404:
            print("SKIP: No submissions to export (404)")
            return
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "text/csv" in response.headers.get("content-type", "")
        assert "attachment" in response.headers.get("content-disposition", "")
        
        # Verify CSV has headers
        csv_content = response.text
        assert "id" in csv_content
        assert "submitted_at" in csv_content
        assert "service_branch" in csv_content
        print("PASS: CSV export working correctly")
    
    def test_export_pdf(self):
        """GET /api/debrief/export/pdf returns PDF file"""
        response = requests.get(f"{BASE_URL}/api/debrief/export/pdf")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        assert "application/pdf" in response.headers.get("content-type", "")
        assert "attachment" in response.headers.get("content-disposition", "")
        
        # Verify it's a valid PDF (starts with %PDF)
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF"
        print("PASS: PDF export working correctly")


class TestDebriefIntegration:
    """Integration tests - submit and verify retrieval"""
    
    def test_submit_and_retrieve(self):
        """Submit feedback and verify it appears in submissions"""
        unique_marker = f"TEST_INTEGRATION_{uuid.uuid4().hex[:8]}"
        
        # Submit
        payload = {
            "what_done_well": unique_marker,
            "ease_of_navigation": 3,
            "felt_safe": 4
        }
        submit_response = requests.post(
            f"{BASE_URL}/api/debrief/submit",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        assert submit_response.status_code == 200
        submission_id = submit_response.json()["id"]
        
        # Retrieve and verify
        get_response = requests.get(f"{BASE_URL}/api/debrief/submissions")
        assert get_response.status_code == 200
        submissions = get_response.json()["submissions"]
        
        # Find our submission
        found = False
        for sub in submissions:
            if sub.get("id") == submission_id:
                found = True
                assert sub["what_done_well"] == unique_marker
                assert sub["ease_of_navigation"] == 3
                assert sub["felt_safe"] == 4
                break
        
        assert found, f"Submitted feedback {submission_id} not found in submissions"
        print(f"PASS: Submit and retrieve integration test passed for {submission_id}")
    
    def test_submit_affects_summary(self):
        """Submit feedback and verify summary updates"""
        # Get initial summary
        initial_response = requests.get(f"{BASE_URL}/api/debrief/summary")
        initial_total = initial_response.json()["total"]
        
        # Submit new feedback
        payload = {
            "ease_of_navigation": 5,
            "felt_safe": 5,
            "net_promoter": 10
        }
        requests.post(
            f"{BASE_URL}/api/debrief/submit",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        # Get updated summary
        updated_response = requests.get(f"{BASE_URL}/api/debrief/summary")
        updated_total = updated_response.json()["total"]
        
        assert updated_total == initial_total + 1, "Summary total should increase by 1"
        print(f"PASS: Summary total updated from {initial_total} to {updated_total}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
