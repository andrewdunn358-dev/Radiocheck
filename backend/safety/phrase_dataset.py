"""
RadioCheck Safeguarding - Comprehensive Phrase Dataset
======================================================
Version 1.0 - March 2026

500+ categorized suicide-related indicators with severity weights.
Used for keyword detection, fuzzy matching, and semantic similarity training.
"""

from typing import Dict, List
from dataclasses import dataclass

@dataclass
class PhraseEntry:
    phrase: str
    category: str
    severity_weight: int
    is_uk_specific: bool = False

# ============================================================================
# DISTRESS INDICATORS (Weight: 20-40)
# Early warning signs of emotional distress
# ============================================================================
DISTRESS_PHRASES = [
    # General distress
    PhraseEntry("i feel awful", "distress", 25),
    PhraseEntry("i feel terrible", "distress", 25),
    PhraseEntry("i feel horrible", "distress", 25),
    PhraseEntry("i feel dreadful", "distress", 25, True),
    PhraseEntry("i feel rotten", "distress", 20, True),
    PhraseEntry("i feel rubbish", "distress", 20, True),
    PhraseEntry("i feel like crap", "distress", 25),
    PhraseEntry("i feel like shit", "distress", 30),
    PhraseEntry("i feel really low", "distress", 35),
    PhraseEntry("i feel so low", "distress", 35),
    PhraseEntry("i feel incredibly low", "distress", 40),
    PhraseEntry("i feel down", "distress", 20),
    PhraseEntry("i feel really down", "distress", 30),
    PhraseEntry("i feel so down", "distress", 30),
    PhraseEntry("feeling down today", "distress", 20),
    PhraseEntry("feeling rough", "distress", 20, True),
    PhraseEntry("feeling off", "distress", 15),
    PhraseEntry("not feeling great", "distress", 20),
    PhraseEntry("not feeling good", "distress", 20),
    PhraseEntry("not feeling myself", "distress", 25),
    PhraseEntry("struggling today", "distress", 25),
    PhraseEntry("having a hard time", "distress", 25),
    PhraseEntry("having a rough time", "distress", 25),
    PhraseEntry("having a bad day", "distress", 20),
    PhraseEntry("everything is hard", "distress", 30),
    PhraseEntry("everything feels hard", "distress", 30),
    PhraseEntry("life is hard", "distress", 30),
    PhraseEntry("life is so hard", "distress", 35),
    PhraseEntry("things are difficult", "distress", 25),
    PhraseEntry("things are tough", "distress", 25),
    PhraseEntry("stressed out", "distress", 20),
    PhraseEntry("overwhelmed", "distress", 30),
    PhraseEntry("completely overwhelmed", "distress", 35),
    PhraseEntry("can't cope", "distress", 40),
    PhraseEntry("struggling to cope", "distress", 35),
    PhraseEntry("barely coping", "distress", 40),
    PhraseEntry("falling apart", "distress", 40),
    PhraseEntry("breaking down", "distress", 40),
    PhraseEntry("at breaking point", "distress", 45),
    PhraseEntry("reached my limit", "distress", 40),
    PhraseEntry("at my wit's end", "distress", 40, True),
    PhraseEntry("at the end of my tether", "distress", 45, True),
    PhraseEntry("had a row", "distress", 20, True),
    PhraseEntry("had a bust up", "distress", 20, True),
    PhraseEntry("lost my job", "distress", 35),
    PhraseEntry("relationship ended", "distress", 35),
    PhraseEntry("partner left me", "distress", 40),
    PhraseEntry("wife left me", "distress", 40),
    PhraseEntry("husband left me", "distress", 40),
    PhraseEntry("divorce", "distress", 35),
    PhraseEntry("lost everything", "distress", 50),
    PhraseEntry("nothing is going right", "distress", 35),
    PhraseEntry("everything is going wrong", "distress", 35),
]

