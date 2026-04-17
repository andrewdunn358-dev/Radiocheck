#!/usr/bin/env python3
"""
Batch CMS Page Seeder
=====================
Generates block data for all static content pages and seeds them via the API.
Run: python3 /app/backend/scripts/all_page_seeds.py
"""
import requests, os, json, sys

API_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://modular-safety-hub.preview.emergentagent.com")
# Login
r = requests.post(f"{API_URL}/api/auth/login", json={"email": "admin@veteran.dbty.co.uk", "password": "ChangeThisPassword123!"})
token = r.json().get("token")
if not token:
    print("Login failed:", r.json())
    sys.exit(1)
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Helper
def sc(title, desc, phone="", url="", tag=""):
    return {"type": "support_card", "props": {"title": title, "description": desc, "phone": phone, "url": url, "tag": tag}}

def co(title, desc, icon="message-circle", color="#0d9488"):
    return {"type": "callout", "props": {"text": f"{title} \u2014 {desc}", "icon": icon, "iconColor": color}}

def h(text):
    return {"type": "heading", "props": {"text": text}}

def p(text):
    return {"type": "paragraph", "props": {"text": text}}

def bl(items):
    return {"type": "bullet_list", "props": {"items": items}}

def cb(persona):
    return {"type": "chat_banner", "props": {"persona": persona}}

def div():
    return {"type": "divider", "props": {}}

def cf():
    return {"type": "crisis_footer", "props": {}}

# =========================================================
# PAGE DATA
# =========================================================

PAGES = []

# --- ABOUT ---
PAGES.append({
    "title": "About Radio Check",
    "slug": "about",
    "linked_persona": "tommy",
    "blocks": [
        h("About Radio Check"),
        co("What Is Radio Check?", "Radio Check combines peer support and AI conversation to give veterans a place to talk when it matters.", "compass", "#3b82f6"),
        p("Sometimes a real person isn't available straight away. When that happens, the chat is there \u2014 so you're not carrying things alone."),
        p("Talking helps. Even talking here."),
        div(),
        co("What the AI Is For", "The AI is here to listen without judgement, help you slow things down, let you get things off your chest, and encourage healthy coping and real-world support.", "shield", "#22c55e"),
        p("You're always in control of the conversation."),
        co("What the AI Is Not For", "The AI does not give medical or legal advice, diagnose or treat conditions, replace professionals, or handle emergencies on its own.", "alert-triangle", "#dc2626"),
        p("If you're in immediate danger, human help matters most \u2014 and we'll always encourage that."),
        div(),
        co("Is This Right for Me?", "Radio Check may help if you feel low, stressed, angry, or stuck; find it easier to talk in writing; don't want to feel like a burden; or just need somewhere safe to talk.", "eye", "#f59e0b"),
        p("You don't need to be in crisis to use this."),
        co("Safety & Trust", "Safeguarding comes first. Conversations handled with care. No judgement. No pressure. Your privacy matters.", "shield", "#7c3aed"),
        p("We're upfront about what this is \u2014 and what it isn't."),
        div(),
        h("The Bottom Line"),
        p("If Radio Check helps you feel even a little less alone, it's doing its job."),
        p("Someone is on the net."),
    ]
})

# --- CRIMINAL JUSTICE ---
PAGES.append({
    "title": "Criminal Justice Support",
    "slug": "criminal-justice",
    "linked_persona": "doris",
    "blocks": [
        cb("doris"),
        h("Criminal Justice Support"),
        co("We Understand", "Serving personnel and veterans can face unique challenges with the law, often linked to untreated PTSD, substance misuse, or difficulty adjusting to civilian life. Whether you're currently in prison, recently released, or facing charges \u2014 specialist support is available. You're not alone.", "scale", "#4f46e5"),
        co("This Section Provides Emotional Support", "For legal advice, please consult a qualified legal professional. We offer wellbeing support and signposting to specialist services.", "alert-triangle", "#22c55e"),
        div(),
        h("Support Organisations"),
        p("Specialist services for veterans in the justice system"),
        sc("NACRO", "Support for people with criminal records", "0300 123 1999", "https://www.nacro.org.uk"),
        sc("Forces in Mind Trust", "Research on veterans in justice system", "", "https://www.fim-trust.org"),
        sc("Walking With The Wounded", "Employment & justice support for the armed forces", "", "https://walkingwiththewounded.org.uk"),
        sc("Project Nova", "Armed forces personnel in the criminal justice system", "0800 917 7299", "https://www.rfea.org.uk/our-programmes/project-nova/"),
        sc("Probation Services", "Support after prison release", "0800 464 0708", "https://www.gov.uk/guidance/probation-services"),
        sc("Veterans' Gateway", "First point of contact for veterans", "0808 802 1212", "https://www.veteransgateway.org.uk"),
        div(),
        co("Tip", "Project Nova works specifically with veterans at every stage of the criminal justice system \u2014 from arrest to release.", "star", "#f59e0b"),
        cf(),
    ]
})

