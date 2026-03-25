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
DB_NAME = os.environ.get("DB_NAME", "veterans_support")
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
    rssFeedUrl: str = ""
    youtubeFeedUrl: str = ""
    spotifyUrl: str = ""
    appleUrl: str = ""
    youtubeUrl: str = ""
    websiteUrl: str = ""
    focus: list = []
    visible: bool = True

class PodcastUpdate(BaseModel):
    title: Optional[str] = None
    host: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    coverUrl: Optional[str] = None
    category: Optional[str] = None
    rssFeedUrl: Optional[str] = None
    youtubeFeedUrl: Optional[str] = None
    spotifyUrl: Optional[str] = None
    appleUrl: Optional[str] = None
    youtubeUrl: Optional[str] = None
    websiteUrl: Optional[str] = None
    focus: Optional[list] = None
    visible: Optional[bool] = None

class PersonaBioUpdate(BaseModel):
    description: Optional[str] = None
    bio: Optional[str] = None
    visible: Optional[bool] = None


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

@router.post("/admin/podcasts/seed")
async def admin_seed_podcasts():
    """Seed the database with the hardcoded podcast list."""
    existing = db.cms_podcasts.count_documents({})
    if existing > 0:
        return {"message": f"Database already has {existing} podcasts. Delete them first or add individually."}

    SEED_PODCASTS = [
        {"title": "Frankie's Pod: Uncorking the Unforgettable", "host": "Frankie Dunn", "description": "Raw stories from British military veterans covering PTSD, resilience, and recovery after service.", "url": "", "coverUrl": "", "category": "PTSD & Recovery", "rssFeedUrl": "https://feeds.acast.com/public/shows/6714f073e3d9082a5a2bf617", "youtubeFeedUrl": "https://www.youtube.com/feeds/videos.xml?channel_id=UCANN4qRGM5yyBUH27TWLbQQ", "spotifyUrl": "https://open.spotify.com/show/7wrcVZ8zdtX5urzIvZSaUJ", "appleUrl": "https://podcasts.apple.com/us/podcast/frankies-pod-uncorking-the-unforgettable/id1729850191", "youtubeUrl": "https://www.youtube.com/@FrankiesPod", "websiteUrl": "", "focus": ["PTSD", "Recovery", "Veteran Stories"]},
        {"title": "Speed. Aggression. Surprise.", "host": "Tom Petch", "description": "Raw, candid conversations with military figures including SAS veterans and commanders.", "url": "", "coverUrl": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/55/e1/a4/55e1a412-6002-3594-3e01-3e9df23244dc/mza_2886434919509823568.jpg/600x600bb.jpg", "category": "Military History", "rssFeedUrl": "https://anchor.fm/s/10a795454/podcast/rss", "youtubeFeedUrl": "https://www.youtube.com/feeds/videos.xml?channel_id=UCOadyBud5o3iK7YTkpYRBCQ", "spotifyUrl": "https://open.spotify.com/show/0nqV8qef8CmvjurAPtV0qj", "appleUrl": "https://podcasts.apple.com/us/podcast/speed-aggression-surprise-the-untold-truth-behind/id1846864165", "youtubeUrl": "https://www.youtube.com/@speedaggressionsurprise", "websiteUrl": "https://www.tompetch.com/podcasts", "focus": ["Military History", "Leadership", "Personal Stories"]},
        {"title": "The Old Paratrooper Podcast", "host": "Chris Binch (ex-2 PARA)", "description": "Interviews with British Paras, SAS veterans, and special forces personnel on combat and mental health.", "url": "", "coverUrl": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/16/8a/d9/168ad914-db3f-70f8-8e1f-481b80e14183/mza_3119811594421415273.jpg/600x600bb.jpg", "category": "Special Forces", "rssFeedUrl": "https://feeds.acast.com/public/shows/679a9f6b65f74095105c2af2", "youtubeFeedUrl": "https://www.youtube.com/feeds/videos.xml?channel_id=UC4oHlVmxAjog1Dz6BDByNfQ", "spotifyUrl": "https://open.spotify.com/show/4jm3x1EoBBcPqQUXTwD1xc", "appleUrl": "https://podcasts.apple.com/us/podcast/the-old-paratrooper-podcast/id1859991469", "youtubeUrl": "https://www.youtube.com/@TheOldParatrooperpodcast", "websiteUrl": "", "focus": ["Parachute Regiment", "Special Forces", "Combat Stories"]},
        {"title": "Beyond the Barracks", "host": "RSL Victoria / Gina Allsop", "description": "Unfiltered stories from veterans covering transitions to civilian life, resilience, and recovery.", "url": "", "coverUrl": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts122/v4/71/da/c3/71dac30b-6a59-30a7-d5d3-878fa678afc8/mza_11916087358722418837.png/600x600bb.jpg", "category": "Transition", "rssFeedUrl": "", "youtubeFeedUrl": "https://www.youtube.com/feeds/videos.xml?channel_id=UCh_L_4t746PldKRfIKvj-0w", "spotifyUrl": "https://open.spotify.com/show/4MwejGmTY5CdDT8zsRkUTQ", "appleUrl": "", "youtubeUrl": "https://www.youtube.com/channel/UCh_L_4t746PldKRfIKvj-0w", "websiteUrl": "", "focus": ["Transition", "Recovery", "Family Support"]},
        {"title": "Combat Stress 100 Podcast", "host": "Combat Stress Charity", "description": "Clinical expertise combined with veteran testimonies on PTSD, depression, and substance misuse.", "url": "", "coverUrl": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/85/7b/90/857b90f2-c285-191f-c296-4cff7e8bd158/mza_11603060415803986663.jpg/600x600bb.jpg", "category": "Clinical Support", "rssFeedUrl": "https://feeds.acast.com/public/shows/62a8eda1-799d-4268-805c-6dd9ebd85c8e", "youtubeFeedUrl": "", "spotifyUrl": "", "appleUrl": "https://podcasts.apple.com/us/podcast/the-combat-stress-100-podcast/id1534726321", "youtubeUrl": "", "websiteUrl": "https://combatstress.org.uk/combat-stress-100-podcast", "focus": ["PTSD", "Depression", "Clinical Support"]},
        {"title": "Military Veterans Podcast", "host": "Gavin Watson (British Army)", "description": "Veterans share experiences from before, during, and after service. Includes dedicated PTSD episodes.", "url": "", "coverUrl": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/7a/a7/f7/7aa7f7a8-a6f8-fb6d-25d7-1dbf19662230/mza_8250357024051214226.jpg/600x600bb.jpg", "category": "Peer Support", "rssFeedUrl": "", "youtubeFeedUrl": "https://www.youtube.com/feeds/videos.xml?channel_id=UCchZkQj1bA3m21o_cLv8DuA", "spotifyUrl": "", "appleUrl": "https://podcasts.apple.com/gb/podcast/military-veterans-podcast/id1531710391", "youtubeUrl": "https://www.youtube.com/c/MilitaryVeteransPodcast", "websiteUrl": "https://milvetpodcast.com", "focus": ["Service Life", "PTSD", "Peer Support"]},
        {"title": "Talking with the Wounded", "host": "Ben", "description": "Frank, often humorous conversations with physically and mentally wounded veterans about recovery.", "url": "", "coverUrl": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts126/v4/1c/62/6b/1c626bbc-1412-2ce3-3a59-1faa05092eac/mza_6205096570431111656.jpg/600x600bb.jpg", "category": "Wounded Veterans", "rssFeedUrl": "https://talkingwiththewounded.podbean.com/feed.xml", "youtubeFeedUrl": "", "spotifyUrl": "https://open.spotify.com/show/3kP9jH6mN4vR8sT2wX5yZ1", "appleUrl": "https://podcasts.apple.com/gb/podcast/talking-with-the-wounded/id1712320662", "youtubeUrl": "", "websiteUrl": "", "focus": ["Wounded Veterans", "Recovery", "PTSD Resolution"]},
        {"title": "Stray Voltage", "host": "Veterans", "description": "By veterans, for veterans. Covering British military transitions and mental health topics.", "url": "", "coverUrl": "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/cd/05/66/cd056601-ed8d-18f0-dd35-bd8ddc76eb30/mza_1296788537650884352.jpg/600x600bb.jpg", "category": "Mental Health", "rssFeedUrl": "", "youtubeFeedUrl": "", "spotifyUrl": "https://open.spotify.com/show/6gyPTRjSXBuD2ImEnWGseD", "appleUrl": "", "youtubeUrl": "https://www.youtube.com/channel/UCz1sjXkh9mOI2UoovGMsQjw", "websiteUrl": "", "focus": ["Veteran to Veteran", "Transitions", "Mental Health"]},
        {"title": "The Unconventional Soldier", "host": "Tim Heale (Former British Army)", "description": "Letting the Guest Tell the Story. Stories from WW2, Cold War, Afghanistan & Iraq. Military history, veterans' voices, and book reviews.", "url": "", "coverUrl": "", "category": "Military History", "rssFeedUrl": "https://feeds.acast.com/public/shows/the-unconventional-soldier", "youtubeFeedUrl": "", "spotifyUrl": "https://open.spotify.com/show/2f93vEPu7y92NGhLaHH4TM", "appleUrl": "https://podcasts.apple.com/us/podcast/the-unconventional-soldier/id1524077345", "youtubeUrl": "", "websiteUrl": "https://shows.acast.com/the-unconventional-soldier", "focus": ["WW2", "Cold War", "Afghanistan", "Iraq", "Military History", "Book Reviews"]},
    ]

    for i, podcast in enumerate(SEED_PODCASTS):
        podcast["position"] = i
        podcast["visible"] = True
        podcast["created_at"] = datetime.now(timezone.utc).isoformat()
        podcast["updated_at"] = datetime.now(timezone.utc).isoformat()

    db.cms_podcasts.insert_many(SEED_PODCASTS)
    return {"message": f"Seeded {len(SEED_PODCASTS)} podcasts"}


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



# ==================== PAGE MODELS ====================

class PageCreate(BaseModel):
    title: str
    slug: str
    content: str = ""
    blocks: Optional[List[dict]] = None
    status: str = "draft"
    is_system_page: bool = False
    is_migrated_from_tsx: bool = False
    linked_persona: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None

class PageUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    content: Optional[str] = None
    blocks: Optional[List[dict]] = None
    status: Optional[str] = None
    is_system_page: Optional[bool] = None
    linked_persona: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None


# ==================== PAGES - PUBLIC ====================

@router.get("/pages/{slug}")
async def get_page_by_slug(slug: str):
    """Public endpoint: fetch a published page by slug."""
    page = db.cms_pages.find_one({"slug": slug, "status": "published"})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["id"] = str(page.pop("_id"))
    return {"page": page}


@router.get("/pages")
async def list_pages():
    """Public endpoint: list all published pages (title, slug only)."""
    pages = list(db.cms_pages.find(
        {"status": "published"},
        {"content": 0}
    ).sort("title", 1))
    return {"pages": [{"id": str(p.pop("_id")), **{k: v for k, v in p.items()}} for p in pages]}


# ==================== PAGES - ADMIN ====================

# Fixed-path routes MUST come before {slug} routes to avoid FastAPI matching them as slugs

@router.get("/admin/pages")
async def admin_list_pages():
    """Admin endpoint: list all pages with full metadata (no content body for perf)."""
    pages = list(db.cms_pages.find({}, {"content": 0}).sort([("status", -1), ("title", 1)]))
    return {"pages": [{"id": str(p.pop("_id")), **{k: v for k, v in p.items()}} for p in pages]}


@router.post("/admin/pages")
async def admin_create_page(page: PageCreate):
    """Create a new CMS page."""
    existing = db.cms_pages.find_one({"slug": page.slug})
    if existing:
        base_slug = page.slug
        counter = 2
        while db.cms_pages.find_one({"slug": f"{base_slug}-{counter}"}):
            counter += 1
        page.slug = f"{base_slug}-{counter}"

    doc = page.model_dump()
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = db.cms_pages.insert_one(doc)
    return {"message": "Page created", "page": {"id": str(result.inserted_id), "slug": doc["slug"]}}


@router.delete("/admin/pages/clear-all")
async def admin_clear_all_pages():
    """Delete ALL pages from cms_pages collection. Use before re-seeding."""
    result = db.cms_pages.delete_many({})
    return {"message": f"Deleted {result.deleted_count} pages from cms_pages"}


@router.post("/admin/pages/for-carers/seed")
async def admin_seed_for_carers():
    """Seed or reset the /for-carers page with block-based content."""
    db.cms_pages.delete_one({"slug": "for-carers"})

    FOR_CARERS_BLOCKS = [
        {"type": "chat_banner", "props": {"persona": "helen"}},
        {"type": "heading", "props": {"text": "For Carers"}},
        {"type": "paragraph", "props": {"text": "You look after them. But who looks after you? Support for the people behind the support."}},
        {"type": "divider", "props": {}},
        {"type": "heading", "props": {"text": "What Carers Face"}},
        {"type": "callout", "props": {"text": "You Matter Too \u2014 Caring for a veteran can consume your entire life. Your needs, your health, and your wellbeing matter just as much. You can\u2019t pour from an empty cup."}},
        {"type": "callout", "props": {"text": "Living with PTSD \u2014 When your loved one has PTSD, the whole household feels it \u2014 the nightmares, the hypervigilance, the anger, the withdrawal. Understanding what\u2019s happening is the first step to coping."}},
        {"type": "callout", "props": {"text": "Compassion Fatigue \u2014 Caring for someone long-term can lead to emotional exhaustion, numbness, and resentment. These are normal responses to an abnormal situation. Recognising it is the first step."}},
        {"type": "callout", "props": {"text": "Taking a Break \u2014 Respite isn\u2019t selfish \u2014 it\u2019s essential. Whether it\u2019s an afternoon off, a weekend away, or a funded respite programme, regular breaks keep you going."}},
        {"type": "callout", "props": {"text": "Financial Support \u2014 Caring often means reduced working hours or giving up work entirely. Carer\u2019s Allowance, charity grants, and council support can help bridge the gap."}},
        {"type": "callout", "props": {"text": "Finding Your Community \u2014 Connecting with other military carers who truly understand can make all the difference. You\u2019re not alone in this \u2014 even when it feels like it."}},
        {"type": "divider", "props": {}},
        {"type": "heading", "props": {"text": "Support & Resources"}},
        {"type": "support_card", "props": {"title": "Carers UK", "description": "Carers UK provides expert advice, information, and support for carers. Their helpline covers everything from benefits to employment rights to emotional support. They also campaign for carers\u2019 rights.", "phone": "0808 808 7777", "url": "https://www.carersuk.org", "tag": "Carer Support"}},
        {"type": "support_card", "props": {"title": "SSAFA Carers Support", "description": "SSAFA understands the unique challenges of caring for someone with military-related injuries or conditions. They provide mentoring, grants, respite funding, and connect you with other military carers who understand.", "url": "https://www.ssafa.org.uk/get-help/carers", "tag": "Carer Support"}},
        {"type": "support_card", "props": {"title": "Help for Heroes Family Support", "description": "Help for Heroes doesn\u2019t just support veterans \u2014 they support the families too. Their family recovery programmes include counselling, peer support, social activities, and grants for carers who need a break.", "url": "https://www.helpforheroes.org.uk/get-support/family/", "tag": "Carer Support"}},
        {"type": "support_card", "props": {"title": "Carer\u2019s Allowance", "description": "If you spend at least 35 hours a week caring for someone, you may be entitled to Carer\u2019s Allowance (currently \u00a376.75/week). It\u2019s not much, but it\u2019s your right. You can also get National Insurance credits towards your State Pension.", "url": "https://www.gov.uk/carers-allowance", "tag": "Financial"}},
        {"type": "support_card", "props": {"title": "Carers Trust", "description": "Carers Trust works with a network of local partners to provide breaks, information, advice, and support for carers. They can connect you with services in your area and help you access the support you\u2019re entitled to.", "url": "https://carers.org", "tag": "Practical"}},
        {"type": "support_card", "props": {"title": "Combat Stress Family Support", "description": "Living with someone with PTSD, anxiety, or depression from military service is exhausting. Combat Stress provides family support including information days, online resources, and signposting to help you cope while supporting your loved one.", "url": "https://combatstress.org.uk/get-help/family-and-carers", "tag": "Mental Health"}},
        {"type": "support_card", "props": {"title": "Mind - Supporting Someone Else", "description": "Mind provides practical guidance on supporting someone with mental health issues \u2014 how to start conversations, what to say, how to look after yourself while caring for them, and when to encourage professional help.", "url": "https://www.mind.org.uk/information-support/helping-someone-else/", "tag": "Mental Health"}},
        {"type": "support_card", "props": {"title": "Respite Care Grants", "description": "Several military charities provide grants for respite care \u2014 giving you a break while ensuring your loved one is looked after. The Royal British Legion, SSAFA, and Help for Heroes all offer respite funding. You need breaks to keep going.", "url": "https://www.britishlegion.org.uk", "tag": "Respite"}},
        {"type": "support_card", "props": {"title": "Veterans Gateway", "description": "Veterans Gateway isn\u2019t just for veterans \u2014 it\u2019s for their families too. Call 0808 802 1212 (24/7) and they\u2019ll connect you with the right support for carers, whether that\u2019s financial help, respite, or emotional support.", "phone": "0808 802 1212", "url": "https://www.veteransgateway.org.uk", "tag": "Carer Support"}},
        {"type": "divider", "props": {}},
        {"type": "crisis_footer", "props": {}},
    ]

    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "title": "For Carers",
        "slug": "for-carers",
        "content": "",
        "blocks": FOR_CARERS_BLOCKS,
        "status": "published",
        "is_system_page": False,
        "is_migrated_from_tsx": True,
        "linked_persona": "helen",
        "meta_title": "For Carers - Radio Check",
        "meta_description": "Support for those caring for UK veterans",
        "created_at": now,
        "updated_at": now,
    }
    db.cms_pages.insert_one(doc)
    return {"message": "Seeded for-carers page with block content", "blocks": len(FOR_CARERS_BLOCKS)}


# Parameterized {slug} routes below

@router.get("/admin/pages/{slug}")
async def admin_get_page(slug: str):
    """Admin endpoint: fetch a single page by slug with full content."""
    page = db.cms_pages.find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["id"] = str(page.pop("_id"))
    return {"page": page}


@router.put("/admin/pages/{slug}")
async def admin_update_page(slug: str, update: PageUpdate):
    """Update a CMS page by slug."""
    page = db.cms_pages.find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    updates = {k: v for k, v in update.model_dump().items() if v is not None}

    if "slug" in updates and updates["slug"] != slug:
        if db.cms_pages.find_one({"slug": updates["slug"]}):
            raise HTTPException(status_code=409, detail="Slug already in use")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    db.cms_pages.update_one({"slug": slug}, {"$set": updates})
    return {"message": "Page updated"}


@router.delete("/admin/pages/{slug}")
async def admin_delete_page(slug: str):
    """Delete a CMS page. System pages cannot be deleted."""
    page = db.cms_pages.find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    if page.get("is_system_page"):
        raise HTTPException(status_code=403, detail="System pages cannot be deleted")
    db.cms_pages.delete_one({"slug": slug})
    return {"message": "Page deleted"}


@router.put("/admin/pages/{slug}/status")
async def admin_toggle_page_status(slug: str):
    """Toggle page status between draft and published."""
    page = db.cms_pages.find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    new_status = "published" if page.get("status") == "draft" else "draft"
    db.cms_pages.update_one({"slug": slug}, {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}})
    return {"message": f"Page status changed to {new_status}", "status": new_status}