# ============================================================================
# HOPELESSNESS INDICATORS (Weight: 40-60)
# Cognitive distortions suggesting loss of hope
# ============================================================================
HOPELESSNESS_PHRASES = [
    # Core hopelessness
    PhraseEntry("no hope", "hopelessness", 50),
    PhraseEntry("there's no hope", "hopelessness", 55),
    PhraseEntry("i have no hope", "hopelessness", 55),
    PhraseEntry("lost all hope", "hopelessness", 60),
    PhraseEntry("i've lost all hope", "hopelessness", 60),
    PhraseEntry("hopeless", "hopelessness", 50),
    PhraseEntry("feeling hopeless", "hopelessness", 55),
    PhraseEntry("completely hopeless", "hopelessness", 60),
    PhraseEntry("utterly hopeless", "hopelessness", 60),
    
    # Future-oriented hopelessness
    PhraseEntry("no future", "hopelessness", 55),
    PhraseEntry("i have no future", "hopelessness", 60),
    PhraseEntry("there's no future", "hopelessness", 55),
    PhraseEntry("no future for me", "hopelessness", 65),
    PhraseEntry("can't see a future", "hopelessness", 60),
    PhraseEntry("don't see a future", "hopelessness", 60),
    PhraseEntry("i don't see a future", "hopelessness", 60),
    PhraseEntry("nothing will change", "hopelessness", 50),
    PhraseEntry("things will never change", "hopelessness", 55),
    PhraseEntry("it will never get better", "hopelessness", 60),
    PhraseEntry("things will never get better", "hopelessness", 60),
    PhraseEntry("nothing ever changes", "hopelessness", 50),
    PhraseEntry("it's never going to improve", "hopelessness", 55),
    PhraseEntry("there's no way out", "hopelessness", 65),
    PhraseEntry("no way out", "hopelessness", 60),
    PhraseEntry("trapped", "hopelessness", 45),
    PhraseEntry("i feel trapped", "hopelessness", 50),
    PhraseEntry("completely trapped", "hopelessness", 55),
    PhraseEntry("no escape", "hopelessness", 60),
    PhraseEntry("there's no escape", "hopelessness", 60),
    
    # Helplessness
    PhraseEntry("nothing i can do", "hopelessness", 45),
    PhraseEntry("there's nothing i can do", "hopelessness", 50),
    PhraseEntry("powerless", "hopelessness", 45),
    PhraseEntry("i feel powerless", "hopelessness", 50),
    PhraseEntry("completely powerless", "hopelessness", 55),
    PhraseEntry("helpless", "hopelessness", 45),
    PhraseEntry("i feel helpless", "hopelessness", 50),
    PhraseEntry("nothing works", "hopelessness", 45),
    PhraseEntry("nothing ever works", "hopelessness", 50),
    PhraseEntry("tried everything", "hopelessness", 45),
    PhraseEntry("i've tried everything", "hopelessness", 50),
    PhraseEntry("nothing helps", "hopelessness", 50),
    PhraseEntry("nothing will help", "hopelessness", 55),
    
    # Giving up
    PhraseEntry("what's the point", "hopelessness", 55),
    PhraseEntry("whats the point", "hopelessness", 55),
    PhraseEntry("no point", "hopelessness", 50),
    PhraseEntry("no point anymore", "hopelessness", 60),
    PhraseEntry("no point in anything", "hopelessness", 60),
    PhraseEntry("no point in trying", "hopelessness", 55),
    PhraseEntry("no point in living", "hopelessness", 80),
    PhraseEntry("i give up", "hopelessness", 55),
    PhraseEntry("given up", "hopelessness", 50),
    PhraseEntry("i've given up", "hopelessness", 55),
    PhraseEntry("giving up", "hopelessness", 50),
    PhraseEntry("ready to give up", "hopelessness", 55),
    PhraseEntry("can't go on", "hopelessness", 65),
    PhraseEntry("i can't go on", "hopelessness", 70),
    PhraseEntry("can't keep going", "hopelessness", 65),
    PhraseEntry("i can't keep going", "hopelessness", 70),
    PhraseEntry("can't do this anymore", "hopelessness", 65),
    PhraseEntry("i can't do this anymore", "hopelessness", 70),
]

# ============================================================================
# PASSIVE DEATH WISH (Weight: 50-70)
# Indirect expressions of wanting to die without active planning
# ============================================================================
PASSIVE_DEATH_WISH_PHRASES = [
    PhraseEntry("wish i was dead", "passive_death_wish", 70),
    PhraseEntry("i wish i was dead", "passive_death_wish", 70),
    PhraseEntry("wish i wasn't here", "passive_death_wish", 65),
    PhraseEntry("i wish i wasn't here", "passive_death_wish", 65),
    PhraseEntry("wish i didn't exist", "passive_death_wish", 70),
    PhraseEntry("i wish i didn't exist", "passive_death_wish", 70),
    PhraseEntry("wish i'd never been born", "passive_death_wish", 70),
    PhraseEntry("i wish i'd never been born", "passive_death_wish", 70),
    PhraseEntry("shouldn't exist", "passive_death_wish", 65),
    PhraseEntry("i shouldn't exist", "passive_death_wish", 65),
    PhraseEntry("shouldn't be here", "passive_death_wish", 60),
    PhraseEntry("i shouldn't be here", "passive_death_wish", 60),
    PhraseEntry("don't belong here", "passive_death_wish", 55),
    PhraseEntry("i don't belong here", "passive_death_wish", 55),
    PhraseEntry("want to disappear", "passive_death_wish", 60),
    PhraseEntry("i want to disappear", "passive_death_wish", 60),
    PhraseEntry("wish i could disappear", "passive_death_wish", 60),
    PhraseEntry("want to fade away", "passive_death_wish", 60),
    PhraseEntry("i want to fade away", "passive_death_wish", 60),
    PhraseEntry("stop existing", "passive_death_wish", 65),
    PhraseEntry("i want to stop existing", "passive_death_wish", 65),
    PhraseEntry("don't want to wake up", "passive_death_wish", 70),
    PhraseEntry("i don't want to wake up", "passive_death_wish", 70),
    PhraseEntry("hope i don't wake up", "passive_death_wish", 75),
    PhraseEntry("i hope i don't wake up", "passive_death_wish", 75),
    PhraseEntry("go to sleep and never wake up", "passive_death_wish", 75),
    PhraseEntry("not wake up tomorrow", "passive_death_wish", 75),
    PhraseEntry("don't want to be here anymore", "passive_death_wish", 65),
    PhraseEntry("i don't want to be here anymore", "passive_death_wish", 65),
    PhraseEntry("don't want to live", "passive_death_wish", 75),
    PhraseEntry("i don't want to live", "passive_death_wish", 75),
    PhraseEntry("tired of living", "passive_death_wish", 70),
    PhraseEntry("i'm tired of living", "passive_death_wish", 70),
    PhraseEntry("tired of life", "passive_death_wish", 65),
    PhraseEntry("i'm tired of life", "passive_death_wish", 65),
    PhraseEntry("tired of waking up", "passive_death_wish", 70),
    PhraseEntry("tired of it all", "passive_death_wish", 60, True),
    PhraseEntry("sick of it all", "passive_death_wish", 55, True),
    PhraseEntry("had enough of life", "passive_death_wish", 70),
    PhraseEntry("i've had enough of life", "passive_death_wish", 70),
    PhraseEntry("done with life", "passive_death_wish", 75),
    PhraseEntry("i'm done with life", "passive_death_wish", 75),
    PhraseEntry("fed up with life", "passive_death_wish", 65, True),
    PhraseEntry("sick of life", "passive_death_wish", 65),
    PhraseEntry("life isn't worth living", "passive_death_wish", 75),
    PhraseEntry("not worth living", "passive_death_wish", 70),
]

