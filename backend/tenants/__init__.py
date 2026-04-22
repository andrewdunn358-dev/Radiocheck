"""
Multi-Tenant Configuration for Radio Check Platform
====================================================
Each tenant gets: branding, personas, content, crisis resources.
Same safety system, same judge, same protocols across all tenants.
"""

TENANTS = {
    "radiocheck": {
        "id": "radiocheck",
        "name": "Radio Check",
        "tagline": "Veteran Peer Support",
        "domain": "radiocheck.me",
        "colors": {
            "primary": "#dc2626",
            "background": "#1a2332",
            "surface": "#2d3748",
            "accent": "#dc2626",
            "text": "#ffffff",
            "textMuted": "#9ca3af"
        },
        "personas": [
            "tommy", "grace", "bob", "frankie", "margie", "megan", "rachel",
            "finch", "penny", "jack", "rita", "sam", "helen", "alex", "kofi",
            "james", "catherine", "dave", "baz", "mo", "reg"
        ],
        "crisis_resources": [
            {"name": "Samaritans", "phone": "116 123", "description": "24/7 emotional support"},
            {"name": "Combat Stress", "phone": "0800 138 1619", "description": "Veterans mental health helpline"},
            {"name": "Emergency", "phone": "999", "description": "Immediate danger"},
            {"name": "Veterans Gateway", "phone": "0808 802 1212", "description": "First point of contact for veterans"},
        ],
        "support_organisations": [],
    },

    "bluelight": {
        "id": "bluelight",
        "name": "Blue Light Support",
        "tagline": "Support for Those Who Protect",
        "domain": "police.radiocheck.me",
        "colors": {
            "primary": "#0057B8",
            "background": "#0a1628",
            "surface": "#1a2744",
            "accent": "#003078",
            "text": "#ffffff",
            "textMuted": "#8b9dc3"
        },
        "personas": ["steve", "claire"],
        "crisis_resources": [
            {"name": "Samaritans", "phone": "116 123", "description": "24/7 emotional support"},
            {"name": "Police Care UK", "phone": "0300 012 0030", "description": "Support for police officers and families"},
            {"name": "Emergency", "phone": "999", "description": "Immediate danger"},
            {"name": "Oscar Kilo", "phone": "", "description": "National police wellbeing service — oscarkilowell.org.uk"},
        ],
        "support_organisations": [
            {"name": "Police Care UK", "url": "https://www.policecare.org.uk", "description": "Charity for serving and retired police officers, staff, and volunteers"},
            {"name": "Oscar Kilo", "url": "https://oscarkilo.org.uk", "description": "National Police Wellbeing Service"},
            {"name": "Police Mutual", "url": "https://www.policemutual.co.uk", "description": "Financial services and wellbeing for police"},
            {"name": "Mind Blue Light Programme", "url": "https://www.mind.org.uk/news-campaigns/campaigns/blue-light-programme/", "description": "Mental health support for emergency services"},
            {"name": "PFEW Welfare", "url": "https://www.polfed.org/ourwork/welfare/", "description": "Police Federation welfare support"},
            {"name": "The Police Treatment Centres", "url": "https://www.thepolicetreatmentcentres.org", "description": "Physical and psychological treatment for officers"},
            {"name": "Flint House", "url": "https://www.flinthouse.co.uk", "description": "Police rehabilitation centre"},
            {"name": "NARPO", "url": "https://www.narpo.org", "description": "National Association of Retired Police Officers"},
            {"name": "Blue Light Together", "url": "https://bluelighttogether.org.uk", "description": "Domestic abuse support for emergency services"},
            {"name": "BackUp Buddy (PFOA)", "url": "https://www.intandem.org.uk", "description": "Post-trauma support for officers"},
        ],
    },
}


def get_tenant_config(hostname: str) -> dict:
    """Resolve tenant from request hostname."""
    hostname = hostname.lower().split(":")[0]  # strip port

    if "police" in hostname or "bluelight" in hostname:
        return TENANTS["bluelight"]

    return TENANTS["radiocheck"]


def get_tenant_by_id(tenant_id: str) -> dict:
    """Get tenant config by explicit ID."""
    return TENANTS.get(tenant_id, TENANTS["radiocheck"])
