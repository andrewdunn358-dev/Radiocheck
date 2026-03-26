"""
Batch CMS Migration Tests
=========================
Tests for the 13 newly seeded pages + 3 previously migrated pages (total 16).
Verifies block structure, callout icons, support cards, chat banners, and personas.
"""
import pytest
import requests
import os

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://block-cms-hotfix.preview.emergentagent.com")

# All 16 expected pages
EXPECTED_PAGES = [
    "about", "criminal-justice", "crisis-support", "he-served", "historical-investigations",
    "compensation-schemes", "privacy-policy", "terms-of-service", "commonwealth-veterans",
    "faith-service", "substance-support", "women-veterans", "money-benefits",
    "for-carers", "serious-illness", "recovery-support"
]

# Pages with chat_banner blocks and their expected personas
PAGES_WITH_CHAT_BANNER = {
    "criminal-justice": "doris",
    "crisis-support": "tommy",
    "he-served": "dave",
    "historical-investigations": "james",
    "compensation-schemes": "jack",
    "commonwealth-veterans": "kofi",
    "faith-service": "catherine",
    "substance-support": "sam",
    "women-veterans": "rita",
    "money-benefits": "jack",
    "for-carers": "helen",
    "serious-illness": "reg",
    "recovery-support": "mo",
}

# Valid persona IDs from the system
VALID_PERSONAS = [
    "tommy", "doris", "bob", "margie", "catherine", "sentry", "baz", "jack",
    "penny", "rita", "sam", "dave", "megan", "alex", "kofi", "james", "frankie",
    "mo", "helen", "reg"
]


class TestAdminPagesEndpoint:
    """Test GET /api/cms/admin/pages returns all 16 pages"""
    
    def test_admin_pages_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        assert response.status_code == 200
        print("✓ GET /api/cms/admin/pages returns 200")
    
    def test_admin_pages_returns_16_pages(self):
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        data = response.json()
        pages = data.get("pages", [])
        assert len(pages) == 16, f"Expected 16 pages, got {len(pages)}"
        print(f"✓ Admin pages endpoint returns {len(pages)} pages")
    
    def test_all_expected_pages_exist(self):
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        data = response.json()
        slugs = [p["slug"] for p in data.get("pages", [])]
        
        missing = [s for s in EXPECTED_PAGES if s not in slugs]
        assert len(missing) == 0, f"Missing pages: {missing}"
        print(f"✓ All 16 expected pages exist: {sorted(slugs)}")
    
    def test_all_pages_are_published(self):
        response = requests.get(f"{BASE_URL}/api/cms/admin/pages")
        data = response.json()
        
        draft_pages = [p["slug"] for p in data.get("pages", []) if p.get("status") != "published"]
        assert len(draft_pages) == 0, f"Draft pages found: {draft_pages}"
        print("✓ All 16 pages have status 'published'")


class TestPublicPagesEndpoint:
    """Test GET /api/cms/pages/{slug} for each seeded page"""
    
    @pytest.mark.parametrize("slug", EXPECTED_PAGES)
    def test_page_returns_200(self, slug):
        response = requests.get(f"{BASE_URL}/api/cms/pages/{slug}")
        assert response.status_code == 200, f"Page {slug} returned {response.status_code}"
        print(f"✓ GET /api/cms/pages/{slug} returns 200")
    
    @pytest.mark.parametrize("slug", EXPECTED_PAGES)
    def test_page_has_blocks_array(self, slug):
        response = requests.get(f"{BASE_URL}/api/cms/pages/{slug}")
        data = response.json()
        page = data.get("page", {})
        
        assert "blocks" in page, f"Page {slug} missing 'blocks' field"
        assert isinstance(page["blocks"], list), f"Page {slug} blocks is not a list"
        assert len(page["blocks"]) > 0, f"Page {slug} has no blocks"
        print(f"✓ Page {slug} has {len(page['blocks'])} blocks")


class TestBlockStructure:
    """Test that blocks have correct type and props structure"""
    
    @pytest.mark.parametrize("slug", EXPECTED_PAGES)
    def test_blocks_have_type_and_props(self, slug):
        response = requests.get(f"{BASE_URL}/api/cms/pages/{slug}")
        data = response.json()
        blocks = data.get("page", {}).get("blocks", [])
        
        for i, block in enumerate(blocks):
            assert "type" in block, f"Block {i} in {slug} missing 'type'"
            assert "props" in block, f"Block {i} in {slug} missing 'props'"
            assert isinstance(block["props"], dict), f"Block {i} in {slug} props is not a dict"
        
        print(f"✓ All {len(blocks)} blocks in {slug} have type and props")
    
    def test_valid_block_types_used(self):
        """Verify only valid block types are used across all pages"""
        valid_types = {"heading", "paragraph", "callout", "bullet_list", "support_card", 
                       "chat_banner", "image", "crisis_footer", "divider"}
        
        all_types = set()
        for slug in EXPECTED_PAGES:
            response = requests.get(f"{BASE_URL}/api/cms/pages/{slug}")
            blocks = response.json().get("page", {}).get("blocks", [])
            all_types.update(b["type"] for b in blocks)
        
        invalid = all_types - valid_types
        assert len(invalid) == 0, f"Invalid block types found: {invalid}"
        print(f"✓ All block types are valid: {sorted(all_types)}")


