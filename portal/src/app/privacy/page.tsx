import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-primary-dark text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-primary-dark/95 backdrop-blur-md border-b border-border">
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
          <Link href="/" className="inline-flex items-center gap-2 text-secondary hover:text-white transition mb-8">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-secondary mb-6">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-secondary">Our Commitment to Privacy</h2>
              <p className="text-white/80 mb-4">
                Radio Check is designed with privacy at its core. We understand that seeking mental health support requires trust, and we take that responsibility seriously. This policy explains what information we collect, how we use it, and your rights.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-secondary">Information We Collect</h2>
              
              <h3 className="text-xl font-medium mb-3 text-emerald-400">What We DON&apos;T Collect</h3>
              <ul className="list-disc list-inside text-white/80 mb-4 space-y-2">
                <li>Your real name (unless you choose to share it)</li>
                <li>Your service number or military ID</li>
                <li>Your location (unless you opt in for local services)</li>
                <li>Any information that could identify you to your chain of command</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 text-emerald-400">What We May Collect</h3>
              <ul className="list-disc list-inside text-white/80 mb-4 space-y-2">
                <li>Anonymous usage data to improve our services</li>
                <li>Conversation logs with AI companions (stored locally on your device by default)</li>
                <li>Voluntary feedback you choose to provide</li>
                <li>Technical information needed to deliver the service (device type, browser)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-secondary">How We Use Information</h2>
              <ul className="list-disc list-inside text-white/80 mb-4 space-y-2">
                <li>To provide and improve our mental health support services</li>
                <li>To connect you with human counsellors when requested</li>
                <li>To respond to safeguarding concerns (see Safeguarding section)</li>
                <li>To maintain and improve the platform</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-secondary">Safeguarding</h2>
              <p className="text-white/80 mb-4">
                Radio Check has a duty of care to our users. If our AI companions or human supporters identify an immediate risk to life, we may need to take action. This could include:
              </p>
              <ul className="list-disc list-inside text-white/80 mb-4 space-y-2">
                <li>Providing crisis helpline information</li>
                <li>Alerting our safeguarding team</li>
                <li>In extreme circumstances, contacting emergency services</li>
              </ul>
              <p className="text-white/80">
                We will always try to work with you and will only break confidentiality when there is an immediate risk to life.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-secondary">Data Storage and Security</h2>
              <ul className="list-disc list-inside text-white/80 mb-4 space-y-2">
                <li>Conversation data is encrypted in transit and at rest</li>
                <li>We use industry-standard security measures</li>
                <li>Data is stored on secure UK/EU servers</li>
                <li>We regularly review and update our security practices</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-secondary">Your Rights</h2>
              <p className="text-white/80 mb-4">Under UK GDPR, you have the right to:</p>
              <ul className="list-disc list-inside text-white/80 mb-4 space-y-2">
                <li>Access any personal data we hold about you</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Data portability</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-secondary">Contact Us</h2>
              <p className="text-white/80 mb-4">
                If you have any questions about this Privacy Policy or how we handle your data, please contact us at:
              </p>
              <p className="text-secondary">
                <a href="mailto:privacy@radiocheck.me" className="hover:underline">privacy@radiocheck.me</a>
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-card/30">
        <div className="max-w-3xl mx-auto text-center text-secondary/60 text-sm">
          <p>&copy; {new Date().getFullYear()} Radio Check. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
