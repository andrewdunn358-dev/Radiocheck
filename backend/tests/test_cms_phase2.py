"""
CMS Phase 2 API Tests - Podcasts Manager & AI Personas Manager
===============================================================
Tests for:
- Podcasts CRUD (GET, POST, PUT, DELETE, reorder, seed)
- Persona Bios CRUD (GET, PUT, reorder, seed)
- Public endpoints (visible filtering)
- Books regression tests
"""

import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://cms-legacy-cleanup.preview.emergentagent.com"


class TestPodcastsAdmin:
    """Admin Podcasts CRUD tests"""
    
    def test_get_all_podcasts_returns_200(self):
        """GET /api/cms/admin/podcasts - returns list of seeded podcasts"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "podcasts" in data, "Response should contain 'podcasts' key"
        assert isinstance(data["podcasts"], list), "podcasts should be a list"
        assert len(data["podcasts"]) >= 8, f"Expected at least 8 seeded podcasts, got {len(data['podcasts'])}"
        
        # Verify podcast structure
        podcast = data["podcasts"][0]
        assert "id" in podcast, "Podcast should have 'id'"
        assert "title" in podcast, "Podcast should have 'title'"
        assert "host" in podcast, "Podcast should have 'host'"
        assert "description" in podcast, "Podcast should have 'description'"
        assert "visible" in podcast, "Podcast should have 'visible'"
        assert "position" in podcast, "Podcast should have 'position'"
        print(f"✓ Found {len(data['podcasts'])} podcasts")
    
    def test_create_podcast_and_verify(self):
        """POST /api/cms/admin/podcasts - create a new podcast"""
        new_podcast = {
            "title": "TEST_Podcast_Create",
            "host": "Test Host",
            "description": "Test description for podcast creation",
            "url": "https://example.com/test-podcast",
            "coverUrl": "https://example.com/cover.jpg",
            "category": "Test Category",
            "visible": True
        }
        
        response = requests.post(f"{BASE_URL}/api/cms/admin/podcasts", json=new_podcast)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "podcast" in data, "Response should contain 'podcast'"
        assert "id" in data["podcast"], "Created podcast should have 'id'"
        assert data["podcast"]["title"] == new_podcast["title"], "Title should match"
        assert data["podcast"]["host"] == new_podcast["host"], "Host should match"
        
        created_id = data["podcast"]["id"]
        print(f"✓ Created podcast with ID: {created_id}")
        
        # Verify persistence via GET
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        assert get_response.status_code == 200
        podcasts = get_response.json()["podcasts"]
        created_podcast = next((p for p in podcasts if p["id"] == created_id), None)
        assert created_podcast is not None, "Created podcast should be in list"
        assert created_podcast["title"] == new_podcast["title"]
        
        return created_id
    
    def test_update_podcast_and_verify(self):
        """PUT /api/cms/admin/podcasts/{id} - update a podcast"""
        # First create a podcast to update
        new_podcast = {
            "title": "TEST_Podcast_Update",
            "host": "Original Host",
            "description": "Original description",
            "category": "Original Category",
            "visible": True
        }
        create_response = requests.post(f"{BASE_URL}/api/cms/admin/podcasts", json=new_podcast)
        assert create_response.status_code == 200
        podcast_id = create_response.json()["podcast"]["id"]
        
        # Update the podcast
        update_data = {
            "title": "TEST_Podcast_Updated_Title",
            "host": "Updated Host",
            "description": "Updated description"
        }
        update_response = requests.put(f"{BASE_URL}/api/cms/admin/podcasts/{podcast_id}", json=update_data)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify update via GET
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        podcasts = get_response.json()["podcasts"]
        updated_podcast = next((p for p in podcasts if p["id"] == podcast_id), None)
        assert updated_podcast is not None, "Updated podcast should exist"
        assert updated_podcast["title"] == update_data["title"], "Title should be updated"
        assert updated_podcast["host"] == update_data["host"], "Host should be updated"
        print(f"✓ Updated podcast {podcast_id}")
        
        return podcast_id
    
    def test_toggle_podcast_visibility(self):
        """PUT /api/cms/admin/podcasts/{id} - toggle visibility"""
        # Create a visible podcast
        new_podcast = {
            "title": "TEST_Podcast_Visibility",
            "host": "Test Host",
            "description": "Test visibility toggle",
            "visible": True
        }
        create_response = requests.post(f"{BASE_URL}/api/cms/admin/podcasts", json=new_podcast)
        assert create_response.status_code == 200
        podcast_id = create_response.json()["podcast"]["id"]
        
        # Toggle to hidden
        update_response = requests.put(f"{BASE_URL}/api/cms/admin/podcasts/{podcast_id}", json={"visible": False})
        assert update_response.status_code == 200
        
        # Verify it's hidden in admin list
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        podcast = next((p for p in get_response.json()["podcasts"] if p["id"] == podcast_id), None)
        assert podcast is not None, "Podcast should still be in admin list"
        assert podcast["visible"] == False, "Podcast should be hidden"
        
        # Verify it's NOT in public list
        public_response = requests.get(f"{BASE_URL}/api/cms/podcasts")
        public_podcasts = public_response.json()["podcasts"]
        hidden_in_public = next((p for p in public_podcasts if p["id"] == podcast_id), None)
        assert hidden_in_public is None, "Hidden podcast should NOT be in public list"
        print(f"✓ Visibility toggle works for podcast {podcast_id}")
        
        return podcast_id
    
    def test_delete_podcast_and_verify(self):
        """DELETE /api/cms/admin/podcasts/{id} - delete a podcast"""
        # Create a podcast to delete
        new_podcast = {
            "title": "TEST_Podcast_Delete",
            "host": "Delete Host",
            "description": "To be deleted"
        }
        create_response = requests.post(f"{BASE_URL}/api/cms/admin/podcasts", json=new_podcast)
        assert create_response.status_code == 200
        podcast_id = create_response.json()["podcast"]["id"]
        
        # Delete the podcast
        delete_response = requests.delete(f"{BASE_URL}/api/cms/admin/podcasts/{podcast_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        
        # Verify deletion via GET
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        podcasts = get_response.json()["podcasts"]
        deleted_podcast = next((p for p in podcasts if p["id"] == podcast_id), None)
        assert deleted_podcast is None, "Deleted podcast should not exist"
        print(f"✓ Deleted podcast {podcast_id}")
    
    def test_delete_nonexistent_podcast_returns_404(self):
        """DELETE /api/cms/admin/podcasts/{id} - 404 for nonexistent"""
        fake_id = "000000000000000000000000"
        response = requests.delete(f"{BASE_URL}/api/cms/admin/podcasts/{fake_id}")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Delete nonexistent podcast returns 404")
    
    def test_reorder_podcasts(self):
        """POST /api/cms/admin/podcasts/reorder - reorder podcasts"""
        # Get current podcasts
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        podcasts = get_response.json()["podcasts"]
        
        if len(podcasts) < 2:
            pytest.skip("Need at least 2 podcasts to test reorder")
        
        # Reverse the order of first 3 podcasts
        original_ids = [p["id"] for p in podcasts[:3]]
        reversed_ids = list(reversed(original_ids))
        
        # Reorder
        reorder_response = requests.post(f"{BASE_URL}/api/cms/admin/podcasts/reorder", json=reversed_ids)
        assert reorder_response.status_code == 200, f"Expected 200, got {reorder_response.status_code}: {reorder_response.text}"
        
        # Verify new order
        get_response2 = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        new_podcasts = get_response2.json()["podcasts"]
        new_ids = [p["id"] for p in new_podcasts[:3]]
        
        # Check positions were updated
        for i, pid in enumerate(reversed_ids):
            podcast = next((p for p in new_podcasts if p["id"] == pid), None)
            assert podcast is not None
            assert podcast["position"] == i, f"Position should be {i} for podcast {pid}"
        
        print("✓ Reorder podcasts works")
    
    def test_seed_podcasts_fails_when_already_seeded(self):
        """POST /api/cms/admin/podcasts/seed - should fail when already seeded"""
        response = requests.post(f"{BASE_URL}/api/cms/admin/podcasts/seed")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data
        assert "already has" in data["message"].lower() or "delete them first" in data["message"].lower(), \
            f"Expected 'already has' message, got: {data['message']}"
        print(f"✓ Seed podcasts correctly fails: {data['message']}")


class TestPodcastsPublic:
    """Public Podcasts endpoint tests"""
    
    def test_get_public_podcasts_returns_only_visible(self):
        """GET /api/cms/podcasts - returns only visible podcasts"""
        response = requests.get(f"{BASE_URL}/api/cms/podcasts")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "podcasts" in data
        
        # All returned podcasts should be visible
        for podcast in data["podcasts"]:
            assert podcast.get("visible", True) == True, f"Public endpoint should only return visible podcasts"
        
        print(f"✓ Public endpoint returns {len(data['podcasts'])} visible podcasts")


class TestPersonaBiosAdmin:
    """Admin Persona Bios CRUD tests"""
    
    def test_get_all_persona_bios_returns_200(self):
        """GET /api/cms/admin/persona-bios - returns list of 20 personas"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/persona-bios")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "personas" in data, "Response should contain 'personas' key"
        assert isinstance(data["personas"], list), "personas should be a list"
        assert len(data["personas"]) >= 20, f"Expected at least 20 personas, got {len(data['personas'])}"
        
        # Verify persona structure
        persona = data["personas"][0]
        assert "id" in persona, "Persona should have 'id'"
        assert "persona_id" in persona, "Persona should have 'persona_id'"
        assert "name" in persona, "Persona should have 'name'"
        assert "description" in persona, "Persona should have 'description'"
        assert "visible" in persona, "Persona should have 'visible'"
        assert "position" in persona, "Persona should have 'position'"
        print(f"✓ Found {len(data['personas'])} personas")
    
    def test_update_persona_bio_and_description(self):
        """PUT /api/cms/admin/persona-bios/{id} - update bio and description"""
        # Get first persona
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/persona-bios")
        personas = get_response.json()["personas"]
        persona_id = personas[0]["id"]
        original_bio = personas[0].get("bio", "")
        
        # Update bio and description
        update_data = {
            "bio": f"TEST_Updated bio at {time.time()}",
            "description": "TEST_Updated description"
        }
        update_response = requests.put(f"{BASE_URL}/api/cms/admin/persona-bios/{persona_id}", json=update_data)
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}: {update_response.text}"
        
        # Verify update
        get_response2 = requests.get(f"{BASE_URL}/api/cms/admin/persona-bios")
        updated_persona = next((p for p in get_response2.json()["personas"] if p["id"] == persona_id), None)
        assert updated_persona is not None
        assert updated_persona["bio"] == update_data["bio"], "Bio should be updated"
        assert updated_persona["description"] == update_data["description"], "Description should be updated"
        print(f"✓ Updated persona bio for {persona_id}")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/cms/admin/persona-bios/{persona_id}", json={"bio": original_bio, "description": personas[0].get("description", "")})
    
    def test_toggle_persona_visibility(self):
        """PUT /api/cms/admin/persona-bios/{id} - toggle visibility"""
        # Get a persona (use last one to avoid affecting main personas)
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/persona-bios")
        personas = get_response.json()["personas"]
        persona = personas[-1]  # Use last persona
        persona_id = persona["id"]
        original_visible = persona.get("visible", True)
        
        # Toggle visibility
        new_visible = not original_visible
        update_response = requests.put(f"{BASE_URL}/api/cms/admin/persona-bios/{persona_id}", json={"visible": new_visible})
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify in admin list
        get_response2 = requests.get(f"{BASE_URL}/api/cms/admin/persona-bios")
        updated_persona = next((p for p in get_response2.json()["personas"] if p["id"] == persona_id), None)
        assert updated_persona is not None
        assert updated_persona["visible"] == new_visible, f"Visibility should be {new_visible}"
        print(f"✓ Toggled visibility for persona {persona_id} to {new_visible}")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/cms/admin/persona-bios/{persona_id}", json={"visible": original_visible})
    
    def test_update_nonexistent_persona_returns_404(self):
        """PUT /api/cms/admin/persona-bios/{id} - 404 for nonexistent"""
        fake_id = "000000000000000000000000"
        response = requests.put(f"{BASE_URL}/api/cms/admin/persona-bios/{fake_id}", json={"bio": "test"})
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Update nonexistent persona returns 404")
    
    def test_reorder_personas(self):
        """POST /api/cms/admin/persona-bios/reorder - reorder personas"""
        # Get current personas
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/persona-bios")
        personas = get_response.json()["personas"]
        
        if len(personas) < 2:
            pytest.skip("Need at least 2 personas to test reorder")
        
        # Swap first two personas
        original_ids = [p["id"] for p in personas[:2]]
        swapped_ids = [original_ids[1], original_ids[0]]
        
        # Reorder
        reorder_response = requests.post(f"{BASE_URL}/api/cms/admin/persona-bios/reorder", json=swapped_ids)
        assert reorder_response.status_code == 200, f"Expected 200, got {reorder_response.status_code}: {reorder_response.text}"
        
        # Verify positions were updated
        get_response2 = requests.get(f"{BASE_URL}/api/cms/admin/persona-bios")
        new_personas = get_response2.json()["personas"]
        
        for i, pid in enumerate(swapped_ids):
            persona = next((p for p in new_personas if p["id"] == pid), None)
            assert persona is not None
            assert persona["position"] == i, f"Position should be {i} for persona {pid}"
        
        print("✓ Reorder personas works")
        
        # Restore original order
        requests.post(f"{BASE_URL}/api/cms/admin/persona-bios/reorder", json=original_ids)
    
    def test_seed_personas_fails_when_already_seeded(self):
        """POST /api/cms/admin/persona-bios/seed - should fail when already seeded"""
        response = requests.post(f"{BASE_URL}/api/cms/admin/persona-bios/seed")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "message" in data
        assert "already has" in data["message"].lower() or "clear first" in data["message"].lower(), \
            f"Expected 'already has' message, got: {data['message']}"
        print(f"✓ Seed personas correctly fails: {data['message']}")