# ============================================================================
# ACTIVE IDEATION (Weight: 70-85)
# Thoughts about suicide/self-harm
# ============================================================================
IDEATION_PHRASES = [
    # Direct ideation
    PhraseEntry("thinking about suicide", "ideation", 85),
    PhraseEntry("thinking about killing myself", "ideation", 85),
    PhraseEntry("thoughts of suicide", "ideation", 80),
    PhraseEntry("suicidal thoughts", "ideation", 80),
    PhraseEntry("having suicidal thoughts", "ideation", 85),
    PhraseEntry("i have suicidal thoughts", "ideation", 85),
    PhraseEntry("can't stop thinking about death", "ideation", 80),
    PhraseEntry("keep thinking about dying", "ideation", 80),
    PhraseEntry("thinking about ending it", "ideation", 85),
    PhraseEntry("thinking about ending it all", "ideation", 85),
    PhraseEntry("thought about ending my life", "ideation", 85),
    PhraseEntry("considering ending my life", "ideation", 85),
    PhraseEntry("contemplating suicide", "ideation", 85),
    
    # Indirect ideation
    PhraseEntry("want to end it", "ideation", 80),
    PhraseEntry("i want to end it", "ideation", 80),
    PhraseEntry("want to end it all", "ideation", 85),
    PhraseEntry("i want to end it all", "ideation", 85),
    PhraseEntry("want to end my life", "ideation", 85),
    PhraseEntry("i want to end my life", "ideation", 85),
    PhraseEntry("want to die", "ideation", 80),
    PhraseEntry("i want to die", "ideation", 80),
    PhraseEntry("just want to die", "ideation", 85),
    PhraseEntry("i just want to die", "ideation", 85),
    PhraseEntry("rather be dead", "ideation", 80),
    PhraseEntry("i'd rather be dead", "ideation", 80),
    PhraseEntry("better off dead", "ideation", 80),
    PhraseEntry("i'd be better off dead", "ideation", 80),
    
    # UK slang
    PhraseEntry("top myself", "ideation", 85, True),
    PhraseEntry("thinking of topping myself", "ideation", 85, True),
    PhraseEntry("do myself in", "ideation", 85, True),
    PhraseEntry("thinking of doing myself in", "ideation", 85, True),
    PhraseEntry("off myself", "ideation", 85),
    PhraseEntry("thinking of offing myself", "ideation", 85),
    PhraseEntry("snuff myself", "ideation", 80, True),
    
    # Metaphorical
    PhraseEntry("want this to be over", "ideation", 60),
    PhraseEntry("want it all to end", "ideation", 70),
    PhraseEntry("just want the pain to stop", "ideation", 65),
    PhraseEntry("make the pain stop", "ideation", 60),
    PhraseEntry("want peace", "ideation", 40),
    PhraseEntry("want permanent peace", "ideation", 75),
    PhraseEntry("want eternal peace", "ideation", 80),
]

