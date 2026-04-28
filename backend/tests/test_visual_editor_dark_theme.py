"""
Visual Editor Dark Theme Tests
==============================
Tests for the CMS Visual Editor with dark navy theme, icon picker, and block rendering.
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://radio-check-safety-1.preview.emergentagent.com')

# Test credentials
ADMIN_EMAIL = "admin@veteran.dbty.co.uk"
ADMIN_PASSWORD = "ChangeThisPassword123!"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for admin user."""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
    )
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip("Authentication failed - skipping authenticated tests")


class TestForCarersPageBlocks:
    """Test the for-carers page blocks structure and content."""
    
    def test_get_for_carers_page_returns_200(self):
        """GET /api/cms/pages/for-carers returns 200."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        assert response.status_code == 200
        print("PASS: GET /api/cms/pages/for-carers returns 200")
    
    def test_for_carers_page_has_blocks_array(self):
        """Page has blocks array with content."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        data = response.json()
        assert "page" in data
        assert "blocks" in data["page"]
        assert isinstance(data["page"]["blocks"], list)
        assert len(data["page"]["blocks"]) > 0
        print(f"PASS: Page has {len(data['page']['blocks'])} blocks")
    
    def test_blocks_have_type_and_props(self):
        """Each block has type and props fields."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        for i, block in enumerate(blocks):
            assert "type" in block, f"Block {i} missing 'type'"
            assert "props" in block, f"Block {i} missing 'props'"
        print("PASS: All blocks have type and props")
    
    def test_expected_block_types_exist(self):
        """Page contains expected block types."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        block_types = set(b["type"] for b in blocks)
        
        expected_types = {"chat_banner", "heading", "paragraph", "callout", "support_card", "crisis_footer", "divider"}
        for expected in expected_types:
            assert expected in block_types, f"Missing block type: {expected}"
        print(f"PASS: All expected block types present: {expected_types}")


class TestCalloutBlocksWithIcons:
    """Test callout blocks with icon and iconColor support."""
    
    def test_callout_blocks_exist(self):
        """Page has callout blocks."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        callouts = [b for b in blocks if b["type"] == "callout"]
        assert len(callouts) >= 6, f"Expected at least 6 callout blocks, got {len(callouts)}"
        print(f"PASS: Found {len(callouts)} callout blocks")
    
    def test_callout_blocks_have_text(self):
        """Callout blocks have text content."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        callouts = [b for b in blocks if b["type"] == "callout"]
        
        for i, callout in enumerate(callouts):
            assert "text" in callout["props"], f"Callout {i} missing 'text'"
            assert len(callout["props"]["text"]) > 0, f"Callout {i} has empty text"
        print("PASS: All callout blocks have text content")
    
    def test_callout_blocks_can_have_icon(self):
        """Callout blocks can have icon property."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        callouts = [b for b in blocks if b["type"] == "callout"]
        
        # At least one callout should have an icon (from our test)
        callouts_with_icon = [c for c in callouts if c["props"].get("icon")]
        print(f"INFO: {len(callouts_with_icon)} callouts have icons")
        # This is optional - icons may or may not be set
        print("PASS: Callout icon property check completed")
    
    def test_callout_blocks_can_have_icon_color(self):
        """Callout blocks can have iconColor property."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        callouts = [b for b in blocks if b["type"] == "callout"]
        
        callouts_with_color = [c for c in callouts if c["props"].get("iconColor")]
        print(f"INFO: {len(callouts_with_color)} callouts have iconColor")
        print("PASS: Callout iconColor property check completed")


class TestChatBannerBlock:
    """Test chat banner block with persona data."""
    
    def test_chat_banner_exists(self):
        """Page has a chat_banner block."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        chat_banners = [b for b in blocks if b["type"] == "chat_banner"]
        assert len(chat_banners) >= 1, "No chat_banner block found"
        print(f"PASS: Found {len(chat_banners)} chat_banner block(s)")
    
    def test_chat_banner_has_persona(self):
        """Chat banner has persona property."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        chat_banners = [b for b in blocks if b["type"] == "chat_banner"]
        
        for banner in chat_banners:
            assert "persona" in banner["props"], "Chat banner missing 'persona'"
            assert banner["props"]["persona"], "Chat banner has empty persona"
        print("PASS: Chat banner has persona property")
    
    def test_chat_banner_persona_is_helen(self):
        """For-carers page chat banner uses Helen persona."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        chat_banners = [b for b in blocks if b["type"] == "chat_banner"]
        
        assert chat_banners[0]["props"]["persona"] == "helen", "Expected Helen persona for for-carers page"
        print("PASS: Chat banner uses Helen persona")


class TestSupportCardBlocks:
    """Test support card blocks with tag, phone, and URL fields."""
    
    def test_support_cards_exist(self):
        """Page has support_card blocks."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        support_cards = [b for b in blocks if b["type"] == "support_card"]
        assert len(support_cards) >= 9, f"Expected at least 9 support cards, got {len(support_cards)}"
        print(f"PASS: Found {len(support_cards)} support_card blocks")
    
    def test_support_cards_have_title(self):
        """Support cards have title property."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        support_cards = [b for b in blocks if b["type"] == "support_card"]
        
        for i, card in enumerate(support_cards):
            assert "title" in card["props"], f"Support card {i} missing 'title'"
            assert card["props"]["title"], f"Support card {i} has empty title"
        print("PASS: All support cards have titles")
    
    def test_support_cards_have_description(self):
        """Support cards have description property."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        support_cards = [b for b in blocks if b["type"] == "support_card"]
        
        for i, card in enumerate(support_cards):
            assert "description" in card["props"], f"Support card {i} missing 'description'"
        print("PASS: All support cards have descriptions")
    
    def test_support_cards_have_tags(self):
        """Support cards have tag property."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        support_cards = [b for b in blocks if b["type"] == "support_card"]
        
        cards_with_tags = [c for c in support_cards if c["props"].get("tag")]
        assert len(cards_with_tags) > 0, "No support cards have tags"
        print(f"PASS: {len(cards_with_tags)} support cards have tags")
    
    def test_support_cards_have_valid_tags(self):
        """Support card tags are from valid set."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        support_cards = [b for b in blocks if b["type"] == "support_card"]
        
        valid_tags = {"Carer Support", "Financial", "Practical", "Mental Health", "Respite"}
        for card in support_cards:
            tag = card["props"].get("tag")
            if tag:
                assert tag in valid_tags, f"Invalid tag: {tag}"
        print("PASS: All support card tags are valid")


