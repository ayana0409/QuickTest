'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Shield,
  BookOpen,
  FileCheck,
  BarChart3,
  GraduationCap,
  Clock,
  Award,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  User as UserIcon,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const roleNavItems: Record<string, NavItem[]> = {
  ADMIN: [
    { label: 'System Overview', href: '/admin', icon: LayoutDashboard },
    { label: 'User Management', href: '/admin/users', icon: Users },
    { label: 'Content Moderation', href: '/admin/moderation', icon: ShieldAlert },
    { label: 'Exam Monitoring', href: '/admin/exams', icon: Shield },
    { label: 'System Logs', href: '/admin/logs', icon: FileCheck },
    { label: 'System Health', href: '/admin/health', icon: Activity },
    { label: 'System Settings', href: '/admin/settings', icon: Settings },
  ],
  TEACHER: [
    { label: 'Exam Management', href: '/teacher/exams', icon: BookOpen },
    { label: 'Essay Grading', href: '/teacher/grading', icon: FileCheck },
    { label: 'Thông tin cá nhân', href: '/teacher/profile', icon: UserIcon },
  ],
  STUDENT: [
    { label: 'My Exams', href: '/student', icon: GraduationCap },
    { label: 'Attempt History', href: '/student/history', icon: Clock },
    { label: 'Results & Certificates', href: '/student/results', icon: Award },
  ],
};

const roleMetadata: Record<
  string,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  ADMIN: {
    label: 'Admin Portal',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50',
    icon: Shield,
  },
  TEACHER: {
    label: 'Teacher Hub',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900/50',
    icon: BookOpen,
  },
  STUDENT: {
    label: 'Student Portal',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50',
    icon: GraduationCap,
  },
};

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  isMobileOpen,
  onMobileClose,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, activeRole, logout } = useAuthStore();

  const currentRole = (activeRole || 'STUDENT').toUpperCase();
  const navItems = roleNavItems[currentRole] || roleNavItems.STUDENT;
  const currentRoleMeta = roleMetadata[currentRole] || roleMetadata.STUDENT;
  const RoleIcon = currentRoleMeta.icon;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const NavContent = () => (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm shadow-indigo-600/30 shrink-0">
            Q
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100">
                Quick<span className="text-indigo-600">Test</span>
              </span>
              <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                Online Assessment
              </span>
            </div>
          )}
        </Link>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Role Badge Indicator */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${currentRoleMeta.badgeClass}`}
          >
            <RoleIcon className="w-3.5 h-3.5" />
            <span>{currentRoleMeta.label}</span>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' &&
              item.href !== '/student' &&
              pathname.startsWith(item.href));

          const ItemIcon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20 font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
            >
              <ItemIcon
                className={`w-5 h-5 shrink-0 ${
                  isActive ? 'text-white' : 'text-zinc-500 dark:text-zinc-400'
                }`}
              />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>

      {/* User Info & Actions at Bottom */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        {!isCollapsed ? (
          <div className="space-y-2">
            <Link
              href="/teacher/profile"
              onClick={onMobileClose}
              className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer group"
              title="Xem thông tin cá nhân"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {user?.fullName || 'User Account'}
                </p>
                <p className="text-[11px] text-zinc-500 truncate">
                  {user?.email || 'user@quicktest.com'}
                </p>
              </div>
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
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <Link
              href="/teacher/profile"
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs hover:scale-105 transition-transform shadow-xs"
              title={user?.fullName || 'Xem thông tin cá nhân'}
            >
              {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Desktop Collapse Toggle */}
        <div className="hidden lg:block pt-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium">
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse menu</span>
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile Offcanvas Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shadow-2xl lg:hidden transform transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <NavContent />
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 h-screen transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <NavContent />
      </aside>
    </>
  );
}