# ============================================================================
# METHOD MENTIONS (Weight: 80-95)
# References to specific suicide methods
# ============================================================================
METHOD_PHRASES = [
    # Overdose/medication
    PhraseEntry("take tablets", "method", 75),
    PhraseEntry("take some tablets", "method", 80),
    PhraseEntry("take all my tablets", "method", 90),
    PhraseEntry("take all my pills", "method", 90),
    PhraseEntry("take too many pills", "method", 85),
    PhraseEntry("swallow tablets", "method", 80),
    PhraseEntry("overdose", "method", 85),
    PhraseEntry("overdose on pills", "method", 90),
    PhraseEntry("overdose on medication", "method", 90),
    PhraseEntry("overdose on paracetamol", "method", 95, True),
    PhraseEntry("overdose on painkillers", "method", 95),
    PhraseEntry("take all my medication", "method", 90),
    PhraseEntry("stockpiling pills", "method", 85),
    PhraseEntry("saving up pills", "method", 85),
    PhraseEntry("collected enough pills", "method", 90),
    
    # Hanging
    PhraseEntry("hang myself", "method", 95),
    PhraseEntry("hanging myself", "method", 95),
    PhraseEntry("find a rope", "method", 85),
    PhraseEntry("tie a noose", "method", 95),
    PhraseEntry("got a rope", "method", 85),
    
    # Vehicle
    PhraseEntry("drive off a cliff", "method", 95),
    PhraseEntry("driving off a cliff", "method", 95),
    PhraseEntry("drive of a cliff", "method", 95),  # typo
    PhraseEntry("driving of a cliff", "method", 95),  # typo
    PhraseEntry("crash my car", "method", 85),
    PhraseEntry("drive into a wall", "method", 90),
    PhraseEntry("drive into traffic", "method", 95),
    PhraseEntry("drive off a bridge", "method", 95),
    PhraseEntry("step in front of traffic", "method", 95),
    PhraseEntry("step in front of a train", "method", 95),
    PhraseEntry("jump in front of a train", "method", 95),
    PhraseEntry("throw myself in front of", "method", 95),
    
    # Heights
    PhraseEntry("jump off a bridge", "method", 95),
    PhraseEntry("jump off a building", "method", 95),
    PhraseEntry("jump from a height", "method", 90),
    PhraseEntry("throw myself off", "method", 95),
    PhraseEntry("find a tall building", "method", 85),
    PhraseEntry("going to the bridge", "method", 75),
    PhraseEntry("beachy head", "method", 90, True),  # UK cliff
    
    # Cutting/bleeding
    PhraseEntry("cut my wrists", "method", 90),
    PhraseEntry("slit my wrists", "method", 95),
    PhraseEntry("cut myself deeply", "method", 85),
    PhraseEntry("cut an artery", "method", 95),
    PhraseEntry("bleed out", "method", 90),
    
    # Drowning
    PhraseEntry("drown myself", "method", 90),
    PhraseEntry("walk into the sea", "method", 85),
    PhraseEntry("walk into the ocean", "method", 85),
    PhraseEntry("walk into the water", "method", 80),
    
    # Firearms
    PhraseEntry("shoot myself", "method", 95),
    PhraseEntry("use a gun", "method", 85),
    PhraseEntry("got a gun", "method", 85),
    PhraseEntry("access to a firearm", "method", 80),
    
    # Suffocation
    PhraseEntry("suffocate myself", "method", 90),
    PhraseEntry("plastic bag over my head", "method", 95),
    PhraseEntry("stop breathing", "method", 75),
    
    # Generic method talk
    PhraseEntry("know how i'll do it", "method", 90),
    PhraseEntry("figured out how to do it", "method", 90),
    PhraseEntry("found a way", "method", 80),
    PhraseEntry("got a plan", "method", 85),
    PhraseEntry("made a plan", "method", 85),
    PhraseEntry("have a plan", "method", 85),
]

# ============================================================================
# INTENT CONFIRMATION (Weight: 90-100)
# Statements confirming intention to act
# ============================================================================
INTENT_PHRASES = [
    # Direct intent
    PhraseEntry("going to kill myself", "intent", 100),
    PhraseEntry("i'm going to kill myself", "intent", 100),
    PhraseEntry("im going to kill myself", "intent", 100),
    PhraseEntry("going to end my life", "intent", 100),
    PhraseEntry("i'm going to end my life", "intent", 100),
    PhraseEntry("going to do it", "intent", 90),
    PhraseEntry("i'm going to do it", "intent", 95),
    PhraseEntry("im going to do it", "intent", 95),
    PhraseEntry("about to do it", "intent", 95),
    PhraseEntry("i'm about to do it", "intent", 100),
    PhraseEntry("doing it tonight", "intent", 100),
    PhraseEntry("doing it today", "intent", 100),
    PhraseEntry("doing it now", "intent", 100),
    PhraseEntry("this is it", "intent", 80),
    PhraseEntry("made my decision", "intent", 85),
    PhraseEntry("i've made my decision", "intent", 85),
    PhraseEntry("decided to end it", "intent", 100),
    PhraseEntry("i've decided to end it", "intent", 100),
    PhraseEntry("going through with it", "intent", 95),
    PhraseEntry("i'm going through with it", "intent", 95),
    PhraseEntry("nothing can stop me", "intent", 90),
    PhraseEntry("won't change my mind", "intent", 85),
    PhraseEntry("i won't change my mind", "intent", 85),
    PhraseEntry("my mind is made up", "intent", 85),
    
    # Time-specific intent
    PhraseEntry("tonight is the night", "intent", 95),
    PhraseEntry("this is my last day", "intent", 100),
    PhraseEntry("won't be here tomorrow", "intent", 100),
    PhraseEntry("i won't be here tomorrow", "intent", 100),
    PhraseEntry("by tomorrow i'll be gone", "intent", 100),
    PhraseEntry("after tonight", "intent", 80),
    PhraseEntry("when everyone's asleep", "intent", 85),
    PhraseEntry("before morning", "intent", 85),
    
    # Confirmation phrases
    PhraseEntry("yes i'm serious", "intent", 70),
    PhraseEntry("i mean it", "intent", 65),
    PhraseEntry("i'm not joking", "intent", 70),
    PhraseEntry("this isn't a joke", "intent", 70),
    PhraseEntry("i'm really going to", "intent", 85),
    PhraseEntry("i really am going to", "intent", 85),
]

