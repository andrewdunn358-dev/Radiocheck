"""
AI Usage Tracker
================
Tracks token usage and costs for OpenAI and Gemini APIs.
Helps monitor spending against budget limits.
"""

import tiktoken
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import logging

# Pricing (as of 2026) - adjust these as needed
# Prices in GBP per 1M tokens
PRICING = {
    "openai": {
        "gpt-4o-mini": {
            "input": 0.12,   # £0.12 per 1M input tokens (~$0.15)
            "output": 0.48,  # £0.48 per 1M output tokens (~$0.60)
        },
        "gpt-4o": {
            "input": 2.00,   # £2.00 per 1M input tokens
            "output": 8.00,  # £8.00 per 1M output tokens
        },
    },
    "gemini": {
        "gemini-2.0-flash": {
            "input": 0.06,   # £0.06 per 1M input tokens
            "output": 0.24,  # £0.24 per 1M output tokens
        },
        "gemini-2.0-flash-lite": {
            "input": 0.03,   # Even cheaper
            "output": 0.12,
        },
    }
}

# Monthly budget limits (in GBP)
BUDGET_LIMITS = {
    "openai": 20.00,   # £20/month for OpenAI
    "gemini": 10.00,   # £10/month for Gemini
}


def count_openai_tokens(text: str, model: str = "gpt-4o-mini") -> int:
    """Count tokens for OpenAI models using tiktoken."""
    try:
        # Use cl100k_base encoding for GPT-4 models
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception as e:
        logging.warning(f"Token counting failed: {e}")
        # Rough estimate: ~4 chars per token
        return len(text) // 4


def estimate_gemini_tokens(text: str) -> int:
    """Estimate tokens for Gemini (roughly similar to OpenAI tokenization)."""
    # Gemini uses similar tokenization, ~4 chars per token
    return len(text) // 4


def calculate_cost(
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int
) -> float:
    """Calculate cost in GBP for a given API call."""
    if provider not in PRICING or model not in PRICING[provider]:
        logging.warning(f"Unknown pricing for {provider}/{model}, using default")
        # Default to cheapest pricing
        input_price = 0.06
        output_price = 0.24
    else:
        input_price = PRICING[provider][model]["input"]
        output_price = PRICING[provider][model]["output"]
    
    input_cost = (input_tokens / 1_000_000) * input_price
    output_cost = (output_tokens / 1_000_000) * output_price
    
    return input_cost + output_cost


async def log_ai_usage(
    db,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    session_id: str,
    character_id: str,
    cost_gbp: float
):
    """Log AI usage to database for tracking."""
    usage_record = {
        "timestamp": datetime.utcnow(),
        "provider": provider,
        "model": model,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
        "cost_gbp": cost_gbp,
        "session_id": session_id[:20] if session_id else "unknown",  # Truncate for privacy
        "character_id": character_id,
    }
    
    await db.ai_usage.insert_one(usage_record)
    return usage_record


async def get_usage_summary(db, days: int = 30) -> Dict[str, Any]:
    """Get AI usage summary for the past N days."""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Aggregate usage by provider
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": "$provider",
            "total_input_tokens": {"$sum": "$input_tokens"},
            "total_output_tokens": {"$sum": "$output_tokens"},
            "total_tokens": {"$sum": "$total_tokens"},
            "total_cost_gbp": {"$sum": "$cost_gbp"},
            "request_count": {"$sum": 1},
        }}
    ]
    
    results = await db.ai_usage.aggregate(pipeline).to_list(length=10)
    
    summary = {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": datetime.utcnow().isoformat(),
        "providers": {},
        "total_cost_gbp": 0,
        "total_requests": 0,
        "total_tokens": 0,
    }
    
    for result in results:
        provider = result["_id"]
        budget_limit = BUDGET_LIMITS.get(provider, 0)
        cost = result["total_cost_gbp"]
        
        summary["providers"][provider] = {
            "input_tokens": result["total_input_tokens"],
            "output_tokens": result["total_output_tokens"],
            "total_tokens": result["total_tokens"],
            "cost_gbp": round(cost, 4),
            "request_count": result["request_count"],
            "budget_limit_gbp": budget_limit,
            "budget_remaining_gbp": round(budget_limit - cost, 4),
            "budget_percentage_used": round((cost / budget_limit) * 100, 1) if budget_limit > 0 else 0,
        }
        
        summary["total_cost_gbp"] += cost
        summary["total_requests"] += result["request_count"]
        summary["total_tokens"] += result["total_tokens"]
    
    summary["total_cost_gbp"] = round(summary["total_cost_gbp"], 4)
    
    return summary


async def get_daily_usage(db, days: int = 7) -> list:
    """Get daily usage breakdown for charts."""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {
                "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "provider": "$provider"
            },
            "tokens": {"$sum": "$total_tokens"},
            "cost_gbp": {"$sum": "$cost_gbp"},
            "requests": {"$sum": 1},
        }},
        {"$sort": {"_id.date": 1}}
    ]
    
    results = await db.ai_usage.aggregate(pipeline).to_list(length=100)
    
    # Format for frontend
    daily_data = []
    for result in results:
        daily_data.append({
            "date": result["_id"]["date"],
            "provider": result["_id"]["provider"],
            "tokens": result["tokens"],
            "cost_gbp": round(result["cost_gbp"], 4),
            "requests": result["requests"],
        })
    
    return daily_data


async def get_usage_by_character(db, days: int = 30) -> list:
    """Get usage breakdown by AI character."""
    start_date = datetime.utcnow() - timedelta(days=days)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": "$character_id",
            "total_tokens": {"$sum": "$total_tokens"},
            "cost_gbp": {"$sum": "$cost_gbp"},
            "requests": {"$sum": 1},
        }},
        {"$sort": {"requests": -1}}
    ]
    
    results = await db.ai_usage.aggregate(pipeline).to_list(length=50)
    
    return [
        {
            "character": result["_id"],
            "tokens": result["total_tokens"],
            "cost_gbp": round(result["cost_gbp"], 4),
            "requests": result["requests"],
        }
        for result in results
    ]
