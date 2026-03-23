import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Radio Check - Mental Health Support for UK Armed Forces',
  description: 'Free, confidential 24/7 mental health and peer support for UK veterans, serving personnel, and their families.',
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
      <body>
        {children}
      </body>
    </html>
  );
}
