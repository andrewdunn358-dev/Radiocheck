"""
CMS Visual Editor Backend Tests
================================
Tests for the new visual inline page editor endpoints:
- GET /api/cms/personas - Returns 20 personas with id, name, avatar, role, accent_color
- POST /api/cms/admin/upload-image - Multipart file upload for images
- GET /api/cms/uploads/{filename} - Serve uploaded images
- Existing block API regression tests
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    BASE_URL = "https://buddy-chat-qa.preview.emergentagent.com"


class TestPersonasEndpoint:
    """Tests for GET /api/cms/personas endpoint"""

    def test_personas_endpoint_returns_200(self):
        """Personas endpoint should return 200 OK"""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/cms/personas returns 200")

    def test_personas_returns_20_personas(self):
        """Should return exactly 20 personas"""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        data = response.json()
        assert "personas" in data, "Response should have 'personas' key"
        assert len(data["personas"]) == 20, f"Expected 20 personas, got {len(data['personas'])}"
        print(f"PASS: Returns 20 personas")

    def test_each_persona_has_required_fields(self):
        """Each persona should have id, name, avatar, role, accent_color"""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        data = response.json()
        required_fields = ["id", "name", "avatar", "role", "accent_color"]
        
        for persona in data["personas"]:
            for field in required_fields:
                assert field in persona, f"Persona {persona.get('id', 'unknown')} missing field: {field}"
        print("PASS: All personas have required fields (id, name, avatar, role, accent_color)")

    def test_persona_ids_are_unique(self):
        """All persona IDs should be unique"""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        data = response.json()
        ids = [p["id"] for p in data["personas"]]
        assert len(ids) == len(set(ids)), "Persona IDs should be unique"
        print("PASS: All persona IDs are unique")

    def test_persona_accent_colors_are_valid_hex(self):
        """Accent colors should be valid hex color codes"""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        data = response.json()
        
        for persona in data["personas"]:
            color = persona["accent_color"]
            assert color.startswith("#"), f"Color {color} should start with #"
            assert len(color) == 7, f"Color {color} should be 7 chars (#RRGGBB)"
        print("PASS: All accent_colors are valid hex codes")

    def test_known_personas_exist(self):
        """Check that known personas like tommy, helen exist"""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        data = response.json()
        ids = [p["id"] for p in data["personas"]]
        
        expected_personas = ["tommy", "helen", "bob", "jack", "rita"]
        for pid in expected_personas:
            assert pid in ids, f"Expected persona '{pid}' not found"
        print(f"PASS: Known personas exist: {expected_personas}")


class TestImageUploadEndpoint:
    """Tests for POST /api/cms/admin/upload-image endpoint"""

    def test_upload_valid_png_image(self):
        """Should accept valid PNG image upload"""
        # Create a minimal valid PNG (1x1 pixel transparent)
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 dimensions
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,  # bit depth, color type, etc
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,  # compressed data
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,  # checksum
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,  # IEND chunk
            0xAE, 0x42, 0x60, 0x82                           # IEND CRC
        ])
        
        files = {"file": ("test_image.png", io.BytesIO(png_data), "image/png")}
        response = requests.post(f"{BASE_URL}/api/cms/admin/upload-image", files=files)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain 'url' field"
        assert data["url"].startswith("/api/cms/uploads/"), f"URL should start with /api/cms/uploads/, got {data['url']}"
        print(f"PASS: PNG upload successful, URL: {data['url']}")
        return data["url"]

    def test_upload_valid_jpeg_image(self):
        """Should accept valid JPEG image upload"""
        # Minimal valid JPEG (1x1 pixel red)
        jpeg_data = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
            0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
            0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
            0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
            0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
            0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
            0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
            0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
            0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
            0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
            0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
            0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
            0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
            0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
            0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
            0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
            0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
            0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
            0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
            0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
            0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF1, 0x7E, 0xA9,
            0x00, 0x1F, 0xFF, 0xD9
        ])
        
        files = {"file": ("test_image.jpg", io.BytesIO(jpeg_data), "image/jpeg")}
        response = requests.post(f"{BASE_URL}/api/cms/admin/upload-image", files=files)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "url" in data, "Response should contain 'url' field"
        print(f"PASS: JPEG upload successful, URL: {data['url']}")

    def test_upload_rejects_non_image_file(self):
        """Should reject non-image files with 400"""
        text_data = b"This is not an image file"
        files = {"file": ("test.txt", io.BytesIO(text_data), "text/plain")}
        response = requests.post(f"{BASE_URL}/api/cms/admin/upload-image", files=files)
        
        assert response.status_code == 400, f"Expected 400 for non-image, got {response.status_code}"
        print("PASS: Non-image file rejected with 400")

    def test_upload_rejects_pdf_file(self):
        """Should reject PDF files with 400"""
        pdf_data = b"%PDF-1.4 fake pdf content"
        files = {"file": ("test.pdf", io.BytesIO(pdf_data), "application/pdf")}
        response = requests.post(f"{BASE_URL}/api/cms/admin/upload-image", files=files)
        
        assert response.status_code == 400, f"Expected 400 for PDF, got {response.status_code}"
        print("PASS: PDF file rejected with 400")

    def test_upload_rejects_oversized_file(self):
        """Should reject files over 5MB with 400"""
        # Create a 6MB file (over the 5MB limit)
        large_data = b"x" * (6 * 1024 * 1024)
        files = {"file": ("large.png", io.BytesIO(large_data), "image/png")}
        response = requests.post(f"{BASE_URL}/api/cms/admin/upload-image", files=files)
        
        assert response.status_code == 400, f"Expected 400 for oversized file, got {response.status_code}"
        print("PASS: Oversized file (>5MB) rejected with 400")


class TestServeUploadedImages:
    """Tests for GET /api/cms/uploads/{filename} endpoint"""

    def test_serve_uploaded_image(self):
        """Should serve an uploaded image"""
        # First upload an image
        png_data = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
            0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44,
            0xAE, 0x42, 0x60, 0x82
        ])
        
        files = {"file": ("serve_test.png", io.BytesIO(png_data), "image/png")}
        upload_response = requests.post(f"{BASE_URL}/api/cms/admin/upload-image", files=files)
        assert upload_response.status_code == 200
        
        url = upload_response.json()["url"]
        filename = url.split("/")[-1]
        
        # Now fetch the uploaded image
        serve_response = requests.get(f"{BASE_URL}/api/cms/uploads/{filename}")
        assert serve_response.status_code == 200, f"Expected 200, got {serve_response.status_code}"
        print(f"PASS: Uploaded image served successfully at {url}")

    def test_serve_nonexistent_image_returns_404(self):
        """Should return 404 for non-existent image"""
        response = requests.get(f"{BASE_URL}/api/cms/uploads/nonexistent_image_12345.png")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASS: Non-existent image returns 404")


class TestForCarersPageBlocks:
    """Regression tests for existing for-carers page block API"""

    def test_get_for_carers_page_returns_200(self):
        """GET /api/cms/pages/for-carers should return 200"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/cms/pages/for-carers returns 200")

    def test_for_carers_page_has_blocks_array(self):
        """for-carers page should have blocks array"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        data = response.json()
        assert "page" in data, "Response should have 'page' key"
        assert "blocks" in data["page"], "Page should have 'blocks' field"
        assert isinstance(data["page"]["blocks"], list), "blocks should be a list"
        print(f"PASS: for-carers page has blocks array with {len(data['page']['blocks'])} blocks")

    def test_blocks_have_type_and_props(self):
        """Each block should have type and props fields"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        
        for i, block in enumerate(blocks):
            assert "type" in block, f"Block {i} missing 'type' field"
            assert "props" in block, f"Block {i} missing 'props' field"
        print("PASS: All blocks have type and props fields")

    def test_expected_block_types_exist(self):
        """Should have all expected block types"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        
        block_types = set(b["type"] for b in blocks)
        expected_types = {"chat_banner", "heading", "paragraph", "divider", "callout", "support_card", "crisis_footer"}
        
        for expected in expected_types:
            assert expected in block_types, f"Missing expected block type: {expected}"
        print(f"PASS: All expected block types present: {expected_types}")

    def test_seed_endpoint_works(self):
        """POST /api/cms/admin/pages/for-carers/seed should work"""
        response = requests.post(f"{BASE_URL}/api/cms/admin/pages/for-carers/seed")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "message" in data, "Response should have 'message'"
        print(f"PASS: Seed endpoint works: {data['message']}")

    def test_seed_creates_24_blocks(self):
        """Seed should create page with 24 blocks"""
        # First seed
        requests.post(f"{BASE_URL}/api/cms/admin/pages/for-carers/seed")
        
        # Then verify
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        assert len(blocks) == 24, f"Expected 24 blocks, got {len(blocks)}"
        print("PASS: Seed creates page with 24 blocks")


class TestAdminPagesEndpoint:
    """Tests for admin pages list endpoint"""

    def test_admin_pages_returns_200(self):
        """GET /api/cms/admin/pages should return 200"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("PASS: GET /api/cms/admin/pages returns 200")

    def test_admin_pages_includes_for_carers(self):
        """Admin pages list should include for-carers"""
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        data = response.json()
        slugs = [p["slug"] for p in data["pages"]]
        assert "for-carers" in slugs, "for-carers page should be in admin list"
        print("PASS: Admin pages list includes for-carers")


class TestUpdateForCarersBlocks:
    """Tests for updating for-carers page blocks"""

    def test_update_blocks_via_put(self):
        """PUT /api/cms/admin/pages/for-carers should update blocks"""
        # First get current blocks
        get_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/for-carers")
        original_blocks = get_response.json()["page"]["blocks"]
        
        # Add a test block
        test_blocks = original_blocks + [{"type": "paragraph", "props": {"text": "TEST_BLOCK_FOR_TESTING"}}]
        
        # Update
        put_response = requests.put(
            f"{BASE_URL}/api/cms/admin/pages/for-carers",
            json={"blocks": test_blocks}
        )
        assert put_response.status_code == 200, f"Expected 200, got {put_response.status_code}"
        
        # Verify
        verify_response = requests.get(f"{BASE_URL}/api/cms/admin/pages/for-carers")
        updated_blocks = verify_response.json()["page"]["blocks"]
        assert len(updated_blocks) == len(test_blocks), "Block count should match"
        
        # Restore original
        requests.put(f"{BASE_URL}/api/cms/admin/pages/for-carers", json={"blocks": original_blocks})
        print("PASS: Blocks can be updated via PUT and verified with GET")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
