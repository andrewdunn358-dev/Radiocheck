'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { 
  MessageCircle, Phone, Dumbbell, Heart, BookOpen, Users,
  Shield, Clock, UserCheck, ChevronDown, ExternalLink,
  Menu, X, Sparkles
} from 'lucide-react';

// AI Team Data - from the actual app's ai-characters.ts
const aiTeam = [
  {
    name: 'Tommy',
    role: 'Your Battle Buddy',
    description: 'Tommy is your straightforward battle buddy. A no-nonsense mate who tells it like it is, but always has your back.',
    avatar: '/images/tommy.png',
    color: '#f59e0b'
  },
  {
    name: 'Bob',
    role: 'Peer Support Buddy',
    description: 'A friendly ear when you need to talk. Bob understands military life and is here to listen without judgment.',
    avatar: '/images/bob.png',
    color: '#3b82f6'
  },
  {
    name: 'Frankie',
    role: 'Physical Training Instructor',
    description: 'Your PTI - a former British Army Physical Training Instructor. He brings proper military fitness discipline with motivating banter.',
    avatar: '/images/frankie.png',
    color: '#22c55e'
  },
  {
    name: 'Rachel',
    role: 'Criminal Justice Support',
    description: 'Rachel provides warm, non-judgemental support for veterans in or leaving the criminal justice system.',
    avatar: '/images/rachel.png',
    color: '#14b8a6'
  },
  {
    name: 'Rita',
    role: 'Family Support Specialist',
    description: 'Supporting the partners, spouses, parents and loved ones of veterans. Rita understands that families serve too.',
    avatar: '/images/rita.png',
    color: '#f472b6'
  },
  {
    name: 'Jack',
    role: 'Compensation Schemes Expert',
    description: 'Jack is ex-Royal Navy — 20 years at sea. He helps with compensation claims, AFCS, War Pensions, and hearing loss.',
    avatar: '/images/jack.png',
    color: '#1e40af'
  },
  {
    name: 'Margie',
    role: 'Addiction Support Specialist',
    description: 'Supporting veterans dealing with addiction - alcohol, drugs, gambling, and other compulsive behaviours. Margie understands without judgement.',
    avatar: '/images/margie.png',
    color: '#ec4899'
  },
  {
    name: 'Catherine',
    role: 'Calm & Intelligent Support',
    description: 'Catherine is composed, articulate, and grounded. She helps you think clearly when emotions run high.',
    avatar: '/images/catherine.png',
    color: '#8b5cf6'
  },
  {
    name: 'Finch',
    role: 'Military Law & Legal Support',
    description: 'Expert in UK military law, the Armed Forces Act, and service discipline. Finch helps veterans understand their legal rights.',
    avatar: '/images/finch.png',
    color: '#6366f1'
  },
  {
    name: 'Baz',
    role: 'Support Services & Transition',
    description: 'Baz is an ex-Rifles infantry soldier who helps veterans navigate support services, housing, and the transition out of military life.',
    avatar: '/images/baz.png',
    color: '#78716c'
  },
  {
    name: 'Megan',
    role: 'Women Veterans Specialist',
    description: 'Megan is ex-RAF MERT — a Chinook medic who flew nearly 200 missions. She specialises in supporting women veterans.',
    avatar: '/images/megan.png',
    color: '#a855f7'
  },
  {
    name: 'Penny',
    role: 'Benefits & Money Specialist',
    description: 'Penny is ex-Royal Navy, 15 years as a Writer. She knows the benefits system inside out — UC, PIP, Council Tax, debt advice.',
    avatar: '/images/penny.png',
    color: '#22c55e'
  },
  {
    name: 'Alex',
    role: 'LGBTQ+ Veterans Specialist',
    description: 'Alex is non-binary, former RAF, who served under the ban. They understand the unique journey of LGBTQ+ veterans.',
    avatar: '/images/alex.png',
    color: '#ec4899'
  },
  {
    name: 'Sam',
    role: 'Forces Kids Specialist',
    description: 'Sam was an Army wife for 15 years with three children. She understands school moves, deployments, and forces kids.',
    avatar: '/images/sam.png',
    color: '#f97316'
  },
  {
    name: 'Kofi',
    role: 'Commonwealth Veterans Specialist',
    description: 'Kofi served 16 years in the Royal Logistics Corps. Originally from Ghana, he helps Commonwealth veterans claim their rights.',
    avatar: '/images/kofi.png',
    color: '#14b8a6'
  },
  {
    name: 'James',
    role: 'Faith & Spiritual Support',
    description: 'James was an Army Chaplain for 20 years, serving alongside soldiers of every faith. He provides spiritual care without preaching.',
    avatar: '/images/james.png',
    color: '#8b5cf6'
  }
];