# --- CRISIS SUPPORT ---
PAGES.append({
    "title": "Crisis Support",
    "slug": "crisis-support",
    "linked_persona": "tommy",
    "blocks": [
        cb("tommy"),
        h("Crisis Support"),
        co("You're Not Alone", "If you're struggling right now, help is available 24/7. Whether you need someone to talk to, professional support, or emergency help \u2014 we've got your back. Reaching out is a sign of strength, not weakness.", "heart", "#dc2626"),
        div(),
        h("24/7 Crisis Helplines"),
        sc("NHS Mental Health", "Free 24/7 urgent mental health support. Call 111, then press Option 2 to speak to trained mental health professionals.", "", "", "Mental Health"),
        sc("Samaritans", "24/7 emotional support for anyone in distress. Free to call, always confidential.", "116 123", "https://www.samaritans.org", "Mental Health"),
        sc("Combat Stress", "Veterans' mental health charity. Specialist support from people who understand military life. 24/7 helpline.", "0800 138 1619", "https://combatstress.org.uk", "Mental Health"),
        sc("Veterans Gateway", "First point of contact for veterans seeking support. Connects you to the right services.", "0808 802 1212", "https://www.veteransgateway.org.uk"),
        sc("SSAFA", "Armed Forces charity supporting serving personnel, veterans and their families since 1885.", "0800 731 4880", "https://www.ssafa.org.uk"),
        sc("East Durham Veterans Trust", "Local North East support with counselling, peer groups, housing and benefits help. Mon-Fri 9am-4pm.", "0191 581 5677", "https://www.eastdurhamveteranstrust.org.uk"),
        div(),
        p("All services listed are free and confidential."),
        cf(),
    ]
})

# --- HE SERVED ---
PAGES.append({
    "title": "He Served",
    "slug": "he-served",
    "linked_persona": "dave",
    "blocks": [
        cb("dave"),
        h("He Served"),
        p("Your service shaped you. But it doesn't have to define how you suffer. It's time to talk about the stuff that doesn't get talked about."),
        div(),
        h("What We Cover"),
        co("It's Okay to Not Be Okay", "The military taught you to push through. But bottling it up doesn't make it go away. Talking isn't weakness \u2014 it's maintenance.", "message-circle", "#3b82f6"),
        co("The Andropause (Male Menopause)", "Testosterone drops with age \u2014 fatigue, irritability, low mood, reduced libido, weight gain. It's not 'getting old', it's a medical condition. Your GP can test and treat it.", "activity", "#f59e0b"),
        co("Military Sexual Trauma", "MST happens to men too. More than you think. It wasn't your fault and you're not alone. Specialist support exists that understands the military context.", "shield", "#ec4899"),
        co("Anger & Aggression", "Hyper-vigilance and aggression were survival tools in theatre. In civvy street, they destroy relationships and careers. Understanding the 'why' is the first step.", "zap", "#ef4444"),
        co("Alcohol & Substance Use", "The drinking culture in the forces normalises heavy use. When it follows you into civilian life and starts causing problems, it's time to take stock.", "flame", "#d97706"),
        co("Prostate & Testicular Health", "Check yourself regularly. Know the symptoms. Early detection saves lives. Don't be embarrassed \u2014 your GP has seen it all before.", "stethoscope", "#10b981"),
        co("Isolation & Loneliness", "Going from a tight-knit unit to civilian isolation hits hard. Finding your tribe again takes effort, but groups like Andy's Man Club prove there are men who get it.", "users", "#8b5cf6"),
        co("Suicide Prevention", "If you're having thoughts about ending it \u2014 please reach out. Veterans are at higher risk. Call CALM on 0800 58 58 58 or Samaritans on 116 123.", "heart", "#dc2626"),
        div(),
        h("Support & Resources"),
        sc("Andy's Man Club", "Free talking groups for men, every Monday at 7pm. No referral needed, no sign-up \u2014 just turn up.", "", "https://andysmanclub.co.uk"),
        sc("Combat Stress", "Specialist mental health support for veterans. 24/7 helpline: 0800 138 1619.", "0800 138 1619", "https://combatstress.org.uk", "Mental Health"),
        sc("CALM", "Dedicated to preventing male suicide. Free helpline 0800 58 58 58, 5pm-midnight daily.", "0800 58 58 58", "https://www.thecalmzone.net", "Mental Health"),
        sc("Movember", "Men's health \u2014 mental health, suicide prevention, prostate & testicular cancer.", "", "https://uk.movember.com"),
        sc("Prostate Cancer UK", "Support, information and research. Specialist nurse helpline: 0800 074 8383.", "0800 074 8383", "https://prostatecanceruk.org"),
        sc("Men's Health Forum", "Improving health for men and boys. Practical health information.", "", "https://www.menshealthforum.org.uk"),
        sc("NHS - Male Menopause", "Understanding male hormone changes. Your GP can check testosterone levels.", "", "https://www.nhs.uk/conditions/male-menopause/"),
        sc("The Survivors Trust (MST)", "Support for men who experienced military sexual trauma. Helpline: 0808 801 0818.", "0808 801 0818", "https://www.thesurvivorstrust.org"),
        sc("SurvivorsUK", "Support for men who have experienced sexual violence. Counselling and online helpline.", "", "https://www.survivorsuk.org"),
        sc("Veterans Gateway", "First point of contact for veteran support. 24/7: 0808 802 1212.", "0808 802 1212", "https://www.veteransgateway.org.uk"),
        sc("SSAFA", "Lifelong support for Armed Forces and families.", "0800 731 4880", "https://www.ssafa.org.uk"),
        sc("Help for Heroes", "Recovery and support for wounded veterans.", "", "https://www.helpforheroes.org.uk"),
        div(),
        cf(),
    ]
})

