'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, ArrowRight, UserCheck, BookOpen, ChevronRight } from 'lucide-react';

/**
 * Interactive Hero Quick Join Bar:
 * Enables candidates to enter an exam Access Code directly on the landing hero
 * for zero-friction redirection to the exam lobby, alongside quick role portals.
 */
export function HeroQuickJoin() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim().toUpperCase();
    if (cleanCode) {
      router.push(`/exam?code=${encodeURIComponent(cleanCode)}`);
    } else {
      router.push('/exam');
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4 sm:space-y-5">
      {/* Primary Interactive Access Code Bar */}
      <form
        onSubmit={handleJoin}
        className="p-1.5 sm:p-2 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 shadow-lg shadow-indigo-500/5 flex items-center gap-2 transition-all focus-within:border-indigo-500/60 focus-within:ring-4 focus-within:ring-indigo-500/10"
      >
        <div className="relative flex-1 min-w-0">
          <KeyRound className="w-4 h-4 text-indigo-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
            placeholder="Nhập mã phòng thi (VD: JAVA26)..."
            aria-label="Mã phòng thi"
            className="w-full pl-10 pr-2 py-2 sm:py-2.5 rounded-xl bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 placeholder:font-normal placeholder:tracking-normal text-xs sm:text-sm font-bold font-mono tracking-wider uppercase focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="group inline-flex items-center gap-2 pl-3.5 sm:pl-4 pr-1.5 sm:pr-2 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all cursor-pointer shrink-0"
        >
          <span>Vào phòng thi</span>
          <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>
      </form>

      {/* Secondary Role Portals */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs">
        <span className="text-zinc-400 dark:text-zinc-500 font-medium hidden sm:inline">
          Hoặc truy cập theo vai trò:
        </span>

        <Link
          href="/student"
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold shadow-2xs transition-all"
        >
          <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
          <span>Dành cho Thí sinh</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <Link
          href="/teacher"
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-indigo-500/40 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold shadow-2xs transition-all"
        >
          <BookOpen className="w-3.5 h-3.5 text-purple-500" />
          <span>Dành cho Giảng viên</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
