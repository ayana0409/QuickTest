'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, user, initializeAuth, isInitialized, isLoggedIn } = useAuthStore();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
    initializeAuth();
  }, [initializeAuth]);

  // Close mobile sidebar whenever route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Prevent flash of unauthenticated content only after auth initialization
  useEffect(() => {
    if (hasMounted && isInitialized) {
      if (!isAuthenticated && !isLoggedIn()) {
        const currentPath = window.location.pathname + window.location.search;
        if (!currentPath.startsWith('/login')) {
          window.location.replace(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
        }
      }
    }
  }, [hasMounted, isInitialized, isAuthenticated, isLoggedIn]);

  // Enforce role-based route boundaries
  useEffect(() => {
    if (hasMounted && isInitialized && (isAuthenticated || isLoggedIn()) && user) {
      const rawRoles =
        Array.isArray(user.roles) && user.roles.length > 0
          ? user.roles
          : user.role
            ? [user.role]
            : [];
      const normalizedRoles = rawRoles.map((r) => r.replace(/^ROLE_/, '').toUpperCase());
      const isAdmin = normalizedRoles.includes('ADMIN');
      const isTeacher = normalizedRoles.includes('TEACHER');

      // Restrict /admin strictly to ADMIN
      if (pathname.startsWith('/admin') && !isAdmin) {
        const target = isTeacher ? '/teacher/exams' : '/student';
        window.location.replace(target);
        return;
      }

      // Restrict /teacher (except shared profile) to TEACHER and ADMIN
      if (pathname.startsWith('/teacher') && !pathname.startsWith('/teacher/profile') && !isAdmin && !isTeacher) {
        window.location.replace('/student');
        return;
      }
    }
  }, [hasMounted, isInitialized, isAuthenticated, isLoggedIn, user, pathname]);

  if (!hasMounted || !isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold animate-pulse shadow-md shadow-indigo-600/30">
            Q
          </div>
          <p className="text-xs text-zinc-500 font-medium animate-pulse">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col lg:flex-row">
      {/* Dynamic Role-Aware Sidebar */}
      <Sidebar
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Responsive Header */}
        <Header onOpenMobileSidebar={() => setIsMobileOpen(true)} />

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
