'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Client provider to initialize and synchronize authentication state across Cookie,
 * LocalStorage, and Zustand store upon application mount.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initializeAuth } = useAuthStore();

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return <>{children}</>;
}
