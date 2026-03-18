'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLearnerAuth } from '@/hooks/useLearnerAuth';
import { lmsApi, CertificateResponse } from '@/lib/api';
import { ArrowLeft, Award, Download, Share2, CheckCircle } from 'lucide-react';

export default function CertificatePage() {
  const router = useRouter();
  const { learner, progress, refreshProgress } = useLearnerAuth();
  const [certificate, setCertificate] = useState<CertificateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!learner) {
      router.push('/learning');
      return;
    }
    if (learner.certificate_issued && learner.certificate_id) {
      setCertificate({
        success: true,
        certificate_id: learner.certificate_id,
        learner_name: learner.full_name,
        issued_date: new Date().toISOString(),
      });
    }
  }, [learner]);

  const handleGenerateCertificate = async () => {
    if (!learner) return;
    setLoading(true);
    setError('');
    
    try {
      const result = await lmsApi.generateCertificate(learner.email);
      setCertificate(result);
      await refreshProgress();
    } catch (err: any) {
      setError(err.message || 'Failed to generate certificate');
    } finally {
      setLoading(false);
    }
  };

  if (!learner || !progress) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-secondary"></div>
      </div>
    );
  }

  const canGetCertificate = progress.can_get_certificate;

  return (
    <div className="min-h-screen bg-primary-dark">
      {/* Header */}
      <header className="bg-primary border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/learning" className="flex items-center gap-2 text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Certificate Display */}
        {certificate ? (
          <div className="text-center">
            <div className="mb-8">
              <Award className="w-20 h-20 text-secondary mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-2">Congratulations!</h1>
              <p className="text-gray-400">You have successfully completed the Radio Check Peer Support Training</p>
            </div>

            {/* Certificate Preview */}
            <div className="bg-gradient-to-br from-secondary/20 via-card to-primary-light/20 border-4 border-secondary rounded-xl p-12 mb-8 max-w-2xl mx-auto">
              <div className="border-2 border-secondary/50 rounded-lg p-8">
                <img 
                  src="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png"
                  alt="Radio Check"
                  className="w-16 h-16 mx-auto mb-4"
                />
                <p className="text-secondary uppercase tracking-widest text-sm mb-4">Certificate of Completion</p>
                <h2 className="text-2xl font-bold mb-2">Peer Support Training</h2>
                <p className="text-gray-400 mb-6">This certifies that</p>
                <p className="text-3xl font-bold text-secondary mb-6">{certificate.learner_name}</p>
                <p className="text-gray-400 mb-2">has successfully completed the</p>
                <p className="font-semibold mb-6">Radio Check Mental Health First Aid for Veterans Course</p>
                <div className="flex justify-center gap-8 text-sm text-gray-400">
                  <div>
                    <p className="font-semibold text-white">Certificate ID</p>
                    <p>{certificate.certificate_id}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-white">Date Issued</p>
                    <p>{new Date(certificate.issued_date).toLocaleDateString('en-GB', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-4">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light"
              >
                <Download className="w-5 h-5" />
                Download / Print
              </button>
              <button
                onClick={() => {
                  navigator.share?.({
                    title: 'Radio Check Certificate',
                    text: `I completed the Radio Check Peer Support Training!`,
                    url: window.location.href,
                  });
                }}
                className="flex items-center gap-2 px-6 py-3 border border-secondary text-secondary rounded-lg hover:bg-secondary/10"
              >
                <Share2 className="w-5 h-5" />
                Share
              </button>
            </div>
          </div>
        ) : canGetCertificate ? (
          <div className="text-center">
            <Award className="w-20 h-20 text-secondary mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Claim Your Certificate</h1>
            <p className="text-gray-400 mb-8">
              You've completed all modules! Click below to generate your official certificate.
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400 max-w-md mx-auto">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerateCertificate}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-4 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light disabled:opacity-50 mx-auto"
            >
              {loading ? (
                <>Generating...</>
              ) : (
                <>
                  <Award className="w-5 h-5" />
                  Generate Certificate
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="text-center">
            <Award className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Certificate Not Yet Available</h1>
            <p className="text-gray-400 mb-8">
              Complete all modules to earn your Radio Check Peer Support Certificate.
            </p>

            <div className="bg-card border border-border rounded-xl p-6 max-w-md mx-auto mb-8">
              <h3 className="font-semibold mb-4">Your Progress</h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 h-3 bg-border rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-secondary rounded-full transition-all"
                    style={{ width: `${progress.progress_percent}%` }}
                  />
                </div>
                <span className="font-bold">{progress.progress_percent}%</span>
              </div>
              <p className="text-sm text-gray-400">
                {progress.completed_modules} of {progress.total_modules} modules completed
              </p>
            </div>

            <Link
              href="/learning"
              className="inline-flex items-center gap-2 px-6 py-3 bg-secondary text-primary-dark font-semibold rounded-lg hover:bg-secondary-light"
            >
              Continue Learning
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
