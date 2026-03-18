import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Radio Check Portal',
  description: 'Peer to Peer Training & LMS Management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="https://customer-assets.emergentagent.com/job_535ca64e-70e1-4fc8-813d-3b487fc07905/artifacts/14k1x3vl_logo.png" />
      </head>
      <body className="min-h-screen bg-primary-dark text-white">
        {children}
      </body>
    </html>
  );
}