class TestCalloutBlocksWithIcons:
    """Test callout blocks have icon and iconColor props"""
    
    def test_he_served_callouts_have_icons(self):
        """he-served page should have callouts with icons"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/he-served")
        blocks = response.json().get("page", {}).get("blocks", [])
        callouts = [b for b in blocks if b["type"] == "callout"]
        
        assert len(callouts) >= 5, f"Expected at least 5 callouts, got {len(callouts)}"
        
        # Check that callouts have icon and iconColor
        for callout in callouts:
            props = callout.get("props", {})
            assert "icon" in props, f"Callout missing 'icon' prop"
            assert "iconColor" in props, f"Callout missing 'iconColor' prop"
            assert props["icon"], f"Callout has empty icon"
            assert props["iconColor"].startswith("#"), f"iconColor should be hex: {props['iconColor']}"
        
        print(f"✓ he-served has {len(callouts)} callouts with icon and iconColor")
    
    def test_about_callouts_have_icons(self):
        """about page should have callouts with icons"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/about")
        blocks = response.json().get("page", {}).get("blocks", [])
        callouts = [b for b in blocks if b["type"] == "callout"]
        
        assert len(callouts) >= 3, f"Expected at least 3 callouts, got {len(callouts)}"
        
        icons_found = []
        for callout in callouts:
            props = callout.get("props", {})
            if "icon" in props and props["icon"]:
                icons_found.append(props["icon"])
        
        assert len(icons_found) >= 3, f"Expected at least 3 callouts with icons, got {len(icons_found)}"
        print(f"✓ about page has callouts with icons: {icons_found[:5]}")