class TestPersonaBiosPublic:
    """Public Persona Bios endpoint tests"""
    
    def test_get_public_persona_bios_returns_only_visible(self):
        """GET /api/cms/persona-bios - returns only visible personas"""
        response = requests.get(f"{BASE_URL}/api/cms/persona-bios")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "personas" in data
        
        # All returned personas should be visible (or visible not explicitly false)
        for persona in data["personas"]:
            visible = persona.get("visible", True)
            assert visible != False, f"Public endpoint should only return visible personas"
        
        print(f"✓ Public endpoint returns {len(data['personas'])} visible personas")


class TestBooksRegression:
    """Regression tests for existing Books CRUD"""
    
    def test_get_admin_books_returns_200(self):
        """GET /api/cms/admin/books - existing books CRUD still works"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/books")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "books" in data
        assert isinstance(data["books"], list)
        assert len(data["books"]) >= 25, f"Expected at least 25 seeded books, got {len(data['books'])}"
        
        # Verify book structure
        book = data["books"][0]
        assert "id" in book
        assert "title" in book
        assert "author" in book
        print(f"✓ Books admin endpoint returns {len(data['books'])} books")
    
    def test_get_public_books_returns_200(self):
        """GET /api/cms/books - existing books public endpoint still works"""
        response = requests.get(f"{BASE_URL}/api/cms/books")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "books" in data
        assert isinstance(data["books"], list)
        
        # All returned books should be visible
        for book in data["books"]:
            assert book.get("visible", True) == True
        
        print(f"✓ Books public endpoint returns {len(data['books'])} visible books")
    
    def test_create_book_still_works(self):
        """POST /api/cms/admin/books - create book still works"""
        new_book = {
            "title": "TEST_Book_Regression",
            "author": "Test Author",
            "description": "Regression test book",
            "rating": 4.5,
            "category": "Test",
            "format": "both",
            "visible": True
        }
        
        response = requests.post(f"{BASE_URL}/api/cms/admin/books", json=new_book)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "book" in data
        book_id = data["book"]["id"]
        print(f"✓ Created book {book_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/cms/admin/books/{book_id}")
    
    def test_update_book_still_works(self):
        """PUT /api/cms/admin/books/{id} - update book still works"""
        # Create a book
        new_book = {
            "title": "TEST_Book_Update_Regression",
            "author": "Original Author",
            "description": "Original description"
        }
        create_response = requests.post(f"{BASE_URL}/api/cms/admin/books", json=new_book)
        book_id = create_response.json()["book"]["id"]
        
        # Update
        update_response = requests.put(f"{BASE_URL}/api/cms/admin/books/{book_id}", json={"title": "Updated Title"})
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        print(f"✓ Updated book {book_id}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/cms/admin/books/{book_id}")
    
    def test_delete_book_still_works(self):
        """DELETE /api/cms/admin/books/{id} - delete book still works"""
        # Create a book
        new_book = {
            "title": "TEST_Book_Delete_Regression",
            "author": "Delete Author",
            "description": "To be deleted"
        }
        create_response = requests.post(f"{BASE_URL}/api/cms/admin/books", json=new_book)
        book_id = create_response.json()["book"]["id"]
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/cms/admin/books/{book_id}")
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        print(f"✓ Deleted book {book_id}")


class TestCleanup:
    """Cleanup test data created during tests"""
    
    def test_cleanup_test_podcasts(self):
        """Remove TEST_ prefixed podcasts"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/podcasts")
        if response.status_code == 200:
            podcasts = response.json()["podcasts"]
            deleted = 0
            for podcast in podcasts:
                if podcast.get("title", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/cms/admin/podcasts/{podcast['id']}")
                    deleted += 1
            print(f"✓ Cleaned up {deleted} test podcasts")
    
    def test_cleanup_test_books(self):
        """Remove TEST_ prefixed books"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/books")
        if response.status_code == 200:
            books = response.json()["books"]
            deleted = 0
            for book in books:
                if book.get("title", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/cms/admin/books/{book['id']}")
                    deleted += 1
            print(f"✓ Cleaned up {deleted} test books")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
