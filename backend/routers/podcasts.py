"""
Podcasts Router - Fetches and caches latest episodes from RSS feeds
"""

from fastapi import APIRouter
from typing import Dict, Optional
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import asyncio
import logging

router = APIRouter(prefix="/podcasts", tags=["podcasts"])
logger = logging.getLogger(__name__)

# YouTube RSS feed URLs (preferred - more up to date)
YOUTUBE_FEEDS = {
    "frankies-pod": "https://www.youtube.com/feeds/videos.xml?channel_id=UCANN4qRGM5yyBUH27TWLbQQ",
    "tom-petch": "https://www.youtube.com/feeds/videos.xml?channel_id=UCOadyBud5o3iK7YTkpYRBCQ",
    "old-paratrooper": "https://www.youtube.com/feeds/videos.xml?channel_id=UC4oHlVmxAjog1Dz6BDByNfQ",
    "beyond-barracks": "https://www.youtube.com/feeds/videos.xml?channel_id=UCh_L_4t746PldKRfIKvj-0w",
    "military-veterans": "https://www.youtube.com/feeds/videos.xml?channel_id=UCchZkQj1bA3m21o_cLv8DuA",
}

# Fallback podcast RSS feed URLs
PODCAST_FEEDS = {
    "frankies-pod": "https://feeds.acast.com/public/shows/6714f073e3d9082a5a2bf617",
    "tom-petch": "https://anchor.fm/s/10a795454/podcast/rss",
    "old-paratrooper": "https://feeds.acast.com/public/shows/679a9f6b65f74095105c2af2",
    "combat-stress-100": "https://feeds.acast.com/public/shows/62a8eda1-799d-4268-805c-6dd9ebd85c8e",
    "talking-wounded": "https://talkingwiththewounded.podbean.com/feed.xml",
}

# Cache for latest episodes
_episode_cache: Dict[str, dict] = {}
_cache_timestamp: Optional[datetime] = None
CACHE_DURATION = timedelta(hours=6)  # Refresh every 6 hours


