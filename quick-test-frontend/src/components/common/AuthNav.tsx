'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { UserCircle, LogOut } from 'lucide-react';

export function AuthNav() {
  const { isAuthenticated, user, activeRole, logout } = useAuthStore();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return (
      <div className="flex items-center gap-3">
        <Button href="/login" variant="ghost" size="sm">
          Đăng nhập
        </Button>
        <Button href="/register" variant="primary" size="sm">
          Đăng ký ngay
        </Button>
      </div>
    );
  }

  if (isAuthenticated && user) {
    const getWorkspaceHref = (): string => {
      const currentRole = activeRole || (user.roles?.[0] ? user.roles[0].replace(/^ROLE_/, '') : 'STUDENT');
      if (currentRole === 'ADMIN') return '/admin';
      if (currentRole === 'TEACHER') return '/teacher/exams';
      return '/student';
    };

    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {user.fullName || user.username}
          </span>
        </div>
        <Button href={getWorkspaceHref()} variant="outline" size="sm">
          Vào Workspace
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          Đăng xuất
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Button href="/login" variant="ghost" size="sm">
        Đăng nhập
      </Button>
      <Button href="/register" variant="primary" size="sm">
        Đăng ký ngay
      </Button>
    </div>
  );
}
