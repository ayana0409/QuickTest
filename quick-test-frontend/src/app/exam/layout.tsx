import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Phòng thi Trực tuyến | Quick Test Proctoring',
  description: 'Giao diện phòng thi trực tuyến an toàn và tập trung cao độ.',
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
    <div className="min-h-screen w-full bg-[#0D1117] text-[#E6EDF3] antialiased selection:bg-indigo-600/30 selection:text-indigo-200">
      {children}
    </div>
  );
}
