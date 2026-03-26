"""
Test P0 CMS Hotfix - Verifies fixes for:
1. No useCMSContent/useCMSBlocks hooks in non-CMS pages (self-care, family-friends, peer-support)
2. Correct avatar paths in PERSONA_DATA dictionary
3. Image files exist on disk
4. CMS API endpoints return correct data
"""
import pytest
import requests
import os
import re

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# ============================================================================
# Test 1: Verify non-CMS pages don't have CMS hooks
# ============================================================================
class TestNoCMSHooksInFunctionalPages:
    """Verify self-care, family-friends, peer-support don't import CMS hooks"""
    
    @pytest.fixture(scope="class")
    def self_care_content(self):
        with open('/app/frontend/app/self-care.tsx', 'r') as f:
            return f.read()
    
    @pytest.fixture(scope="class")
    def family_friends_content(self):
        with open('/app/frontend/app/family-friends.tsx', 'r') as f:
            return f.read()
    
    @pytest.fixture(scope="class")
    def peer_support_content(self):
        with open('/app/frontend/app/peer-support.tsx', 'r') as f:
            return f.read()
    
    def test_self_care_no_useCMSContent_import(self, self_care_content):
        """self-care.tsx should NOT import useCMSContent"""
        assert 'useCMSContent' not in self_care_content, "self-care.tsx still imports useCMSContent"
    
    def test_self_care_no_useCMSBlocks_import(self, self_care_content):
        """self-care.tsx should NOT import useCMSBlocks"""
        assert 'useCMSBlocks' not in self_care_content, "self-care.tsx still imports useCMSBlocks"
    
    def test_family_friends_no_useCMSContent_import(self, family_friends_content):
        """family-friends.tsx should NOT import useCMSContent"""
        assert 'useCMSContent' not in family_friends_content, "family-friends.tsx still imports useCMSContent"
    
    def test_family_friends_no_useCMSBlocks_import(self, family_friends_content):
        """family-friends.tsx should NOT import useCMSBlocks"""
        assert 'useCMSBlocks' not in family_friends_content, "family-friends.tsx still imports useCMSBlocks"
    
    def test_peer_support_no_useCMSContent_import(self, peer_support_content):
        """peer-support.tsx should NOT import useCMSContent"""
        assert 'useCMSContent' not in peer_support_content, "peer-support.tsx still imports useCMSContent"
    
    def test_peer_support_no_useCMSBlocks_import(self, peer_support_content):
        """peer-support.tsx should NOT import useCMSBlocks"""
        assert 'useCMSBlocks' not in peer_support_content, "peer-support.tsx still imports useCMSBlocks"