async def fetch_rss_feed(url: str, timeout: float = 10.0) -> Optional[str]:
    """Fetch RSS feed content"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=timeout, follow_redirects=True)
            if response.status_code == 200:
                return response.text
    except Exception as e:
        logger.warning(f"Failed to fetch RSS feed {url}: {e}")
    return None


def parse_youtube_rss(xml_content: str) -> Optional[dict]:
    """Parse YouTube Atom feed and extract the latest video"""
    try:
        root = ET.fromstring(xml_content)
        
        # YouTube uses Atom namespace
        ns = {
            'atom': 'http://www.w3.org/2005/Atom',
            'yt': 'http://www.youtube.com/xml/schemas/2015',
            'media': 'http://search.yahoo.com/mrss/'
        }
        
        # Find the first entry (latest video)
        entry = root.find('atom:entry', ns)
        if entry is None:
            # Try without namespace
            entry = root.find('{http://www.w3.org/2005/Atom}entry')
            if entry is None:
                return None
        
        # Extract video details
        title_elem = entry.find('atom:title', ns) or entry.find('{http://www.w3.org/2005/Atom}title')
        published_elem = entry.find('atom:published', ns) or entry.find('{http://www.w3.org/2005/Atom}published')
        link_elem = entry.find('atom:link[@rel="alternate"]', ns) or entry.find('{http://www.w3.org/2005/Atom}link[@rel="alternate"]')
        
        title = title_elem.text if title_elem is not None else "Unknown Video"
        pub_date = published_elem.text if published_elem is not None else None
        link = link_elem.get('href', '') if link_elem is not None else ''
        
        # Parse the publication date (YouTube uses ISO format)
        date_str = None
        if pub_date:
            try:
                # YouTube format: 2026-02-20T00:00:13+00:00
                parsed_date = datetime.fromisoformat(pub_date.replace('Z', '+00:00'))
                date_str = parsed_date.isoformat()
            except Exception:
                date_str = pub_date
        
        return {
            "title": title,
            "date": date_str,
            "link": link
        }
    except ET.ParseError as e:
        logger.warning(f"Failed to parse YouTube XML: {e}")
    except Exception as e:
        logger.warning(f"Error parsing YouTube feed: {e}")
    
    return None


def parse_rss_latest_episode(xml_content: str) -> Optional[dict]:
    """Parse RSS feed and extract the latest episode"""
    try:
        root = ET.fromstring(xml_content)
        
        # Find the channel element
        channel = root.find('channel')
        if channel is None:
            return None
        
        # Find the first item (latest episode)
        item = channel.find('item')
        if item is None:
            return None
        
        # Extract episode details
        title_elem = item.find('title')
        pub_date_elem = item.find('pubDate')
        link_elem = item.find('link')
        
        # Try to find enclosure (audio link) if link is not present
        if link_elem is None or not link_elem.text:
            enclosure = item.find('enclosure')
            if enclosure is not None:
                link = enclosure.get('url', '')
            else:
                link = ''
        else:
            link = link_elem.text
        
        title = title_elem.text if title_elem is not None else "Unknown Episode"
        pub_date = pub_date_elem.text if pub_date_elem is not None else None
        
        # Parse the publication date
        date_str = None
        if pub_date:
            try:
                # Common RSS date formats
                for fmt in [
                    "%a, %d %b %Y %H:%M:%S %z",
                    "%a, %d %b %Y %H:%M:%S %Z",
                    "%Y-%m-%dT%H:%M:%S%z",
                    "%Y-%m-%d",
                ]:
                    try:
                        parsed_date = datetime.strptime(pub_date.strip(), fmt)
                        date_str = parsed_date.isoformat()
                        break
                    except ValueError:
                        continue
                
                # If none of the formats worked, try a more lenient approach
                if date_str is None:
                    # Just extract the date portion
                    date_str = pub_date[:25] if len(pub_date) > 25 else pub_date
            except Exception:
                date_str = pub_date
        
        return {
            "title": title,
            "date": date_str,
            "link": link
        }
    except ET.ParseError as e:
        logger.warning(f"Failed to parse RSS XML: {e}")
    except Exception as e:
        logger.warning(f"Error parsing RSS feed: {e}")
    
    return None


async def refresh_episode_cache():
    """Refresh the episode cache by fetching all RSS feeds"""
    global _episode_cache, _cache_timestamp
    
    new_cache = {}
    
    # Fetch all feeds concurrently
    tasks = []
    podcast_ids = []
    
    for podcast_id, feed_url in PODCAST_FEEDS.items():
        tasks.append(fetch_rss_feed(feed_url))
        podcast_ids.append(podcast_id)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    for podcast_id, result in zip(podcast_ids, results):
        if isinstance(result, str) and result:
            episode = parse_rss_latest_episode(result)
            if episode:
                new_cache[podcast_id] = episode
                logger.info(f"Cached latest episode for {podcast_id}: {episode['title']}")
    
    _episode_cache = new_cache
    _cache_timestamp = datetime.utcnow()
    
    return new_cache


@router.get("/latest")
async def get_latest_episodes() -> Dict[str, dict]:
    """
    Get the latest episode for each podcast.
    Results are cached for 6 hours.
    """
    global _episode_cache, _cache_timestamp
    
    # Check if cache needs refresh
    if _cache_timestamp is None or datetime.utcnow() - _cache_timestamp > CACHE_DURATION:
        await refresh_episode_cache()
    
    return _episode_cache


@router.post("/refresh")
async def force_refresh_episodes() -> Dict[str, dict]:
    """
    Force refresh of episode cache.
    Admin endpoint to manually trigger refresh.
    """
    return await refresh_episode_cache()


@router.get("/feed/{podcast_id}")
async def get_podcast_feed(podcast_id: str) -> dict:
    """
    Get the latest episode for a specific podcast.
    """
    if podcast_id not in PODCAST_FEEDS:
        return {"error": "Podcast not found", "available": list(PODCAST_FEEDS.keys())}
    
    xml_content = await fetch_rss_feed(PODCAST_FEEDS[podcast_id])
    if xml_content:
        episode = parse_rss_latest_episode(xml_content)
        if episode:
            return {podcast_id: episode}
    
    return {"error": "Could not fetch feed"}
