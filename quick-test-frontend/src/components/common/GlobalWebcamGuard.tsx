'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { stopAllAppWebcams } from '@/lib/webcamManager';

/**
 * Route-aware guard that ensures no webcam hardware tracks remain active
 * whenever the user is NOT actively taking an exam.
 * Automatically halts all camera activity when navigating to homepage (/),
 * result page (/exam/[id]/result), student dashboard, etc.
 */
export const GlobalWebcamGuard = () => {
  const pathname = usePathname();

  useEffect(() => {
    // Active exam runner URL format: /exam/{attemptId} (without /result)
    const isInsideActiveExamRunner =
      Boolean(pathname) &&
      pathname.startsWith('/exam/') &&
      !pathname.endsWith('/result') &&
      !pathname.includes('/result/');

    if (!isInsideActiveExamRunner) {
      stopAllAppWebcams();
    }
  }, [pathname]);

  return null;
};