# ============================================================================
# Test 2: Verify PERSONA_DATA has correct avatar paths
# ============================================================================
class TestPersonaDataAvatars:
    """Verify CMSBlockRenderer.tsx PERSONA_DATA has correct avatar paths"""
    
    @pytest.fixture(scope="class")
    def cms_block_renderer_content(self):
        with open('/app/frontend/src/components/CMSBlockRenderer.tsx', 'r') as f:
            return f.read()
    
    def test_jack_avatar_is_jack_png(self, cms_block_renderer_content):
        """jack avatar should be /images/jack.png (not hugo.png)"""
        # Find jack entry in PERSONA_DATA
        jack_match = re.search(r"jack:\s*\{[^}]*avatar:\s*['\"]([^'\"]+)['\"]", cms_block_renderer_content)
        assert jack_match, "Could not find jack entry in PERSONA_DATA"
        assert jack_match.group(1) == '/images/jack.png', f"jack avatar is {jack_match.group(1)}, expected /images/jack.png"
    
    def test_kofi_avatar_is_kofi_png(self, cms_block_renderer_content):
        """kofi avatar should be /images/kofi.png (not tommy.png)"""
        kofi_match = re.search(r"kofi:\s*\{[^}]*avatar:\s*['\"]([^'\"]+)['\"]", cms_block_renderer_content)
        assert kofi_match, "Could not find kofi entry in PERSONA_DATA"
        assert kofi_match.group(1) == '/images/kofi.png', f"kofi avatar is {kofi_match.group(1)}, expected /images/kofi.png"
    
    def test_sam_avatar_is_sam_png(self, cms_block_renderer_content):
        """sam avatar should be /images/sam.png (not tommy.png)"""
        sam_match = re.search(r"sam:\s*\{[^}]*avatar:\s*['\"]([^'\"]+)['\"]", cms_block_renderer_content)
        assert sam_match, "Could not find sam entry in PERSONA_DATA"
        assert sam_match.group(1) == '/images/sam.png', f"sam avatar is {sam_match.group(1)}, expected /images/sam.png"
    
    def test_james_avatar_is_james_png(self, cms_block_renderer_content):
        """james avatar should be /images/james.png (not tommy.png)"""
        james_match = re.search(r"james:\s*\{[^}]*avatar:\s*['\"]([^'\"]+)['\"]", cms_block_renderer_content)
        assert james_match, "Could not find james entry in PERSONA_DATA"
        assert james_match.group(1) == '/images/james.png', f"james avatar is {james_match.group(1)}, expected /images/james.png"
    
    def test_baz_avatar_is_baz_png(self, cms_block_renderer_content):
        """baz avatar should be /images/baz.png (not tommy.png)"""
        baz_match = re.search(r"baz:\s*\{[^}]*avatar:\s*['\"]([^'\"]+)['\"]", cms_block_renderer_content)
        assert baz_match, "Could not find baz entry in PERSONA_DATA"
        assert baz_match.group(1) == '/images/baz.png', f"baz avatar is {baz_match.group(1)}, expected /images/baz.png"
    
    def test_alex_avatar_is_alex_png(self, cms_block_renderer_content):
        """alex avatar should be /images/alex.png (not tommy.png)"""
        alex_match = re.search(r"alex:\s*\{[^}]*avatar:\s*['\"]([^'\"]+)['\"]", cms_block_renderer_content)
        assert alex_match, "Could not find alex entry in PERSONA_DATA"
        assert alex_match.group(1) == '/images/alex.png', f"alex avatar is {alex_match.group(1)}, expected /images/alex.png"


# ============================================================================
# Test 3: Verify image files exist on disk
# ============================================================================
class TestImageFilesExist:
    """Verify required avatar images exist in /app/frontend/public/images/"""
    
    IMAGE_DIR = '/app/frontend/public/images'
    
    def test_jack_png_exists(self):
        """jack.png should exist"""
        assert os.path.exists(f'{self.IMAGE_DIR}/jack.png'), "jack.png not found"
    
    def test_kofi_png_exists(self):
        """kofi.png should exist"""
        assert os.path.exists(f'{self.IMAGE_DIR}/kofi.png'), "kofi.png not found"
    
    def test_sam_png_exists(self):
        """sam.png should exist"""
        assert os.path.exists(f'{self.IMAGE_DIR}/sam.png'), "sam.png not found"
    
    def test_james_png_exists(self):
        """james.png should exist"""
        assert os.path.exists(f'{self.IMAGE_DIR}/james.png'), "james.png not found"
    
    def test_baz_png_exists(self):
        """baz.png should exist"""
        assert os.path.exists(f'{self.IMAGE_DIR}/baz.png'), "baz.png not found"
    
    def test_alex_png_exists(self):
        """alex.png should exist"""
        assert os.path.exists(f'{self.IMAGE_DIR}/alex.png'), "alex.png not found"