# --- HISTORICAL INVESTIGATIONS ---
PAGES.append({
    "title": "Warfare on Lawfare",
    "slug": "historical-investigations",
    "linked_persona": "james",
    "blocks": [
        cb("james"),
        h("Warfare on Lawfare"),
        co("We Understand", "Being part of a historical investigation \u2014 whether related to Northern Ireland, Iraq, Afghanistan, or other legacy cases \u2014 can bring intense stress, anxiety, and emotional strain. You may be experiencing difficult emotions years after your service. This is a normal response to an abnormal situation.", "shield", "#6366f1"),
        co("This Section Provides Emotional Support", "We offer wellbeing and mental health support, not legal advice. For legal matters, please consult a qualified legal professional.", "alert-triangle", "#22c55e"),
        div(),
        h("Support Options"),
        p("Confidential support from those who understand"),
        sc("Combat Stress", "Specialist support for veterans dealing with investigation-related stress and anxiety", "0191 270 4378", ""),
        sc("Veterans UK Welfare Service", "Confidential welfare support and guidance for veterans facing investigations", "0191 270 4378", ""),
        sc("SSAFA", "Practical and emotional support for veterans and families during difficult times", "0191 270 4378", ""),
        div(),
        co("Non-judgemental Support", "All support services listed here provide confidential, non-judgemental help. We make no assumptions and offer support regardless of circumstances.", "shield", "#7c3aed"),
        p("If you feel at immediate risk of harming yourself or others, call 999 or use the crisis support page."),
        cf(),
    ]
})

