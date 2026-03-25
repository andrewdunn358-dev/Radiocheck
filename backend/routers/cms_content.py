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

@router.get("/admin/pages")
async def admin_list_pages():
    """Admin endpoint: list all pages with full metadata (no content body for perf)."""
    pages = list(db.cms_pages.find({}, {"content": 0}).sort([("status", -1), ("title", 1)]))
    return {"pages": [{"id": str(p.pop("_id")), **{k: v for k, v in p.items()}} for p in pages]}


@router.get("/admin/pages/{slug}")
async def admin_get_page(slug: str):
    """Admin endpoint: fetch a single page by slug with full content."""
    page = db.cms_pages.find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    page["id"] = str(page.pop("_id"))
    return {"page": page}


@router.post("/admin/pages")
async def admin_create_page(page: PageCreate):
    """Create a new CMS page."""
    # Check slug uniqueness
    existing = db.cms_pages.find_one({"slug": page.slug})
    if existing:
        # Auto-append suffix
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


@router.put("/admin/pages/{slug}")
async def admin_update_page(slug: str, update: PageUpdate):
    """Update a CMS page by slug."""
    page = db.cms_pages.find_one({"slug": slug})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    updates = {k: v for k, v in update.model_dump().items() if v is not None}

    # If slug is being changed, check uniqueness
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