# ============================================================================
# FINALITY LANGUAGE (Weight: 70-90)
# Goodbye, final wishes, settling affairs
# ============================================================================
FINALITY_PHRASES = [
    # Goodbye language
    PhraseEntry("goodbye", "finality", 50),
    PhraseEntry("goodbye forever", "finality", 90),
    PhraseEntry("this is goodbye", "finality", 85),
    PhraseEntry("final goodbye", "finality", 90),
    PhraseEntry("saying goodbye", "finality", 70),
    PhraseEntry("wanted to say goodbye", "finality", 80),
    PhraseEntry("before i go", "finality", 65),
    PhraseEntry("before i leave", "finality", 55),
    PhraseEntry("when i'm gone", "finality", 70),
    PhraseEntry("after i'm gone", "finality", 75),
    PhraseEntry("won't be around", "finality", 70),
    PhraseEntry("i won't be around", "finality", 70),
    PhraseEntry("won't be here much longer", "finality", 85),
    PhraseEntry("not going to be here", "finality", 75),
    PhraseEntry("i won't be here", "finality", 75),
    
    # Final message language
    PhraseEntry("this is my final message", "finality", 95),
    PhraseEntry("my last message", "finality", 85),
    PhraseEntry("final words", "finality", 90),
    PhraseEntry("my last words", "finality", 90),
    PhraseEntry("one last thing", "finality", 60),
    PhraseEntry("need to tell you something", "finality", 50),
    PhraseEntry("in case something happens", "finality", 65),
    
    # Settling affairs
    PhraseEntry("given away my things", "finality", 85),
    PhraseEntry("giving away my stuff", "finality", 80),
    PhraseEntry("wrote a note", "finality", 85),
    PhraseEntry("written a note", "finality", 85),
    PhraseEntry("left a note", "finality", 90),
    PhraseEntry("left a letter", "finality", 85),
    PhraseEntry("put my affairs in order", "finality", 85),
    PhraseEntry("sorted out my will", "finality", 80),
    PhraseEntry("updated my will", "finality", 75),
    PhraseEntry("told everyone i love them", "finality", 75),
    PhraseEntry("said my goodbyes", "finality", 85),
    PhraseEntry("made peace with everyone", "finality", 70),
    PhraseEntry("tied up loose ends", "finality", 75),
    
    # Thank you / appreciation
    PhraseEntry("thank you for everything", "finality", 50),
    PhraseEntry("thanks for trying to help", "finality", 60),
    PhraseEntry("you've been good to me", "finality", 55),
    PhraseEntry("i appreciate what you've done", "finality", 50),
]

# ============================================================================
# SELF-HARM INDICATORS (Weight: 50-75)
# Non-suicidal self-injury and related thoughts
# ============================================================================
SELF_HARM_PHRASES = [
    PhraseEntry("hurt myself", "self_harm", 60),
    PhraseEntry("want to hurt myself", "self_harm", 65),
    PhraseEntry("going to hurt myself", "self_harm", 70),
    PhraseEntry("harm myself", "self_harm", 60),
    PhraseEntry("want to harm myself", "self_harm", 65),
    PhraseEntry("cut myself", "self_harm", 65),
    PhraseEntry("want to cut myself", "self_harm", 70),
    PhraseEntry("cutting myself", "self_harm", 70),
    PhraseEntry("started cutting", "self_harm", 70),
    PhraseEntry("been cutting", "self_harm", 70),
    PhraseEntry("burn myself", "self_harm", 65),
    PhraseEntry("burning myself", "self_harm", 70),
    PhraseEntry("punish myself", "self_harm", 55),
    PhraseEntry("need to punish myself", "self_harm", 60),
    PhraseEntry("self harm", "self_harm", 60),
    PhraseEntry("self-harm", "self_harm", 60),
    PhraseEntry("self harming", "self_harm", 65),
    PhraseEntry("self-harming", "self_harm", 65),
    PhraseEntry("relapsed on self harm", "self_harm", 70),
    PhraseEntry("urge to cut", "self_harm", 65),
    PhraseEntry("urge to hurt myself", "self_harm", 65),
    PhraseEntry("deserve to be hurt", "self_harm", 60),
    PhraseEntry("i deserve pain", "self_harm", 60),
]