# --- COMPENSATION SCHEMES ---
PAGES.append({
    "title": "Compensation Schemes",
    "slug": "compensation-schemes",
    "linked_persona": "jack",
    "blocks": [
        cb("jack"),
        h("Compensation Schemes"),
        co("Introduction", "If you've been injured or become ill due to military service, you may be entitled to compensation. Jack can help you understand your options, or browse the resources below.", "compass", "#059669"),
        div(),
        h("Official Government Schemes"),
        p("These are the official compensation schemes administered by Veterans UK"),
        co("Armed Forces Compensation Scheme (AFCS)", "For injuries or illness caused by service on or after 6 April 2005. Lump sum payments from \u00a31,236 to \u00a3650,000. Tax-free Guaranteed Income Payment for serious injuries. Must claim within 7 years.", "shield", "#059669"),
        co("War Pension Scheme", "For injuries or illness caused by service before 6 April 2005. Weekly pension payments based on disablement level. No time limit on claims \u2014 you can apply many years after leaving.", "shield", "#059669"),
        co("Tribunal Guide", "If your claim is rejected, you can appeal to an independent tribunal. Charities like RBL can represent you for free.", "scale", "#059669"),
        div(),
        h("Charities & Support Organisations"),
        p("These organisations can help you with claims for free \u2014 no lawyers needed"),
        sc("Royal British Legion", "Free claims advice and support for all veterans. Expert help with forms, medical evidence, and tribunal representation.", "", "https://www.britishlegion.org.uk/get-support/expert-guidance/money-debt/war-pensions-scheme"),
        sc("Hearing Loss Claims (RBL)", "Royal British Legion guidance on military hearing loss claims.", "", "https://www.britishlegion.org.uk/get-support/expert-guidance/tribunal-representation/military-hearing-loss-claims"),
        sc("Matrix Agreement - Hearing Loss", "DEADLINE EXTENDED TO 31 JULY 2026. Over 70,000 veterans may be eligible. Awards often much higher than AFCS.", "", "https://veteranswelfaregroup.co.uk/news/the-matrix-agreement-extending-the-hearing-loss-claims-deadline/"),
        sc("Blesma - The Limbless Veterans", "Support for veterans who have lost limbs. Expert help with War Pension and AFCS claims.", "", "https://blesma.org/war-pension-scheme/"),
        div(),
        co("Beware of Claims Companies", "You don't need to pay a solicitor or claims company. The charities listed above offer free help. Claims companies often take 20-30% of your compensation.", "alert-triangle", "#f59e0b"),
        cf(),
    ]
})

# --- PRIVACY POLICY ---
PAGES.append({
    "title": "Privacy Policy",
    "slug": "privacy-policy",
    "blocks": [
        h("Privacy Policy"),
        p("Last Updated: February 2026"),
        h("1. Introduction"),
        p("Radio Check is committed to protecting the privacy of UK veterans and their families. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use our mobile application and services."),
        h("2. Information We Collect"),
        p("Account Information: Email address, Name (optional), Password (encrypted), Service branch and regiment (optional)."),
        p("Chat & Communication Data: Messages with AI companions, Messages with peer supporters, Callback requests, Call logs (metadata only)."),
        p("Technical Data: Device type and operating system, IP address (for security purposes), App usage statistics."),
        h("3. How We Use Your Information"),
        bl(["Provide AI-powered support and companionship", "Connect you with peer supporters", "Detect and respond to crisis situations (safeguarding)", "Improve our services and AI responses", "Send important service notifications", "Comply with legal obligations"]),
        h("4. AI Chat Processing"),
        p("When you chat with our AI companions, your messages are processed by OpenAI's language models to generate supportive responses. We do not share your identity with OpenAI. Chat data is also analyzed locally to detect potential crisis situations."),
        h("5. Safeguarding"),
        p("Your safety is our priority. Our system automatically monitors conversations for signs of crisis, including expressions of suicidal ideation, self-harm indicators, and severe distress signals. If detected, our safeguarding team may be alerted."),
        h("6. Data Security"),
        bl(["AES-256 encryption for sensitive data", "Secure password hashing (bcrypt)", "HTTPS for all data transmission", "Regular security audits", "Access controls and staff training"]),
        h("7. Data Retention"),
        p("Account data: Retained while your account is active, plus 7 years after deletion. Chat history: 7 years (for safeguarding audit purposes). Technical logs: 90 days."),
        h("8. Your Rights (GDPR)"),
        bl(["Access your personal data", "Correct inaccurate data", "Request deletion of your data", "Export your data in a portable format", "Object to certain processing", "Withdraw consent"]),
        p("To exercise these rights, go to Settings > Privacy in the app, or contact us at privacy@radiocheck.me"),
        h("9. Third-Party Services"),
        bl(["OpenAI: AI chat processing (USA, with Standard Contractual Clauses)", "MongoDB Atlas: Database hosting (UK/EU)", "Render: Application hosting (EU)", "Expo: Mobile app services"]),
        h("10. Contact Us"),
        p("For privacy-related queries: Email: privacy@radiocheck.me. For complaints, you may also contact the Information Commissioner's Office (ICO): ico.org.uk"),
    ]
})

