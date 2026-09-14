'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Menu,
  Shield,
  BookOpen,
  GraduationCap,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Home,
  Check,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
}

interface RoleConfig {
  key: string;
  name: string;
  homePath: string;
  icon: React.ElementType;
  badgeClass: string;
}

const roleConfigs: Record<string, RoleConfig> = {
  ADMIN: {
    key: 'ADMIN',
    name: 'Administrator',
    homePath: '/admin',
    icon: Shield,
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
  },
  TEACHER: {
    key: 'TEACHER',
    name: 'Teacher',
    homePath: '/teacher/exams',
    icon: BookOpen,
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50',
  },
  STUDENT: {
    key: 'STUDENT',
    name: 'Student',
    homePath: '/student',
    icon: GraduationCap,
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
  },
};

export function Header({ onOpenMobileSidebar }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, activeRole, setActiveRole, getUserRoles, logout } = useAuthStore();

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const userRoles = getUserRoles();
  const currentRole = (activeRole || 'STUDENT').toUpperCase();
  const currentRoleConfig = roleConfigs[currentRole] || roleConfigs.STUDENT;
  const CurrentRoleIcon = currentRoleConfig.icon;

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target as Node)
      ) {
        setIsRoleDropdownOpen(false);
      }
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

  const handleRoleSwitch = (newRoleKey: string) => {
    if (newRoleKey === currentRole) {
      setIsRoleDropdownOpen(false);
      return;
    }

    setActiveRole(newRoleKey);
    setIsRoleDropdownOpen(false);

    const targetConfig = roleConfigs[newRoleKey];
    toast.success(`Switched role to ${targetConfig?.name || newRoleKey}`);

    if (targetConfig?.homePath) {
      router.push(targetConfig.homePath);
    }
  };

  const handleLogout = () => {
    setIsUserDropdownOpen(false);
    logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  // Derive dynamic page title from pathname
  const getPageTitle = (): string => {
    if (pathname.startsWith('/admin')) return 'Admin Workspace';
    if (pathname.startsWith('/teacher/exams')) return 'Exam Management';
    if (pathname.startsWith('/teacher/grading')) return 'Essay Grading';
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

      {/* Right section: Role switcher & User profile menu */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Role Switcher (Enabled when user holds multiple roles) */}
        {userRoles.length > 1 ? (
          <div className="relative" ref={roleDropdownRef}>
            <button
              type="button"
              onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 ${currentRoleConfig.badgeClass} hover:opacity-90 shadow-xs`}
            >
              <CurrentRoleIcon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Role: {currentRoleConfig.name}</span>
              <span className="sm:hidden">{currentRoleConfig.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
            </button>

            {isRoleDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl py-2 z-50 animate-in fade-in-50 zoom-in-95">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Switch Active Role
                </div>

                <div className="space-y-0.5 px-1.5">
                  {userRoles.map((roleKey) => {
                    const normalized = roleKey.toUpperCase();
                    const config = roleConfigs[normalized] || {
                      key: normalized,
                      name: normalized,
                      homePath: '/student',
                      icon: Sparkles,
                      badgeClass: 'text-zinc-600',
                    };
                    const ItemIcon = config.icon;
                    const isSelected = normalized === currentRole;

                    return (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => handleRoleSwitch(normalized)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold'
                            : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <ItemIcon className="w-4 h-4" />
                          <span>{config.name}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Single role badge */
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${currentRoleConfig.badgeClass}`}
          >
            <CurrentRoleIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{currentRoleConfig.name}</span>
          </div>
        )}

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
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${currentRoleConfig.badgeClass}`}
                  >
                    <CurrentRoleIcon className="w-3 h-3" />
                    {currentRoleConfig.name}
                  </span>
                </div>
              </div>

              {/* Navigation Options */}
              <div className="p-1.5 space-y-0.5">
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
