import Link from 'next/link';
import { GraduationCap, Users, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-dark via-primary to-primary-dark flex items-center justify-center p-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="mb-8">
          <img 
            src="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png"
            alt="Radio Check"
            className="w-24 h-24 mx-auto mb-4"
          />
          <h1 className="text-4xl font-bold mb-2">Radio Check Portal</h1>
          <p className="text-gray-400">Training & Administration Platform</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <Link 
            href="/learning"
            className="bg-card border border-border rounded-xl p-8 hover:border-secondary/50 transition-all group"
          >
            <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <GraduationCap className="w-8 h-8 text-secondary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Peer to Peer Training</h2>
            <p className="text-gray-400 text-sm">
              Access your training modules, quizzes, and certificates
            </p>
          </Link>

          <Link 
            href="/staff"
            className="bg-card border border-border rounded-xl p-8 hover:border-secondary/50 transition-all group"
          >
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Staff Portal</h2>
            <p className="text-gray-400 text-sm">
              Counsellors & peer supporters dashboard
            </p>
          </Link>

          <Link 
            href="/lms-admin"
            className="bg-card border border-border rounded-xl p-8 hover:border-secondary/50 transition-all group"
          >
            <div className="w-16 h-16 bg-primary-light/30 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Shield className="w-8 h-8 text-secondary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">LMS Administration</h2>
            <p className="text-gray-400 text-sm">
              Manage learners, registrations, and course content
            </p>
          </Link>
        </div>

        <p className="mt-12 text-sm text-gray-500">
          Need help? Contact{' '}
          <a href="mailto:training@radiocheck.me" className="text-secondary hover:underline">
            training@radiocheck.me
          </a>
        </p>
      </div>
    </div>
  );
}