# --- TERMS OF SERVICE ---
PAGES.append({
    "title": "Terms of Service",
    "slug": "terms-of-service",
    "blocks": [
        h("Terms of Service"),
        p("Last Updated: February 2026"),
        h("1. Acceptance of Terms"),
        p("By downloading, accessing, or using Radio Check, you agree to be bound by these Terms of Service. If you do not agree, please do not use the App."),
        h("2. Service Description"),
        bl(["AI-powered companions for emotional support", "Peer-to-peer connection (Buddy Finder)", "Access to professional support resources", "WebRTC-based voice calls", "Educational resources and information"]),
        h("3. Important Disclaimers"),
        co("Not a Medical Service", "Radio Check is NOT a medical, psychiatric, or therapeutic service. Our AI companions cannot diagnose conditions, prescribe treatments, or provide therapy.", "alert-triangle", "#dc2626"),
        co("Not Emergency Services", "If you are in immediate danger, call 999. For crisis support, contact Samaritans (116 123) or Combat Stress (0800 138 1619).", "alert-triangle", "#dc2626"),
        h("4. User Eligibility"),
        bl(["At least 18 years old", "A UK resident or veteran connected to UK services", "Capable of entering into a legally binding agreement"]),
        h("5. User Conduct"),
        p("You agree NOT to use the App for unlawful purposes, harass or threaten other users, share false information, attempt to exploit AI systems, or interfere with the App's security."),
        h("6. Safeguarding"),
        p("By using the App, you consent to our safeguarding measures including monitoring conversations for signs of crisis and alerting our safeguarding team when concerned."),
        h("7. Governing Law"),
        p("These terms are governed by the laws of England and Wales."),
        h("8. Contact"),
        p("For questions: support@radiocheck.me. Privacy concerns: privacy@radiocheck.me"),
    ]
})

# --- COMMONWEALTH VETERANS ---
PAGES.append({
    "title": "Commonwealth Comrades",
    "slug": "commonwealth-veterans",
    "linked_persona": "kofi",
    "blocks": [
        cb("kofi"),
        h("Commonwealth Comrades"),
        p("From Fiji to Jamaica, Nepal to Ghana \u2014 Commonwealth citizens have served with distinction in the British Armed Forces. This page is for you."),
        div(),
        co("Key Rights \u2014 Know Your Entitlements", "FREE settlement (ILR) after 4+ years service. FREE settlement for your spouse & children. Same pension & compensation as UK veterans. Full NHS healthcare entitlement. Armed Forces Covenant protections.", "shield", "#14b8a6"),
        div(),
        h("Your Rights"),
        co("Right to Remain in UK", "Commonwealth veterans who served 4+ years are entitled to Indefinite Leave to Remain (ILR). Since 2022, this is FREE \u2014 no immigration fees for you or your family.", "home", "#14b8a6"),
        co("Family Settlement Rights", "Your spouse/partner and children under 18 can also apply for settlement. As of 2022, there are no fees for these applications.", "users", "#14b8a6"),
        co("British Citizenship", "After holding ILR for 12 months, you can apply for British Citizenship. Full voting rights and a British passport.", "flag", "#14b8a6"),
        div(),
        h("Support Organisations"),
        sc("CFFVC", "Commonwealth Forces Families & Veterans Council. They understand the unique challenges you face.", "", "https://cffvc.org.uk"),
        sc("Royal British Legion", "Support for ALL veterans, regardless of nationality. Welfare services, financial support, and advocacy.", "", "https://www.britishlegion.org.uk"),
        sc("SSAFA", "Practical, emotional, and financial support. Caseworkers help navigate UK systems.", "", "https://www.ssafa.org.uk"),
        sc("Veterans UK", "Government support \u2014 pensions, compensation, and welfare. Contact: 0808 1914 218", "0808 1914 218", "https://www.gov.uk/government/organisations/veterans-uk"),
        div(),
        h("Health & Wellbeing"),
        sc("NHS Entitlement", "You are entitled to FREE NHS healthcare. Register with a GP and mention veteran status.", "", "https://www.nhs.uk/nhs-services/armed-forces-community"),
        sc("Op COURAGE", "NHS veterans' mental health service. Self-referral available \u2014 no GP needed.", "", "https://www.nhs.uk/nhs-services/armed-forces-community/mental-health/veterans-reservists"),
        sc("Combat Stress", "Specialist mental health treatment. 24/7 Helpline: 0800 138 1619.", "0800 138 1619", "https://combatstress.org.uk"),
        div(),
        cf(),
    ]
})

