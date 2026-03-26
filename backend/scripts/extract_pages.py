"""
Extract block content from original .tsx page files.
Generates JSON block arrays for each page for the CMS seed.
"""
import re, json, os

APP_DIR = "/app/frontend/app"

# Map page -> persona (from chat routes found in code)
PAGE_PERSONAS = {
    "about": None,
    "criminal-justice": "doris",
    "privacy-policy": None,
    "terms-of-service": None,
    "your-data-rights": None,
    "historical-investigations": None,
    "crisis-support": "tommy",
    "self-care": "catherine",
    "organizations": "baz",
    "peer-support": "bob",
    "he-served": "dave",
    "they-served": "alex",
    "women-veterans": "megan",
    "commonwealth-veterans": "kofi",
    "faith-service": "james",
    "forces-kids": "sam",
    "family-friends": "leanne",
    "money-benefits": "penny",
    "compensation-schemes": "jack",
    "substance-support": "margie",
    "associations": None,
    "regimental-associations": None,
}

def extract_text(tsx_content):
    """Extract plain text strings from TSX."""
    # Find all text between quotes in Text components
    texts = []
    # Match string literals
    for m in re.finditer(r"['\"]([^'\"]{10,})['\"]", tsx_content):
        t = m.group(1).strip()
        if t and not t.startswith('http') and not t.startswith('#') and not t.startswith('/') and 'style' not in t.lower() and 'color' not in t.lower():
            texts.append(t)
    return texts

def extract_resources(tsx_content):
    """Extract resource objects from arrays in TSX."""
    resources = []
    # Find array definitions like const RESOURCES = [ ... ]
    array_pattern = r'(?:const\s+\w+\s*=\s*\[)(.*?)(?:\];)'
    for match in re.finditer(array_pattern, tsx_content, re.DOTALL):
        block = match.group(1)
        # Find individual objects
        obj_pattern = r'\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}'
        for obj_match in re.finditer(obj_pattern, block):
            obj_str = obj_match.group(1)
            resource = {}
            # Extract name/title
            name_match = re.search(r"name:\s*['\"]([^'\"]+)['\"]", obj_str)
            title_match = re.search(r"title:\s*['\"]([^'\"]+)['\"]", obj_str)
            resource['title'] = (name_match or title_match).group(1) if (name_match or title_match) else None
            
            # Extract desc/description  
            desc_match = re.search(r"(?:desc|description|fullDescription):\s*['\"]([^'\"]+)['\"]", obj_str)
            if desc_match:
                resource['description'] = desc_match.group(1)
            
            # Extract phone
            phone_match = re.search(r"phone:\s*['\"]([^'\"]+)['\"]", obj_str)
            if phone_match:
                resource['phone'] = phone_match.group(1)
            
            # Extract url
            url_match = re.search(r"url:\s*['\"]([^'\"]+)['\"]", obj_str)
            if url_match:
                resource['url'] = url_match.group(1)
            
            # Extract category/tag
            cat_match = re.search(r"(?:category|tag|type):\s*['\"]([^'\"]+)['\"]", obj_str)
            if cat_match:
                resource['tag'] = cat_match.group(1).replace('-', ' ').title()
            
            if resource.get('title'):
                resources.append(resource)
    return resources

def extract_topic_cards(tsx_content):
    """Extract topic/callout cards."""
    callouts = []
    # Look for topic card arrays
    for match in re.finditer(r"(?:title|label):\s*['\"]([^'\"]+)['\"].*?(?:desc|description|text):\s*['\"]([^'\"]+)['\"]", tsx_content, re.DOTALL):
        title = match.group(1)
        desc = match.group(2)
        if len(desc) > 20:  # Filter out non-content
            callouts.append(f"{title} \u2014 {desc}")
    return callouts

def extract_section_headings(tsx_content):
    """Extract section headings."""
    headings = []
    for match in re.finditer(r"sectionTitle['\"]?>([^<]+)<", tsx_content):
        headings.append(match.group(1).strip())
    # Also look for fontWeight 700 headings
    for match in re.finditer(r"fontWeight.*?['\"]700['\"].*?>([A-Z][^<]{3,50})<", tsx_content):
        h = match.group(1).strip()
        if h not in headings and len(h) < 50:
            headings.append(h)
    return headings

def process_page(slug):
    filepath = os.path.join(APP_DIR, f"{slug}.tsx")
    if not os.path.exists(filepath):
        return None
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    persona = PAGE_PERSONAS.get(slug)
    resources = extract_resources(content)
    topics = extract_topic_cards(content)
    headings = extract_section_headings(content)
    
    return {
        "slug": slug,
        "persona": persona,
        "resources": resources,
        "topics": topics,
        "headings": headings,
        "lines": content.count('\n'),
    }

# Process all pages
pages = [
    "about", "criminal-justice", "privacy-policy", "terms-of-service",
    "your-data-rights", "historical-investigations", "crisis-support",
    "self-care", "organizations", "peer-support", "he-served", "they-served",
    "women-veterans", "commonwealth-veterans", "faith-service", "forces-kids",
    "family-friends", "money-benefits", "compensation-schemes", 
    "substance-support", "associations", "regimental-associations"
]

for slug in pages:
    result = process_page(slug)
    if result:
        print(f"\n{'='*60}")
        print(f"PAGE: {slug}")
        print(f"  Persona: {result['persona']}")
        print(f"  Resources: {len(result['resources'])}")
        print(f"  Topics: {len(result['topics'])}")
        print(f"  Headings: {result['headings'][:5]}")
        for r in result['resources'][:3]:
            print(f"    - {r.get('title', '?')}: {r.get('description', '?')[:60]}...")
