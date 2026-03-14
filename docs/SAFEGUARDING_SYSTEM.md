# Radio Check - AI Safeguarding System Documentation

**Version 3.0 | March 2026**

This document explains how the multi-layered AI safeguarding system works, how components link together, and potential areas for improvement.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Layer 1: Keyword-Based Detection](#layer-1-keyword-based-detection)
4. [Layer 2: Semantic Similarity Analysis](#layer-2-semantic-similarity-analysis)
5. [Layer 3: Conversation Trajectory Analysis](#layer-3-conversation-trajectory-analysis)
6. [Layer 4: AI Safety Classifier (LLM)](#layer-4-ai-safety-classifier-llm)
7. [How Layers Combine](#how-layers-combine)
8. [Risk Levels & Thresholds](#risk-levels--thresholds)
9. [Crisis Patterns Detected](#crisis-patterns-detected)
10. [Intervention Actions](#intervention-actions)
11. [Data Flow Example](#data-flow-example)
12. [Current Statistics](#current-statistics)
13. [Potential Improvements](#potential-improvements)

---

## System Overview

The Radio Check safeguarding system uses **4 complementary detection layers** to identify users at risk of suicide or self-harm:

| Layer | Method | Speed | Strength | Weakness |
|-------|--------|-------|----------|----------|
| **1. Keyword** | Regex pattern matching | ~1ms | Fast, deterministic | Misses novel phrasing |
| **2. Semantic** | Embedding similarity | ~50ms | Catches indirect expressions | Requires good dataset |
| **3. Conversation** | Trajectory analysis | ~10ms | Sees escalation patterns | Needs message history |
| **4. AI (LLM)** | GPT-4o-mini classification | ~300ms | Deep contextual understanding | Cost, latency |

**Core Principle**: The system **fails safe** - when in doubt, it assumes risk rather than dismissing it.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER MESSAGE                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED SAFETY LAYER                                     │
│                   (unified_safety.py)                                        │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   LAYER 1    │  │   LAYER 2    │  │   LAYER 3    │  │   LAYER 4    │    │
│  │   Keyword    │  │   Semantic   │  │ Conversation │  │  AI (LLM)    │    │
│  │   Matching   │  │  Similarity  │  │  Trajectory  │  │  Classifier  │    │
│  │              │  │              │  │              │  │              │    │
│  │ safety_      │  │ semantic_    │  │ conversation │  │ ai_safety_   │    │
│  │ monitor.py   │  │ model.py     │  │ _monitor.py  │  │ classifier.py│    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                  │            │
│         │    Weight: 30%  │   Weight: 25%   │   Weight: 35%    │  Selective │
│         └────────────────┴─────────────────┴──────────────────┘            │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌─────────────────────┐                             │
│                         │   SCORE COMBINER    │                             │
│                         │   + Failsafe Checks │                             │
│                         └─────────────────────┘                             │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │       FINAL RISK LEVEL         │
                    │  NONE | LOW | MEDIUM | HIGH |  │
                    │         IMMINENT               │
                    └────────────────────────────────┘
                                     │
                                     ▼
         ┌───────────────────────────┴────────────────────────────┐
         │                                                         │
         ▼                                                         ▼
┌─────────────────────┐                               ┌─────────────────────┐
│  INTERVENTION       │                               │  STAFF ALERT        │
│  - Safety wrapper   │                               │  (if HIGH/IMMINENT) │
│  - Crisis resources │                               │                     │
│  - Human referral   │                               └─────────────────────┘
└─────────────────────┘
```

---

## Layer 1: Keyword-Based Detection

**File**: `backend/safety/safety_monitor.py`

### How It Works

1. **Text Normalization**: Lowercase, collapse whitespace, remove repeated punctuation
2. **Pattern Matching**: Word-boundary-aware regex matching against keyword lists
3. **Negation Handling**: Checks if a match is preceded by negation phrases (e.g., "don't want to kill myself")
4. **Context Multipliers**: Escalates risk when combining factors are present (substances, isolation, finality, means)

### Keyword Categories

| Category | Examples | Base Score |
|----------|----------|------------|
| **CRITICAL** | "kill myself", "end my life", "drive off a cliff" | 95-100 |
| **HIGH** | "don't want to live", "better off dead" | 70-80 |
| **MEDIUM** | "hurt myself", "no hope", "dead inside" | 50-60 |
| **LOW** | "wish i was dead", "want to disappear" | 25-35 |

### Context Multipliers

When these are detected alongside keywords, risk is escalated:
- **Substances**: "drunk", "on drugs", "been drinking"
- **Isolation**: "all alone", "no one cares"
- **Finality**: "goodbye", "final", "forever"
- **Means**: "gun", "pills", "bridge", "tablets", "car"

### Strengths & Limitations

**Strengths**:
- Very fast (~1ms)
- Deterministic (same input = same output)
- Catches explicit crisis language
- UK-specific slang included ("top myself", "do myself in", "tablets")

**Limitations**:
- Misses novel phrasing not in keyword list
- Can have false positives (e.g., "I want to kill my boss's project")
- Doesn't understand context or metaphors

---

## Layer 2: Semantic Similarity Analysis

**File**: `backend/safety/semantic_model.py`

### How It Works

1. **Embedding Generation**: Uses `sentence-transformers/all-MiniLM-L6-v2` to convert messages to vectors
2. **Similarity Calculation**: Compares user message against the phrase dataset (527 phrases)
3. **Category Matching**: Identifies which category the message is most similar to
4. **Indirect Expression Detection**: Catches phrases that mean the same thing but use different words

### Example Detections

| User Message | Most Similar Phrase | Similarity | Category |
|--------------|---------------------|------------|----------|
| "I'm so exhausted with everything" | "tired of life" | 0.78 | passive_death_wish |
| "Nobody would even notice" | "nobody would miss me" | 0.85 | burden |
| "I've figured out how" | "figured out how to do it" | 0.82 | method |

### Scoring

- Similarity >= 0.85 with category in [intent, method] → **Failsafe trigger**
- Similarity >= 0.70 → Adds to overall risk score
- Similarity >= 0.50 → Invokes AI classifier

### Strengths & Limitations

**Strengths**:
- Catches indirect expressions ("I'm just so tired of fighting" → maps to ideation)
- Language-agnostic to some degree
- Learns from the phrase dataset

**Limitations**:
- Requires good phrase dataset coverage
- Can miss very novel phrasing
- Processing time ~50ms per message

---

## Layer 3: Conversation Trajectory Analysis

**File**: `backend/safety/conversation_monitor.py`

### How It Works

1. **History Tracking**: Maintains last 50 messages per conversation
2. **Category Progression**: Tracks which risk categories have been seen
3. **Pattern Detection**: Looks for specific crisis escalation patterns
4. **Escalation Scoring**: Calculates risk based on how conversation is progressing

### Tracked State

For each conversation, the system tracks:
- All message risk scores
- Categories triggered (distress → hopelessness → ideation → method → intent)
- Detected patterns
- Risk trend (stable, improving, escalating, critical)
- Peak risk level reached

### Crisis Patterns Detected

| Pattern Name | Trigger Condition | Bonus Score |
|--------------|-------------------|-------------|
| **EMOTIONAL_DECLINE** | distress → hopelessness → ideation (within 15 msgs) | +40 |
| **METHOD_INTRODUCTION** | method + any of [distress, hopelessness, ideation] | +50 |
| **INTENT_ESCALATION** | ideation → intent (within 8 msgs) | +70 |
| **FINALITY_BEHAVIOR** | finality + any of [intent, method, ideation] | +80 |
| **BURDEN_TO_IDEATION** | burden → ideation (within 12 msgs) | +25 |
| **REPEATED_IDEATION** | ideation appears 2+ times across conversation | +50 |
| **MULTIPLE_WEAK_SIGNALS** | 3+ distress signals in 5 messages | +30 |
| **SUDDEN_EMOTIONAL_DROP** | Significant drop in emotional intensity | +25 |
| **RAPID_ESCALATION** | distress → ideation → method within 10 mins | +60 |
| **METHOD_PERSISTENCE** | method mentioned anywhere in last 50 messages | +40 |

### Strengths & Limitations

**Strengths**:
- Sees patterns across the whole conversation
- Detects gradual escalation that individual messages might miss
- Can identify users who mention methods early then escalate later

**Limitations**:
- Needs message history (new sessions start fresh)
- Memory-based (lost if server restarts)
- Requires minimum 3 messages for pattern detection

---

## Layer 4: AI Safety Classifier (LLM)

**File**: `backend/safety/ai_safety_classifier.py`

### How It Works

1. **Selective Invocation**: Only called when other layers indicate potential risk
2. **Context Assembly**: Includes current message + last 15-20 conversation messages
3. **LLM Classification**: Uses GPT-4o-mini to analyze for suicide risk
4. **Structured Output**: Returns JSON with risk level, confidence, indicators

### When AI is Invoked

The AI classifier is called when ANY of these conditions are true:
- Rule-based score >= 30
- Keywords were triggered
- Semantic similarity >= 0.5
- Pattern detected by conversation monitor
- Conversation is escalating

### AI Prompt

The AI is prompted with:
- Mental health safety classifier role
- Risk level definitions (none → low → medium → high → imminent)
- Things to look for (direct statements, indirect expressions, method mentions, etc.)
- Military/veteran-specific indicators

### Response Format

```json
{
  "risk_level": "none|low|medium|high|imminent",
  "confidence": 0.0-1.0,
  "contains_self_harm_intent": true|false,
  "detected_indicators": ["list", "of", "indicators"],
  "reason": "brief explanation"
}
```

### Critical Rule: AI Can UPGRADE, Never DOWNGRADE

If rule-based detection says HIGH risk, AI **cannot** lower it to MEDIUM. AI can only:
- Upgrade LOW → MEDIUM
- Upgrade MEDIUM → HIGH
- Leave as-is

This ensures explicit keyword matches are never overridden by AI.

### Strengths & Limitations

**Strengths**:
- Deep contextual understanding
- Can catch subtle language the rules miss
- Considers full conversation context
- Handles ambiguity better than rules

**Limitations**:
- Adds ~300ms latency
- API costs
- Can hallucinate (mitigated by structured output)
- Requires API availability

---

## How Layers Combine

### Scoring Formula

```
Final Score = (keyword_score × 0.30) + 
              (conversation_score × 0.35) + 
              (semantic_score × 0.25) + 
              (pattern_bonus × 0.10)

If AI invoked and found higher risk with confidence >= 0.6:
  Final Score = blend(Final Score, AI Score) with AI having max 30% influence
```

### Failsafe Overrides

These conditions **immediately set IMMINENT risk**, regardless of score:

1. **Explicit suicide plan** (keyword layer returns "critical")
2. **Imminent intent** (conversation layer returns "IMMINENT")
3. **High semantic similarity to suicide** (similarity >= 0.85 for intent/method)
4. **Rapid escalation with method mention**
5. **Intent confirmation pattern detected**

---

## Risk Levels & Thresholds

| Risk Level | Score Range | Description | Action |
|------------|-------------|-------------|--------|
| **NONE** | 0 | No safety flags detected | Normal response |
| **LOW** | 1-39 | Passive ideation, mild distress | Monitor, gentle check-in |
| **MEDIUM** | 40-59 | Self-harm signals, hopelessness | Direct concern, offer resources |
| **HIGH** | 60-79 | Active ideation, no immediate plan | Crisis response, staff alert |
| **IMMINENT** | 80-100 | Immediate danger, method/intent | Emergency resources, block AI response |

---

## Intervention Actions

### By Risk Level

| Risk Level | Safety Wrapper | Resources Shown | Staff Alert | Block AI |
|------------|----------------|-----------------|-------------|----------|
| NONE | No | No | No | No |
| LOW | No | No | No | No |
| MEDIUM | Yes (gentle) | Optional | No | No |
| HIGH | Yes (concern) | Yes | Yes | No |
| IMMINENT | Yes (crisis) | Yes | Yes | Yes |

### Crisis Resources Shown (UK)

1. **Emergency Services**: 999
2. **Samaritans**: 116 123 (free, 24/7)
3. **Crisis Text Line**: Text SHOUT to 85258
4. **CALM**: 0800 58 58 58 (5pm-midnight)

---

## Data Flow Example

**User sends**: "I've been thinking about driving off that bridge near my house"

```
LAYER 1 (Keyword):
  - Match: "drive off" → CRITICAL
  - Context multiplier: No
  - Score: 95

LAYER 2 (Semantic):
  - Similarity to "drive off a bridge": 0.92
  - Category: method
  - Score: 92

LAYER 3 (Conversation):
  - Previous messages showed "distress" category
  - Pattern detected: METHOD_INTRODUCTION
  - Pattern bonus: +50
  - Score: 75

LAYER 4 (AI):
  - Invoked because keyword triggered
  - AI Risk: "imminent"
  - AI Confidence: 0.95
  - Indicators: ["specific method", "specific location", "bridge mention"]

COMBINED:
  - Weighted: (95 × 0.30) + (75 × 0.35) + (92 × 0.25) + (50 × 0.10) = 79.75
  - Failsafe triggered: semantic >= 0.85 for method category
  - FINAL: IMMINENT (failsafe override)

INTERVENTION:
  - Staff alert: TRIGGERED
  - Crisis resources: SHOWN
  - AI response: BLOCKED
  - Safety message: "I'm very worried about what you're sharing..."
```

---

## Current Statistics

### Phrase Dataset (phrase_dataset.py)

| Category | Phrase Count | Example |
|----------|--------------|---------|
| distress | 79 | "i feel awful", "struggling to cope" |
| hopelessness | 68 | "no hope", "can't go on" |
| passive_death_wish | 43 | "wish i wasn't here", "tired of living" |
| ideation | 50 | "thinking about suicide", "want to end it" |
| method | 80 | "hang myself", "overdose on pills" |
| intent | 44 | "going to kill myself", "doing it tonight" |
| finality | 46 | "final goodbye", "left a note" |
| self_harm | 24 | "cut myself", "burn myself" |
| burden | 27 | "i'm a burden", "better off without me" |
| isolation | 25 | "all alone", "nobody cares" |
| veteran | 45 | "should have died over there", "survivor's guilt" |
| uk_colloquial | 24 | "at my wit's end", "lost the will" |
| emotional | 40 | "empty inside", "darkness is winning" |
| relationship_loss | 36 | "lost my reason to live", "want to join them" |

**TOTAL: 527 phrases**

---

## Potential Improvements

### High Priority

1. **Real-time model updates**
   - Currently phrases are static. Could implement a review queue where flagged candidate phrases are reviewed by staff and added.

2. **Persistent conversation state**
   - Currently lost on server restart. Could store in Redis/MongoDB for persistence across deployments.

3. **Multi-language support**
   - Currently English only. Welsh is a planned feature. Could add Welsh translations of all phrases.

4. **User history across sessions**
   - Currently each session is independent. Could track user's risk history across multiple sessions.

### Medium Priority

5. **Fine-tuned embedding model**
   - Current model is general-purpose. Could fine-tune on mental health/crisis data for better semantic matching.

6. **Escalation prediction**
   - Currently reactive. Could predict risk escalation before it happens based on early signals.

7. **Voice/audio analysis**
   - Could analyze voice tone during calls for emotional state.

8. **Integration with clinical systems**
   - If deployed in clinical setting, could integrate with NHS systems for care coordination.

### Low Priority (Future)

9. **Personalized risk thresholds**
   - Different users may have different baseline risk levels.

10. **A/B testing of interventions**
    - Test which intervention messages are most effective.

11. **False positive feedback loop**
    - Allow staff to mark false positives to improve the model.

---

## Files Reference

| File | Purpose |
|------|---------|
| `safety/unified_safety.py` | Main entry point, combines all layers |
| `safety/safety_monitor.py` | Layer 1: Keyword matching |
| `safety/semantic_model.py` | Layer 2: Embedding similarity |
| `safety/conversation_monitor.py` | Layer 3: Trajectory analysis |
| `safety/ai_safety_classifier.py` | Layer 4: LLM classification |
| `safety/phrase_dataset.py` | 527 phrases database |
| `enhanced_safety_layer.py` | Legacy enhanced safety (still used for some features) |
| `routers/safeguarding.py` | API endpoints for staff alerts |

---

## Testing

Run safeguarding tests:
```bash
cd /app/backend
pytest tests/test_safeguarding.py -v
pytest tests/test_unified_safeguarding.py -v
```

---

## Contact

For questions about the safeguarding system, contact the Radio Check development team.

**Last Updated**: March 2026