class TestSupportCardBlocks:
    """Test support_card blocks have required props"""
    
    def test_crisis_support_has_support_cards(self):
        response = requests.get(f"{BASE_URL}/api/cms/pages/crisis-support")
        blocks = response.json().get("page", {}).get("blocks", [])
        cards = [b for b in blocks if b["type"] == "support_card"]
        
        assert len(cards) >= 5, f"Expected at least 5 support cards, got {len(cards)}"
        print(f"✓ crisis-support has {len(cards)} support cards")
    
    def test_support_cards_have_title_and_description(self):
        response = requests.get(f"{BASE_URL}/api/cms/pages/crisis-support")
        blocks = response.json().get("page", {}).get("blocks", [])
        cards = [b for b in blocks if b["type"] == "support_card"]
        
        for card in cards:
            props = card.get("props", {})
            assert "title" in props and props["title"], f"Support card missing title"
            assert "description" in props, f"Support card missing description"
        
        print(f"✓ All {len(cards)} support cards have title and description")
    
    def test_support_cards_have_phone_or_url(self):
        """Support cards should have at least phone or url"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/crisis-support")
        blocks = response.json().get("page", {}).get("blocks", [])
        cards = [b for b in blocks if b["type"] == "support_card"]
        
        cards_with_contact = 0
        for card in cards:
            props = card.get("props", {})
            has_phone = props.get("phone", "").strip() != ""
            has_url = props.get("url", "").strip() != ""
            if has_phone or has_url:
                cards_with_contact += 1
        
        assert cards_with_contact >= len(cards) * 0.8, f"Most cards should have phone or url"
        print(f"✓ {cards_with_contact}/{len(cards)} support cards have phone or url")
    
    def test_support_cards_have_tags(self):
        """Some support cards should have tags"""
        response = requests.get(f"{BASE_URL}/api/cms/pages/crisis-support")
        blocks = response.json().get("page", {}).get("blocks", [])
        cards = [b for b in blocks if b["type"] == "support_card"]
        
        cards_with_tags = [c for c in cards if c.get("props", {}).get("tag")]
        assert len(cards_with_tags) >= 3, f"Expected at least 3 cards with tags"
        
        tags = [c["props"]["tag"] for c in cards_with_tags]
        print(f"✓ Found {len(cards_with_tags)} cards with tags: {set(tags)}")


class TestChatBannerBlocks:
    """Test chat_banner blocks reference valid personas"""
    
    @pytest.mark.parametrize("slug,expected_persona", list(PAGES_WITH_CHAT_BANNER.items()))
    def test_chat_banner_has_correct_persona(self, slug, expected_persona):
        response = requests.get(f"{BASE_URL}/api/cms/pages/{slug}")
        blocks = response.json().get("page", {}).get("blocks", [])
        banners = [b for b in blocks if b["type"] == "chat_banner"]
        
        assert len(banners) >= 1, f"Page {slug} should have at least 1 chat_banner"
        
        persona = banners[0].get("props", {}).get("persona")
        assert persona == expected_persona, f"Page {slug} expected persona {expected_persona}, got {persona}"
        print(f"✓ Page {slug} has chat_banner with persona '{persona}'")
    
    def test_all_chat_banner_personas_are_valid(self):
        """All chat_banner personas should be valid persona IDs"""
        invalid_personas = []
        
        for slug in EXPECTED_PAGES:
            response = requests.get(f"{BASE_URL}/api/cms/pages/{slug}")
            blocks = response.json().get("page", {}).get("blocks", [])
            banners = [b for b in blocks if b["type"] == "chat_banner"]
            
            for banner in banners:
                persona = banner.get("props", {}).get("persona")
                if persona and persona not in VALID_PERSONAS:
                    invalid_personas.append((slug, persona))
        
        assert len(invalid_personas) == 0, f"Invalid personas found: {invalid_personas}"
        print("✓ All chat_banner personas are valid")


class TestCrisisFooterBlocks:
    """Test crisis_footer blocks exist where expected"""
    
    def test_crisis_support_has_crisis_footer(self):
        response = requests.get(f"{BASE_URL}/api/cms/pages/crisis-support")
        blocks = response.json().get("page", {}).get("blocks", [])
        footers = [b for b in blocks if b["type"] == "crisis_footer"]
        
        assert len(footers) >= 1, "crisis-support should have crisis_footer"
        print("✓ crisis-support has crisis_footer block")
    
    def test_he_served_has_crisis_footer(self):
        response = requests.get(f"{BASE_URL}/api/cms/pages/he-served")
        blocks = response.json().get("page", {}).get("blocks", [])
        footers = [b for b in blocks if b["type"] == "crisis_footer"]
        
        assert len(footers) >= 1, "he-served should have crisis_footer"
        print("✓ he-served has crisis_footer block")


class TestBatchSeedEndpoint:
    """Test POST /api/cms/admin/pages/batch-seed endpoint"""
    
    def test_batch_seed_endpoint_exists(self):
        """Verify the batch-seed endpoint is accessible (requires auth)"""
        # Without auth, should get 401 or 403
        response = requests.post(f"{BASE_URL}/api/cms/admin/pages/batch-seed", json={"pages": []})
        # The endpoint exists if we don't get 404
        assert response.status_code != 404, "batch-seed endpoint should exist"
        print(f"✓ batch-seed endpoint exists (status: {response.status_code})")


class TestPageBlockCounts:
    """Verify each page has expected minimum block counts"""
    
    EXPECTED_MIN_BLOCKS = {
        "about": 10,
        "criminal-justice": 10,
        "crisis-support": 10,
        "he-served": 20,
        "historical-investigations": 10,
        "compensation-schemes": 15,
        "privacy-policy": 15,
        "terms-of-service": 15,
        "commonwealth-veterans": 15,
        "faith-service": 15,
        "substance-support": 15,
        "women-veterans": 15,
        "money-benefits": 15,
        "for-carers": 20,
        "serious-illness": 20,
        "recovery-support": 20,
    }
    
    @pytest.mark.parametrize("slug,min_blocks", list(EXPECTED_MIN_BLOCKS.items()))
    def test_page_has_minimum_blocks(self, slug, min_blocks):
        response = requests.get(f"{BASE_URL}/api/cms/pages/{slug}")
        blocks = response.json().get("page", {}).get("blocks", [])
        
        assert len(blocks) >= min_blocks, f"Page {slug} has {len(blocks)} blocks, expected >= {min_blocks}"
        print(f"✓ Page {slug} has {len(blocks)} blocks (min: {min_blocks})")


class TestPersonasEndpoint:
    """Test GET /api/cms/personas returns valid personas for visual editor"""
    
    def test_personas_endpoint_returns_200(self):
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        assert response.status_code == 200
        print("✓ GET /api/cms/personas returns 200")
    
    def test_personas_returns_list(self):
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        data = response.json()
        personas = data.get("personas", [])
        
        assert len(personas) >= 15, f"Expected at least 15 personas, got {len(personas)}"
        print(f"✓ Personas endpoint returns {len(personas)} personas")
    
    def test_personas_have_required_fields(self):
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        personas = response.json().get("personas", [])
        
        required_fields = ["id", "name", "avatar", "role", "accent_color"]
        for persona in personas:
            for field in required_fields:
                assert field in persona, f"Persona missing field: {field}"
        
        print(f"✓ All {len(personas)} personas have required fields")
    
    def test_chat_banner_personas_exist_in_api(self):
        """All personas used in chat_banners should exist in /api/cms/personas"""
        response = requests.get(f"{BASE_URL}/api/cms/personas")
        persona_ids = [p["id"] for p in response.json().get("personas", [])]
        
        missing = []
        for slug, expected_persona in PAGES_WITH_CHAT_BANNER.items():
            if expected_persona not in persona_ids:
                missing.append((slug, expected_persona))
        
        assert len(missing) == 0, f"Personas missing from API: {missing}"
        print("✓ All chat_banner personas exist in /api/cms/personas")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