# ============================================================================
# BURDEN STATEMENTS (Weight: 60-80)
# Feeling like a burden to others
# ============================================================================
BURDEN_PHRASES = [
    PhraseEntry("i'm a burden", "burden", 65),
    PhraseEntry("i am a burden", "burden", 65),
    PhraseEntry("just a burden", "burden", 70),
    PhraseEntry("burden to everyone", "burden", 75),
    PhraseEntry("burden on everyone", "burden", 75),
    PhraseEntry("burden to my family", "burden", 75),
    PhraseEntry("burden on my family", "burden", 75),
    PhraseEntry("dragging everyone down", "burden", 65),
    PhraseEntry("i'm dragging everyone down", "burden", 70),
    PhraseEntry("making everyone's life worse", "burden", 70),
    PhraseEntry("everyone would be better off without me", "burden", 85),
    PhraseEntry("they'd be better off without me", "burden", 85),
    PhraseEntry("better off without me", "burden", 80),
    PhraseEntry("world would be better without me", "burden", 85),
    PhraseEntry("my family would be better off", "burden", 80),
    PhraseEntry("nobody would miss me", "burden", 80),
    PhraseEntry("no one would miss me", "burden", 80),
    PhraseEntry("no one would notice", "burden", 75),
    PhraseEntry("nobody would notice if i was gone", "burden", 85),
    PhraseEntry("they wouldn't even notice", "burden", 70),
    PhraseEntry("i'm worthless", "burden", 60),
    PhraseEntry("completely worthless", "burden", 65),
    PhraseEntry("i'm useless", "burden", 55),
    PhraseEntry("waste of space", "burden", 65),
    PhraseEntry("i'm a waste of space", "burden", 70),
]

# ============================================================================
# ISOLATION INDICATORS (Weight: 40-60)
# Feelings of being alone/disconnected
# ============================================================================
ISOLATION_PHRASES = [
    PhraseEntry("all alone", "isolation", 45),
    PhraseEntry("i'm all alone", "isolation", 50),
    PhraseEntry("completely alone", "isolation", 55),
    PhraseEntry("totally alone", "isolation", 55),
    PhraseEntry("no one to talk to", "isolation", 50),
    PhraseEntry("nobody to talk to", "isolation", 50),
    PhraseEntry("no one understands", "isolation", 45),
    PhraseEntry("nobody understands", "isolation", 45),
    PhraseEntry("no one cares", "isolation", 55),
    PhraseEntry("nobody cares", "isolation", 55),
    PhraseEntry("nobody cares about me", "isolation", 60),
    PhraseEntry("no one cares about me", "isolation", 60),
    PhraseEntry("i have no one", "isolation", 55),
    PhraseEntry("got nobody", "isolation", 50),
    PhraseEntry("i've got nobody", "isolation", 55),
    PhraseEntry("no friends", "isolation", 45),
    PhraseEntry("i have no friends", "isolation", 50),
    PhraseEntry("no family", "isolation", 50),
    PhraseEntry("cut off from everyone", "isolation", 55),
    PhraseEntry("pushed everyone away", "isolation", 50),
    PhraseEntry("i've pushed everyone away", "isolation", 55),
    PhraseEntry("isolated myself", "isolation", 50),
    PhraseEntry("can't connect with anyone", "isolation", 50),
    PhraseEntry("disconnected from everyone", "isolation", 55),
]

# ============================================================================
# ADDITIONAL VETERAN/MILITARY SPECIFIC (Weight: varies)
# Phrases commonly used by veterans and military personnel
# ============================================================================
VETERAN_PHRASES = [
    # Combat-related
    PhraseEntry("can't live with what i did", "ideation", 75),
    PhraseEntry("blood on my hands", "distress", 55),
    PhraseEntry("can't forget what i saw", "distress", 45),
    PhraseEntry("nightmares won't stop", "distress", 40),
    PhraseEntry("flashbacks are getting worse", "distress", 45),
    PhraseEntry("can't get the images out of my head", "distress", 50),
    PhraseEntry("the guilt is killing me", "ideation", 60),
    PhraseEntry("should have died over there", "passive_death_wish", 70),
    PhraseEntry("should have died instead", "passive_death_wish", 70),
    PhraseEntry("wish i'd died over there", "passive_death_wish", 75),
    PhraseEntry("mates died and i lived", "distress", 50),
    PhraseEntry("survivor's guilt", "distress", 45),
    PhraseEntry("don't deserve to be here", "passive_death_wish", 65),
    
    # Service-related
    PhraseEntry("lost my purpose", "hopelessness", 50),
    PhraseEntry("don't know who i am anymore", "hopelessness", 55),
    PhraseEntry("useless civilian now", "burden", 55),
    PhraseEntry("can't function in civvy street", "distress", 45, True),
    PhraseEntry("nothing like the forces", "isolation", 40),
    PhraseEntry("no one understands service", "isolation", 50),
    PhraseEntry("miss my unit", "distress", 30),
    PhraseEntry("lost my family when i left", "distress", 45),
    PhraseEntry("regiment was my family", "isolation", 40),
    PhraseEntry("no mates left", "isolation", 55),
    PhraseEntry("everyone from my unit is gone", "isolation", 60),
    
    # PTSD indicators
    PhraseEntry("ptsd is destroying me", "distress", 55),
    PhraseEntry("can't control my anger", "distress", 45),
    PhraseEntry("rage inside me", "distress", 40),
    PhraseEntry("scared of myself", "distress", 55),
    PhraseEntry("don't trust myself", "distress", 60),
    PhraseEntry("afraid of what i might do", "ideation", 65),
    PhraseEntry("losing control", "distress", 50),
    
    # UK military slang
    PhraseEntry("jack of it all", "hopelessness", 55, True),
    PhraseEntry("done my time now what", "hopelessness", 45, True),
    PhraseEntry("head's gone", "distress", 55, True),
    PhraseEntry("lost the plot", "distress", 50, True),
    PhraseEntry("proper messed up", "distress", 45, True),
]

