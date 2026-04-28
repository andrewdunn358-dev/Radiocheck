"""
CMS Pages API Tests - Phase 1 Proof of Concept
===============================================
Tests for the CMS Page Manager endpoints:
- Admin endpoints: GET/POST/PUT/DELETE pages, status toggle
- Public endpoints: GET published pages
- Regression: Books and Podcasts still work
"""

import pytest
import requests
import os
import time

# Use the public URL from environment
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', 'https://radio-check-safety-1.preview.emergentagent.com').rstrip('/')


class TestPagesAdminList:
    """Test GET /api/cms/admin/pages - list all pages"""
    
    def test_admin_list_pages_returns_200(self):
        """Admin endpoint returns list of seeded pages"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "pages" in data, "Response should contain 'pages' key"
        pages = data["pages"]
        
        # Should have at least 3 seeded pages
        assert len(pages) >= 3, f"Expected at least 3 pages, got {len(pages)}"
        
        # Verify page structure
        for page in pages:
            assert "id" in page, "Page should have 'id'"
            assert "title" in page, "Page should have 'title'"
            assert "slug" in page, "Page should have 'slug'"
            assert "status" in page, "Page should have 'status'"
            assert "is_system_page" in page, "Page should have 'is_system_page'"
        
        print(f"✓ Admin list pages returned {len(pages)} pages")
    
    def test_admin_list_pages_excludes_content(self):
        """Admin list endpoint should not include full content for performance"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        assert response.status_code == 200
        
        data = response.json()
        pages = data["pages"]
        
        # Content should be excluded from list view
        for page in pages:
            assert "content" not in page, "List view should not include content"
        
        print("✓ Admin list pages correctly excludes content")


class TestPagesAdminGetSingle:
    """Test GET /api/cms/admin/pages/{slug} - get single page with content"""
    
    def test_get_about_page_returns_full_content(self):
        """GET /api/cms/admin/pages/about returns full page with HTML content"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages/about")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "page" in data, "Response should contain 'page' key"
        page = data["page"]
        
        # Verify structure
        assert page["slug"] == "about", f"Expected slug 'about', got {page['slug']}"
        assert page["title"] == "About Radio Check", f"Expected title 'About Radio Check', got {page['title']}"
        assert "content" in page, "Page should have 'content'"
        assert len(page["content"]) > 100, "Content should have substantial HTML"
        assert "<h2>" in page["content"], "Content should contain HTML tags"
        
        print(f"✓ About page returned with {len(page['content'])} chars of content")
    
    def test_get_criminal_justice_page_has_linked_persona(self):
        """GET /api/cms/admin/pages/criminal-justice returns page with linked_persona='rachel'"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages/criminal-justice")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        page = data["page"]
        
        assert page["slug"] == "criminal-justice"
        assert page["linked_persona"] == "rachel", f"Expected linked_persona 'rachel', got {page.get('linked_persona')}"
        assert page["is_system_page"] == False, "criminal-justice should not be a system page"
        
        print("✓ Criminal justice page has linked_persona='rachel'")
    
    def test_get_privacy_policy_is_system_page(self):
        """GET /api/cms/admin/pages/privacy-policy returns page with is_system_page=true"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages/privacy-policy")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        page = data["page"]
        
        assert page["slug"] == "privacy-policy"
        assert page["is_system_page"] == True, f"Expected is_system_page=True, got {page.get('is_system_page')}"
        
        print("✓ Privacy policy page has is_system_page=True")
    
    def test_get_nonexistent_page_returns_404(self):
        """GET /api/cms/admin/pages/nonexistent returns 404"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages/nonexistent-page-xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ Nonexistent page returns 404")


class TestPagesPublic:
    """Test public page endpoints"""
    
    def test_public_get_about_page(self):
        """GET /api/cms/pages/about returns published page content"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/about")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "page" in data
        page = data["page"]
        
        assert page["slug"] == "about"
        assert page["status"] == "published"
        assert "content" in page
        
        print("✓ Public about page returned successfully")
    
    def test_public_get_criminal_justice_page(self):
        """GET /api/cms/pages/criminal-justice returns published page"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/criminal-justice")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        page = data["page"]
        
        assert page["slug"] == "criminal-justice"
        assert page["status"] == "published"
        
        print("✓ Public criminal-justice page returned successfully")


