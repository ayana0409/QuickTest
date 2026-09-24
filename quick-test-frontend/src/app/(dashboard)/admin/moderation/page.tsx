'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  FileText,
  HelpCircle,
  Hash,
  Layers,
  Sparkles,
} from 'lucide-react';
import { adminService } from '@/services/admin.service';
import type {
  AdminModerationQuestion,
  AdminModerationStats,
  ModerationFilterParams,
} from '@/types/admin';
import type { QuestionType } from '@/types/exam';

interface LightboxState {
  isOpen: boolean;
  imageUrl: string;
  title: string;
}

interface DeleteModalState {
  isOpen: boolean;
  question: AdminModerationQuestion | null;
  isDeleting: boolean;
}

export default function AdminContentModerationPage() {
  // Moderation questions state
  const [questions, setQuestions] = useState<AdminModerationQuestion[]>([]);
  const [stats, setStats] = useState<AdminModerationStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalElements, setTotalElements] = useState<number>(0);
  const pageSize = 8;

  // Filter state
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [filterWithImagesOnly, setFilterWithImagesOnly] = useState<boolean>(false);
  const [filterSafetyStatus, setFilterSafetyStatus] = useState<'ALL' | 'UNSAFE' | 'SAFE'>('ALL');
  const [filterQuestionType, setFilterQuestionType] = useState<QuestionType | 'ALL'>('ALL');

  // Debounce search input for high performance fulltext querying
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
      setCurrentPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Interactive Modals state
  const [lightbox, setLightbox] = useState<LightboxState>({
    isOpen: false,
    imageUrl: '',
    title: '',
  });

  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    question: null,
    isDeleting: false,
  });

  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Load KPI Stats
  const loadStats = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const data = await adminService.getModerationStats();
      setStats(data);
    } catch {
      // Handled by global axios interceptor
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  // Load Questions Feed
  const loadQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: ModerationFilterParams = {
        page: currentPage,
        size: pageSize,
      };

      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      if (filterWithImagesOnly) {
        params.hasImage = true;
      }

      if (filterSafetyStatus === 'UNSAFE') {
        params.isSafe = false;
      } else if (filterSafetyStatus === 'SAFE') {
        params.isSafe = true;
      }

      if (filterQuestionType !== 'ALL') {
        params.questionType = filterQuestionType;
      }

      const res = await adminService.getModerationQuestions(params);
      setQuestions(res.content || []);
      setTotalPages(res.totalPages || 1);
      setTotalElements(res.totalElements || 0);
    } catch {
      // Handled by global axios interceptor
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, filterWithImagesOnly, filterSafetyStatus, filterQuestionType]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  // Handle Search Input Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDebouncedSearch(searchKeyword);
    setCurrentPage(0);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchKeyword('');
    setDebouncedSearch('');
    setFilterWithImagesOnly(false);
    setFilterSafetyStatus('ALL');
    setFilterQuestionType('ALL');
    setCurrentPage(0);
  };

  // Toggle Safety Flag
  const handleToggleSafety = async (question: AdminModerationQuestion) => {
    const nextSafeStatus = !question.isSafe;
    try {
      setTogglingId(question.id);
      const updated = await adminService.updateQuestionSafety(question.id, nextSafeStatus);
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? updated : q))
      );
      loadStats();
    } catch {
      // Error toast is automatically handled by apiClient interceptor
    } finally {
      setTogglingId(null);
    }
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (question: AdminModerationQuestion) => {
    setDeleteModal({
      isOpen: true,
      question,
      isDeleting: false,
    });
  };

  // Confirm Delete Question
  const handleConfirmDelete = async () => {
    if (!deleteModal.question) return;
    try {
      setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
      await adminService.deleteModerationQuestion(deleteModal.question.id);
      setDeleteModal({ isOpen: false, question: null, isDeleting: false });
      loadQuestions();
      loadStats();
    } catch {
      // Error toast is automatically handled by apiClient interceptor
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  // Open Lightbox
  const handleOpenLightbox = (imageUrl: string, title: string) => {
    setLightbox({
      isOpen: true,
      imageUrl,
      title,
    });
  };

  const getQuestionTypeBadge = (type: QuestionType) => {
    switch (type) {
      case 'SINGLE_CHOICE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/50">
            <CheckCircle2 className="w-3.5 h-3.5" /> Single Choice
          </span>
        );
      case 'MULTIPLE_CHOICE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/50">
            <Layers className="w-3.5 h-3.5" /> Multiple Choice
          </span>
        );
      case 'NUMERIC':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900/50">
            <Hash className="w-3.5 h-3.5" /> Numeric
          </span>
        );
      case 'ESSAY_TEXT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
            <FileText className="w-3.5 h-3.5" /> Essay
          </span>
        );
      default:
        return null;
    }
  };

  const getModalQuestionTypeBadge = (type?: QuestionType) => {
    switch (type) {
      case 'SINGLE_CHOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-100 text-indigo-950 dark:bg-indigo-950/80 dark:text-indigo-100 border-2 border-indigo-400 dark:border-indigo-400 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" /> Single Choice
          </span>
        );
      case 'MULTIPLE_CHOICE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-100 text-purple-950 dark:bg-purple-950/80 dark:text-purple-100 border-2 border-purple-400 dark:border-purple-400 shadow-sm">
            <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-300" /> Multiple Choice
          </span>
        );
      case 'NUMERIC':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-cyan-100 text-cyan-950 dark:bg-cyan-950/80 dark:text-cyan-100 border-2 border-cyan-400 dark:border-cyan-400 shadow-sm">
            <Hash className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-300" /> Numeric
          </span>
        );
      case 'ESSAY_TEXT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-950 dark:bg-amber-950/80 dark:text-amber-100 border-2 border-amber-400 dark:border-amber-400 shadow-sm">
            <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" /> Essay
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border-2 border-zinc-400 dark:border-zinc-500 shadow-sm">
            Question
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header & Eyebrow */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 mb-2">
            <ShieldAlert className="w-3.5 h-3.5" /> Content Moderation
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Question & Answer Governance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review all exam learning materials, inspect images, verify content safety, and remove violations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              loadQuestions();
              loadStats();
            }}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-accent/50 text-foreground transition-all duration-200 disabled:opacity-60 shadow-sm"
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Bento Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Questions */}
        <div className="p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 ring-1 ring-border/50">
          <div className="p-4 sm:p-5 rounded-[calc(1rem-0.125rem)] bg-card border border-border/40 shadow-sm flex flex-col justify-between h-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Questions
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-foreground">
                {isStatsLoading ? '...' : (stats?.totalQuestions ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Across all exams</p>
            </div>
          </div>
        </div>

        {/* Questions with Images */}
        <div
          onClick={() => {
            setFilterWithImagesOnly((prev) => !prev);
            setCurrentPage(0);
          }}
          className="p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 ring-1 ring-border/50 cursor-pointer group"
        >
          <div
            className={`p-4 sm:p-5 rounded-[calc(1rem-0.125rem)] bg-card border transition-all duration-200 shadow-sm flex flex-col justify-between h-full ${
              filterWithImagesOnly
                ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/30 dark:bg-blue-950/20'
                : 'border-border/40 group-hover:border-blue-300 dark:group-hover:border-blue-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                With Images
                {filterWithImagesOnly && (
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                )}
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ImageIcon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {isStatsLoading ? '...' : (stats?.questionsWithImages ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filterWithImagesOnly ? 'Click to show all' : 'Click to filter'}
              </p>
            </div>
          </div>
        </div>

        {/* Needs Review / Unsafe */}
        <div
          onClick={() => {
            setFilterSafetyStatus((prev) => (prev === 'UNSAFE' ? 'ALL' : 'UNSAFE'));
            setCurrentPage(0);
          }}
          className="p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 ring-1 ring-border/50 cursor-pointer group"
        >
          <div
            className={`p-4 sm:p-5 rounded-[calc(1rem-0.125rem)] bg-card border transition-all duration-200 shadow-sm flex flex-col justify-between h-full ${
              filterSafetyStatus === 'UNSAFE'
                ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30 dark:bg-amber-950/20'
                : 'border-border/40 group-hover:border-amber-300 dark:group-hover:border-amber-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                Needs Review
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {isStatsLoading ? '...' : (stats?.unreviewedQuestions ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filterSafetyStatus === 'UNSAFE' ? 'Click to show all' : 'Awaiting admin review'}
              </p>
            </div>
          </div>
        </div>

        {/* Verified Safe */}
        <div
          onClick={() => {
            setFilterSafetyStatus((prev) => (prev === 'SAFE' ? 'ALL' : 'SAFE'));
            setCurrentPage(0);
          }}
          className="p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 ring-1 ring-border/50 cursor-pointer group"
        >
          <div
            className={`p-4 sm:p-5 rounded-[calc(1rem-0.125rem)] bg-card border transition-all duration-200 shadow-sm flex flex-col justify-between h-full ${
              filterSafetyStatus === 'SAFE'
                ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/20'
                : 'border-border/40 group-hover:border-emerald-300 dark:group-hover:border-emerald-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Verified Safe
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {isStatsLoading ? '...' : (stats?.safeQuestions ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filterSafetyStatus === 'SAFE' ? 'Click to show all' : 'Passed safety checks'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filter Toolbar */}
      <div className="p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 ring-1 ring-border/50">
        <div className="p-4 rounded-[calc(1rem-0.125rem)] bg-card border border-border/40 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input with Fulltext Search Indicators */}
            <form onSubmit={handleSearchSubmit} className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Search exam title, access code (e.g. VF4TKH), question content, or answer options..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-input bg-background/50 focus:bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200"
              />
              {searchKeyword && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchKeyword('');
                    setDebouncedSearch('');
                    setCurrentPage(0);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>

            {/* Quick Toggle: Has Image Button */}
            <button
              type="button"
              onClick={() => {
                setFilterWithImagesOnly((prev) => !prev);
                setCurrentPage(0);
              }}
              className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                filterWithImagesOnly
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-background/50 border-input text-foreground hover:bg-accent/50'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>With Images Only</span>
              {filterWithImagesOnly && (
                <span className="w-2 h-2 rounded-full bg-white ml-0.5" />
              )}
            </button>
          </div>

          {/* Secondary Filter Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40">
            {/* Safety Status Segmented Control */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/60 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setFilterSafetyStatus('ALL');
                  setCurrentPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterSafetyStatus === 'ALL'
                    ? 'bg-card text-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterSafetyStatus('UNSAFE');
                  setCurrentPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  filterSafetyStatus === 'UNSAFE'
                    ? 'bg-amber-500 text-white font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Needs Review
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterSafetyStatus('SAFE');
                  setCurrentPage(0);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  filterSafetyStatus === 'SAFE'
                    ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Safe
              </button>
            </div>

            {/* Question Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                Type:
              </span>
              <select
                value={filterQuestionType}
                onChange={(e) => {
                  setFilterQuestionType(e.target.value as any);
                  setCurrentPage(0);
                }}
                className="px-3 py-1.5 rounded-xl border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="ALL">All Question Types</option>
                <option value="SINGLE_CHOICE">Single Choice</option>
                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                <option value="NUMERIC">Numeric</option>
                <option value="ESSAY_TEXT">Essay</option>
              </select>

              {/* Reset Button */}
              {(searchKeyword || filterWithImagesOnly || filterSafetyStatus !== 'ALL' || filterQuestionType !== 'ALL') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1 underline"
                >
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Question Cards Feed */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 rounded-2xl border border-border/50 bg-card animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-5 w-32 bg-muted rounded-full" />
                <div className="h-5 w-24 bg-muted rounded-full" />
              </div>
              <div className="h-6 w-3/4 bg-muted rounded" />
              <div className="h-24 w-full bg-muted/50 rounded-xl" />
            </div>
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 ring-1 ring-border/50">
          <div className="p-12 text-center rounded-[calc(1rem-0.125rem)] bg-card border border-border/40">
            <div className="w-14 h-14 mx-auto rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-foreground">No questions found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              No questions matched your current search filters or review criteria.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {questions.map((question) => {
            const isProcessing = togglingId === question.id;
            return (
              <div
                key={question.id}
                className="p-1.5 rounded-2xl bg-black/5 dark:bg-white/5 ring-1 ring-border/50 transition-all duration-300 hover:ring-border hover:shadow-lg"
              >
                <div className="p-5 sm:p-6 rounded-[calc(1rem-0.125rem)] bg-card border border-border/40 flex flex-col justify-between gap-5">
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {getQuestionTypeBadge(question.questionType)}

                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                        {question.points} {question.points === 1 ? 'pt' : 'pts'}
                      </span>

                      {/* Safety Flag Badge */}
                      {question.isSafe ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verified Safe
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Needs Review
                        </span>
                      )}

                      {/* Submissions Badge */}
                      {question.attemptsCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                          {question.attemptsCount} student submissions
                        </span>
                      )}
                    </div>

                    {/* Exam and Teacher Metadata */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {question.exam && (
                        <span className="font-medium bg-muted/50 px-2.5 py-1 rounded-lg border border-border/40">
                          Exam:{' '}
                          <span className="text-foreground font-semibold">
                            {question.exam.title}
                          </span>{' '}
                          ({question.exam.accessCode})
                        </span>
                      )}
                      {question.teacher && (
                        <span className="font-medium bg-muted/50 px-2.5 py-1 rounded-lg border border-border/40">
                          Teacher:{' '}
                          <span className="text-foreground font-semibold">
                            {question.teacher.fullName}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Question Content */}
                  <div className="space-y-4">
                    {question.content ? (
                      <div className="text-base text-foreground font-medium leading-relaxed break-words whitespace-pre-line">
                        {question.content}
                      </div>
                    ) : (
                      <div className="text-sm italic text-muted-foreground">
                        (No text content - question uses image prompt)
                      </div>
                    )}

                    {/* Question Image Attachment */}
                    {question.imageUrl && (
                      <div className="inline-block">
                        <div
                          onClick={() =>
                            handleOpenLightbox(question.imageUrl!, 'Question Image Attachment')
                          }
                          className="group relative cursor-pointer overflow-hidden rounded-xl border border-border/60 bg-muted/30 p-1.5 max-w-sm hover:border-primary/50 transition-all shadow-sm"
                        >
                          <div className="relative h-44 sm:h-52 w-full max-w-xs rounded-lg overflow-hidden bg-black/5 dark:bg-white/5">
                            <Image
                              src={question.imageUrl}
                              alt="Question attachment"
                              fill
                              sizes="(max-width: 640px) 100vw, 320px"
                              className="object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/90 text-black shadow-lg">
                                <Maximize2 className="w-3.5 h-3.5" /> Enlarge Image
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Answer Options & Rubric Display */}
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      Answer Configuration
                    </div>

                    {/* Choice Types (SINGLE_CHOICE / MULTIPLE_CHOICE) */}
                    {(question.questionType === 'SINGLE_CHOICE' ||
                      question.questionType === 'MULTIPLE_CHOICE') && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {question.options?.map((option, idx) => {
                          const optionLabel = String.fromCharCode(65 + idx);
                          const isCorrect = option.isCorrect;
                          return (
                            <div
                              key={option.id || idx}
                              className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                                isCorrect
                                  ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-200'
                                  : 'bg-card border-border/60 text-foreground'
                              }`}
                            >
                              <span
                                className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {optionLabel}
                              </span>

                              <div className="flex-1 min-w-0 space-y-2">
                                <div className="text-sm font-medium break-words leading-tight">
                                  {option.content || (
                                    <span className="italic text-muted-foreground">
                                      (Image-only option)
                                    </span>
                                  )}
                                </div>

                                {/* Option Image */}
                                {option.imageUrl && (
                                  <div
                                    onClick={() =>
                                      handleOpenLightbox(
                                        option.imageUrl!,
                                        `Option ${optionLabel} Image`
                                      )
                                    }
                                    className="group/opt relative cursor-pointer overflow-hidden rounded-lg border border-border/50 bg-black/5 dark:bg-white/5 inline-block"
                                  >
                                    <div className="relative h-20 w-28 rounded overflow-hidden">
                                      <Image
                                        src={option.imageUrl}
                                        alt={`Option ${optionLabel} attachment`}
                                        fill
                                        sizes="112px"
                                        className="object-contain group-hover/opt:scale-105 transition-transform"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/opt:opacity-100 flex items-center justify-center transition-opacity">
                                        <Maximize2 className="w-3.5 h-3.5 text-white" />
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {isCorrect && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Numeric Type */}
                    {question.questionType === 'NUMERIC' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-card border border-border/60">
                          <span className="text-xs text-muted-foreground font-semibold uppercase">
                            Sample Target Answer:
                          </span>
                          <div className="text-base font-bold text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                            {question.sampleAnswer || 'N/A'}
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-card border border-border/60">
                          <span className="text-xs text-muted-foreground font-semibold uppercase">
                            Tolerance Margin (±):
                          </span>
                          <div className="text-base font-bold text-foreground font-mono mt-0.5">
                            {question.numericTolerance ?? 0.0}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Essay Type */}
                    {question.questionType === 'ESSAY_TEXT' && (
                      <div className="space-y-2">
                        {question.gradingRubric && (
                          <div className="p-3 rounded-lg bg-card border border-border/60">
                            <span className="text-xs text-muted-foreground font-semibold uppercase">
                              Grading Rubric / Context Prompt:
                            </span>
                            <div className="text-xs text-foreground mt-1 whitespace-pre-line leading-relaxed">
                              {question.gradingRubric}
                            </div>
                          </div>
                        )}
                        {question.sampleAnswer && (
                          <div className="p-3 rounded-lg bg-card border border-border/60">
                            <span className="text-xs text-muted-foreground font-semibold uppercase">
                              Sample Reference Answer:
                            </span>
                            <div className="text-xs text-foreground mt-1 whitespace-pre-line leading-relaxed">
                              {question.sampleAnswer}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-border/40">
                    <div className="text-xs text-muted-foreground">
                      {question.isSafe && question.reviewedByName ? (
                        <span>
                          Verified safe by{' '}
                          <strong className="text-foreground">{question.reviewedByName}</strong>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Unverified or recently edited
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {/* Safety Flag Toggle Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleSafety(question)}
                        disabled={isProcessing}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shadow-sm disabled:opacity-60 ${
                          question.isSafe
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        {isProcessing ? (
                          <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        ) : question.isSafe ? (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        <span>{question.isSafe ? 'Revoke Safe Flag' : 'Mark as Safe'}</span>
                      </button>

                      {/* Delete Question Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteModal(question)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 transition-colors"
                        title="Delete question permanently"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border/40">
          <div className="text-xs text-muted-foreground">
            Showing Page{' '}
            <strong className="text-foreground">{currentPage + 1}</strong> of{' '}
            <strong className="text-foreground">{totalPages}</strong> ({totalElements} Total questions)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage >= totalPages - 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-accent disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightbox.isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightbox({ isOpen: false, imageUrl: '', title: '' })}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Lightbox Bar */}
            <div className="w-full flex items-center justify-between text-white pb-3">
              <span className="text-sm font-semibold truncate">{lightbox.title}</span>
              <div className="flex items-center gap-3">
                <a
                  href={lightbox.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Open full image in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setLightbox({ isOpen: false, imageUrl: '', title: '' })}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Preview Box */}
            <div className="relative w-full h-[70vh] rounded-2xl overflow-hidden bg-black/60 border border-white/10 flex items-center justify-center">
              <Image
                src={lightbox.imageUrl}
                alt={lightbox.title}
                fill
                sizes="(max-width: 1024px) 100vw, 900px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Redesigned Ultra High-Contrast Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.question && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => {
            if (!deleteModal.isDeleting) {
              setDeleteModal({ isOpen: false, question: null, isDeleting: false });
            }
          }}
        >
          <div
            className="w-full max-w-xl rounded-3xl bg-white dark:bg-[#13151c] text-zinc-900 dark:text-zinc-50 border-2 border-zinc-300 dark:border-zinc-700 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Danger Warning Accent */}
            <div className="p-6 pb-4 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4 bg-zinc-50/80 dark:bg-zinc-900/60">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-sm">
                  <Trash2 className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                    Delete Question Permanently
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 font-medium mt-0.5">
                    This destructive action cannot be undone.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, question: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
                className="p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200/60 dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Question Snapshot Preview Card */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-[#1a1d26] border-2 border-zinc-300 dark:border-zinc-700 space-y-3.5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Question Type Badge with High Contrast */}
                  {getModalQuestionTypeBadge(deleteModal.question.questionType)}

                  {/* Exam Access Code Badge */}
                  {deleteModal.question.exam?.accessCode && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-lg text-xs font-mono font-bold bg-zinc-200/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-2 border-zinc-400 dark:border-zinc-500 shadow-sm">
                      <Hash className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                      {deleteModal.question.exam.accessCode}
                    </span>
                  )}

                  {/* Points Badge */}
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-200/70 dark:bg-zinc-800/80 border-2 border-zinc-300 dark:border-zinc-600 shadow-sm">
                    {deleteModal.question.points} pts
                  </span>
                </div>

                {/* Exam Title with distinct pill container */}
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-2">
                  <FileText className="w-4 h-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
                  <span className="shrink-0">Exam:</span>
                  <span className="text-zinc-900 dark:text-white font-bold text-sm bg-zinc-200/70 dark:bg-zinc-800 px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-600 truncate">
                    {deleteModal.question.exam?.title || 'Unknown Exam'}
                  </span>
                </div>

                {/* Question Content Snippet in a Crisp Highlight Box */}
                <div className="flex gap-3 items-start pt-1">
                  <div className="flex-1 p-3.5 rounded-xl bg-white dark:bg-[#0f1117] border-2 border-zinc-300 dark:border-zinc-600 shadow-inner">
                    <p className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-white line-clamp-3 leading-relaxed">
                      {deleteModal.question.content || (
                        <span className="italic text-zinc-500 dark:text-zinc-400">
                          (No text content - question uses image attachment)
                        </span>
                      )}
                    </p>
                  </div>
                  {deleteModal.question.imageUrl && (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-white dark:border-zinc-500 shrink-0 bg-zinc-800 shadow-md">
                      <Image
                        src={deleteModal.question.imageUrl}
                        alt="Question media preview"
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>
                  )}
                </div>

                {/* Options count & Teacher metadata */}
                <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 pt-2 border-t border-zinc-200 dark:border-zinc-700/80 flex items-center justify-between">
                  <span>
                    {deleteModal.question.options ? deleteModal.question.options.length : 0} answer options attached
                  </span>
                  {deleteModal.question.teacher && (
                    <span className="text-zinc-700 dark:text-zinc-200">
                      Teacher: <strong className="text-zinc-900 dark:text-white font-bold">{deleteModal.question.teacher.fullName || deleteModal.question.teacher.username}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Warning Notice about student submissions - ULTRA HIGH CONTRAST */}
              {deleteModal.question.attemptsCount > 0 ? (
                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-[#2b1016] border-2 border-rose-500 dark:border-rose-400 shadow-sm flex items-start gap-3.5">
                  <div className="p-1 rounded-lg bg-rose-600 text-white shrink-0 mt-0.5 shadow-sm">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="text-xs sm:text-sm leading-relaxed">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-black text-rose-950 dark:text-white text-sm">CRITICAL WARNING:</span>
                      <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-xs shadow-sm border border-white/40">
                        {deleteModal.question.attemptsCount} student submission(s) exist
                      </span>
                    </div>
                    <p className="mt-1.5 font-semibold text-rose-900 dark:text-rose-100">
                      Deleting this question will cascade clean related candidate answers to prevent foreign key errors and recalculate student scores.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-[#261d0f] border-2 border-amber-500 dark:border-amber-400 text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-100 flex items-center gap-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    Question content and Cloudinary images will be permanently purged immediately.
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            <div className="p-4 sm:p-5 px-6 bg-zinc-50/80 dark:bg-zinc-900/60 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, question: null, isDeleting: false })}
                disabled={deleteModal.isDeleting}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-white border-2 border-zinc-300 dark:border-zinc-600 shadow-sm transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteModal.isDeleting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white border-2 border-rose-500 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-60"
              >
                {deleteModal.isDeleting ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Deleting Question...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Question Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