# ============================================================================
# Test 4: Verify CMS API endpoints
# ============================================================================
class TestCMSAPIEndpoints:
    """Verify CMS API returns correct data for pages"""
    
    def test_self_care_returns_404(self):
        """GET /api/cms/pages/self-care should return 404 (not a CMS page)"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/self-care')
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
    
    def test_compensation_schemes_returns_200(self):
        """GET /api/cms/pages/compensation-schemes should return 200"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/compensation-schemes')
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_compensation_schemes_has_jack_persona(self):
        """compensation-schemes should have persona 'jack'"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/compensation-schemes')
        data = response.json()
        chat_banners = [b for b in data['page']['blocks'] if b['type'] == 'chat_banner']
        assert len(chat_banners) > 0, "No chat_banner found in compensation-schemes"
        assert chat_banners[0]['props']['persona'] == 'jack', f"Expected persona 'jack', got {chat_banners[0]['props']['persona']}"
    
    def test_commonwealth_veterans_returns_200(self):
        """GET /api/cms/pages/commonwealth-veterans should return 200"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/commonwealth-veterans')
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_commonwealth_veterans_has_kofi_persona(self):
        """commonwealth-veterans should have persona 'kofi'"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/commonwealth-veterans')
        data = response.json()
        chat_banners = [b for b in data['page']['blocks'] if b['type'] == 'chat_banner']
        assert len(chat_banners) > 0, "No chat_banner found in commonwealth-veterans"
        assert chat_banners[0]['props']['persona'] == 'kofi', f"Expected persona 'kofi', got {chat_banners[0]['props']['persona']}"
    
    def test_faith_service_returns_200(self):
        """GET /api/cms/pages/faith-service should return 200"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/faith-service')
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    
    def test_faith_service_has_catherine_persona(self):
        """faith-service should have persona 'catherine'"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/faith-service')
        data = response.json()
        chat_banners = [b for b in data['page']['blocks'] if b['type'] == 'chat_banner']
        assert len(chat_banners) > 0, "No chat_banner found in faith-service"
        # Note: This test may fail if the CMS data hasn't been updated
        persona = chat_banners[0]['props']['persona']
        assert persona == 'catherine', f"Expected persona 'catherine', got {persona}"


# ============================================================================
# Test 5: Verify all CMS pages still load correctly
# ============================================================================
class TestAllCMSPagesLoad:
    """Verify all CMS pages return 200"""
    
    CMS_PAGES = [
        'about', 'for-carers', 'criminal-justice', 'crisis-support', 'he-served',
        'historical-investigations', 'compensation-schemes', 'serious-illness',
        'recovery-support', 'privacy-policy', 'terms-of-service', 'commonwealth-veterans',
        'faith-service', 'substance-support', 'women-veterans', 'money-benefits'
    ]
    
    @pytest.mark.parametrize('page_slug', CMS_PAGES)
    def test_cms_page_returns_200(self, page_slug):
        """Each CMS page should return 200"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/{page_slug}')
        assert response.status_code == 200, f"Page {page_slug} returned {response.status_code}"
    
    @pytest.mark.parametrize('page_slug', CMS_PAGES)
    def test_cms_page_has_blocks(self, page_slug):
        """Each CMS page should have blocks array"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/{page_slug}')
        data = response.json()
        assert 'page' in data, f"Page {page_slug} missing 'page' key"
        assert 'blocks' in data['page'], f"Page {page_slug} missing 'blocks' key"
        assert isinstance(data['page']['blocks'], list), f"Page {page_slug} blocks is not a list"


# ============================================================================
# Test 6: Verify non-CMS pages return 404
# ============================================================================
class TestNonCMSPagesReturn404:
    """Verify non-CMS functional pages return 404 from CMS API"""
    
    NON_CMS_PAGES = ['self-care', 'peer-support', 'family-friends']
    
    @pytest.mark.parametrize('page_slug', NON_CMS_PAGES)
    def test_non_cms_page_returns_404(self, page_slug):
        """Non-CMS pages should return 404 from CMS API"""
        response = requests.get(f'{BASE_URL}/api/cms/pages/{page_slug}')
        assert response.status_code == 404, f"Page {page_slug} returned {response.status_code}, expected 404"