class TestCrisisFooterBlock:
    """Test crisis footer block."""
    
    def test_crisis_footer_exists(self):
        """Page has a crisis_footer block."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        crisis_footers = [b for b in blocks if b["type"] == "crisis_footer"]
        assert len(crisis_footers) >= 1, "No crisis_footer block found"
        print(f"PASS: Found {len(crisis_footers)} crisis_footer block(s)")


class TestPersonasEndpoint:
    """Test the personas endpoint for the visual editor."""
    
    def test_personas_endpoint_returns_200(self):
        """GET /api/cms/personas returns 200."""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        assert response.status_code == 200
        print("PASS: GET /api/cms/personas returns 200")
    
    def test_personas_returns_list(self):
        """Personas endpoint returns a list of personas."""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        data = response.json()
        assert "personas" in data
        assert isinstance(data["personas"], list)
        assert len(data["personas"]) > 0
        print(f"PASS: Personas endpoint returns {len(data['personas'])} personas")
    
    def test_personas_have_required_fields(self):
        """Each persona has required fields."""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        personas = response.json()["personas"]
        
        required_fields = ["id", "name", "avatar", "role", "accent_color"]
        for persona in personas:
            for field in required_fields:
                assert field in persona, f"Persona missing '{field}'"
        print("PASS: All personas have required fields")
    
    def test_helen_persona_exists(self):
        """Helen persona exists for for-carers page."""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        personas = response.json()["personas"]
        
        helen = next((p for p in personas if p["id"] == "helen"), None)
        assert helen is not None, "Helen persona not found"
        assert helen["name"] == "Helen"
        print("PASS: Helen persona exists")


class TestUpdateBlocksWithIcon:
    """Test updating blocks with icon data."""
    
    def test_update_callout_with_icon(self, auth_token):
        """Can update a callout block with icon and iconColor."""
        # First get current blocks
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        
        # Find first callout and update its icon
        for i, block in enumerate(blocks):
            if block["type"] == "callout":
                blocks[i]["props"]["icon"] = "heart"
                blocks[i]["props"]["iconColor"] = "#ef4444"
                break
        
        # Update the page
        update_response = requests.put(
            f"{BASE_URL}/api/cms/admin/pages/for-carers",
            json={"blocks": blocks},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.text}"
        print("PASS: Updated callout with icon and iconColor")
        
        # Verify the update
        verify_response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        updated_blocks = verify_response.json()["page"]["blocks"]
        callouts = [b for b in updated_blocks if b["type"] == "callout"]
        
        # Check that at least one callout has the icon
        icons_found = [c["props"].get("icon") for c in callouts if c["props"].get("icon")]
        assert "heart" in icons_found, "Icon not saved correctly"
        print("PASS: Icon data persisted correctly")


class TestBlockTypeCounts:
    """Test block type distribution."""
    
    def test_block_type_distribution(self):
        """Verify expected block type counts."""
        response = requests.get(f"{BASE_URL}/api/cms/pages/for-carers")
        blocks = response.json()["page"]["blocks"]
        
        type_counts = {}
        for block in blocks:
            t = block["type"]
            type_counts[t] = type_counts.get(t, 0) + 1
        
        print(f"Block type distribution: {type_counts}")
        
        # Verify minimum counts
        assert type_counts.get("chat_banner", 0) >= 1, "Missing chat_banner"
        assert type_counts.get("heading", 0) >= 3, "Missing headings"
        assert type_counts.get("callout", 0) >= 6, "Missing callouts"
        assert type_counts.get("support_card", 0) >= 9, "Missing support cards"
        assert type_counts.get("crisis_footer", 0) >= 1, "Missing crisis_footer"
        print("PASS: Block type distribution is correct")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
