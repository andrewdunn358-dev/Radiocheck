import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blue Light Support',
  description: 'Confidential support for serving and retired police officers.',
};

export default function PoliceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