// Founders Data - from the actual app
const founders = [
  {
    name: 'Andrew "Frankie" Dunn',
    role: 'Founder',
    description: 'Andrew served 27 years in the British Army before creating Frankie\'s Pod: Uncorking the Unforgettable. Through podcasting and projects like Radio Check, he works to build communities where veterans can connect and support each other.',
    image: 'https://customer-assets.emergentagent.com/job_e4b45c7f-469e-4d50-8310-96df1bd9d53a/artifacts/4zwz619g_image.png',
  },
  {
    name: 'Rachel Webster',
    role: 'Founder',
    description: 'Rachel is a veteran of the British Army, having served for 24 years across operational and leadership roles. Since leaving the Army, she has remained committed to supporting the veteran community through advocacy initiatives.',
    image: 'https://customer-assets.emergentagent.com/job_e4b45c7f-469e-4d50-8310-96df1bd9d53a/artifacts/kec981d4_Rachel.avif',
  },
  {
    name: 'Anthony Donnelly',
    role: 'Founder',
    description: 'Anthony is the founder of Zentrafuge (Labs) Limited, an AI safety and research initiative. He focuses on AI safety architecture and building systems that earn trust. Zentrafuge\'s safety modules are integrated into Radio Check.',
    image: 'https://customer-assets.emergentagent.com/job_e4b45c7f-469e-4d50-8310-96df1bd9d53a/artifacts/jz9ku914_image.png',
  }
];

const features = [
  {
    icon: MessageCircle,
    title: 'AI Battle Buddies',
    description: '16 AI companions with unique personalities, available 24/7 for a chat whenever you need it.',
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
  { value: '16', label: 'AI Battle Buddies' },
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
                src="/images/logo.png"
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
              16 unique AI Battle Buddies, each with their own personality and expertise. Available 24/7, they understand military culture and speak your language.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiTeam.map((member, index) => (
              <div 
                key={index}
                className="bg-card rounded-2xl p-5 border border-border hover:border-secondary/50 transition group"
              >
                <div 
                  className="w-20 h-20 rounded-full overflow-hidden mb-4 group-hover:scale-105 transition-transform mx-auto ring-2 ring-offset-2 ring-offset-card"
                  style={{ borderColor: member.color, boxShadow: `0 0 0 2px ${member.color}` }}
                >
                  <img 
                    src={member.avatar} 
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-1">{member.name}</h3>
                  <p className="text-xs mb-2" style={{ color: member.color }}>{member.role}</p>
                  <p className="text-secondary/80 text-xs">{member.description}</p>
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
                <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden group-hover:scale-105 transition-transform">
                  <img 
                    src={founder.image} 
                    alt={founder.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-2xl font-semibold mb-1">{founder.name}</h3>
                <p className="text-secondary font-medium mb-4">{founder.role}</p>
                <p className="text-secondary/80 text-sm">{founder.description}</p>
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
          <div className="flex flex-wrap justify-center items-center gap-8">
            <a href="https://www.youtube.com/@FrankiesPod" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition">
              <img src="/images/frankies-pod.png" alt="Frankie's Pod" className="h-16 w-auto" />
            </a>
            <a href="https://www.standingtall.co.uk/" target="_blank" rel="noopener noreferrer" className="opacity-70 hover:opacity-100 transition">
              <img src="/images/standing-tall.png" alt="Standing Tall Foundation" className="h-16 w-auto" />
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
                  src="/images/logo.png"
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
