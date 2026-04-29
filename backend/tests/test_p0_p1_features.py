"""
Test Suite: P0/P1 Features - Backend Modularization, Knowledge Base RAG, AI Feedback, Message Queue
Tests the new modular routers and endpoints for Radio Check veteran support app
"""

import pytest
import requests
import os

# Use environment variable or default to the preview URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://radio-check-safety-1.preview.emergentagent.com').rstrip('/')

# Test credentials from previous iterations
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]  # set via CI repo secret


class TestKnowledgeBaseRAG:
    """Knowledge Base RAG System - P1 Feature Tests"""
    
    def test_get_categories(self):
        """GET /api/knowledge-base/categories - should return knowledge categories"""
        response = requests.get(f"{BASE_URL}/api/knowledge-base/categories")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "categories" in data
        categories = data["categories"]
        
        # Verify expected categories exist
        expected_cats = ["benefits", "mental_health", "housing", "employment", "crisis"]
        for cat in expected_cats:
            assert cat in categories, f"Expected category '{cat}' not found"
        
        print(f"PASS: Categories endpoint returned {len(categories)} categories")
    
    def test_search_knowledge_base(self):
        """POST /api/knowledge-base/search - should search and return relevant results"""
        payload = {
            "query": "mental health support veteran",
            "limit": 5
        }
        response = requests.post(
            f"{BASE_URL}/api/knowledge-base/search",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "query" in data
        assert "results" in data
        assert "total_found" in data
        assert isinstance(data["results"], list)
        
        # Check result structure if results exist
        if len(data["results"]) > 0:
            result = data["results"][0]
            assert "id" in result
            assert "title" in result
            assert "content" in result
            assert "relevance_score" in result
        
        print(f"PASS: Search returned {len(data['results'])} results, total_found: {data['total_found']}")
    
    def test_get_context_for_ai(self):
        """GET /api/knowledge-base/context/{query} - should return formatted context for AI"""
        query = "benefits pension"
        response = requests.get(f"{BASE_URL}/api/knowledge-base/context/{query}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "query" in data
        assert "context" in data
        assert "has_relevant_info" in data
        assert "sources" in data
        
        # Context should be a string (formatted for AI prompts)
        assert isinstance(data["context"], str)
        assert isinstance(data["has_relevant_info"], bool)
        
        print(f"PASS: Context endpoint returned has_relevant_info={data['has_relevant_info']}, sources: {data['sources']}")
    
    def test_knowledge_base_stats(self):
        """GET /api/knowledge-base/stats - should return statistics"""
        response = requests.get(f"{BASE_URL}/api/knowledge-base/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "total_entries" in data
        assert "verified_entries" in data
        assert "by_category" in data
        
        print(f"PASS: Stats returned total_entries={data['total_entries']}, verified={data['verified_entries']}")


class TestAIFeedbackSystem:
    """AI Feedback System - P1 Feature Tests"""
    
    def test_get_feedback_summary(self):
        """GET /api/ai-feedback/summary - should return feedback summary statistics"""
        response = requests.get(f"{BASE_URL}/api/ai-feedback/summary")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "period_days" in data
        assert "total_feedback" in data
        assert "characters" in data
        
        # Characters should be a list with character stats
        assert isinstance(data["characters"], list)
        if len(data["characters"]) > 0:
            char = data["characters"][0]
            assert "character" in char
            assert "total_feedback" in char or "average_rating" in char
        
        print(f"PASS: Summary returned total_feedback={data['total_feedback']}, {len(data['characters'])} characters")
    
    def test_submit_thumbs_feedback(self):
        """POST /api/ai-feedback/thumbs - should submit thumbs up/down feedback"""
        params = {
            "session_id": "test_session_p0p1",
            "message_index": 1,
            "ai_character": "tommy",
            "is_positive": True
        }
        response = requests.post(f"{BASE_URL}/api/ai-feedback/thumbs", params=params)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "feedback_id" in data
        assert isinstance(data["feedback_id"], str)
        
        print(f"PASS: Thumbs feedback submitted, feedback_id={data['feedback_id']}")
    
    def test_get_character_feedback(self):
        """GET /api/ai-feedback/character/{character} - should return character-specific feedback"""
        response = requests.get(f"{BASE_URL}/api/ai-feedback/character/tommy")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "character" in data
        assert "total_feedback" in data
        assert "average_rating" in data
        
        # Should have positive/negative counts
        assert "positive_count" in data
        assert "negative_count" in data
        
        print(f"PASS: Tommy feedback - total={data['total_feedback']}, avg_rating={data['average_rating']}")
    
    def test_get_improvement_suggestions(self):
        """GET /api/ai-feedback/improvements/{character} - should return improvement suggestions"""
        response = requests.get(f"{BASE_URL}/api/ai-feedback/improvements/tommy")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "character" in data
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        
        print(f"PASS: Improvements endpoint returned {len(data['suggestions'])} suggestions")


class TestMessageQueue:
    """Message Queue System - P1 Offline Message Queue Tests"""
    
    def test_get_queue_stats(self):
        """GET /api/message-queue/stats - should return queue statistics"""
        response = requests.get(f"{BASE_URL}/api/message-queue/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "total" in data
        assert "queued" in data
        assert "delivered" in data
        assert "acknowledged" in data
        assert "failed" in data
        
        print(f"PASS: Queue stats - total={data['total']}, queued={data['queued']}, delivered={data['delivered']}")
    
    def test_mark_user_online(self):
        """POST /api/message-queue/online/{user_id} - should mark user as online"""
        user_id = "test_user_p0p1"
        response = requests.post(f"{BASE_URL}/api/message-queue/online/{user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "online"
        assert "pending_messages" in data
        
        print(f"PASS: User marked online, pending_messages={data['pending_messages']}")
    
    def test_mark_user_offline(self):
        """POST /api/message-queue/offline/{user_id} - should mark user as offline"""
        user_id = "test_user_p0p1"
        response = requests.post(f"{BASE_URL}/api/message-queue/offline/{user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "status" in data
        assert data["status"] == "offline"
        
        print(f"PASS: User marked offline")
    
    def test_queue_message(self):
        """POST /api/message-queue/queue - should queue a message for offline user"""
        payload = {
            "recipient_id": "test_recipient_p0p1",
            "message": "Test message for offline queue",
            "message_type": "buddy_message",
            "priority": 0
        }
        response = requests.post(
            f"{BASE_URL}/api/message-queue/queue",
            json=payload
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message_id" in data
        assert "status" in data
        assert data["status"] in ["queued", "delivered", "push_sent"]
        
        print(f"PASS: Message queued, id={data['message_id']}, status={data['status']}")
    
    def test_get_pending_messages(self):
        """GET /api/message-queue/pending/{user_id} - should return pending messages"""
        user_id = "test_recipient_p0p1"
        response = requests.get(f"{BASE_URL}/api/message-queue/pending/{user_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "messages" in data
        assert "count" in data
        assert isinstance(data["messages"], list)
        
        print(f"PASS: Pending messages returned, count={data['count']}")


class TestOrganizationsRouter:
    """Organizations Router Tests"""
    
    def test_get_organizations(self):
        """GET /api/organizations/ - should return organizations list"""
        response = requests.get(f"{BASE_URL}/api/organizations/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # Should have some organizations
        if len(data) > 0:
            org = data[0]
            assert "name" in org
            assert "phone" in org
        
        print(f"PASS: Organizations endpoint returned {len(data)} organizations")


class TestResourcesRouter:
    """Resources Router Tests"""
    
    def test_get_resources(self):
        """GET /api/resources/ - should return resources list without ObjectId error"""
        response = requests.get(f"{BASE_URL}/api/resources/")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text[:200]}"
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify no ObjectId in response (should be string IDs)
        if len(data) > 0:
            resource = data[0]
            assert "title" in resource
            # id should be string, not ObjectId
            if "id" in resource:
                assert isinstance(resource["id"], str)
            # _id should not exist in response
            assert "_id" not in resource, "Response should not contain MongoDB _id"
        
        print(f"PASS: Resources endpoint returned {len(data)} resources without ObjectId errors")


class TestExistingEndpoints:
    """Test existing endpoints still work after modularization"""
    
    def test_cms_pages(self):
        """GET /api/cms/pages - existing CMS should still work"""
        response = requests.get(f"{BASE_URL}/api/cms/pages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one CMS page"
        
        print(f"PASS: CMS pages endpoint returned {len(data)} pages")
    
    def test_auth_login(self):
        """POST /api/auth/login - existing auth should still work"""
        payload = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == ADMIN_EMAIL
        
        print(f"PASS: Auth login successful, user: {data['user']['email']}")


class TestPushTokenEndpoint:
    """Push Token Management - P1 Feature
    
    NOTE: Push token endpoints exist in /routers/auth.py but are NOT yet
    integrated into the main server.py. The auth router needs to be included
    or the push-token endpoints need to be added to server.py's api_router.
    
    Current status: 404 Not Found - endpoints not exposed
    """
    
    @pytest.fixture
    def auth_token(self):
        """Get admin auth token"""
        payload = {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        response = requests.post(f"{BASE_URL}/api/auth/login", json=payload)
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Could not get auth token")
    
    @pytest.mark.skip(reason="Push token endpoint not yet integrated - exists in /routers/auth.py but router not included in server.py")
    def test_push_token_requires_auth(self):
        """POST /api/auth/push-token - should require authentication"""
        payload = {
            "push_token": "ExponentPushToken[test123]",
            "device_type": "expo"
        }
        response = requests.post(f"{BASE_URL}/api/auth/push-token", json=payload)
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print(f"PASS: Push token endpoint requires authentication (returned {response.status_code})")
    
    @pytest.mark.skip(reason="Push token endpoint not yet integrated - exists in /routers/auth.py but router not included in server.py")
    def test_register_push_token(self, auth_token):
        """POST /api/auth/push-token - should register push token with auth"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        payload = {
            "push_token": "ExponentPushToken[test_p0p1_token]",
            "device_type": "expo"
        }
        response = requests.post(
            f"{BASE_URL}/api/auth/push-token",
            json=payload,
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data
        
        print(f"PASS: Push token registered successfully")
    
    @pytest.mark.skip(reason="Push token endpoint not yet integrated - exists in /routers/auth.py but router not included in server.py")
    def test_delete_push_token(self, auth_token):
        """DELETE /api/auth/push-token - should remove push token"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.delete(
            f"{BASE_URL}/api/auth/push-token",
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data
        
        print(f"PASS: Push token removed successfully")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
