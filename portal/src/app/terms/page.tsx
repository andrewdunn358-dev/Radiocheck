import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <img 
                src="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png"
                alt="Radio Check"
                className="w-10 h-10"
              />
              <span className="font-bold text-xl">Radio Check</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-invert prose-gray max-w-none">
            <p className="text-gray-400 mb-6">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Welcome to Radio Check</h2>
              <p className="text-gray-300 mb-4">
                By using Radio Check, you agree to these Terms of Service. Please read them carefully. If you don&apos;t agree with these terms, please don&apos;t use our service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">What Radio Check Is</h2>
              <p className="text-gray-300 mb-4">Radio Check is:</p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>A peer support platform for UK Armed Forces personnel, veterans, and their families</li>
                <li>A safe space to talk with AI companions and human supporters</li>
                <li>A resource hub for finding UK veteran charities and support services</li>
                <li>A collection of self-care tools including journaling and breathing exercises</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">What Radio Check Is NOT</h2>
              <p className="text-gray-300 mb-4 font-semibold text-yellow-400">Important: Please understand these limitations:</p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li><strong>NOT a replacement for professional help</strong> — We do not provide medical, psychiatric, or therapeutic treatment</li>
                <li><strong>NOT a crisis intervention service</strong> — In emergencies, always call 999</li>
                <li><strong>NOT a diagnostic tool</strong> — Our AI companions cannot diagnose conditions</li>
                <li><strong>NOT a substitute for the NHS</strong> — We encourage professional medical care alongside peer support</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">AI Companions</h2>
              <p className="text-gray-300 mb-4">
                Our AI &quot;Battle Buddies&quot; are conversational companions designed to provide supportive conversation. They are:
              </p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>Available 24/7 for a chat</li>
                <li>Designed with input from veterans and mental health professionals</li>
                <li>Trained to recognise when you might need human support</li>
              </ul>
              <p className="text-gray-300 mb-4 font-semibold">
                However, AI companions are NOT therapists. They use natural language processing to provide supportive conversation, but they cannot replace professional mental health care.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">User Responsibilities</h2>
              <p className="text-gray-300 mb-4">By using Radio Check, you agree to:</p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>Use the service for its intended purpose of peer support</li>
                <li>Not attempt to harm, abuse, or exploit other users or the service</li>
                <li>Not use the service for illegal activities</li>
                <li>Seek professional help if you&apos;re experiencing a mental health crisis</li>
                <li>Call 999 in an emergency</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Safeguarding</h2>
              <p className="text-gray-300 mb-4">
                Radio Check includes safeguarding measures to help identify when someone may be at risk. Our AI companions and human supporters are trained to:
              </p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>Recognise crisis language</li>
                <li>Provide immediate crisis helpline information</li>
                <li>Alert our safeguarding team when appropriate</li>
                <li>Never leave someone alone if they express thoughts of self-harm</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Limitation of Liability</h2>
              <p className="text-gray-300 mb-4">
                Radio Check is provided &quot;as is&quot; without warranties of any kind. We do our best to provide helpful support, but:
              </p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>We cannot guarantee the service will be available at all times</li>
                <li>AI responses may not always be appropriate or helpful</li>
                <li>We are not liable for decisions you make based on conversations with our service</li>
                <li>This service does not create a doctor-patient or therapist-client relationship</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Crisis Resources</h2>
              <p className="text-gray-300 mb-4">If you&apos;re in crisis, please contact:</p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li><strong>Emergency:</strong> 999</li>
                <li><strong>Samaritans:</strong> 116 123 (free, 24/7)</li>
                <li><strong>Combat Stress Helpline:</strong> 0800 138 1619</li>
                <li><strong>Veterans&apos; Gateway:</strong> 0808 802 1212</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Changes to Terms</h2>
              <p className="text-gray-300 mb-4">
                We may update these terms from time to time. Continued use of Radio Check after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
              <p className="text-gray-300 mb-4">
                If you have any questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-green-400">
                <a href="mailto:hello@radiocheck.me" className="hover:underline">hello@radiocheck.me</a>
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 px-4">
        <div className="max-w-3xl mx-auto text-center text-gray-500 text-sm">
          <p>&copy; {new Date().getFullYear()} Radio Check. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
