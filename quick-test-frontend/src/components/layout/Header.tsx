'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Home,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}


export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();

  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setIsUserDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    setIsUserDropdownOpen(false);
    logout();
    toast.success('Đã đăng xuất');
    router.push('/login');
  };

  // Derive dynamic page title from pathname
  const getPageTitle = (): string => {
    if (pathname.endsWith('/profile')) return 'Thông tin cá nhân';
    if (pathname.includes('/proctoring')) return 'Phòng thi & Kết quả';
    if (pathname.startsWith('/admin')) return 'Admin Workspace';
    if (pathname.startsWith('/teacher/exams')) return 'Exam Management';
    if (pathname.startsWith('/teacher/grading')) return 'Essay Grading';
    if (pathname.startsWith('/teacher/ai-tasks')) return 'Tiến trình Tác vụ AI';
    if (pathname.startsWith('/teacher')) return 'Teacher Hub';
    if (pathname.startsWith('/student/history')) return 'Submission History';
    if (pathname.startsWith('/student/results')) return 'Certificates & Results';
    if (pathname.startsWith('/student')) return 'Student Portal';
    return 'Dashboard';
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
      {/* Left section: Hamburger button & page header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Open sidebar menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
            {getPageTitle()}
          </span>
        </div>
      </div>

      {/* Right section: User profile menu */}
      <div className="flex items-center gap-2 sm:gap-4">

        {/* User Account Dropdown */}
        <div className="relative" ref={userDropdownRef}>
          <button
            type="button"
            onClick={() => setIsUserDropdownOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 sm:px-2 sm:py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="hidden md:block text-xs font-semibold text-zinc-800 dark:text-zinc-200 max-w-[120px] truncate">
              {user?.fullName || 'User'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 hidden sm:block" />
          </button>

          {isUserDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in-50 zoom-in-95">
              {/* Profile summary */}
              <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {user?.fullName || 'Signed In User'}
                </p>
                <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                  {user?.email || 'user@quicktest.com'}
                </p>
              </div>

              {/* Navigation Options */}
              <div className="p-1.5 space-y-0.5">
                <Link
                  href="/profile"
                  onClick={() => setIsUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-zinc-400" />
                  <span>Thông tin cá nhân</span>
                </Link>

                <Link
                  href="/"
                  onClick={() => setIsUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Home className="w-4 h-4 text-zinc-400" />
                  <span>Landing Page</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
