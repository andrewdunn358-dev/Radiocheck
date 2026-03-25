"""
CMS Content Router - Books, Podcasts, Persona Bios
===================================================
Provides CRUD API for managing app content from the admin portal.
Public endpoints (no auth) for the mobile app to fetch content.
Admin endpoints (auth required) for managing content.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import os
from pymongo import MongoClient

router = APIRouter()

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "radiocheck")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]


# ==================== MODELS ====================

class BookCreate(BaseModel):
    title: str
    author: str
    description: str
    rating: float = 0
    category: str = "Memoir"
    format: str = "both"
    amazonUrl: str = ""
    coverUrl: str = ""
    visible: bool = True

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    description: Optional[str] = None
    rating: Optional[float] = None
    category: Optional[str] = None
    format: Optional[str] = None
    amazonUrl: Optional[str] = None
    coverUrl: Optional[str] = None
    visible: Optional[bool] = None

class PodcastCreate(BaseModel):
    title: str
    host: str = ""
    description: str
    url: str = ""
    coverUrl: str = ""
    category: str = "General"
    visible: bool = True

class PodcastUpdate(BaseModel):
    title: Optional[str] = None
    host: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    coverUrl: Optional[str] = None
    category: Optional[str] = None
    visible: Optional[bool] = None

class PersonaBioUpdate(BaseModel):
    description: Optional[str] = None
    bio: Optional[str] = None


# ==================== HELPERS ====================

def serialize_doc(doc):
    """Convert MongoDB doc to JSON-safe dict."""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc

def serialize_list(cursor):
    return [serialize_doc(doc) for doc in cursor]


# ==================== BOOKS - PUBLIC ====================

@router.get("/books")
async def get_books():
    """Public endpoint - returns all visible books ordered by position."""
    books = db.cms_books.find({"visible": True}).sort("position", 1)
    result = serialize_list(books)
    if not result:
        return {"books": [], "source": "empty"}
    return {"books": result, "source": "database"}


# ==================== BOOKS - ADMIN ====================

@router.get("/admin/books")
async def admin_get_books():
    """Admin endpoint - returns ALL books including hidden ones."""
    books = db.cms_books.find().sort("position", 1)
    return {"books": serialize_list(books)}

@router.post("/admin/books")
async def admin_create_book(book: BookCreate):
    max_pos = db.cms_books.find_one(sort=[("position", -1)])
    position = (max_pos["position"] + 1) if max_pos else 0
    doc = {
        **book.model_dump(),
        "position": position,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.cms_books.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return {"message": "Book created", "book": doc}

@router.put("/admin/books/{book_id}")
async def admin_update_book(book_id: str, book: BookUpdate):
    updates = {k: v for k, v in book.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.cms_books.update_one({"_id": ObjectId(book_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"message": "Book updated"}

@router.delete("/admin/books/{book_id}")
async def admin_delete_book(book_id: str):
    result = db.cms_books.delete_one({"_id": ObjectId(book_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"message": "Book deleted"}

@router.post("/admin/books/reorder")
async def admin_reorder_books(order: List[str]):
    """Accepts list of book IDs in desired order."""
    for i, book_id in enumerate(order):
        db.cms_books.update_one({"_id": ObjectId(book_id)}, {"$set": {"position": i}})
    return {"message": "Books reordered"}

@router.post("/admin/books/seed")
async def admin_seed_books():
    """Seed the database with the hardcoded book list."""
    existing = db.cms_books.count_documents({})
    if existing > 0:
        return {"message": f"Database already has {existing} books. Delete them first or add individually."}

    SEED_BOOKS = [
        {"title": "Bravo Two Zero", "author": "Andy McNab", "description": "The classic SAS patrol account from the Gulf War. One of the best-selling war books of all time.", "rating": 4.6, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Bravo+Two+Zero+Andy+McNab", "coverUrl": "https://covers.openlibrary.org/b/id/1003545-M.jpg"},
        {"title": "Spoken from the Front", "author": "Andy McNab", "description": "Real accounts from British soldiers serving in Afghanistan. Raw, unfiltered voices from the frontline.", "rating": 4.7, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Spoken+from+the+Front+Andy+McNab", "coverUrl": "https://covers.openlibrary.org/b/id/6430891-M.jpg"},
        {"title": "Escape from Kabul", "author": "Levison Wood & Geraint Jones", "description": "The gripping inside story of the 2021 Kabul evacuation. Eyewitness accounts from soldiers, interpreters and officials during the Taliban's return.", "rating": 4.6, "category": "Military History", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Escape+from+Kabul+Levison+Wood+Geraint+Jones", "coverUrl": "https://covers.openlibrary.org/b/id/14748224-M.jpg"},
        {"title": "Walking the Nile", "author": "Levison Wood", "description": "Former British Army officer walks the entire length of the Nile. Adventure, resilience and the power of putting one foot in front of the other.", "rating": 4.5, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Walking+the+Nile+Levison+Wood", "coverUrl": "https://covers.openlibrary.org/b/id/8867756-M.jpg"},
        {"title": "The Body Keeps the Score", "author": "Bessel van der Kolk", "description": "Groundbreaking research on trauma and PTSD. Essential reading for understanding how the body stores trauma and pathways to recovery.", "rating": 4.7, "category": "Mental Health", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=The+Body+Keeps+the+Score+Bessel+van+der+Kolk", "coverUrl": "https://covers.openlibrary.org/b/id/8315367-M.jpg"},
        {"title": "Complex PTSD: From Surviving to Thriving", "author": "Pete Walker", "description": "Practical guide for recovering from complex trauma. Written by a therapist who is himself a survivor.", "rating": 4.7, "category": "Mental Health", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Complex+PTSD+From+Surviving+to+Thriving+Pete+Walker", "coverUrl": "https://covers.openlibrary.org/b/id/9319615-M.jpg"},
        {"title": "Painting the Sand", "author": "Kim Hughes GC", "description": "Bomb disposal in Helmand by a George Cross recipient. Terrifying, gripping and deeply human.", "rating": 4.7, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Painting+the+Sand+Kim+Hughes", "coverUrl": ""},
        {"title": "Chickenhawk", "author": "Robert Mason", "description": "Helicopter pilot's raw memoir from Vietnam. One of the most vivid accounts of combat flying ever written.", "rating": 4.7, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Chickenhawk+Robert+Mason", "coverUrl": "https://covers.openlibrary.org/b/id/93944-M.jpg"},
        {"title": "Man's Search for Meaning", "author": "Viktor Frankl", "description": "Holocaust survivor and psychiatrist on finding purpose through suffering. A life-changing read for anyone facing darkness.", "rating": 4.7, "category": "Mental Health", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Mans+Search+for+Meaning+Viktor+Frankl", "coverUrl": "https://covers.openlibrary.org/b/id/8516506-M.jpg"},
        {"title": "First Man In", "author": "Ant Middleton", "description": "Former SBS point man's take on leadership, fear and resilience. Direct, no-nonsense and motivating.", "rating": 4.6, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=First+Man+In+Ant+Middleton", "coverUrl": "https://covers.openlibrary.org/b/id/9168494-M.jpg"},
        {"title": "Apache Dawn", "author": "Damien Lewis", "description": "British forces in Afghanistan — 3 Para's bloody battle for Helmand. Gripping and brutal.", "rating": 4.5, "category": "Military History", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Apache+Dawn+Damien+Lewis", "coverUrl": "https://covers.openlibrary.org/b/id/11589739-M.jpg"},
        {"title": "Walking with the Wounded", "author": "Mark McCrum", "description": "The inspiring story of wounded veterans who trekked to the North Pole. Incredible resilience and determination.", "rating": 4.5, "category": "Inspiration", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Walking+with+the+Wounded+Mark+McCrum", "coverUrl": "https://covers.openlibrary.org/b/id/8195152-M.jpg"},
        {"title": "The Unforgiving Minute", "author": "Craig Mullaney", "description": "A soldier's education from West Point to Afghanistan. Thoughtful, honest and deeply human.", "rating": 4.6, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=The+Unforgiving+Minute+Craig+Mullaney", "coverUrl": "https://covers.openlibrary.org/b/id/5665294-M.jpg"},
        {"title": "Trauma Is Really Strange", "author": "Steve Haines", "description": "A short, illustrated guide to understanding trauma and how the body responds. Perfect introduction — not heavy reading.", "rating": 4.6, "category": "Mental Health", "format": "book", "amazonUrl": "https://www.amazon.co.uk/s?k=Trauma+Is+Really+Strange+Steve+Haines", "coverUrl": "https://covers.openlibrary.org/b/id/13440430-M.jpg"},
        {"title": "It Doesn't Have to Hurt to Work", "author": "Dave Collins & Leigh Maybury", "description": "Performance psychology from a former military psychologist. Practical tools for managing stress and building resilience.", "rating": 4.5, "category": "Mental Health", "format": "book", "amazonUrl": "https://www.amazon.co.uk/s?k=It+Doesnt+Have+to+Hurt+to+Work+Dave+Collins", "coverUrl": ""},
        {"title": "Wearing the Green Beret", "author": "Robin Childs", "description": "A Royal Marine Commando's journey. Honest account of service life, the bonds formed, and the challenges after.", "rating": 4.5, "category": "Memoir", "format": "book", "amazonUrl": "https://www.amazon.co.uk/s?k=Wearing+the+Green+Beret+Robin+Childs", "coverUrl": ""},
        {"title": "Soldier Box", "author": "Joe Glenton", "description": "A British soldier's story of refusing to return to Afghanistan. Controversial, brave, and thought-provoking.", "rating": 4.3, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Soldier+Box+Joe+Glenton", "coverUrl": ""},
        {"title": "Losing the Plot", "author": "Gail Hanlon", "description": "Growing a garden to grow yourself. Therapeutic gardening for mental health — popular with veterans' allotment projects.", "rating": 4.5, "category": "Wellbeing", "format": "book", "amazonUrl": "https://www.amazon.co.uk/s?k=Losing+the+Plot+Gail+Hanlon", "coverUrl": ""},
        {"title": "East of Croydon", "author": "Sue Perkins", "description": "Not military — but a brilliant, funny memoir about identity and belonging. Sometimes you need a laugh.", "rating": 4.4, "category": "Lighter Reads", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=East+of+Croydon+Sue+Perkins", "coverUrl": "https://covers.openlibrary.org/b/id/10187926-M.jpg"},
        {"title": "The Complete Guide to Veterans' Benefits", "author": "Bruce Brown", "description": "Comprehensive guide to understanding and claiming all the benefits and support you're entitled to.", "rating": 4.4, "category": "Practical", "format": "book", "amazonUrl": "https://www.amazon.co.uk/s?k=Complete+Guide+Veterans+Benefits+Bruce+Brown", "coverUrl": "https://covers.openlibrary.org/b/id/12550227-M.jpg"},
        {"title": "Danger Close", "author": "Stuart Tootal", "description": "The true story of Helmand from the leader of 3 PARA. A commanding officer's gripping account of the brutal 2006 deployment.", "rating": 4.7, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Danger+Close+Stuart+Tootal", "coverUrl": "https://covers.openlibrary.org/b/id/11759009-M.jpg"},
        {"title": "Operation Mayhem", "author": "Steve Heaney MC", "description": "The first account of X Platoon's epic mission during a bloody civil war in Africa. Raw courage, elite forces.", "rating": 4.6, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Operation+Mayhem+Steve+Heaney", "coverUrl": "https://covers.openlibrary.org/b/id/10436919-M.jpg"},
        {"title": "Operation Telic", "author": "Tim Ripley", "description": "The definitive account of the British campaign in Iraq 2003-2009. Uncensored documents and the real story of Basra.", "rating": 4.5, "category": "Military History", "format": "both", "amazonUrl": "https://www.amazon.co.uk/s?k=Operation+Telic+Tim+Ripley", "coverUrl": ""},
        {"title": "Charlie Four Kilo", "author": "Rich Jones", "description": "A veteran falls into organised crime across Europe. A true story ending with a 15-year prison sentence. Raw, honest, gripping.", "rating": 4.5, "category": "Memoir", "format": "both", "amazonUrl": "https://www.amazon.co.uk/Charlie-Four-Kilo-Rich-Jones/dp/1800315414", "coverUrl": ""},
        {"title": "Conquering Dreams", "author": "Hari Budha Magar MBE", "description": "The autobiography of the first double above-knee amputee to summit Everest and complete the Seven Summits. A former Gurkha. Coming August 2026.", "rating": 0, "category": "Inspiration", "format": "book", "amazonUrl": "https://www.amazon.co.uk/s?k=Conquering+Dreams+Hari+Budha+Magar", "coverUrl": ""},
    ]

    for i, book in enumerate(SEED_BOOKS):
        book["position"] = i
        book["visible"] = True
        book["created_at"] = datetime.now(timezone.utc).isoformat()
        book["updated_at"] = datetime.now(timezone.utc).isoformat()

    db.cms_books.insert_many(SEED_BOOKS)
    return {"message": f"Seeded {len(SEED_BOOKS)} books"}


# ==================== PODCASTS - PUBLIC ====================

@router.get("/podcasts")
async def get_podcasts():
    podcasts = db.cms_podcasts.find({"visible": True}).sort("position", 1)
    result = serialize_list(podcasts)
    return {"podcasts": result, "source": "database" if result else "empty"}

# ==================== PODCASTS - ADMIN ====================

@router.get("/admin/podcasts")
async def admin_get_podcasts():
    podcasts = db.cms_podcasts.find().sort("position", 1)
    return {"podcasts": serialize_list(podcasts)}

@router.post("/admin/podcasts")
async def admin_create_podcast(podcast: PodcastCreate):
    max_pos = db.cms_podcasts.find_one(sort=[("position", -1)])
    position = (max_pos["position"] + 1) if max_pos else 0
    doc = {
        **podcast.model_dump(),
        "position": position,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.cms_podcasts.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return {"message": "Podcast created", "podcast": doc}

@router.put("/admin/podcasts/{podcast_id}")
async def admin_update_podcast(podcast_id: str, podcast: PodcastUpdate):
    updates = {k: v for k, v in podcast.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.cms_podcasts.update_one({"_id": ObjectId(podcast_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return {"message": "Podcast updated"}

@router.delete("/admin/podcasts/{podcast_id}")
async def admin_delete_podcast(podcast_id: str):
    result = db.cms_podcasts.delete_one({"_id": ObjectId(podcast_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Podcast not found")
    return {"message": "Podcast deleted"}

@router.post("/admin/podcasts/reorder")
async def admin_reorder_podcasts(order: List[str]):
    for i, pid in enumerate(order):
        db.cms_podcasts.update_one({"_id": ObjectId(pid)}, {"$set": {"position": i}})
    return {"message": "Podcasts reordered"}


# ==================== PERSONA BIOS - PUBLIC ====================

@router.get("/persona-bios")
async def get_persona_bios():
    bios = db.cms_persona_bios.find({"visible": {"$ne": False}}).sort("position", 1)
    result = serialize_list(bios)
    return {"personas": result, "source": "database" if result else "empty"}

# ==================== PERSONA BIOS - ADMIN ====================

@router.get("/admin/persona-bios")
async def admin_get_persona_bios():
    bios = db.cms_persona_bios.find().sort("position", 1)
    return {"personas": serialize_list(bios)}

@router.put("/admin/persona-bios/{persona_id}")
async def admin_update_persona_bio(persona_id: str, bio: PersonaBioUpdate):
    updates = {k: v for k, v in bio.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.cms_persona_bios.update_one({"_id": ObjectId(persona_id)}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Persona not found")
    return {"message": "Persona bio updated"}

@router.post("/admin/persona-bios/reorder")
async def admin_reorder_personas(order: List[str]):
    for i, pid in enumerate(order):
        db.cms_persona_bios.update_one({"_id": ObjectId(pid)}, {"$set": {"position": i}})
    return {"message": "Personas reordered"}

@router.post("/admin/persona-bios/seed")
async def admin_seed_persona_bios():
    existing = db.cms_persona_bios.count_documents({})
    if existing > 0:
        return {"message": f"Database already has {existing} persona bios. Clear first or edit individually."}

    from personas import AI_CHARACTERS
    PERSONA_ORDER = ["tommy","doris","bob","margie","catherine","sentry","baz","jack","penny","rita","sam","dave","megan","alex","kofi","james","frankie","mo","helen","reg"]
    DISPLAY_NAMES = {"doris":"Rachel","sentry":"Finch"}

    bios = []
    for i, pid in enumerate(PERSONA_ORDER):
        char = AI_CHARACTERS.get(pid, {})
        bios.append({
            "persona_id": pid,
            "name": DISPLAY_NAMES.get(pid, char.get("name", pid.title())),
            "description": char.get("role", ""),
            "bio": "",
            "avatar": char.get("avatar", f"/images/{pid}.png"),
            "position": i,
            "visible": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    db.cms_persona_bios.insert_many(bios)
    return {"message": f"Seeded {len(bios)} persona bios"}
