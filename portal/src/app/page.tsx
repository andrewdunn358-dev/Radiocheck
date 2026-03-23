'use client';

import Link from 'next/link';
import { useState } from 'react';
import { 
  MessageCircle, Phone, Dumbbell, Heart, BookOpen, Users,
  Shield, Clock, UserCheck, ChevronDown, ExternalLink,
  Menu, X, Sparkles
} from 'lucide-react';

// AI Team Data
const aiTeam = [
  {
    name: 'Tommy',
    role: 'Your Laid-Back Mate',
    description: 'Ex-Infantry, now your go-to for a relaxed chat. Tommy keeps it real with dry humor and zero judgment. Perfect for when you just need someone to listen without making a big deal of it.',
    personality: 'Calm, friendly, relatable',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-green-500 to-emerald-600'
  },
  {
    name: 'Bob',
    role: 'Straight-Talking Para',
    description: 'Former Parachute Regiment. Bob tells it like it is with Para banter and no-nonsense advice. When you need someone to cut through the BS and give you a reality check.',
    personality: 'Direct, honest, motivating',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-red-500 to-rose-600'
  },
  {
    name: 'Frankie',
    role: 'PTI Fitness Coach',
    description: 'Your virtual PTI who combines physical training with mental resilience. Frankie runs The Gym - a 12-week programme that builds strength inside and out.',
    personality: 'Energetic, encouraging, structured',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-orange-500 to-amber-600'
  },
  {
    name: 'Rachel',
    role: 'Warm & Caring Support',
    description: 'Former Army medic with a gentle approach. Rachel specializes in emotional support and helping you process difficult feelings with compassion and understanding.',
    personality: 'Empathetic, patient, nurturing',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-pink-500 to-rose-500'
  },
  {
    name: 'Rita',
    role: 'Family Support Specialist',
    description: 'Dedicated to supporting military families. Rita helps partners, parents, and children of serving personnel and veterans navigate the unique challenges they face.',
    personality: 'Understanding, supportive, resourceful',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-purple-500 to-violet-600'
  },
  {
    name: 'Mac',
    role: 'Royal Navy Veteran',
    description: 'Senior rate who served on submarines. Mac understands the unique pressures of naval service and the challenges of long deployments away from family.',
    personality: 'Steady, wise, experienced',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-blue-500 to-cyan-600'
  },
  {
    name: 'Taff',
    role: 'RAF Ground Crew',
    description: 'Former RAF technician who knows the importance of keeping things running smoothly. Taff is practical, solution-focused, and great at breaking down problems.',
    personality: 'Analytical, practical, reassuring',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-sky-500 to-blue-600'
  },
  {
    name: 'Jock',
    role: 'Scottish Highlander',
    description: 'Former Royal Regiment of Scotland. Jock brings highland hospitality and a warm Scottish welcome. Great for a blether when you need to get things off your chest.',
    personality: 'Friendly, humorous, welcoming',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-indigo-500 to-purple-600'
  },
  {
    name: 'Sarge',
    role: 'Senior NCO Mentor',
    description: 'The wise senior NCO who has seen it all. Sarge provides mentorship, career guidance, and helps you navigate military bureaucracy and transition challenges.',
    personality: 'Authoritative, knowledgeable, mentoring',
    avatar: 'https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png',
    color: 'from-slate-500 to-gray-600'
  }
];

const features = [
  {
    icon: MessageCircle,
    title: 'AI Battle Buddies',
    description: '9 AI companions with unique personalities, available 24/7 for a chat whenever you need it.',
    color: 'bg-green-500/20 text-green-400'
  },
  {
    icon: Users,
    title: 'Live Chat Support',
    description: 'Text chat with real counsellors and peer supporters who understand military life.',
    color: 'bg-blue-500/20 text-blue-400'
  },
  {
    icon: Phone,
    title: 'Callback Service',
    description: 'Request a call from a counsellor at a time that suits you.',
    color: 'bg-purple-500/20 text-purple-400'
  },
  {
    icon: Dumbbell,
    title: 'The Gym',
    description: "Frankie's 12-week PTI fitness programme to build strength and mental resilience.",
    color: 'bg-orange-500/20 text-orange-400'
  },
  {
    icon: Heart,
    title: 'Self-Care Tools',
    description: 'Private journaling, breathing exercises, grounding techniques, and sleep tips.',
    color: 'bg-pink-500/20 text-pink-400'
  },
  {
    icon: BookOpen,
    title: 'Support Directory',
    description: 'Comprehensive database of UK veteran charities and military support services.',
    color: 'bg-cyan-500/20 text-cyan-400'
  }
];