# --- FAITH & SERVICE ---
PAGES.append({
    "title": "Faith & Service",
    "slug": "faith-service",
    "linked_persona": "catherine",
    "blocks": [
        cb("catherine"),
        h("Faith & Service"),
        p("Whatever your faith \u2014 or none \u2014 spiritual support is available. Chaplains serve all personnel, and faith communities welcome veterans."),
        co("One Team, Many Faiths", "The British Armed Forces respect and accommodate all faiths. Christians, Muslims, Sikhs, Hindus, Jews, Buddhists, and those of no faith serve side by side. Your beliefs are valued.", "globe", "#8b5cf6"),
        div(),
        h("Armed Forces Chaplaincy"),
        co("Royal Army Chaplains' Department", "Pastoral care and spiritual support to soldiers of all faiths and none. Padres deploy alongside troops and provide a confidential ear.", "shield", "#4f46e5"),
        co("Naval Chaplaincy Service", "Spiritual care at sea and shore. Support on ships, submarines, and shore establishments.", "anchor", "#4f46e5"),
        co("RAF Chaplains Branch", "Spiritual support across all RAF stations worldwide. Available 24/7.", "compass", "#4f46e5"),
        div(),
        h("Faith Communities"),
        co("Christian Support", "Armed Forces Christian Union, Forces Chaplaincy, and the Salvation Army all provide support for Christian veterans.", "book-open", "#3b82f6"),
        co("Muslim Support", "Armed Forces Muslim Association (AFMA) supports Muslim personnel and veterans. Muslim chaplains (Imams) provide Islamic spiritual care.", "globe", "#059669"),
        co("Jewish Support", "AJEX \u2014 Association of Jewish Ex-Servicemen represents Jewish veterans. Jewish military chaplains provide spiritual support.", "star", "#f59e0b"),
        co("Sikh Support", "Armed Forces Sikh Association (AFSA) represents Sikhs. A proud tradition of service dating back generations.", "shield", "#ea580c"),
        co("Hindu & Buddhist Support", "Armed Forces Hindu Network and Buddhist Society provide spiritual guidance, meditation, and community.", "leaf", "#8b5cf6"),
        co("No Faith? That's OK Too", "Military chaplains support ALL personnel \u2014 including those with no religious faith. You don't need to be religious to talk.", "message-circle", "#6b7280"),
        div(),
        co("Moral Injury Support", "The deep distress from actions that violate your moral code affects many veterans. Chaplains and specialist therapists understand this.", "heart", "#ec4899"),
        cf(),
    ]
})

# --- SUBSTANCE SUPPORT ---
PAGES.append({
    "title": "Substance Support",
    "slug": "substance-support",
    "linked_persona": "sam",
    "blocks": [
        cb("sam"),
        h("Substance Support"),
        p("The drinking culture in the forces normalises heavy use. If it's following you into civilian life and causing problems, there's no judgement here \u2014 just support."),
        div(),
        h("Understanding the Issue"),
        co("You're Not Weak", "Substance use in the military is common \u2014 alcohol especially. Using substances to cope with trauma, boredom, or the transition to civilian life doesn't make you weak. It makes you human.", "heart", "#f59e0b"),
        co("When It Becomes a Problem", "If drinking or substance use is affecting your relationships, work, health, or mood \u2014 it's time to take stock. You don't need to hit rock bottom to ask for help.", "alert-triangle", "#ef4444"),
        div(),
        h("Support Services"),
        sc("Change Grow Live", "NHS-funded drug and alcohol treatment services across England.", "", "https://www.changegrowlive.org", "Mental Health"),
        sc("Turning Point", "Support for people affected by drug and alcohol use. Free, confidential.", "", "https://www.turning-point.co.uk"),
        sc("Drinkline", "Free helpline for people concerned about their drinking. 0300 123 1110.", "0300 123 1110", ""),
        sc("Alcoholics Anonymous", "Fellowship of people who share their experience to help others recover.", "0800 917 7650", "https://www.alcoholics-anonymous.org.uk"),
        sc("FRANK", "Honest information about drugs. Free helpline: 0300 123 6600.", "0300 123 6600", "https://www.talktofrank.com"),
        sc("Combat Stress", "Understand the link between military trauma and substance use. 24/7: 0800 138 1619.", "0800 138 1619", "https://combatstress.org.uk", "Mental Health"),
        sc("Tom Harrison House", "Residential treatment for veterans with addiction. Military-sensitive environment.", "", "https://www.tomharrisonhouse.org.uk"),
        div(),
        cf(),
    ]
})