class TestPagesCreate:
    """Test POST /api/cms/admin/pages - create new page"""
    
    def test_create_page_success(self):
        """Create a new page with title, slug, content"""
        payload = {
            "title": "TEST Page Creation",
            "slug": "test-page-creation",
            "content": "<h1>Test Content</h1><p>This is a test page.</p>",
            "status": "draft"
        }
        
        response = requests.post(f"{BASE_URL}/api/cms/admin/pages", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "page" in data
        assert data["page"]["slug"] == "test-page-creation"
        
        # Verify persistence
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/test-page-creation")
        assert get_response.status_code == 200
        
        print("✓ Page created successfully")
    
    def test_create_page_duplicate_slug_auto_suffix(self):
        """POST with duplicate slug should auto-append suffix"""
        # First create a page
        payload1 = {
            "title": "TEST Duplicate Slug",
            "slug": "test-duplicate-slug",
            "content": "<p>First page</p>",
            "status": "draft"
        }
        requests.post(f"{BASE_URL}/api/cms/admin/pages", json=payload1)
        
        # Try to create another with same slug
        payload2 = {
            "title": "TEST Duplicate Slug 2",
            "slug": "test-duplicate-slug",
            "content": "<p>Second page</p>",
            "status": "draft"
        }
        response = requests.post(f"{BASE_URL}/api/cms/admin/pages", json=payload2)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # Slug should have been modified
        assert data["page"]["slug"] != "test-duplicate-slug", "Slug should have been modified"
        assert "test-duplicate-slug-" in data["page"]["slug"], f"Slug should have suffix, got {data['page']['slug']}"
        
        print(f"✓ Duplicate slug auto-suffixed to: {data['page']['slug']}")


class TestPagesUpdate:
    """Test PUT /api/cms/admin/pages/{slug} - update page"""
    
    def test_update_page_content(self):
        """PUT /api/cms/admin/pages/about updates page content"""
        # First get current content
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/about")
        original_page = get_response.json()["page"]
        
        # Update with new content
        update_payload = {
            "content": original_page["content"] + "\n<!-- Updated by test -->"
        }
        
        response = requests.put(f"{BASE_URL}/api/cms/admin/pages/about", json=update_payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify update persisted
        verify_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/about")
        updated_page = verify_response.json()["page"]
        assert "<!-- Updated by test -->" in updated_page["content"]
        
        # Restore original content
        requests.put(f"{BASE_URL}/api/cms/admin/pages/about", json={"content": original_page["content"]})
        
        print("✓ Page content updated successfully")


class TestPagesStatusToggle:
    """Test PUT /api/cms/admin/pages/{slug}/status - toggle status"""
    
    def test_toggle_status_published_to_draft(self):
        """Toggle about page from published to draft"""
        # First verify it's published
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/about")
        original_status = get_response.json()["page"]["status"]
        
        # Toggle status
        response = requests.put(f"{BASE_URL}/api/cms/admin/pages/about/status")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        new_status = data.get("status")
        
        # Verify status changed
        if original_status == "published":
            assert new_status == "draft", f"Expected 'draft', got {new_status}"
        else:
            assert new_status == "published", f"Expected 'published', got {new_status}"
        
        print(f"✓ Status toggled from {original_status} to {new_status}")
        
        # Return the new status for next test
        return new_status
    
    def test_unpublished_page_returns_404_on_public_endpoint(self):
        """After unpublishing, public endpoint should return 404"""
        # First ensure page is unpublished (draft)
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/about")
        current_status = get_response.json()["page"]["status"]
        
        if current_status == "published":
            # Toggle to draft
            requests.put(f"{BASE_URL}/api/cms/admin/pages/about/status")
        
        # Now try public endpoint
        public_response = requests.get(f"{BASE_URL}/api/cms/pages/about")
        assert public_response.status_code == 404, f"Expected 404 for unpublished page, got {public_response.status_code}"
        
        print("✓ Unpublished page returns 404 on public endpoint")
        
        # Restore to published
        requests.put(f"{BASE_URL}/api/cms/admin/pages/about/status")
        
        # Verify restored
        verify_response = requests.get(f"{BASE_URL}/api/cms/pages/about")
        assert verify_response.status_code == 200, "Page should be accessible again after republishing"
        
        print("✓ Page restored to published status")


class TestPagesDelete:
    """Test DELETE /api/cms/admin/pages/{slug}"""
    
    def test_delete_system_page_returns_403(self):
        """DELETE /api/cms/admin/pages/privacy-policy should return 403 (system page)"""
        response = requests.delete(f"{BASE_URL}/api/cms/admin/pages/privacy-policy")
        assert response.status_code == 403, f"Expected 403 for system page, got {response.status_code}: {response.text}"
        
        # Verify page still exists
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/privacy-policy")
        assert get_response.status_code == 200, "System page should still exist"
        
        print("✓ System page deletion correctly blocked with 403")
    
    def test_delete_non_system_page_success(self):
        """DELETE non-system page should succeed"""
        # First create a test page
        payload = {
            "title": "TEST Page To Delete",
            "slug": "test-page-to-delete",
            "content": "<p>This page will be deleted</p>",
            "status": "draft"
        }
        create_response = requests.post(f"{BASE_URL}/api/cms/admin/pages", json=payload)
        assert create_response.status_code == 200
        
        created_slug = create_response.json()["page"]["slug"]
        
        # Delete the page
        delete_response = requests.delete(f"{BASE_URL}/api/cms/admin/pages/{created_slug}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/{created_slug}")
        assert get_response.status_code == 404, "Deleted page should return 404"
        
        print("✓ Non-system page deleted successfully")
    
    def test_delete_nonexistent_page_returns_404(self):
        """DELETE nonexistent page returns 404"""
        response = requests.delete(f"{BASE_URL}/api/cms/admin/pages/nonexistent-page-xyz")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        print("✓ Delete nonexistent page returns 404")


class TestBooksRegression:
    """Regression tests - Books endpoints still work"""
    
    def test_admin_get_books_returns_200(self):
        """GET /api/cms/admin/books still works"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/books")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "books" in data
        
        print(f"✓ Books admin endpoint works - {len(data['books'])} books")
    
    def test_public_get_books_returns_200(self):
        """GET /api/cms/books still works"""
        response = requests.get(f"{BASE_URL}/api/cms/books")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "books" in data
        
        print(f"✓ Books public endpoint works - {len(data['books'])} visible books")


class TestPodcastsRegression:
    """Regression tests - Podcasts endpoints still work"""
    
    def test_admin_get_podcasts_returns_200(self):
        """GET /api/cms/admin/podcasts still works"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "podcasts" in data
        
        print(f"✓ Podcasts admin endpoint works - {len(data['podcasts'])} podcasts")
    
    def test_public_get_podcasts_returns_200(self):
        """GET /api/cms/podcasts still works"""
        response = requests.get(f"{BASE_URL}/api/cms/podcasts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "podcasts" in data
        
        print(f"✓ Podcasts public endpoint works - {len(data['podcasts'])} visible podcasts")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_pages(self):
        """Remove all TEST_ prefixed pages"""
        # Get all pages
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        if response.status_code == 200:
            pages = response.json().get("pages", [])
            deleted = 0
            for page in pages:
                if page.get("title", "").startswith("TEST") or page.get("slug", "").startswith("test-"):
                    delete_response = requests.delete(f"{BASE_URL}/api/cms/admin/pages/{page['slug']}")
                    if delete_response.status_code == 200:
                        deleted += 1
            print(f"✓ Cleaned up {deleted} test pages")
        else:
            print("✓ No cleanup needed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