@router.post("/admin/pages/seed")
async def admin_seed_pages():
    """Seed the 3 proof-of-concept pages from hardcoded TSX content."""
    existing = db.cms_pages.count_documents({})
    if existing > 0:
        return {"message": f"Database already has {existing} pages. Clear first or add individually."}

    SEED_PAGES = [
        {
            "title": "About Radio Check",
            "slug": "about",
            "linked_persona": None,
            "is_system_page": False,
            "is_migrated_from_tsx": True,
            "meta_title": "About Radio Check",
            "meta_description": "Learn about Radio Check — AI-powered peer support for UK veterans",
            "status": "published",
            "content": """<h2>What Is Radio Check?</h2>
<p>Radio Check combines peer support and AI conversation to give veterans a place to talk when it matters.</p>
<blockquote><p>Sometimes a real person isn't available straight away. When that happens, the chat is there — so you're not carrying things alone.</p></blockquote>
<p><strong>Talking helps. Even talking here.</strong></p>

<h2>What the AI Is For</h2>
<p>The AI is here to:</p>
<ul>
<li>Listen without judgement</li>
<li>Help you slow things down</li>
<li>Let you get things off your chest</li>
<li>Encourage healthy coping and real-world support</li>
</ul>
<p><em>You're always in control of the conversation.</em></p>

<h2>What the AI Is Not For</h2>
<p>The AI does not:</p>
<ul>
<li>Give medical or legal advice</li>
<li>Diagnose or treat conditions</li>
<li>Replace professionals</li>
<li>Handle emergencies on its own</li>
</ul>
<p><strong>If you're in immediate danger, human help matters most — and we'll always encourage that.</strong></p>

<h2>Is This Right for Me?</h2>
<p>Radio Check may help if you:</p>
<ul>
<li>Feel low, stressed, angry, or stuck</li>
<li>Find it easier to talk in writing</li>
<li>Don't want to feel like a burden</li>
<li>Just need somewhere safe to talk</li>
</ul>
<p><strong>You don't need to be in crisis to use this.</strong></p>

<h2>Safety &amp; Trust</h2>
<ul>
<li>Safeguarding comes first</li>
<li>Conversations handled with care</li>
<li>No judgement. No pressure.</li>
<li>Your privacy matters</li>
</ul>
<p><em>We're upfront about what this is — and what it isn't.</em></p>

<h2>The Bottom Line</h2>
<p>If Radio Check helps you feel even a little less alone, it's doing its job.</p>
<p><strong>Someone is on the net.</strong></p>"""
        },
        {
            "title": "Criminal Justice Support",
            "slug": "criminal-justice",
            "linked_persona": "rachel",
            "is_system_page": False,
            "is_migrated_from_tsx": True,
            "meta_title": "Criminal Justice Support for Veterans",
            "meta_description": "Support for veterans in or leaving the criminal justice system",
            "status": "published",
            "content": """<h2>We Understand</h2>
<p>Serving personnel and veterans can face unique challenges with the law, often linked to untreated PTSD, substance misuse, or difficulty adjusting to civilian life.</p>
<p>Whether you're currently in prison, recently released, or facing charges — specialist support is available. You're not alone.</p>

<blockquote><p>This section provides emotional support. For legal advice, please consult a qualified legal professional. We offer wellbeing support and signposting to specialist services.</p></blockquote>

<h2>Support Organisations</h2>
<p>Specialist services for veterans in the justice system:</p>
<ul>
<li><strong>NACRO</strong> — Support for people with criminal records (0300 123 1999) — <a href="https://www.nacro.org.uk">nacro.org.uk</a></li>
<li><strong>Forces in Mind Trust</strong> — Research on veterans in justice system — <a href="https://www.fim-trust.org">fim-trust.org</a></li>
<li><strong>Walking With The Wounded</strong> — Employment &amp; justice support — <a href="https://walkingwiththewounded.org.uk">walkingwiththewounded.org.uk</a></li>
<li><strong>Project Nova</strong> — Armed forces personnel in the CJS (0800 917 7299) — <a href="https://www.rfea.org.uk/our-programmes/project-nova/">rfea.org.uk</a></li>
<li><strong>Probation Services</strong> — Support after prison release (0800 464 0708) — <a href="https://www.gov.uk/guidance/probation-services">gov.uk</a></li>
<li><strong>Veterans' Gateway</strong> — First point of contact for veterans (0808 802 1212) — <a href="https://www.veteransgateway.org.uk">veteransgateway.org.uk</a></li>
</ul>

<p><strong>Project Nova</strong> works specifically with veterans at every stage of the criminal justice system — from arrest to release.</p>"""
        },
        {
            "title": "Privacy Policy",
            "slug": "privacy-policy",
            "linked_persona": None,
            "is_system_page": True,
            "is_migrated_from_tsx": True,
            "meta_title": "Privacy Policy — Radio Check",
            "meta_description": "How Radio Check collects, uses, and safeguards your personal information",
            "status": "published",
            "content": """<p><em>Last Updated: February 2026</em></p>

<h2>1. Introduction</h2>
<p>Radio Check ("we", "our", "us") is committed to protecting the privacy of UK veterans and their families. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use our mobile application and services.</p>

<h2>2. Information We Collect</h2>
<h3>Account Information</h3>
<ul>
<li>Email address</li>
<li>Name (optional)</li>
<li>Password (encrypted)</li>
<li>Service branch and regiment (optional)</li>
</ul>

<h3>Chat &amp; Communication Data</h3>
<ul>
<li>Messages with AI companions</li>
<li>Messages with peer supporters (Buddy Finder)</li>
<li>Callback requests</li>
<li>Call logs (metadata only, calls are peer-to-peer)</li>
</ul>

<h3>Technical Data</h3>
<ul>
<li>Device type and operating system</li>
<li>IP address (for security purposes)</li>
<li>App usage statistics</li>
</ul>

<h2>3. How We Use Your Information</h2>
<p>We use your information to:</p>
<ul>
<li>Provide AI-powered support and companionship</li>
<li>Connect you with peer supporters</li>
<li>Detect and respond to crisis situations (safeguarding)</li>
<li>Improve our services and AI responses</li>
<li>Send important service notifications</li>
<li>Comply with legal obligations</li>
</ul>

<h2>4. AI Chat Processing</h2>
<p>When you chat with our AI companions, your messages are processed by OpenAI's language models to generate supportive responses. We do not share your identity with OpenAI. Chat data is also analyzed locally to detect potential crisis situations and trigger our safeguarding protocols.</p>

<h2>5. Safeguarding</h2>
<p>Your safety is our priority. Our system automatically monitors conversations for signs of crisis, including:</p>
<ul>
<li>Expressions of suicidal ideation</li>
<li>Self-harm indicators</li>
<li>Severe distress signals</li>
</ul>
<p>If detected, our safeguarding team may be alerted and may reach out to offer support. In extreme cases, we may contact emergency services if we believe there is immediate risk to life.</p>

<h2>6. Data Security</h2>
<p>We implement robust security measures including:</p>
<ul>
<li>AES-256 encryption for sensitive data</li>
<li>Secure password hashing (bcrypt)</li>
<li>HTTPS for all data transmission</li>
<li>Regular security audits</li>
<li>Access controls and staff training</li>
</ul>

<h2>7. Data Retention</h2>
<ul>
<li>Account data: Retained while your account is active, plus 7 years after deletion</li>
<li>Chat history: 7 years (for safeguarding audit purposes)</li>
<li>Technical logs: 90 days</li>
</ul>
<p>You can request data deletion at any time through the app settings.</p>

<h2>8. Your Rights (GDPR)</h2>
<p>Under UK data protection law, you have the right to:</p>
<ul>
<li>Access your personal data</li>
<li>Correct inaccurate data</li>
<li>Request deletion of your data</li>
<li>Export your data in a portable format</li>
<li>Object to certain processing</li>
<li>Withdraw consent</li>
</ul>
<p>To exercise these rights, go to Settings &gt; Privacy in the app, or contact us at privacy@radiocheck.me</p>

<h2>9. Third-Party Services</h2>
<p>We use the following third-party services:</p>
<ul>
<li>OpenAI: AI chat processing (USA, with Standard Contractual Clauses)</li>
<li>MongoDB Atlas: Database hosting (UK/EU)</li>
<li>Render: Application hosting (EU)</li>
<li>Expo: Mobile app services</li>
</ul>

<h2>10. Children's Privacy</h2>
<p>Radio Check is intended for adults (18+). We do not knowingly collect personal information from children under 18. If you believe a child has provided us with personal information, please contact us immediately.</p>

<h2>11. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of significant changes through the app or by email. Your continued use of the app after changes constitutes acceptance of the updated policy.</p>

<h2>12. Contact Us</h2>
<p>For privacy-related queries: <strong>privacy@radiocheck.me</strong></p>
<p>For complaints, you may also contact the Information Commissioner's Office (ICO): <a href="https://ico.org.uk">ico.org.uk</a></p>"""
        },
    ]

    for page in SEED_PAGES:
        page["created_at"] = datetime.now(timezone.utc).isoformat()
        page["updated_at"] = datetime.now(timezone.utc).isoformat()

    db.cms_pages.insert_many(SEED_PAGES)
    return {"message": f"Seeded {len(SEED_PAGES)} pages"}
