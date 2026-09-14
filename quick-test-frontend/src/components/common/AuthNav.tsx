'use client';

import Link from 'next/link';
import { Button } from '@/components/common/Button';
import { useAuthStore } from '@/stores/authStore';
import { UserCircle, LogOut } from 'lucide-react';

export function AuthNav() {
  const { isAuthenticated, user, logout } = useAuthStore();

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-zinc-500" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {user.fullName || user.username}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
          <LogOut className="w-4 h-4 mr-1.5" />
          Đăng xuất
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href="/login">
        <Button variant="ghost" size="sm">
          Đăng nhập
        </Button>
      </Link>
      <Link href="/register">
        <Button variant="primary" size="sm">
          Đăng ký ngay
        </Button>
      </Link>
    </div>
  );
}
