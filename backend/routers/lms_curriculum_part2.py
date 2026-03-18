"""
Radio Check Peer to Peer Training - Modules 9-14
Continuation of curriculum with remaining modules
"""

from .lms_curriculum import MODULE_IMAGES, RADIOCHECK_CURRICULUM

# Add modules 9-14 to the curriculum
MODULES_9_TO_14 = [
    # ===================================================================
    # MODULE 9: SUBSTANCE MISUSE
    # ===================================================================
    {
        "id": "m9-substance",
        "title": "Substance Misuse and Addiction",
        "description": "Understanding and supporting veterans with alcohol and drug problems",
        "duration_minutes": 60,
        "order": 9,
        "is_critical": False,
        "image_url": MODULE_IMAGES["m9-substance"],
        "content": """
## Substance Misuse and Addiction

Substance misuse is common among veterans. This module helps you understand addiction, recognise the signs, and provide appropriate peer support.

---

## Understanding Substance Misuse

### What is Substance Misuse?
Using substances (alcohol, drugs) in ways that cause harm to the person or those around them.

### Spectrum of Use:
- **Experimental**: Trying something once
- **Recreational**: Occasional social use
- **Problematic**: Use causing harm
- **Dependent**: Physical/psychological need

### Common Substances:
- **Alcohol**: Most common in veterans
- **Cannabis**: Often used for sleep/anxiety
- **Painkillers**: From service injuries
- **Cocaine/stimulants**: For energy/mood
- **Prescription medications**: Misused benzos, etc.

---

## Why Veterans Are at Risk

### Contributing Factors:
- **Drinking culture**: Normalised in military
- **Self-medication**: For PTSD, pain, sleep
- **Transition stress**: Major life change
- **Physical injuries**: Chronic pain
- **Loss of structure**: Less routine
- **Availability**: Mess culture
- **Coping mechanism**: Learned in service

### Statistics:
- Veterans are 2x more likely to have alcohol problems
- Heavy drinking often masks mental health issues
- Substance use increases suicide risk

---

## Signs of Problematic Use

### Behavioural Signs:
- Drinking/using more than intended
- Failed attempts to cut down
- Spending lots of time obtaining/using/recovering
- Neglecting responsibilities
- Continuing despite problems
- Giving up activities
- Using in dangerous situations
- Needing more to get the same effect (tolerance)
- Withdrawal symptoms when stopping

### Physical Signs:
- Changes in appearance
- Weight changes
- Sleep problems
- Tremors
- Bloodshot eyes
- Slurred speech

### Social Signs:
- Relationship problems
- Financial difficulties
- Work problems
- Legal issues
- Isolation

---

## Supporting Someone with Substance Issues

### DO:
- **Express concern without judgment**: "I've noticed... I'm worried about you"
- **Listen**: Understand their experience
- **Separate the person from the behaviour**: They're not a "bad person"
- **Encourage professional help**: Addiction services exist
- **Be patient**: Recovery is rarely linear
- **Celebrate small wins**: Every step matters
- **Look after yourself**: Set boundaries

### DON'T:
- Lecture or moralise
- Enable the behaviour (covering up, giving money)
- Give ultimatums unless you mean them
- Expect immediate change
- Take relapse personally
- Try to control their use
- Pour away their substances

### Helpful Things to Say:
- "I care about you and I'm worried"
- "You don't have to face this alone"
- "Would you be willing to talk to someone about this?"
- "What would help right now?"
- "I'm here for you"

---

## Understanding Addiction

### Addiction is a Brain Condition
Addiction changes brain chemistry. It's not simply a choice or moral failing.

- The brain's reward system is hijacked
- Withdrawal causes real physical pain
- Cravings can be overwhelming
- Willpower alone is often not enough

### Dual Diagnosis
Many people with substance problems also have mental health conditions:
- Using substances to cope with symptoms
- Substances making mental health worse
- Both need to be addressed

---

## Treatment Options

### Professional Help:
- **GP**: First point of contact
- **Drug and alcohol services**: Specialist support
- **Detox programmes**: Medical withdrawal support
- **Residential rehab**: Intensive treatment
- **Counselling**: Talking therapies

### Veteran-Specific:
- **Tom Harrison House**: Veteran addiction charity
- **Combat Stress**: Address trauma underlying addiction
- **Forward Assist**: Veteran wellbeing

### Mutual Aid Groups:
- **Alcoholics Anonymous (AA)**: 12-step programme
- **Narcotics Anonymous (NA)**: For drug users
- **SMART Recovery**: Alternative approach
- **Veteran-specific groups**: Some AA meetings are veteran-only

---

## Harm Reduction

If someone isn't ready to stop, harm reduction helps reduce risk:

### For Alcohol:
- Drink water between drinks
- Eat before drinking
- Count drinks
- Avoid rounds
- Don't drink alone
- Avoid mixing with drugs

### For Drugs:
- Don't use alone
- Know what you're taking
- Start with smaller amounts
- Don't mix substances
- Carry naloxone if using opioids

**Note:** You can share harm reduction information without endorsing use.

---

## Further Reading

- **Drinkaware**: https://www.drinkaware.co.uk/
- **FRANK (Drug Information)**: https://www.talktofrank.com/
- **Tom Harrison House (Veteran Addiction)**: https://www.tomharrisonhouse.org.uk/
- **SMART Recovery UK**: https://smartrecovery.org.uk/
- **Alcoholics Anonymous UK**: https://www.alcoholics-anonymous.org.uk/

---

## Summary

This module covered:
- Understanding substance misuse and addiction
- Why veterans are at higher risk
- Signs of problematic use
- How to support someone without enabling
- Understanding addiction as a brain condition
- Treatment options and services
- Harm reduction approaches
        """,
        "external_links": [
            {"title": "Drinkaware", "url": "https://www.drinkaware.co.uk/"},
            {"title": "FRANK (Drug Information)", "url": "https://www.talktofrank.com/"},
            {"title": "Tom Harrison House", "url": "https://www.tomharrisonhouse.org.uk/"},
            {"title": "SMART Recovery UK", "url": "https://smartrecovery.org.uk/"}
        ],
        "quiz": {
            "id": "q9-substance",
            "title": "Module 9 Quiz: Substance Misuse",
            "pass_rate": 80,
            "questions": [
                {
                    "id": "q9-1",
                    "type": "true_false",
                    "question": "Addiction is simply a choice or moral failing.",
                    "options": ["True", "False"],
                    "correct": "False",
                    "explanation": "Addiction is a brain condition. It changes brain chemistry, hijacks the reward system, and creates physical dependence. Willpower alone is often not enough."
                },
                {
                    "id": "q9-2",
                    "type": "multiple_choice",
                    "question": "What is 'dual diagnosis'?",
                    "options": [
                        "Having two different drug addictions",
                        "Both a substance problem and a mental health condition",
                        "Being diagnosed by two doctors",
                        "Having both physical and mental symptoms"
                    ],
                    "correct": "Both a substance problem and a mental health condition",
                    "explanation": "Dual diagnosis refers to having both a substance use problem and a mental health condition. They often co-occur and both need to be addressed."
                },
                {
                    "id": "q9-3",
                    "type": "multiple_choice",
                    "question": "When supporting someone with a substance problem, you should:",
                    "options": [
                        "Pour away their alcohol/drugs without asking",
                        "Give them an ultimatum to stop immediately",
                        "Express concern without judgment and encourage professional help",
                        "Tell them they're weak for not quitting"
                    ],
                    "correct": "Express concern without judgment and encourage professional help",
                    "explanation": "Judgment pushes people away. Express concern compassionately, listen to their experience, and encourage professional support without forcing."
                },
                {
                    "id": "q9-4",
                    "type": "multiple_choice",
                    "question": "Why are veterans at higher risk of substance problems?",
                    "options": [
                        "They have more money to spend",
                        "Military drinking culture, self-medication for trauma/pain, transition stress",
                        "They enjoy drinking more than civilians",
                        "Veteran services encourage drinking"
                    ],
                    "correct": "Military drinking culture, self-medication for trauma/pain, transition stress",
                    "explanation": "Multiple factors contribute: drinking was normalised in service, substances may be used to cope with PTSD or pain, and transition brings significant stress."
                },
                {
                    "id": "q9-5",
                    "type": "multiple_choice",
                    "question": "Harm reduction means:",
                    "options": [
                        "Forcing someone to stop using",
                        "Ignoring their substance use completely",
                        "Reducing the risks of use when someone isn't ready to stop",
                        "Only helping people who are already clean"
                    ],
                    "correct": "Reducing the risks of use when someone isn't ready to stop",
                    "explanation": "Harm reduction acknowledges that not everyone is ready to stop, and focuses on keeping them as safe as possible. It's a pragmatic approach that saves lives."
                }
            ]
        }
    },
    
    # ===================================================================
    # MODULE 10: SAFEGUARDING (CRITICAL)
    # ===================================================================
    {
        "id": "m10-safeguarding",
        "title": "Safeguarding",
        "description": "Protecting vulnerable people and responding to disclosures - CRITICAL MODULE",
        "duration_minutes": 60,
        "order": 10,
        "is_critical": True,
        "image_url": MODULE_IMAGES["m10-safeguarding"],
        "content": """
## CRITICAL MODULE - 100% Pass Required

Safeguarding is about protecting people from harm and abuse. As a peer supporter, you may receive disclosures or notice concerns. This module teaches you what to do.

---

## What is Safeguarding?

Safeguarding means protecting people's health, wellbeing, and human rights, enabling them to live free from harm, abuse, and neglect.

### Who Needs Safeguarding?
- Children (under 18)
- Adults at risk (learning disabilities, mental health conditions, physical disabilities, older people, etc.)
- Anyone vulnerable due to circumstances

### Types of Abuse:
- **Physical**: Hitting, pushing, restraining, misuse of medication
- **Emotional/Psychological**: Threats, humiliation, controlling behaviour
- **Sexual**: Any non-consensual sexual activity
- **Financial**: Theft, fraud, exploitation
- **Neglect**: Not meeting basic needs (food, hygiene, medical care)
- **Modern slavery**: Human trafficking, forced labour
- **Domestic abuse**: Abuse by partners or family members
- **Self-neglect**: Not looking after oneself

---

## Signs of Abuse

### Physical Indicators:
- Unexplained injuries
- Injuries in unusual places
- Injuries at different stages of healing
- Fear of physical contact
- Poor hygiene or malnutrition

### Behavioural Indicators:
- Withdrawn or fearful
- Changes in behaviour
- Reluctance to go home
- Flinching at sudden movements
- Inappropriate sexual behaviour

### Financial Indicators:
- Sudden changes in finances
- Unexplained withdrawals
- Change to wills or documents
- Missing belongings

---

## Receiving a Disclosure

Someone may tell you they are being abused or harmed. How you respond matters.

### DO:
- **Listen calmly**: Give them your full attention
- **Believe them**: Take what they say seriously
- **Reassure them**: "Thank you for telling me", "It's not your fault"
- **Don't promise confidentiality**: Explain you may need to tell someone
- **Don't ask leading questions**: Let them tell you in their own words
- **Record what they said**: As close to their words as possible
- **Report**: Follow Radio Check safeguarding procedures

### DON'T:
- React with shock or disbelief
- Promise to keep it secret
- Ask probing questions or investigate
- Confront the alleged abuser
- Promise things you can't guarantee
- Delay reporting

### What to Say:
- "Thank you for trusting me with this"
- "I believe you"
- "It's not your fault"
- "I need to share this with someone who can help keep you safe"
- "I'm going to do everything I can to help"

---

## When to Report

### Always Report:
- Any disclosure of abuse
- Concerns about a child's safety
- Concerns about a vulnerable adult
- Suspicion of abuse (you don't need proof)
- Immediate risk of harm

### Reporting Doesn't Mean:
- You need to be certain
- You need to have proof
- The person has to agree
- You're getting someone in trouble

**It's NOT your job to investigate. Report your concerns.**

---

## How to Report

### Immediate Danger:
**Call 999** if someone is in immediate risk of harm.

### Radio Check Procedure:
1. Contact your Radio Check supervisor immediately
2. Document what you know (who, what, when, where)
3. Use the person's own words where possible
4. Note your concerns and reasons
5. Don't delay - report promptly

### If You Can't Reach Supervisor:
- Local authority safeguarding team
- Police (101 for non-emergency, 999 for emergency)
- NSPCC Helpline (for children): 0808 800 5000

---

## Recording Concerns

### What to Record:
- Date and time of disclosure/concern
- Who is involved (victim, alleged perpetrator)
- What was said/observed (in their words)
- Any visible injuries
- Your actions taken
- Who you reported to

### Important:
- Record facts, not opinions
- Use the person's words, not interpretations
- Be objective
- Keep records confidential
- Don't share with unauthorised people

---

## Safeguarding Children

### Your Responsibilities:
- Report any concerns about children
- Don't need to investigate - just report
- Child's welfare is paramount

### Remember:
- A child is anyone under 18
- Even if a child asks you not to tell, you must report
- It's always better to be wrong than to miss abuse

---

## Domestic Abuse

### Recognising Domestic Abuse:
- Physical violence
- Controlling behaviour (money, movements, friends)
- Emotional abuse (put-downs, threats)
- Sexual coercion
- Isolation from support

### Supporting Someone in Domestic Abuse:
- Believe them
- Don't pressure them to leave
- Help them access support safely
- Recognise leaving is dangerous
- Refer to specialist services

### Specialist Services:
- **National Domestic Abuse Helpline**: 0808 2000 247
- **Respect (for perpetrators)**: 0808 802 4040
- **CALM (male victims)**: 0800 585858

---

## Looking After Yourself

Hearing disclosures can be distressing.

- Use Radio Check supervision
- Don't carry it alone
- Practice self-care
- Know that you did the right thing by reporting

---

## Further Reading

- **NSPCC - Safeguarding Children**: https://learning.nspcc.org.uk/
- **Ann Craft Trust - Adult Safeguarding**: https://www.anncrafttrust.org/
- **Refuge - Domestic Abuse**: https://www.refuge.org.uk/
- **NHS - Safeguarding**: https://www.england.nhs.uk/safeguarding/

---

## Summary

This critical module covered:
- What safeguarding means and who needs protection
- Types and signs of abuse
- How to receive a disclosure
- When and how to report concerns
- Recording and documentation
- Safeguarding children
- Recognising and responding to domestic abuse
        """,
        "external_links": [
            {"title": "NSPCC - Safeguarding", "url": "https://learning.nspcc.org.uk/"},
            {"title": "Ann Craft Trust - Adult Safeguarding", "url": "https://www.anncrafttrust.org/"},
            {"title": "Refuge - Domestic Abuse", "url": "https://www.refuge.org.uk/"},
            {"title": "NHS - Safeguarding", "url": "https://www.england.nhs.uk/safeguarding/"}
        ],
        "quiz": {
            "id": "q10-safeguarding",
            "title": "Module 10 Quiz: Safeguarding (100% Required)",
            "pass_rate": 100,
            "questions": [
                {
                    "id": "q10-1",
                    "type": "multiple_choice",
                    "question": "When someone discloses abuse to you, you should:",
                    "options": [
                        "Promise to keep it secret as they asked",
                        "Investigate to find out if it's true",
                        "Listen, believe, reassure, and report to your supervisor",
                        "Confront the person they accused"
                    ],
                    "correct": "Listen, believe, reassure, and report to your supervisor",
                    "explanation": "Your role is to listen, believe, reassure ('it's not your fault'), and report. Don't promise secrecy, investigate, or confront - that's not your job."
                },
                {
                    "id": "q10-2",
                    "type": "true_false",
                    "question": "You need to be certain that abuse is occurring before you report.",
                    "options": ["True", "False"],
                    "correct": "False",
                    "explanation": "You do NOT need to be certain or have proof. Report concerns and let professionals investigate. It's better to report and be wrong than miss real abuse."
                },
                {
                    "id": "q10-3",
                    "type": "multiple_choice",
                    "question": "If someone is in immediate danger, you should:",
                    "options": [
                        "Wait until your next supervision session",
                        "Call 999 immediately",
                        "Send them information by email",
                        "Ask them to think about what they want to do"
                    ],
                    "correct": "Call 999 immediately",
                    "explanation": "Immediate danger requires immediate action. Call 999 for emergencies. Don't wait for supervision if someone is at immediate risk."
                },
                {
                    "id": "q10-4",
                    "type": "multiple_choice",
                    "question": "When recording a safeguarding concern, you should:",
                    "options": [
                        "Write your interpretation of what happened",
                        "Include your opinions about the people involved",
                        "Use the person's own words and record facts objectively",
                        "Keep the record vague to protect privacy"
                    ],
                    "correct": "Use the person's own words and record facts objectively",
                    "explanation": "Record facts and the person's own words, not your interpretations or opinions. Be objective and specific."
                },
                {
                    "id": "q10-5",
                    "type": "multiple_choice",
                    "question": "Which is a type of abuse?",
                    "options": [
                        "Physical, emotional, sexual, and financial abuse",
                        "Only physical violence counts as abuse",
                        "Only abuse of children is safeguarding",
                        "Minor disagreements between family members"
                    ],
                    "correct": "Physical, emotional, sexual, and financial abuse",
                    "explanation": "Abuse takes many forms: physical, emotional/psychological, sexual, financial, neglect, and more. All forms are serious and should be reported."
                }
            ]
        }
    },
    
    # ===================================================================
    # MODULE 11: DIVERSITY AND INCLUSION
    # ===================================================================
    {
        "id": "m11-diversity",
        "title": "Diversity and Inclusion in Peer Support",
        "description": "Providing inclusive support to all veterans regardless of background",
        "duration_minutes": 60,
        "order": 11,
        "is_critical": False,
        "image_url": MODULE_IMAGES["m11-diversity"],
        "content": """
## Diversity and Inclusion in Peer Support

The veteran community is diverse. Effective peer support means being able to connect with and support veterans from all backgrounds. This module explores how to provide inclusive support.

---

## The Diverse Veteran Community

Veterans come from all backgrounds:

### Protected Characteristics:
- Age
- Disability
- Gender reassignment
- Marriage/civil partnership
- Pregnancy/maternity
- Race and ethnicity
- Religion or belief
- Sex
- Sexual orientation

### Additionally:
- Different service branches
- Different conflicts/eras
- Regular vs reserve
- Different ranks
- Different lengths of service
- Different reasons for leaving

---

## Why Diversity Matters

### Everyone Deserves Equal Support
Every veteran deserves quality peer support, regardless of who they are.

### Different Experiences, Different Needs
- A woman veteran's experience differs from a male veteran's
- An LGBTQ+ veteran may have faced specific challenges
- Veterans of colour may experience racism in civilian life
- Disabled veterans face additional barriers

### Better Outcomes
Research shows that inclusive services lead to better outcomes for all.

---

## Common Barriers for Diverse Veterans

### Female Veterans:
- Services designed around male experience
- Experiences in military not always validated
- MST (Military Sexual Trauma)
- Caring responsibilities
- Not feeling like "real" veterans

### LGBTQ+ Veterans:
- Historical discrimination ("Don't Ask, Don't Tell", pre-2000 ban)
- Fear of judgment
- Specific mental health impacts
- Lack of representation

### Veterans of Colour:
- Racism in military and civilian life
- Cultural barriers to seeking help
- Underrepresentation in services
- Immigration issues for Commonwealth veterans

### Disabled Veterans:
- Physical access barriers
- Assumptions about capability
- Comorbid mental health
- Navigating multiple services

---

## Inclusive Practice

### Language Matters
- Use language the person uses for themselves
- Don't make assumptions about gender or relationships
- Ask how someone wants to be addressed
- Avoid stereotypes

### Avoid Assumptions
- Don't assume someone's experiences based on how they look
- Everyone's service was valid
- All veterans count, regardless of deployment

### Check Your Biases
We all have unconscious biases. Be aware of yours:
- Do you make different assumptions about different groups?
- Do you relate more easily to people similar to you?
- Are there groups you know less about?

### Make Space for Different Experiences
- Some people may not feel like "real" veterans - validate them
- Different conflicts have different experiences
- Not all trauma looks the same

---

## Supporting Specific Groups

### Female Veterans:
- Recognise women's service
- Be aware of MST (don't probe, but be prepared)
- Don't make sexist comments or jokes
- Recognise their veteran identity

### LGBTQ+ Veterans:
- Use inclusive language
- Don't make assumptions about relationships
- Recognise historical discrimination
- Create a safe, accepting space

### Veterans of Colour:
- Acknowledge racism exists
- Don't minimise racial experiences
- Be culturally sensitive
- Check your own biases

### Older Veterans:
- Recognise different era experiences
- May have different attitudes to mental health
- Value their service

---

## Intersectionality

People can belong to multiple groups, facing combined challenges.

**Example:** A Black woman veteran may face:
- Racism AND sexism
- Military Sexual Trauma
- Not being seen as a "real" veteran
- Cultural barriers to seeking help

Recognise the whole person, not just one aspect of their identity.

---

## Creating Inclusive Environments

### Physical:
- Accessible venues
- Quiet spaces available
- Gender-neutral toilets where possible

### Atmosphere:
- Welcoming to all
- No discrimination tolerated
- Diverse representation in materials

### Online:
- Accessible websites
- Inclusive language
- Moderated to prevent discrimination

---

## What to Do If You Witness Discrimination

### Within Radio Check:
- Challenge inappropriate comments (if safe to do so)
- Report to supervisors
- Support the person affected
- Don't ignore it

### From Outside:
- Support the veteran
- Help them access appropriate support
- Report hate crimes if appropriate

---

## Further Reading

- **Veteran Allies (LGBTQ+ Veterans)**: https://www.veteransgateway.org.uk/
- **Fighting With Pride (LGBTQ+ Veterans)**: https://fightingwithpride.org.uk/
- **Women Veterans Network**: https://www.cobseo.org.uk/
- **Equality and Human Rights Commission**: https://www.equalityhumanrights.com/

---

## Summary

This module covered:
- The diversity of the veteran community
- Why inclusive practice matters
- Barriers faced by different groups
- Inclusive language and avoiding assumptions
- Supporting specific groups (women, LGBTQ+, veterans of colour, disabled veterans)
- Understanding intersectionality
- Creating welcoming environments
- Responding to discrimination
        """,
        "external_links": [
            {"title": "Fighting With Pride (LGBTQ+ Veterans)", "url": "https://fightingwithpride.org.uk/"},
            {"title": "Veterans Gateway", "url": "https://www.veteransgateway.org.uk/"},
            {"title": "Equality and Human Rights Commission", "url": "https://www.equalityhumanrights.com/"}
        ],
        "quiz": {
            "id": "q11-diversity",
            "title": "Module 11 Quiz: Diversity and Inclusion",
            "pass_rate": 80,
            "questions": [
                {
                    "id": "q11-1",
                    "type": "true_false",
                    "question": "All veterans have the same experiences regardless of their background.",
                    "options": ["True", "False"],
                    "correct": "False",
                    "explanation": "Veterans come from diverse backgrounds and have different experiences. Female veterans, LGBTQ+ veterans, and veterans of colour may face unique challenges that affect their needs."
                },
                {
                    "id": "q11-2",
                    "type": "multiple_choice",
                    "question": "Intersectionality means:",
                    "options": [
                        "The intersection of two roads",
                        "How different aspects of identity combine to create unique experiences",
                        "The point where services meet",
                        "Military cross-training"
                    ],
                    "correct": "How different aspects of identity combine to create unique experiences",
                    "explanation": "Intersectionality recognises that people can belong to multiple groups (e.g., Black woman veteran) and face combined challenges from overlapping identities."
                },
                {
                    "id": "q11-3",
                    "type": "multiple_choice",
                    "question": "Inclusive practice includes:",
                    "options": [
                        "Treating everyone exactly the same",
                        "Using language the person uses for themselves and avoiding assumptions",
                        "Only supporting people like yourself",
                        "Assuming everyone has the same needs"
                    ],
                    "correct": "Using language the person uses for themselves and avoiding assumptions",
                    "explanation": "Inclusive practice means using appropriate language, avoiding assumptions, and recognising that different people have different needs and experiences."
                },
                {
                    "id": "q11-4",
                    "type": "multiple_choice",
                    "question": "If you witness discriminatory behaviour within Radio Check, you should:",
                    "options": [
                        "Ignore it to avoid conflict",
                        "Join in to fit in",
                        "Challenge it if safe and report to supervisors",
                        "Assume it was just a joke"
                    ],
                    "correct": "Challenge it if safe and report to supervisors",
                    "explanation": "Discrimination should not be ignored. Challenge it if safe to do so, support the person affected, and report to supervisors."
                },
                {
                    "id": "q11-5",
                    "type": "multiple_choice",
                    "question": "LGBTQ+ veterans may face specific challenges because:",
                    "options": [
                        "They served in different conflicts",
                        "Historical discrimination in the military and fear of judgment",
                        "They have different physical health needs",
                        "They served in different countries"
                    ],
                    "correct": "Historical discrimination in the military and fear of judgment",
                    "explanation": "LGBTQ+ veterans faced historical discrimination (being banned from serving until 2000) and may fear judgment from services or other veterans."
                }
            ]
        }
    },
    
    # ===================================================================
    # MODULE 12: PRACTICAL SKILLS
    # ===================================================================
    {
        "id": "m12-practical",
        "title": "Practical Skills and Resources",
        "description": "Essential practical skills and resources for peer support",
        "duration_minutes": 60,
        "order": 12,
        "is_critical": False,
        "image_url": MODULE_IMAGES["m12-practical"],
        "content": """
## Practical Skills and Resources

This module provides practical tools you'll use regularly as a Radio Check Peer Supporter, including signposting, resource awareness, and practical support skills.

---

## Signposting Skills

### What is Signposting?
Helping someone find the right services and support. You don't need to know everything - just how to help them find what they need.

### How to Signpost:
1. **Listen** to understand what they need
2. **Ask** what kind of help they're looking for
3. **Suggest** relevant services
4. **Offer** to help them contact services if needed
5. **Follow up** to see how they got on

### Helpful Phrases:
- "There's a service that might help with that..."
- "Have you heard of...?"
- "Would it help if we looked at that together?"
- "Would you like me to find the number for you?"

---

## Key Veteran Services

### Mental Health:
- **NHS 111 Option 2**: 24/7 mental health crisis
- **Op Courage**: 0300 323 0137 (NHS veteran mental health)
- **Combat Stress**: 0800 138 1619 (24-hour helpline)
- **Samaritans**: 116 123 (24/7)

### General Support:
- **Veterans Gateway**: 0808 802 1212 (signposting to all services)
- **Royal British Legion**: 0808 802 8080
- **SSAFA**: 0800 731 4880
- **Help for Heroes**: 0800 058 2030

### Housing:
- **Veterans Housing Scotland**: 0800 088 5646
- **Stoll**: 020 7385 2110
- **Haig Housing**: 020 8685 5777

### Employment:
- **CTP (Career Transition Partnership)**: For service leavers
- **Walking with the Wounded**: Employment programmes
- **Poppy Factory**: Disabled veteran employment

### Benefits:
- **Veterans UK**: War pensions, armed forces compensation
- **Citizens Advice**: Benefits guidance
- **RFEA**: Royal Forces Employment Assistance

---

## The Veterans Gateway

Veterans Gateway is the FIRST POINT OF CONTACT for veterans seeking support. If you're unsure where to direct someone, start here.

**Phone**: 0808 802 1212
**Text**: Text VETERAN to 6644
**Website**: www.veteransgateway.org.uk

They can signpost to the right service for any need.

---

## Practical Support You Can Offer

### Helping Access Services:
- Finding phone numbers
- Explaining what services do
- Practising what to say
- Offering to sit with them while they call
- Helping fill in forms (without doing it for them)

### Being Present:
- Listening
- Checking in regularly
- Being reliable and consistent
- Remembering what matters to them

### What You Can't Do:
- Make calls on their behalf (unless they've asked and it's appropriate)
- Fill in forms for them
- Make decisions for them
- Promise outcomes

---

## Managing Your Time

### How Many People Can You Support?
- Start small (1-2 people)
- Build up gradually
- Quality over quantity
- Regular supervision discussions

### Scheduling:
- Agreed contact times
- Regular check-ins
- Don't overcommit
- Leave time between sessions

### When to Say No:
- You're at capacity
- The person needs specialist help
- There's a conflict of interest
- Your own wellbeing is suffering

---

## Documentation

### What to Record:
- Date and type of contact
- Brief summary (not detailed notes)
- Any concerns raised
- Any referrals made
- Agreed next steps

### Why Record:
- Continuity if you're unavailable
- Supervision discussions
- Safeguarding requirements
- Evidence of following procedures

### How to Store:
- Follow Radio Check procedures
- Keep secure and confidential
- Don't store personally identifiable information unnecessarily

---

## Technology Skills

### Useful for Remote Support:
- Video calls (Zoom, WhatsApp, etc.)
- Messaging apps
- Email
- Radio Check platforms

### Digital Inclusion:
- Not everyone has smartphones
- Some prefer phone calls
- Respect preferences
- Help with technology if needed

---

## Emergency Resources Summary

### Life-Threatening Emergency:
**999** - Police, Ambulance, Fire

### Mental Health Crisis:
**NHS 111 Option 2** - 24/7 mental health crisis support

### Suicide Prevention:
**Samaritans**: 116 123 (24/7)
**Veterans Crisis Line**: Text VETERAN to 85258

### Veteran General:
**Veterans Gateway**: 0808 802 1212

---

## Further Reading

- **Veterans Gateway**: https://www.veteransgateway.org.uk/
- **Op Courage**: https://www.nhs.uk/nhs-services/armed-forces-community/
- **COBSEO (Confederation of Service Charities)**: https://www.cobseo.org.uk/
- **Forces Employment Charity**: https://www.forcesemployment.org.uk/

---

## Summary

This module covered:
- How to signpost effectively
- Key veteran services and resources
- The Veterans Gateway as first point of contact
- Practical support you can offer
- Managing your time and caseload
- Documentation requirements
- Technology for remote support
- Emergency resources summary
        """,
        "external_links": [
            {"title": "Veterans Gateway", "url": "https://www.veteransgateway.org.uk/"},
            {"title": "Op Courage", "url": "https://www.nhs.uk/nhs-services/armed-forces-community/"},
            {"title": "COBSEO", "url": "https://www.cobseo.org.uk/"},
            {"title": "Forces Employment Charity", "url": "https://www.forcesemployment.org.uk/"}
        ],
        "quiz": {
            "id": "q12-practical",
            "title": "Module 12 Quiz: Practical Skills",
            "pass_rate": 80,
            "questions": [
                {
                    "id": "q12-1",
                    "type": "multiple_choice",
                    "question": "What is the best first point of contact for any veteran seeking support?",
                    "options": [
                        "Their local pub",
                        "Veterans Gateway (0808 802 1212)",
                        "Their old commanding officer",
                        "Social media"
                    ],
                    "correct": "Veterans Gateway (0808 802 1212)",
                    "explanation": "Veterans Gateway is the official first point of contact for veterans. They can signpost to the right service for any need."
                },
                {
                    "id": "q12-2",
                    "type": "multiple_choice",
                    "question": "What is NHS 111 Option 2?",
                    "options": [
                        "A general health advice line",
                        "A 24/7 mental health crisis line",
                        "A dentist appointment service",
                        "A prescription ordering line"
                    ],
                    "correct": "A 24/7 mental health crisis line",
                    "explanation": "NHS 111 Option 2 provides 24/7 access to mental health crisis support. It's a key resource to know for crisis situations."
                },
                {
                    "id": "q12-3",
                    "type": "true_false",
                    "question": "You should take on as many people as possible to help more veterans.",
                    "options": ["True", "False"],
                    "correct": "False",
                    "explanation": "Quality over quantity. Start with 1-2 people and build up gradually. Overcommitting leads to burnout and poorer quality support."
                },
                {
                    "id": "q12-4",
                    "type": "multiple_choice",
                    "question": "When signposting, you should:",
                    "options": [
                        "Make the call on their behalf without asking",
                        "Just give them a list of numbers and leave",
                        "Understand their needs, suggest services, and offer support to access them",
                        "Tell them what to do"
                    ],
                    "correct": "Understand their needs, suggest services, and offer support to access them",
                    "explanation": "Good signposting involves listening, understanding, suggesting appropriate services, and offering practical support to access them."
                },
                {
                    "id": "q12-5",
                    "type": "multiple_choice",
                    "question": "Why should you keep brief records of support sessions?",
                    "options": [
                        "To gossip about people later",
                        "Continuity, supervision, and safeguarding requirements",
                        "Records aren't necessary",
                        "To prove you've been working"
                    ],
                    "correct": "Continuity, supervision, and safeguarding requirements",
                    "explanation": "Records ensure continuity if you're unavailable, support supervision discussions, and meet safeguarding requirements."
                }
            ]
        }
    },
    
    # ===================================================================
    # MODULE 13: CASE STUDIES
    # ===================================================================
    {
        "id": "m13-casestudies",
        "title": "Case Studies and Scenarios",
        "description": "Practice applying your learning to realistic scenarios",
        "duration_minutes": 75,
        "order": 13,
        "is_critical": False,
        "image_url": MODULE_IMAGES["m13-casestudies"],
        "content": """
## Case Studies and Scenarios

This module presents realistic scenarios you might encounter as a Radio Check Peer Supporter. Use these to test and consolidate your learning.

---

## How to Use This Module

For each scenario:
1. Read the situation carefully
2. Think about what you would do
3. Consider the key issues
4. Check the suggested approach
5. Reflect on what you learned

---

## Scenario 1: Dave - Depression and Isolation

### The Situation:
Dave, 58, left the Army after 22 years. He's been struggling since retirement 5 years ago. He contacts you saying he "just needs someone to talk to". During the conversation, he mentions:
- He rarely leaves the house
- His wife left him last year
- He's drinking more than he used to
- He doesn't see the point in anything anymore
- He sometimes thinks "everyone would be better off without me"

### Key Issues:
- Possible depression
- Social isolation
- Alcohol concerns
- Concerning statement about others being better off (potential suicide ideation)

### Suggested Approach:
1. **Listen and validate**: "It sounds like you've been going through a really difficult time"
2. **Explore the concerning statement**: "You mentioned people being better off without you. Can you tell me more about that?"
3. **Ask directly about suicide**: "Are you having thoughts of ending your life?"
4. **Assess risk level**
5. **Encourage professional help**: GP, Op Courage
6. **Discuss reducing alcohol**
7. **Signpost to services**: Veterans Gateway, Combat Stress
8. **Agree follow-up**

---

## Scenario 2: Sarah - PTSD and Anger

### The Situation:
Sarah served in Afghanistan as a medic. She's having nightmares and flashbacks to treating casualties. She says:
- She's angry all the time and has pushed her friends away
- Loud noises make her "jump out of her skin"
- She avoids anything that reminds her of Afghanistan
- She sometimes dissociates - "it's like I'm not in my body"
- She's tried talking to her GP but they "don't understand military stuff"

### Key Issues:
- Clear PTSD symptoms
- Anger and relationship impact
- Previous negative experience with services
- Possible dissociation

### Suggested Approach:
1. **Acknowledge and validate**: "What you're describing sounds really difficult. Many veterans who've experienced what you did struggle with similar things"
2. **Normalise**: "These are common responses to trauma"
3. **Encourage specialist help**: "There are services that specialise in veterans"
4. **Signpost**: Op Courage, Combat Stress (PTSD specialists)
5. **If she dissociates**: Use grounding techniques
6. **Don't push for trauma details**
7. **Discuss self-care**: What helps her feel calmer?

---

## Scenario 3: Marcus - Crisis

### The Situation:
Marcus calls you sounding distressed. He says:
- He's just found out his wife is having an affair
- He's got a bottle of pills in front of him
- He's "going to end it tonight"
- He's been drinking
- He says "Don't tell anyone - just listen"

### Key Issues:
- **CRISIS SITUATION**
- Has means (pills), plan (tonight), and intent
- Alcohol involved (increases risk)
- Asking for confidentiality

### Immediate Actions:
1. **Stay calm**: Your calm helps him
2. **DON'T promise confidentiality**: "I care about you and I can't promise that when I'm worried about your safety"
3. **Keep him talking**: Build rapport
4. **Ask him to move the pills away**: "Can you put the pills in another room?"
5. **Assess**: Is he alone? Can you get someone there?
6. **Call for help**: While keeping him on the line if possible - 999 or NHS 111 Option 2
7. **Stay with him**: Until help arrives

**This requires immediate action - you cannot handle this alone.**

---

## Scenario 4: Emma - Disclosures

### The Situation:
Emma, a veteran, tells you:
- Her partner has been controlling her money and who she sees
- He sometimes gets physical when he's angry
- She's scared of him but doesn't want to leave
- She asks you not to tell anyone
- She has a 6-year-old daughter

### Key Issues:
- Domestic abuse (physical, financial, emotional)
- Safeguarding concern (child in the household)
- Request for confidentiality
- Safety planning

### Suggested Approach:
1. **Listen and believe**: "Thank you for trusting me with this. I believe you"
2. **Acknowledge difficulty**: "That sounds really frightening"
3. **Explain limits**: "I can't promise confidentiality when there's safety concerns, especially with a child involved"
4. **Don't pressure her to leave**: Leaving is dangerous
5. **Report**: Contact supervisor - safeguarding concern
6. **Signpost safely**: National Domestic Abuse Helpline
7. **Safety plan**: What to do if danger increases
8. **Support her choices**: She's the expert in her own safety

---

## Scenario 5: James - Boundaries

### The Situation:
You've been supporting James for 3 months. Lately:
- He's messaging you multiple times a day
- He wants to meet socially as "mates"
- He gets upset when you can't respond immediately
- He says you're the only person who understands him
- He's stopped seeing his GP because "you're enough"

### Key Issues:
- Dependency developing
- Boundary issues
- He's stopped accessing professional help
- Unhealthy attachment

### Suggested Approach:
1. **Recognise the signs**: This is dependency developing
2. **Gently address it**: "I've noticed we've been in contact a lot more. I'm wondering how we can make sure you've got support from more than just me"
3. **Reinforce boundaries**: "I care about you, but I can only respond during our agreed times"
4. **Encourage other supports**: Who else can he talk to?
5. **Professional help**: "It would really help if you could see your GP again"
6. **Discuss in supervision**: Get support managing this
7. **Be consistent**: Maintain boundaries kindly but firmly

---

## Scenario 6: Cultural Sensitivity

### The Situation:
Ahmed is a British Army veteran who served 15 years. He's Muslim and mentions:
- He struggled with the perception of Muslims in the military
- He feels caught between two worlds
- His family don't understand his veteran identity
- He's experiencing depression
- He's fasting for Ramadan, which is affecting his energy

### Key Issues:
- Intersection of multiple identities
- Cultural considerations
- Depression
- Religious practice

### Suggested Approach:
1. **Validate both identities**: His veteran identity AND cultural identity are valid
2. **Don't make assumptions**: Ask how he'd like to be supported
3. **Respect religious practice**: Be aware of Ramadan
4. **Address mental health**: Depression needs support regardless of background
5. **Signpost inclusively**: Consider if services are culturally appropriate
6. **Check your biases**: Are you making any assumptions?

---

## Reflection Questions

After reviewing these scenarios:
1. What was most challenging?
2. Were there any situations you felt unprepared for?
3. What would you do differently in practice?
4. What additional support do you need?

---

## Summary

This module covered realistic scenarios including:
- Depression and isolation
- PTSD and anger
- Crisis situations
- Domestic abuse disclosures
- Boundary management
- Cultural sensitivity

These scenarios test your learning from all previous modules.
        """,
        "external_links": [
            {"title": "Veterans Gateway", "url": "https://www.veteransgateway.org.uk/"},
            {"title": "National Domestic Abuse Helpline", "url": "https://www.nationaldahelpline.org.uk/"}
        ],
        "quiz": {
            "id": "q13-casestudies",
            "title": "Module 13 Quiz: Case Studies",
            "pass_rate": 80,
            "questions": [
                {
                    "id": "q13-1",
                    "type": "scenario",
                    "question": "Someone says 'everyone would be better off without me'. You should:",
                    "options": [
                        "Ignore it - they're probably exaggerating",
                        "Explore further and ask directly about suicidal thoughts",
                        "Change the subject to something positive",
                        "Tell them they're being silly"
                    ],
                    "correct": "Explore further and ask directly about suicidal thoughts",
                    "explanation": "'Better off without me' is a potential warning sign of suicidal ideation. You should explore it gently and ask directly about suicide."
                },
                {
                    "id": "q13-2",
                    "type": "scenario",
                    "question": "In Scenario 3 (Marcus with pills), what's the FIRST priority?",
                    "options": [
                        "Promise to keep it confidential as he asked",
                        "Tell him to call his GP tomorrow",
                        "Stay calm, don't promise confidentiality, and get emergency help while keeping him talking",
                        "End the call to think about what to do"
                    ],
                    "correct": "Stay calm, don't promise confidentiality, and get emergency help while keeping him talking",
                    "explanation": "This is a crisis requiring immediate action. Stay calm, don't promise confidentiality, try to get him to remove the pills, and get emergency help (999)."
                },
                {
                    "id": "q13-3",
                    "type": "scenario",
                    "question": "Emma discloses domestic abuse and has a child. You should:",
                    "options": [
                        "Keep it confidential as she requested",
                        "Tell her to leave him immediately",
                        "Listen, explain you need to report the safeguarding concern, and support her",
                        "Confront her partner"
                    ],
                    "correct": "Listen, explain you need to report the safeguarding concern, and support her",
                    "explanation": "With a child involved, this is a safeguarding issue that must be reported. Explain this to her, support her, and don't pressure her to leave as this can increase danger."
                },
                {
                    "id": "q13-4",
                    "type": "scenario",
                    "question": "James is becoming dependent on you and messaging constantly. You should:",
                    "options": [
                        "Block his number",
                        "Always respond immediately so he doesn't get upset",
                        "Gently reinforce boundaries and encourage him to develop other supports",
                        "Become his best friend since he needs you"
                    ],
                    "correct": "Gently reinforce boundaries and encourage him to develop other supports",
                    "explanation": "Dependency is unhealthy for both of you. Kindly but firmly maintain boundaries, encourage other supports, and discuss in supervision."
                },
                {
                    "id": "q13-5",
                    "type": "scenario",
                    "question": "Sarah has PTSD symptoms. A key thing NOT to do is:",
                    "options": [
                        "Validate her experiences",
                        "Push her to describe her trauma in detail",
                        "Signpost to specialist services",
                        "Use grounding techniques if she dissociates"
                    ],
                    "correct": "Push her to describe her trauma in detail",
                    "explanation": "Never push for trauma details - let people share at their own pace. Forcing them to relive trauma can be harmful. Validate, signpost, and support."
                }
            ]
        }
    },
    
    # ===================================================================
    # MODULE 14: COURSE COMPLETION
    # ===================================================================
    {
        "id": "m14-completion",
        "title": "Course Completion and Next Steps",
        "description": "Reviewing your learning and preparing for your role",
        "duration_minutes": 45,
        "order": 14,
        "is_critical": False,
        "image_url": MODULE_IMAGES["m14-completion"],
        "content": """
## Congratulations!

You've completed the Radio Check Peer to Peer Training course. This final module reviews what you've learned and prepares you for your role as a Radio Check Peer Supporter.

---

## What You've Learned

### Module 1: Introduction to Mental Health
- Understanding mental health vs mental illness
- Veteran mental health statistics
- Barriers to seeking help
- The role of peer support

### Module 2: The ALGEE Action Plan
- Approach, Assess, Assist
- Listen Non-judgmentally
- Give Reassurance and Information
- Encourage Professional Help
- Encourage Self-Help and Other Supports

### Module 3: Ethics and Boundaries (Critical)
- BACP ethical principles
- Boundaries of competence
- Confidentiality and its limits
- Avoiding dependency

### Module 4: Communication Skills
- Active listening (SOLER)
- Reflecting and paraphrasing
- Open vs closed questions
- Empathy vs sympathy

### Module 5: Crisis Support (Critical)
- Recognising mental health crises
- Suicide awareness and risk assessment
- What to do in crisis situations
- Crisis resources

### Module 6: Understanding PTSD
- Symptoms and types of PTSD
- Complex PTSD and moral injury
- Supporting someone with PTSD
- Grounding techniques

### Module 7: Depression and Anxiety
- Symptoms and impact
- Supporting someone with depression
- Supporting someone with anxiety
- Panic attacks

### Module 8: Self-Care for Peer Supporters
- Burnout and compassion fatigue
- Practical self-care strategies
- Supervision and support
- Setting boundaries

### Module 9: Substance Misuse
- Understanding addiction
- Supporting without enabling
- Harm reduction
- Treatment options

### Module 10: Safeguarding (Critical)
- Types of abuse
- Receiving disclosures
- Reporting concerns
- Domestic abuse

### Module 11: Diversity and Inclusion
- The diverse veteran community
- Inclusive practice
- Supporting different groups
- Intersectionality

### Module 12: Practical Skills
- Signposting effectively
- Key veteran services
- Managing your time
- Documentation

### Module 13: Case Studies
- Applying your learning to realistic scenarios
- Problem-solving approaches
- Reflection on practice

---

## Your Commitments as a Peer Supporter

As a Radio Check Peer Supporter, you commit to:

### Ethics and Boundaries
- Working within your competence
- Maintaining confidentiality (within limits)
- Following safeguarding procedures
- Avoiding dual relationships

### Quality Support
- Using the skills you've learned
- Continuing to develop your skills
- Treating everyone with respect
- Being reliable and consistent

### Self-Care
- Looking after your own wellbeing
- Using supervision
- Knowing your limits
- Asking for help when needed

### Radio Check
- Following Radio Check procedures
- Attending training and supervision
- Reporting concerns appropriately
- Representing Radio Check positively

---

## Next Steps

### Before You Start:
1. Complete your DBS check if not already done
2. Meet with your Radio Check supervisor
3. Understand the support structure
4. Know how to access supervision
5. Familiarise yourself with local resources

### When You Start:
- Begin with 1-2 people maximum
- Use supervision regularly
- Review your learning if needed
- Ask questions - it's how you learn

### Ongoing:
- Regular supervision
- Continued training opportunities
- Self-reflection and development
- Connect with other peer supporters

---

## Resources to Keep Handy

### Crisis Numbers:
- **999**: Life-threatening emergency
- **NHS 111 Option 2**: Mental health crisis
- **Samaritans**: 116 123

### Veteran Support:
- **Veterans Gateway**: 0808 802 1212
- **Op Courage**: 0300 323 0137
- **Combat Stress**: 0800 138 1619

### Safeguarding:
- **NSPCC**: 0808 800 5000
- **National Domestic Abuse Helpline**: 0808 2000 247

---

## Final Reflection

Take a moment to reflect:
- What are you most confident about?
- What would you like more support with?
- What are you most looking forward to?
- What are you most nervous about?

Discuss these in your first supervision session.

---

## Thank You

Thank you for completing this training and for your commitment to supporting fellow veterans.

Peer support makes a real difference. Veterans are more likely to open up to someone who understands their experience. By taking this training, you're helping to save lives and improve wellbeing in the veteran community.

**You are now ready to start your journey as a Radio Check Peer Supporter.**

Welcome to the team.

---

## Certificate

Upon passing the final quiz, you will receive your Radio Check Peer Supporter Certificate. This certifies that you have completed the Radio Check Peer to Peer Training and are qualified to provide peer support under Radio Check supervision.

**Remember:** Your certificate qualifies you as a PEER SUPPORTER, not a counsellor or therapist. Always work within your competence and use supervision.
        """,
        "external_links": [
            {"title": "Veterans Gateway", "url": "https://www.veteransgateway.org.uk/"},
            {"title": "Radio Check", "url": "https://radiocheck.me/"},
            {"title": "BACP Ethical Framework", "url": "https://www.bacp.co.uk/events-and-resources/ethics-and-standards/ethical-framework-for-the-counselling-professions/"}
        ],
        "quiz": {
            "id": "q14-completion",
            "title": "Final Quiz: Course Completion",
            "pass_rate": 80,
            "questions": [
                {
                    "id": "q14-1",
                    "type": "multiple_choice",
                    "question": "As a Radio Check Peer Supporter, you are qualified to:",
                    "options": [
                        "Diagnose mental health conditions",
                        "Provide therapy and treatment",
                        "Listen, support, and signpost within defined boundaries",
                        "Prescribe medication changes"
                    ],
                    "correct": "Listen, support, and signpost within defined boundaries",
                    "explanation": "Your certificate qualifies you as a peer supporter - to listen, support, and signpost. You are NOT qualified to diagnose, treat, or prescribe."
                },
                {
                    "id": "q14-2",
                    "type": "multiple_choice",
                    "question": "What does ALGEE stand for?",
                    "options": [
                        "Ask, Listen, Get help, Encourage, End",
                        "Approach Assess Assist, Listen, Give reassurance, Encourage professional help, Encourage self-help",
                        "Always Listen, Give advice, Evaluate, End",
                        "Assess, Learn, Guide, Educate, Exit"
                    ],
                    "correct": "Approach Assess Assist, Listen, Give reassurance, Encourage professional help, Encourage self-help",
                    "explanation": "ALGEE: Approach/Assess/Assist, Listen non-judgmentally, Give reassurance and information, Encourage professional help, Encourage self-help and other supports."
                },
                {
                    "id": "q14-3",
                    "type": "multiple_choice",
                    "question": "When must you break confidentiality?",
                    "options": [
                        "When they say something embarrassing",
                        "When their family asks",
                        "When there's immediate risk of harm to themselves or others, or safeguarding concerns",
                        "Whenever you think it's best"
                    ],
                    "correct": "When there's immediate risk of harm to themselves or others, or safeguarding concerns",
                    "explanation": "Confidentiality must be broken for immediate safety concerns and safeguarding issues. Not for embarrassment, family requests, or personal judgment."
                },
                {
                    "id": "q14-4",
                    "type": "multiple_choice",
                    "question": "What is the first point of contact for any veteran seeking support?",
                    "options": [
                        "Their local pub",
                        "Veterans Gateway (0808 802 1212)",
                        "Social media groups",
                        "Their MP"
                    ],
                    "correct": "Veterans Gateway (0808 802 1212)",
                    "explanation": "Veterans Gateway is the official first point of contact for all veteran enquiries. They can signpost to the appropriate service."
                },
                {
                    "id": "q14-5",
                    "type": "multiple_choice",
                    "question": "Looking after your own wellbeing as a peer supporter is:",
                    "options": [
                        "Selfish and not important",
                        "Essential - you can't pour from an empty cup",
                        "Only important if you have time",
                        "Something to do after you've helped everyone else"
                    ],
                    "correct": "Essential - you can't pour from an empty cup",
                    "explanation": "Self-care is essential, not optional. You cannot provide quality support if you're burnt out. Use supervision, maintain boundaries, and practice self-care."
                }
            ]
        }
    }
]

def get_full_curriculum():
    """Return the complete curriculum with all 14 modules, using expanded content where available"""
    from .lms_curriculum_expanded import get_expanded_content
    
    expanded_content = get_expanded_content()
    full_curriculum = RADIOCHECK_CURRICULUM.copy()
    
    # Combine modules and apply expanded content
    all_modules = RADIOCHECK_CURRICULUM["modules"] + MODULES_9_TO_14
    
    # Replace content with expanded versions where available
    for module in all_modules:
        if module["id"] in expanded_content:
            module["content"] = expanded_content[module["id"]]
    
    full_curriculum["modules"] = all_modules
    return full_curriculum
