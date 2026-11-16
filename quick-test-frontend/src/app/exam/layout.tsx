import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Phòng làm bài Trực tuyến | Quick Test',
  description: 'Giao diện phòng làm bài trực tuyến an toàn và tập trung cao độ.',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

/**
 * Distraction-Free Layout for all /exam/* routes.
 * Completely isolates candidate from standard dashboard navigation,
 * setting a full-screen dark aesthetic focused on testing integrity.
 */
export default function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#0D1117] text-[#E6EDF3] antialiased selection:bg-indigo-600/30 selection:text-indigo-200">
      {children}
    </div>
  );
}
