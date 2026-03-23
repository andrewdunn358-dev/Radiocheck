'use client';

import Link from 'next/link';
import { useState } from 'react';
import { 
  MessageCircle, Phone, Dumbbell, Heart, BookOpen, Users,
  Shield, Clock, UserCheck, ChevronDown, ExternalLink,
  Menu, X, Sparkles, Linkedin, Mail
} from 'lucide-react';

// AI Team Data with real descriptions
const aiTeam = [
  {
    name: 'Tommy',
    role: 'Your Laid-Back Mate',
    description: 'Ex-Infantry, now your go-to for a relaxed chat. Tommy keeps it real with dry humor and zero judgment. Perfect for when you just need someone to listen.',
    personality: 'Calm, friendly, relatable',
    avatar: '/images/ai/tommy.png',
    color: 'from-emerald-500 to-green-600'
  },
  {
    name: 'Bob',
    role: 'Straight-Talking Para',
    description: 'Former Parachute Regiment. Bob tells it like it is with Para banter and no-nonsense advice. When you need someone to cut through the BS.',
    personality: 'Direct, honest, motivating',
    avatar: '/images/ai/bob.png',
    color: 'from-red-500 to-rose-600'
  },
  {
    name: 'Frankie',
    role: 'PTI Fitness Coach',
    description: 'Your virtual PTI who combines physical training with mental resilience. Frankie runs The Gym - building strength inside and out.',
    personality: 'Energetic, encouraging, structured',
    avatar: '/images/ai/frankie.png',
    color: 'from-orange-500 to-amber-600'
  },
  {
    name: 'Rachel',
    role: 'Warm & Caring Support',
    description: 'Former Army medic with a gentle approach. Rachel specializes in emotional support and helping you process difficult feelings.',
    personality: 'Empathetic, patient, nurturing',
    avatar: '/images/ai/rachel.png',
    color: 'from-pink-500 to-rose-500'
  },
  {
    name: 'Rita',
    role: 'Family Support Specialist',
    description: 'Dedicated to supporting military families. Rita helps partners, parents, and children navigate the unique challenges they face.',
    personality: 'Understanding, supportive, resourceful',
    avatar: '/images/ai/rita.png',
    color: 'from-purple-500 to-violet-600'
  },
  {
    name: 'Mac',
    role: 'Royal Navy Veteran',
    description: 'Senior rate who served on submarines. Mac understands the unique pressures of naval service and long deployments.',
    personality: 'Steady, wise, experienced',
    avatar: '/images/ai/mac.png',
    color: 'from-blue-500 to-cyan-600'
  },
  {
    name: 'Taff',
    role: 'RAF Ground Crew',
    description: 'Former RAF technician. Taff is practical, solution-focused, and great at breaking down problems into manageable pieces.',
    personality: 'Analytical, practical, reassuring',
    avatar: '/images/ai/taff.png',
    color: 'from-sky-500 to-blue-600'
  },
  {
    name: 'Jock',
    role: 'Scottish Highlander',
    description: 'Former Royal Regiment of Scotland. Jock brings highland hospitality and a warm Scottish welcome for a good blether.',
    personality: 'Friendly, humorous, welcoming',
    avatar: '/images/ai/jock.png',
    color: 'from-indigo-500 to-purple-600'
  },
  {
    name: 'Sarge',
    role: 'Senior NCO Mentor',
    description: 'The wise senior NCO who has seen it all. Sarge provides mentorship and helps you navigate transition challenges.',
    personality: 'Authoritative, knowledgeable, mentoring',
    avatar: '/images/ai/sarge.png',
    color: 'from-slate-500 to-gray-600'
  }
];

// Founders Data
const founders = [
  {
    name: 'Andrew',
    role: 'Co-Founder',
    description: 'Army veteran with a passion for using technology to support the military community. Andrew leads the vision and strategy for Radio Check.',
    image: '/images/founders/andrew.jpg',
  },
  {
    name: 'Anthony',
    role: 'Co-Founder',
    description: 'Experienced in mental health support services and veteran welfare. Anthony ensures Radio Check delivers meaningful, effective support.',
    image: '/images/founders/anthony.jpg',
  },
  {
    name: 'Rachel',
    role: 'Co-Founder',
    description: 'Specialist in peer support training and safeguarding. Rachel oversees the human support team and volunteer training programmes.',
    image: '/images/founders/rachel.jpg',
  }
];

