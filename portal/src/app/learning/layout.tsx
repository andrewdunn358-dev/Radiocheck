'use client';

import { LearnerAuthProvider } from '@/hooks/useLearnerAuth';
import TutorChatWidget from '@/components/learning/TutorChatWidget';

export default function LearningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LearnerAuthProvider>
      {children}
      <TutorChatWidget />
    </LearnerAuthProvider>
  );
}
