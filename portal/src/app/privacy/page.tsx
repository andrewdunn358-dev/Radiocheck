import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPolicy() {
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

          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          
          <div className="prose prose-invert prose-gray max-w-none">
            <p className="text-gray-400 mb-6">Last updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Our Commitment to Privacy</h2>
              <p className="text-gray-300 mb-4">
                Radio Check is designed with privacy at its core. We understand that seeking mental health support requires trust, and we take that responsibility seriously. This policy explains what information we collect, how we use it, and your rights.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
              
              <h3 className="text-xl font-medium mb-3 text-green-400">What We DON&apos;T Collect</h3>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>Your real name (unless you choose to share it)</li>
                <li>Your service number or military ID</li>
                <li>Your location (unless you opt in for local services)</li>
                <li>Any information that could identify you to your chain of command</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 text-green-400">What We May Collect</h3>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>Anonymous usage data to improve our services</li>
                <li>Conversation logs with AI companions (stored locally on your device by default)</li>
                <li>Voluntary feedback you choose to provide</li>
                <li>Technical information needed to deliver the service (device type, browser)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">How We Use Information</h2>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>To provide and improve our mental health support services</li>
                <li>To connect you with human counsellors when requested</li>
                <li>To respond to safeguarding concerns (see Safeguarding section)</li>
                <li>To maintain and improve the platform</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Safeguarding</h2>
              <p className="text-gray-300 mb-4">
                Radio Check has a duty of care to our users. If our AI companions or human supporters identify an immediate risk to life, we may need to take action. This could include:
              </p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>Providing crisis helpline information</li>
                <li>Alerting our safeguarding team</li>
                <li>In extreme circumstances, contacting emergency services</li>
              </ul>
              <p className="text-gray-300">
                We will always try to work with you and will only break confidentiality when there is an immediate risk to life.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Data Storage and Security</h2>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>Conversation data is encrypted in transit and at rest</li>
                <li>We use industry-standard security measures</li>
                <li>Data is stored on secure UK/EU servers</li>
                <li>We regularly review and update our security practices</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
              <p className="text-gray-300 mb-4">Under UK GDPR, you have the right to:</p>
              <ul className="list-disc list-inside text-gray-300 mb-4 space-y-2">
                <li>Access any personal data we hold about you</li>
                <li>Request deletion of your data</li>
                <li>Object to processing of your data</li>
                <li>Data portability</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
              <p className="text-gray-300 mb-4">
                If you have any questions about this Privacy Policy or how we handle your data, please contact us at:
              </p>
              <p className="text-green-400">
                <a href="mailto:privacy@radiocheck.me" className="hover:underline">privacy@radiocheck.me</a>
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