# ============================================================================
# ADDITIONAL UK COLLOQUIAL (Weight: varies)
# UK-specific phrases and slang
# ============================================================================
UK_COLLOQUIAL_PHRASES = [
    PhraseEntry("done in", "hopelessness", 50, True),
    PhraseEntry("completely done in", "hopelessness", 55, True),
    PhraseEntry("knackered with life", "passive_death_wish", 60, True),
    PhraseEntry("can't be arsed anymore", "hopelessness", 45, True),
    PhraseEntry("sick of the lot", "hopelessness", 45, True),
    PhraseEntry("sick of everything", "hopelessness", 50),
    PhraseEntry("absolutely gutted", "distress", 35, True),
    PhraseEntry("properly gutted", "distress", 35, True),
    PhraseEntry("feel like rubbish", "distress", 25, True),
    PhraseEntry("feel like absolute rubbish", "distress", 30, True),
    PhraseEntry("going spare", "distress", 35, True),
    PhraseEntry("at my wit's end", "hopelessness", 50, True),
    PhraseEntry("had a gutful", "hopelessness", 45, True),
    PhraseEntry("throwing in the towel", "hopelessness", 50),
    PhraseEntry("chucking in the towel", "hopelessness", 50, True),
    PhraseEntry("can't hack it anymore", "hopelessness", 55),
    PhraseEntry("lost the will", "passive_death_wish", 65),
    PhraseEntry("lost the will to live", "passive_death_wish", 75),
    PhraseEntry("bloody awful", "distress", 25, True),
    PhraseEntry("feel bloody awful", "distress", 30, True),
    PhraseEntry("in a right state", "distress", 35, True),
    PhraseEntry("proper mess", "distress", 40, True),
    PhraseEntry("in a proper mess", "distress", 45, True),
]

# ============================================================================
# ADDITIONAL EMOTIONAL EXPRESSIONS (Weight: varies)
# More nuanced emotional expressions
# ============================================================================
EMOTIONAL_EXPRESSIONS = [
    # Exhaustion
    PhraseEntry("running on empty", "distress", 40),
    PhraseEntry("nothing left in the tank", "hopelessness", 55),
    PhraseEntry("emotionally drained", "distress", 40),
    PhraseEntry("completely drained", "distress", 45),
    PhraseEntry("exhausted inside", "distress", 40),
    PhraseEntry("mentally exhausted", "distress", 35),
    PhraseEntry("too tired to care", "hopelessness", 50),
    PhraseEntry("too tired to try", "hopelessness", 55),
    PhraseEntry("too tired to fight", "hopelessness", 60),
    
    # Pain
    PhraseEntry("hurt so much", "distress", 40),
    PhraseEntry("hurts too much", "distress", 50),
    PhraseEntry("pain won't stop", "distress", 55),
    PhraseEntry("constant pain", "distress", 45),
    PhraseEntry("pain is unbearable", "passive_death_wish", 60),
    PhraseEntry("can't bear the pain", "passive_death_wish", 65),
    PhraseEntry("agony every day", "distress", 50),
    
    # Darkness/emptiness
    PhraseEntry("darkness inside", "distress", 45),
    PhraseEntry("darkness is winning", "hopelessness", 60),
    PhraseEntry("consumed by darkness", "hopelessness", 65),
    PhraseEntry("empty inside", "distress", 40),
    PhraseEntry("feel so empty", "distress", 45),
    PhraseEntry("hollow inside", "distress", 45),
    PhraseEntry("numb to everything", "distress", 40),
    PhraseEntry("can't feel anything", "distress", 45),
    PhraseEntry("dead inside", "passive_death_wish", 55),
    
    # Defeat
    PhraseEntry("defeated", "hopelessness", 45),
    PhraseEntry("completely defeated", "hopelessness", 55),
    PhraseEntry("beaten down", "hopelessness", 50),
    PhraseEntry("ground down", "hopelessness", 50),
    PhraseEntry("worn down", "distress", 40),
    PhraseEntry("broken by life", "hopelessness", 60),
    PhraseEntry("life has broken me", "hopelessness", 65),
]