const stats = [
  { value: '24/7', label: 'AI Support Available' },
  { value: '9', label: 'AI Battle Buddies' },
  { value: '100%', label: 'Confidential' },
  { value: 'FREE', label: 'Forever' }
];

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png"
                alt="Radio Check"
                className="w-10 h-10"
              />
              <span className="font-bold text-xl">Radio Check</span>
            </div>
            
            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition">Features</a>
              <a href="#team" className="text-gray-300 hover:text-white transition">AI Team</a>
              <a href="#about" className="text-gray-300 hover:text-white transition">About</a>
              <div className="flex items-center gap-3">
                <a 
                  href="https://app.radiocheck.me" 
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg font-medium hover:opacity-90 transition"
                >
                  Open App
                </a>
              </div>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a0a0f] border-t border-white/10 p-4">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-gray-300 hover:text-white transition py-2">Features</a>
              <a href="#team" className="text-gray-300 hover:text-white transition py-2">AI Team</a>
              <a href="#about" className="text-gray-300 hover:text-white transition py-2">About</a>
              <a 
                href="https://app.radiocheck.me" 
                className="px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg font-medium text-center"
              >
                Open App
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-green-500/20 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 mb-8">
            <Sparkles className="w-4 h-4 text-green-400" />
            <span className="text-sm text-gray-300">Free, Confidential Mental Health Support</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Radio Check
          </h1>
          <p className="text-xl sm:text-2xl text-gray-400 mb-8 max-w-3xl mx-auto">
            24/7 peer support and counselling for UK Armed Forces personnel, veterans, and their families.
            <br />
            <span className="text-green-400">Because sometimes you just need to know someone&apos;s listening.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="https://app.radiocheck.me"
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-semibold text-lg hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              Open the App
              <ExternalLink className="w-5 h-5" />
            </a>
            <a 
              href="#features"
              className="px-8 py-4 bg-white/10 rounded-xl font-semibold text-lg hover:bg-white/20 transition"
            >
              Learn More
            </a>
          </div>
        </div>

        <div className="flex justify-center mt-16">
          <a href="#features" className="animate-bounce">
            <ChevronDown className="w-8 h-8 text-gray-500" />
          </a>
        </div>
      </section>

      {/* What is Radio Check */}
      <section id="about" className="py-20 px-4 bg-gradient-to-b from-transparent to-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">What is Radio Check?</h2>
            <p className="text-gray-400 text-lg max-w-3xl mx-auto">
              Radio Check is a <strong className="text-white">free, completely confidential</strong> mental health and peer support service
              built by veterans, for the UK Armed Forces community. Whether you&apos;re currently serving, a veteran,
              a reservist, or a family member - we&apos;re here for you, day or night.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-green-500/50 transition">
              <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Names Required</h3>
              <p className="text-gray-400">Completely anonymous. No registration, no records, no impact on your service record or security clearance.</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-blue-500/50 transition">
              <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                <Clock className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Available 24/7</h3>
              <p className="text-gray-400">Our AI Battle Buddies are always online. Human counsellors and peer supporters available during staffed hours.</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition">
              <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center mb-4">
                <UserCheck className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Built By Veterans</h3>
              <p className="text-gray-400">Created by people who&apos;ve served, who understand military culture, and who get it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How Radio Check Helps</h2>
            <p className="text-gray-400 text-lg">Whether you&apos;re struggling right now or just want someone to talk to, we offer multiple ways to get support.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-white/20 transition group"
              >
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the AI Team */}
      <section id="team" className="py-20 px-4 bg-gradient-to-b from-transparent via-green-500/5 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Meet the AI Team</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              9 unique AI Battle Buddies, each with their own personality and background. Available 24/7, they understand military culture and speak your language.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiTeam.map((member, index) => (
              <div 
                key={index}
                className="bg-white/5 rounded-2xl p-6 border border-white/10 hover:border-white/30 transition group"
              >
                <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <span className="text-2xl font-bold">{member.name[0]}</span>
                </div>
                <h3 className="text-xl font-semibold mb-1">{member.name}</h3>
                <p className="text-sm text-green-400 mb-3">{member.role}</p>
                <p className="text-gray-400 text-sm mb-3">{member.description}</p>
                <div className="flex flex-wrap gap-2">
                  {member.personality.split(', ').map((trait, i) => (
                    <span key={i} className="px-2 py-1 bg-white/10 rounded text-xs text-gray-300">
                      {trait}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Who Is Radio Check For?</h2>
            <p className="text-gray-400 text-lg">Radio Check is for everyone in the UK Armed Forces community. No matter your rank, service, or situation.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <Shield className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Serving Personnel</h3>
              <p className="text-gray-400">Currently serving in the Regular Forces or Reserves? We&apos;re here for you. Completely confidential - no impact on your career.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <UserCheck className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Veterans</h3>
              <p className="text-gray-400">Whether you served 4 years or 24, left last month or decades ago - Radio Check supports you through transition and beyond.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <Heart className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Families</h3>
              <p className="text-gray-400">Partners, parents, children, and loved ones. Rita, our family support AI, specialises in helping those who support others.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Radio Check */}
      <section className="py-20 px-4 bg-white/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Why &quot;Radio Check&quot;?</h2>
          <p className="text-xl text-gray-300 mb-8">
            In military communications, a &quot;Radio Check&quot; is a simple request to confirm someone&apos;s listening - to know you&apos;re not alone on the net.
          </p>
          <p className="text-lg text-gray-400 mb-8">
            That&apos;s what this app is about. When you&apos;re struggling at 3am, when the thoughts won&apos;t stop, when you need to talk but don&apos;t know who to call - Radio Check is your confirmation that someone&apos;s listening. You&apos;re not broadcasting into the void.
          </p>
          <p className="text-2xl font-semibold text-green-400">
            &quot;Radio Check&quot; - because sometimes you just need to know someone&apos;s there.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl sm:text-5xl font-bold text-green-400 mb-2">{stat.value}</div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portal Links */}
      <section className="py-20 px-4 bg-gradient-to-b from-transparent to-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Portals</h2>
            <p className="text-gray-400 text-lg">Access different parts of the Radio Check platform</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <a 
              href="https://app.radiocheck.me"
              className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 rounded-2xl p-8 border border-green-500/30 hover:border-green-500/60 transition group"
            >
              <MessageCircle className="w-10 h-10 text-green-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-2">Main App</h3>
              <p className="text-gray-400 text-sm">Chat with AI Battle Buddies and access support services</p>
              <span className="text-green-400 text-sm mt-4 inline-flex items-center gap-1">
                app.radiocheck.me <ExternalLink className="w-4 h-4" />
              </span>
            </a>

            <a 
              href="https://staff.radiocheck.me"
              className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 rounded-2xl p-8 border border-blue-500/30 hover:border-blue-500/60 transition group"
            >
              <Users className="w-10 h-10 text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-2">Staff Portal</h3>
              <p className="text-gray-400 text-sm">For counsellors and peer supporters</p>
              <span className="text-blue-400 text-sm mt-4 inline-flex items-center gap-1">
                staff.radiocheck.me <ExternalLink className="w-4 h-4" />
              </span>
            </a>

            <a 
              href="https://admin.radiocheck.me"
              className="bg-gradient-to-br from-purple-500/20 to-violet-600/20 rounded-2xl p-8 border border-purple-500/30 hover:border-purple-500/60 transition group"
            >
              <Shield className="w-10 h-10 text-purple-400 mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-semibold mb-2">Admin Portal</h3>
              <p className="text-gray-400 text-sm">Platform administration and management</p>
              <span className="text-purple-400 text-sm mt-4 inline-flex items-center gap-1">
                admin.radiocheck.me <ExternalLink className="w-4 h-4" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Talk?</h2>
          <p className="text-xl text-gray-400 mb-8">
            Open the app and start chatting with one of our AI Battle Buddies right now. No sign-up required.
          </p>
          <a 
            href="https://app.radiocheck.me"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl font-semibold text-lg hover:opacity-90 transition"
          >
            Start Chatting Now
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img 
                  src="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png"
                  alt="Radio Check"
                  className="w-10 h-10"
                />
                <span className="font-bold text-lg">Radio Check</span>
              </div>
              <p className="text-gray-400 text-sm">
                Free, confidential mental health support for the UK Armed Forces community.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="https://app.radiocheck.me" className="hover:text-white transition">Open App</a></li>
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#team" className="hover:text-white transition">AI Team</a></li>
                <li><a href="#about" className="hover:text-white transition">About</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Portals</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="https://app.radiocheck.me" className="hover:text-white transition">Main App</a></li>
                <li><a href="https://staff.radiocheck.me" className="hover:text-white transition">Staff Portal</a></li>
                <li><a href="https://admin.radiocheck.me" className="hover:text-white transition">Admin Portal</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Crisis Support</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>Emergency: <span className="text-white">999</span></li>
                <li>Samaritans: <span className="text-white">116 123</span></li>
                <li>Combat Stress: <span className="text-white">0800 138 1619</span></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              &copy; {new Date().getFullYear()} Radio Check. All rights reserved.
            </p>
            <div className="flex gap-6 text-gray-400 text-sm">
              <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
              <a href="mailto:hello@radiocheck.me" className="hover:text-white transition">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