const features = [
  {
    icon: MessageCircle,
    title: 'AI Battle Buddies',
    description: '9 AI companions with unique personalities, available 24/7 for a chat whenever you need it.',
    color: 'bg-emerald-500/20 text-emerald-400'
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
    <div className="min-h-screen bg-primary-dark text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-primary-dark/95 backdrop-blur-md border-b border-border">
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
              <a href="#features" className="text-secondary hover:text-secondary/80 transition">Features</a>
              <a href="#team" className="text-secondary hover:text-secondary/80 transition">AI Team</a>
              <a href="#founders" className="text-secondary hover:text-secondary/80 transition">Founders</a>
              <a href="#about" className="text-secondary hover:text-secondary/80 transition">About</a>
              <div className="flex items-center gap-3">
                <a 
                  href="https://app.radiocheck.me" 
                  className="px-4 py-2 bg-secondary text-primary-dark rounded-lg font-medium hover:bg-secondary/90 transition"
                >
                  Open App
                </a>
              </div>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2 text-secondary"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-primary-dark border-t border-border p-4">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-secondary hover:text-secondary/80 transition py-2">Features</a>
              <a href="#team" className="text-secondary hover:text-secondary/80 transition py-2">AI Team</a>
              <a href="#founders" className="text-secondary hover:text-secondary/80 transition py-2">Founders</a>
              <a href="#about" className="text-secondary hover:text-secondary/80 transition py-2">About</a>
              <a 
                href="https://app.radiocheck.me" 
                className="px-4 py-3 bg-secondary text-primary-dark rounded-lg font-medium text-center"
              >
                Open App
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/10 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-primary/30 rounded-full blur-3xl" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-full border border-border mb-8">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span className="text-sm text-secondary">Free, Confidential Mental Health Support</span>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
            Radio Check
          </h1>
          <p className="text-xl sm:text-2xl text-secondary mb-8 max-w-3xl mx-auto">
            24/7 peer support and counselling for UK Armed Forces personnel, veterans, and their families.
            <br />
            <span className="text-white">Because sometimes you just need to know someone&apos;s listening.</span>
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="https://app.radiocheck.me"
              className="px-8 py-4 bg-secondary text-primary-dark rounded-xl font-semibold text-lg hover:bg-secondary/90 transition flex items-center justify-center gap-2"
            >
              Open the App
              <ExternalLink className="w-5 h-5" />
            </a>
            <a 
              href="#features"
              className="px-8 py-4 bg-card border border-border rounded-xl font-semibold text-lg hover:border-secondary/50 transition"
            >
              Learn More
            </a>
          </div>
        </div>

        <div className="flex justify-center mt-16">
          <a href="#about" className="animate-bounce">
            <ChevronDown className="w-8 h-8 text-secondary" />
          </a>
        </div>
      </section>

      {/* What is Radio Check */}
      <section id="about" className="py-20 px-4 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">What is Radio Check?</h2>
            <p className="text-secondary text-lg max-w-3xl mx-auto">
              Radio Check is a <strong className="text-white">free, completely confidential</strong> mental health and peer support service
              built by veterans, for the UK Armed Forces community. Whether you&apos;re currently serving, a veteran,
              a reservist, or a family member - we&apos;re here for you, day or night.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card rounded-2xl p-8 border border-border hover:border-secondary/50 transition">
              <div className="w-14 h-14 bg-secondary/20 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Names Required</h3>
              <p className="text-secondary">Completely anonymous. No registration, no records, no impact on your service record or security clearance.</p>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border hover:border-secondary/50 transition">
              <div className="w-14 h-14 bg-secondary/20 rounded-xl flex items-center justify-center mb-4">
                <Clock className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Available 24/7</h3>
              <p className="text-secondary">Our AI Battle Buddies are always online. Human counsellors and peer supporters available during staffed hours.</p>
            </div>
            <div className="bg-card rounded-2xl p-8 border border-border hover:border-secondary/50 transition">
              <div className="w-14 h-14 bg-secondary/20 rounded-xl flex items-center justify-center mb-4">
                <UserCheck className="w-7 h-7 text-secondary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Built By Veterans</h3>
              <p className="text-secondary">Created by people who&apos;ve served, who understand military culture, and who get it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How Radio Check Helps</h2>
            <p className="text-secondary text-lg">Whether you&apos;re struggling right now or just want someone to talk to, we offer multiple ways to get support.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="bg-card rounded-2xl p-6 border border-border hover:border-secondary/50 transition group"
              >
                <div className={`w-12 h-12 ${feature.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the AI Team */}
      <section id="team" className="py-20 px-4 bg-card/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Meet the AI Team</h2>
            <p className="text-secondary text-lg max-w-2xl mx-auto">
              9 unique AI Battle Buddies, each with their own personality and background. Available 24/7, they understand military culture and speak your language.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {aiTeam.map((member, index) => (
              <div 
                key={index}
                className="bg-card rounded-2xl p-6 border border-border hover:border-secondary/50 transition group"
              >
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${member.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform mx-auto overflow-hidden`}>
                  <span className="text-3xl font-bold text-white">{member.name[0]}</span>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-1">{member.name}</h3>
                  <p className="text-sm text-secondary mb-3">{member.role}</p>
                  <p className="text-secondary/80 text-sm mb-4">{member.description}</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {member.personality.split(', ').map((trait, i) => (
                      <span key={i} className="px-2 py-1 bg-primary-dark rounded text-xs text-secondary">
                        {trait}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet the Founders */}
      <section id="founders" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Meet the Founders</h2>
            <p className="text-secondary text-lg max-w-2xl mx-auto">
              The team behind Radio Check - veterans and mental health advocates dedicated to supporting the military community.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {founders.map((founder, index) => (
              <div 
                key={index}
                className="bg-card rounded-2xl p-8 border border-border hover:border-secondary/50 transition text-center group"
              >
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-secondary/30 to-primary overflow-hidden flex items-center justify-center group-hover:scale-105 transition-transform">
                  <span className="text-5xl font-bold text-secondary">{founder.name[0]}</span>
                </div>
                <h3 className="text-2xl font-semibold mb-1">{founder.name}</h3>
                <p className="text-secondary font-medium mb-4">{founder.role}</p>
                <p className="text-secondary/80">{founder.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who is it for */}
      <section className="py-20 px-4 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Who Is Radio Check For?</h2>
            <p className="text-secondary text-lg">Radio Check is for everyone in the UK Armed Forces community. No matter your rank, service, or situation.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <Shield className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Serving Personnel</h3>
              <p className="text-secondary">Currently serving in the Regular Forces or Reserves? We&apos;re here for you. Completely confidential - no impact on your career.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <UserCheck className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Veterans</h3>
              <p className="text-secondary">Whether you served 4 years or 24, left last month or decades ago - Radio Check supports you through transition and beyond.</p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center">
                <Heart className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Families</h3>
              <p className="text-secondary">Partners, parents, children, and loved ones of serving personnel and veterans. Rita specialises in helping those who support others.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why Radio Check */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Why &quot;Radio Check&quot;?</h2>
          <p className="text-xl text-white mb-8">
            In military communications, a &quot;Radio Check&quot; is a simple request to confirm someone&apos;s listening -
            to know you&apos;re not alone on the net.
          </p>
          <p className="text-lg text-secondary mb-8">
            That&apos;s what this app is about. When you&apos;re struggling at 3am, when the thoughts won&apos;t stop,
            when you need to talk but don&apos;t know who to call - Radio Check is your confirmation that
            someone&apos;s listening. You&apos;re not broadcasting into the void.
          </p>
          <p className="text-2xl font-semibold text-secondary">
            &quot;Radio Check&quot; - because sometimes you just need to know someone&apos;s there.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl sm:text-5xl font-bold text-secondary mb-2">{stat.value}</div>
                <div className="text-secondary/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supporters */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-lg font-semibold text-secondary mb-8">PROUDLY SUPPORTED BY</h3>
          <div className="flex flex-wrap justify-center items-center gap-12">
            <a href="https://www.youtube.com/@FrankiesPod" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition">
              <div className="bg-card rounded-lg px-6 py-4 border border-border">
                <span className="text-xl font-semibold">Frankie&apos;s Pod</span>
              </div>
            </a>
            <a href="https://www.standingtall.co.uk/" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition">
              <div className="bg-card rounded-lg px-6 py-4 border border-border">
                <span className="text-xl font-semibold">Standing Tall Foundation</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Portal Links */}
      <section className="py-20 px-4 bg-card/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Portals</h2>
            <p className="text-secondary text-lg">Access different parts of the Radio Check platform</p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <a 
              href="https://app.radiocheck.me"
              className="bg-card rounded-2xl p-6 border border-border hover:border-secondary/50 transition group text-center"
            >
              <MessageCircle className="w-10 h-10 text-emerald-400 mb-4 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">Main App</h3>
              <p className="text-secondary text-sm mb-3">Chat with AI Battle Buddies</p>
              <span className="text-secondary/60 text-xs flex items-center justify-center gap-1">
                app.radiocheck.me <ExternalLink className="w-3 h-3" />
              </span>
            </a>

            <a 
              href="https://training.radiocheck.me"
              className="bg-card rounded-2xl p-6 border border-border hover:border-secondary/50 transition group text-center"
            >
              <BookOpen className="w-10 h-10 text-amber-400 mb-4 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">Training</h3>
              <p className="text-secondary text-sm mb-3">Peer supporter training</p>
              <span className="text-secondary/60 text-xs flex items-center justify-center gap-1">
                training.radiocheck.me <ExternalLink className="w-3 h-3" />
              </span>
            </a>

            <a 
              href="https://staff.radiocheck.me"
              className="bg-card rounded-2xl p-6 border border-border hover:border-secondary/50 transition group text-center"
            >
              <Users className="w-10 h-10 text-blue-400 mb-4 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">Staff Portal</h3>
              <p className="text-secondary text-sm mb-3">For counsellors & supporters</p>
              <span className="text-secondary/60 text-xs flex items-center justify-center gap-1">
                staff.radiocheck.me <ExternalLink className="w-3 h-3" />
              </span>
            </a>

            <a 
              href="https://admin.radiocheck.me"
              className="bg-card rounded-2xl p-6 border border-border hover:border-secondary/50 transition group text-center"
            >
              <Shield className="w-10 h-10 text-purple-400 mb-4 mx-auto group-hover:scale-110 transition-transform" />
              <h3 className="text-lg font-semibold mb-2">Admin Portal</h3>
              <p className="text-secondary text-sm mb-3">Platform administration</p>
              <span className="text-secondary/60 text-xs flex items-center justify-center gap-1">
                admin.radiocheck.me <ExternalLink className="w-3 h-3" />
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">Ready to Talk?</h2>
          <p className="text-xl text-secondary mb-8">
            Open the app and start chatting with one of our AI Battle Buddies right now. No sign-up required.
          </p>
          <a 
            href="https://app.radiocheck.me"
            className="inline-flex items-center gap-2 px-8 py-4 bg-secondary text-primary-dark rounded-xl font-semibold text-lg hover:bg-secondary/90 transition"
          >
            Start Chatting Now
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 bg-card/30">
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
              <p className="text-secondary text-sm">
                Free, confidential mental health support for the UK Armed Forces community.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-secondary">Quick Links</h4>
              <ul className="space-y-2 text-secondary/80 text-sm">
                <li><a href="https://app.radiocheck.me" className="hover:text-white transition">Open App</a></li>
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#team" className="hover:text-white transition">AI Team</a></li>
                <li><a href="#founders" className="hover:text-white transition">Founders</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-secondary">Portals</h4>
              <ul className="space-y-2 text-secondary/80 text-sm">
                <li><a href="https://app.radiocheck.me" className="hover:text-white transition">Main App</a></li>
                <li><a href="https://training.radiocheck.me" className="hover:text-white transition">Training Portal</a></li>
                <li><a href="https://staff.radiocheck.me" className="hover:text-white transition">Staff Portal</a></li>
                <li><a href="https://admin.radiocheck.me" className="hover:text-white transition">Admin Portal</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-secondary">Crisis Support</h4>
              <ul className="space-y-2 text-secondary/80 text-sm">
                <li>Emergency: <span className="text-white">999</span></li>
                <li>Samaritans: <span className="text-white">116 123</span></li>
                <li>Combat Stress: <span className="text-white">0800 138 1619</span></li>
                <li>Veterans Gateway: <span className="text-white">0808 802 1212</span></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-secondary/60 text-sm">
              &copy; {new Date().getFullYear()} Radio Check. All rights reserved.
            </p>
            <div className="flex gap-6 text-secondary/80 text-sm">
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
