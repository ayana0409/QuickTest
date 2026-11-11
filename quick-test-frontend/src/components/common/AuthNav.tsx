'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { UserCircle, LogOut, ArrowUpRight } from 'lucide-react';

export function AuthNav() {
  const { isAuthenticated, user, activeRole, logout } = useAuthStore();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="flex items-center gap-2 sm:gap-2.5">
        <Button href="/login" prefetch={false} variant="ghost" size="sm" className="rounded-xl text-xs sm:text-sm h-9 px-3">
          Đăng nhập
        </Button>
        <Button href="/register" prefetch={false} variant="primary" size="sm" className="rounded-xl text-xs sm:text-sm h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs">
          Đăng ký
        </Button>
      </div>
    );
  }

  if (isAuthenticated && user) {
    const getWorkspaceHref = (): string => {
      const currentRole = activeRole || (user.roles?.[0] ? user.roles[0].replace(/^ROLE_/, '') : 'STUDENT');
      if (currentRole === 'ADMIN') return '/admin';
      if (currentRole === 'TEACHER') return '/teacher';
      return '/student';
    };

    return (
      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60">
          <UserCircle className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 max-w-[140px] truncate">
            {user.fullName || user.username}
          </span>
        </div>

        <Button
          href={getWorkspaceHref()}
          prefetch={false}
          variant="primary"
          size="sm"
          rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
          className="rounded-xl text-xs font-semibold h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
        >
          <span className="hidden sm:inline">Vào </span>Workspace
        </Button>

        <button
          type="button"
          onClick={logout}
          title="Đăng xuất"
          className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <Button href="/login" prefetch={false} variant="ghost" size="sm" className="rounded-xl text-xs sm:text-sm h-9 px-3">
        Đăng nhập
      </Button>
      <Button href="/register" prefetch={false} variant="primary" size="sm" className="rounded-xl text-xs sm:text-sm h-9 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs">
        Đăng ký
      </Button>
    </div>
  );
}