# --- WOMEN VETERANS ---
PAGES.append({
    "title": "She Served Too",
    "slug": "women-veterans",
    "linked_persona": "rita",
    "blocks": [
        cb("rita"),
        h("She Served Too"),
        p("Women have served in the British Armed Forces with courage and distinction. Your service matters, your experiences are valid, and support is available."),
        div(),
        h("What We Cover"),
        co("Recognition", "Women's military service has often been overlooked or minimised. Whether you served on the front line, in support roles, or anywhere in between \u2014 your contribution matters.", "star", "#ec4899"),
        co("Military Sexual Trauma", "MST is a reality for too many servicewomen. It was NOT your fault. Specialist support exists and you will be believed.", "shield", "#dc2626"),
        co("Transition Challenges", "Women veterans face unique challenges \u2014 from gender-specific health needs to finding peer support groups that understand.", "compass", "#8b5cf6"),
        co("Mental Health", "PTSD, anxiety, and depression affect women veterans too. The symptoms may present differently, but the need for support is the same.", "heart", "#3b82f6"),
        div(),
        h("Support & Resources"),
        sc("Women Veterans Network UK", "Peer support and advocacy for women who served.", "", "https://www.womensveteransnetwork.org.uk"),
        sc("Salute Her", "Celebrating and supporting women who served in the Armed Forces.", "", "https://www.saluteher.co.uk"),
        sc("The Survivors Trust", "Support for those affected by sexual violence. Helpline: 0808 801 0818.", "0808 801 0818", "https://www.thesurvivorstrust.org"),
        sc("Combat Stress", "Specialist mental health support for veterans. 24/7 helpline.", "0800 138 1619", "https://combatstress.org.uk", "Mental Health"),
        sc("SSAFA", "Practical, emotional, and financial support for all who served.", "0800 731 4880", "https://www.ssafa.org.uk"),
        div(),
        cf(),
    ]
})

# --- MONEY & BENEFITS ---
PAGES.append({
    "title": "Money & Benefits",
    "slug": "money-benefits",
    "linked_persona": "jack",
    "blocks": [
        cb("jack"),
        h("Money & Benefits"),
        p("Financial worries can affect every part of your life. Veterans are entitled to specific benefits and support \u2014 make sure you're getting what you deserve."),
        div(),
        h("Key Entitlements"),
        co("Armed Forces Pension", "Your military pension is a right, not a benefit. Make sure you're receiving the correct amount. Contact Veterans UK on 0808 1914 218 if unsure.", "wallet", "#059669"),
        co("War Disability Pension", "If you were injured or became ill because of service before April 2005, you may be entitled to a War Disability Pension.", "shield", "#059669"),
        co("Council Tax Relief", "Many councils offer council tax discounts for severely disabled veterans or their carers. Ask your local authority.", "home", "#3b82f6"),
        div(),
        h("Support Organisations"),
        sc("Royal British Legion", "Free expert help with benefits, compensation claims, and financial advice.", "", "https://www.britishlegion.org.uk"),
        sc("SSAFA", "Financial assistance and grants for those in need. Emergency funding available.", "0800 731 4880", "https://www.ssafa.org.uk", "Financial"),
        sc("Help for Heroes", "Recovery grants and financial support for wounded veterans.", "", "https://www.helpforheroes.org.uk", "Financial"),
        sc("Veterans UK", "Government pensions and compensation. Helpline: 0808 1914 218.", "0808 1914 218", "https://www.gov.uk/government/organisations/veterans-uk"),
        sc("Citizens Advice", "Free, confidential advice on benefits, debt, housing, and legal issues.", "", "https://www.citizensadvice.org.uk", "Practical"),
        sc("StepChange", "Free debt advice charity. Helping people deal with debt problems.", "0800 138 1111", "https://www.stepchange.org", "Financial"),
        div(),
        cf(),
    ]
})

# =========================================================
# SEED ALL PAGES
# =========================================================

print(f"Seeding {len(PAGES)} pages to {API_URL}...")
r = requests.post(
    f"{API_URL}/api/cms/admin/pages/batch-seed",
    json={"pages": PAGES},
    headers=headers,
)
print(f"Status: {r.status_code}")
print(r.json())