# ============================================================================
# RELATIONSHIP AND LOSS (Weight: varies)
# Relationship breakdown and grief phrases
# ============================================================================
RELATIONSHIP_LOSS_PHRASES = [
    # Relationship breakdown
    PhraseEntry("lost my marriage", "distress", 45),
    PhraseEntry("marriage is over", "distress", 40),
    PhraseEntry("she left me", "distress", 40),
    PhraseEntry("he left me", "distress", 40),
    PhraseEntry("walked out on me", "distress", 45),
    PhraseEntry("don't love me anymore", "distress", 45),
    PhraseEntry("no one loves me", "isolation", 55),
    PhraseEntry("nobody loves me", "isolation", 55),
    PhraseEntry("will never love again", "hopelessness", 50),
    PhraseEntry("can't trust anyone again", "isolation", 50),
    PhraseEntry("everyone leaves me", "isolation", 60),
    PhraseEntry("always get abandoned", "isolation", 55),
    PhraseEntry("nobody stays", "isolation", 55),
    
    # Grief and loss
    PhraseEntry("can't go on without them", "hopelessness", 65),
    PhraseEntry("want to be with them", "passive_death_wish", 70),
    PhraseEntry("want to join them", "passive_death_wish", 75),
    PhraseEntry("lost my reason to live", "ideation", 75),
    PhraseEntry("they were my everything", "distress", 50),
    PhraseEntry("can't cope with the grief", "distress", 55),
    PhraseEntry("grief is killing me", "distress", 60),
    PhraseEntry("can't face life without them", "passive_death_wish", 70),
    PhraseEntry("nothing without them", "hopelessness", 60),
    PhraseEntry("life meaningless without them", "hopelessness", 65),
    
    # Family estrangement
    PhraseEntry("kids don't want to see me", "distress", 55),
    PhraseEntry("family cut me off", "isolation", 55),
    PhraseEntry("lost my children", "distress", 55),
    PhraseEntry("can't see my kids", "distress", 50),
    PhraseEntry("grandkids don't know me", "distress", 45),
    PhraseEntry("family are strangers now", "isolation", 50),
]

# ============================================================================
# AGGREGATE ALL PHRASES
# ============================================================================
ALL_PHRASES: List[PhraseEntry] = (
    DISTRESS_PHRASES +
    HOPELESSNESS_PHRASES +
    PASSIVE_DEATH_WISH_PHRASES +
    IDEATION_PHRASES +
    METHOD_PHRASES +
    INTENT_PHRASES +
    FINALITY_PHRASES +
    SELF_HARM_PHRASES +
    BURDEN_PHRASES +
    ISOLATION_PHRASES +
    VETERAN_PHRASES +
    UK_COLLOQUIAL_PHRASES +
    EMOTIONAL_EXPRESSIONS +
    RELATIONSHIP_LOSS_PHRASES
)

# Organized by category for easy access
PHRASES_BY_CATEGORY: Dict[str, List[PhraseEntry]] = {
    "distress": DISTRESS_PHRASES,
    "hopelessness": HOPELESSNESS_PHRASES,
    "passive_death_wish": PASSIVE_DEATH_WISH_PHRASES,
    "ideation": IDEATION_PHRASES,
    "method": METHOD_PHRASES,
    "intent": INTENT_PHRASES,
    "finality": FINALITY_PHRASES,
    "self_harm": SELF_HARM_PHRASES,
    "burden": BURDEN_PHRASES,
    "isolation": ISOLATION_PHRASES,
    "veteran": VETERAN_PHRASES,
    "uk_colloquial": UK_COLLOQUIAL_PHRASES,
    "emotional": EMOTIONAL_EXPRESSIONS,
    "relationship_loss": RELATIONSHIP_LOSS_PHRASES,
}

# Category severity ranking (for pattern detection)
CATEGORY_SEVERITY_ORDER = [
    "distress",      # Lowest
    "isolation",
    "burden",
    "self_harm",
    "hopelessness",
    "passive_death_wish",
    "ideation",
    "method",
    "finality",
    "intent",        # Highest
]

def get_phrase_count() -> int:
    """Return total number of phrases in dataset."""
    return len(ALL_PHRASES)

def get_phrases_for_category(category: str) -> List[PhraseEntry]:
    """Get all phrases for a specific category."""
    return PHRASES_BY_CATEGORY.get(category, [])

def get_high_severity_phrases(min_weight: int = 70) -> List[PhraseEntry]:
    """Get all phrases above a severity threshold."""
    return [p for p in ALL_PHRASES if p.severity_weight >= min_weight]

def get_uk_specific_phrases() -> List[PhraseEntry]:
    """Get UK-specific colloquial phrases."""
    return [p for p in ALL_PHRASES if p.is_uk_specific]

# Print count on import for verification
print(f"[SafeguardingPhraseDataset] Loaded {get_phrase_count()} phrases across {len(PHRASES_BY_CATEGORY)} categories")
