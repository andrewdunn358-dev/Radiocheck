import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Blue Light Support',
  description: 'Confidential support for serving and retired police officers.',
  manifest: '/police/manifest.webmanifest',
  applicationName: 'Blue Light Support',
  appleWebApp: {
    capable: true,
    title: 'Blue Light',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    icon: [
      { url: '/police/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/police/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/police/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#0057B8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function PoliceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
