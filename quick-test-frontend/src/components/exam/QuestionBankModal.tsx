'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  BookOpen,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  ListChecks,
  Hash,
  FileText,
  CheckCircle2,
  ImageIcon,
  ArrowDownToLine,
  Loader2,
  X,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Modal } from '@/components/common/Modal';
import { examService } from '@/services/exam.service';
import type { QuestionBankItem, QuestionType } from '@/types/question';
import toast from 'react-hot-toast';

interface QuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  onImportSuccess: () => void;
}

const QUESTION_TYPE_CONFIG: Record<
  QuestionType,
  { label: string; icon: React.ReactNode; badgeVariant: 'primary' | 'success' | 'warning' | 'purple' }
> = {
  SINGLE_CHOICE: {
    label: 'Trắc nghiệm 1 đáp án',
    icon: <ListChecks className="w-3.5 h-3.5 text-indigo-500" />,
    badgeVariant: 'primary',
  },
  MULTIPLE_CHOICE: {
    label: 'Nhiều đáp án',
    icon: <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />,
    badgeVariant: 'success',
  },
  NUMERIC: {
    label: 'Điền số',
    icon: <Hash className="w-3.5 h-3.5 text-amber-500" />,
    badgeVariant: 'warning',
  },
  ESSAY_TEXT: {
    label: 'Tự luận',
    icon: <FileText className="w-3.5 h-3.5 text-purple-500" />,
    badgeVariant: 'purple',
  },
};

export const QuestionBankModal: React.FC<QuestionBankModalProps> = ({
  isOpen,
  onClose,
  examId,
  onImportSuccess,
}) => {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedType, setSelectedType] = useState<QuestionType | 'ALL'>('ALL');

  // Selected question IDs for import
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Expanded questions for previewing choices / rubric
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Debounce search term changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(0);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch question bank items
  const fetchBankQuestions = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const response = await examService.getQuestionBank({
        page: currentPage,
        size: pageSize,
        search: debouncedSearch.trim() || undefined,
        excludeExamId: examId,
      });

      setItems(response.content || []);
      setTotalElements(response.totalElements || 0);
      setTotalPages(response.totalPages || 0);
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, currentPage, pageSize, debouncedSearch, examId]);

  useEffect(() => {
    if (isOpen) {
      fetchBankQuestions();
    } else {
      // Reset selections when closed
      setSelectedIds(new Set());
      setSearchTerm('');
      setDebouncedSearch('');
      setSelectedType('ALL');
      setCurrentPage(0);
      setExpandedIds(new Set());
    }
  }, [isOpen, fetchBankQuestions]);

  // Client-side type filter on current page items
  const filteredItems = selectedType === 'ALL'
    ? items
    : items.filter((item) => item.questionType === selectedType);

  // Selection handlers
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isAllPageSelected =
    filteredItems.length > 0 && filteredItems.every((item) => selectedIds.has(item.id));

  const toggleSelectAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) {
        filteredItems.forEach((item) => next.delete(item.id));
      } else {
        filteredItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Perform import
  const handleImport = async () => {
    if (selectedIds.size === 0) return;
    setIsImporting(true);
    try {
      const questionIdsList = Array.from(selectedIds);
      await examService.importQuestionsFromBank(examId, questionIdsList);
      onImportSuccess();
      onClose();
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      className="h-[90vh] max-h-[850px] flex flex-col overflow-hidden"
      bodyClassName="p-0 flex-1 overflow-hidden flex flex-col min-h-0"
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Ngân hàng câu hỏi của bạn
            </span>
          </div>
        </div>
      }
      description="Chọn và sao chép các câu hỏi từ các đề thi khác của bạn vào đề thi hiện tại. Toàn bộ hình ảnh và phương án sẽ được nhân bản độc lập."
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-zinc-500">
            {selectedIds.size > 0 ? (
              <span>
                Đã chọn <strong className="text-indigo-600 dark:text-indigo-400">{selectedIds.size}</strong> câu hỏi
              </span>
            ) : (
              <span>Chưa chọn câu hỏi nào</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isImporting}>
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0 || isImporting}
              isLoading={isImporting}
              onClick={handleImport}
              leftIcon={<ArrowDownToLine className="w-4 h-4" />}
            >
              Nhập {selectedIds.size > 0 ? `${selectedIds.size} câu hỏi` : ''} vào đề thi
            </Button>
          </div>
        </div>
      }
    >
      {/* Fixed Header Controls Strip (Search, Filter, Select-all) */}
      <div className="px-6 pt-4 pb-3 space-y-3 border-b border-zinc-100 dark:border-zinc-800 flex-shrink-0 bg-white dark:bg-zinc-900">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo nội dung câu hỏi hoặc tên đề thi gốc..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-zinc-400 text-zinc-800 dark:text-zinc-200"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter Dropdown */}
          <div className="flex items-center gap-1.5">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as QuestionType | 'ALL')}
              className="px-3 py-2 text-xs sm:text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-zinc-700 dark:text-zinc-300 font-medium"
            >
              <option value="ALL">Tất cả loại câu hỏi</option>
              <option value="SINGLE_CHOICE">Trắc nghiệm 1 đáp án</option>
              <option value="MULTIPLE_CHOICE">Trắc nghiệm nhiều đáp án</option>
              <option value="NUMERIC">Điền số (Numeric)</option>
              <option value="ESSAY_TEXT">Tự luận (Essay)</option>
            </select>
          </div>
        </div>

        {/* Selection summary and Select-All strip */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
          <label className="flex items-center gap-2 cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              checked={isAllPageSelected}
              onChange={toggleSelectAllPage}
              disabled={filteredItems.length === 0}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer"
            />
            <span>
              Chọn tất cả trong trang ({filteredItems.length} câu)
            </span>
          </label>

          <div className="flex items-center gap-3">
            <span>
              Tổng số:{' '}
              <strong className="text-zinc-900 dark:text-zinc-100">{totalElements}</strong> câu hỏi
            </span>
            {selectedIds.size > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-800/60">
                Đã chọn {selectedIds.size}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Question List Content (The SINGLE scrollable area) */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
              <span className="text-xs">Đang tải ngân hàng câu hỏi...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/20">
              <BookOpen className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Không tìm thấy câu hỏi phù hợp
              </p>
              <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc loại câu hỏi.'
                  : 'Bạn chưa có câu hỏi nào từ các đề thi khác trong hệ thống.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = selectedIds.has(item.id);
              const isExpanded = expandedIds.has(item.id);
              const typeConfig = QUESTION_TYPE_CONFIG[item.questionType];

              return (
                <div
                  key={item.id}
                  className={`group relative rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? 'border-indigo-500/80 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'
                  }`}
                >
                  <div className="p-3.5">
                    {/* Top Row: Checkbox, Origin Exam Badge, Type Badge, Points */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(item.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 cursor-pointer flex-shrink-0 mt-0.5"
                        />

                        {/* Origin Exam Metadata */}
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 truncate max-w-[320px]">
                          <BookOpen className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {item.examAccessCode}
                          </span>
                          <span className="text-zinc-400 truncate">- {item.examTitle}</span>
                        </div>

                        {/* Question Type Pill */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 flex-shrink-0">
                          {typeConfig?.icon}
                          <span>{typeConfig?.label}</span>
                        </span>
                      </div>

                      {/* Points badge & Expand Button */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800/40">
                          {item.points} đ
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleExpand(item.id)}
                          className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title={isExpanded ? 'Thu gọn chi tiết' : 'Xem chi tiết câu hỏi'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Question Content */}
                    <div
                      onClick={() => toggleSelectOne(item.id)}
                      className="cursor-pointer select-none pl-6.5 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium"
                    >
                      <p className={isExpanded ? '' : 'line-clamp-2'}>{item.content}</p>
                    </div>

                    {/* Question Image Preview Thumbnail */}
                    {item.imageUrl && (
                      <div className="mt-2.5 pl-6.5">
                        <div className="relative inline-block rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 max-h-36 max-w-xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            alt="Hình ảnh câu hỏi"
                            className="object-cover max-h-36 w-auto"
                          />
                        </div>
                      </div>
                    )}

                    {/* Expanded Detail: Options, Numeric sample, or Essay rubric */}
                    {isExpanded && (
                      <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 pl-6.5 space-y-2">
                        {/* Choice Options */}
                        {(item.questionType === 'SINGLE_CHOICE' ||
                          item.questionType === 'MULTIPLE_CHOICE') &&
                          item.options &&
                          item.options.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                                Các phương án ({item.options.length}):
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {item.options.map((opt, oIdx) => (
                                  <div
                                    key={opt.id || oIdx}
                                    className={`p-2 rounded-lg text-xs flex items-start gap-2 border ${
                                      opt.isCorrect
                                        ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                                        : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                                    }`}
                                  >
                                    <span
                                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                                        opt.isCorrect
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                      }`}
                                    >
                                      {String.fromCharCode(65 + oIdx)}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <p className="leading-snug">{opt.content}</p>
                                      {opt.imageUrl && (
                                        <div className="mt-1">
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={opt.imageUrl}
                                            alt={`Đáp án ${String.fromCharCode(65 + oIdx)}`}
                                            className="h-12 w-auto object-cover rounded border border-zinc-200 dark:border-zinc-700"
                                          />
                                        </div>
                                      )}
                                    </div>
                                    {opt.isCorrect && (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Numeric details */}
                        {item.questionType === 'NUMERIC' && (
                          <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                            <div>
                              <span className="font-semibold">Đáp án số: </span>
                              <code className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 font-mono font-bold">
                                {item.sampleAnswer}
                              </code>
                            </div>
                            {item.numericTolerance !== null && item.numericTolerance !== undefined && (
                              <div>
                                <span className="font-semibold">Sai số cho phép (±): </span>
                                <span>{item.numericTolerance}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Essay Rubric */}
                        {item.questionType === 'ESSAY_TEXT' && item.gradingRubric && (
                          <div className="p-2.5 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-200">
                            <span className="font-semibold block mb-0.5">Barem chấm điểm:</span>
                            <p className="whitespace-pre-line text-zinc-600 dark:text-zinc-300">
                              {item.gradingRubric}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination bar (Fixed bottom above footer) */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-2.5 border-t border-zinc-100 dark:border-zinc-800 text-xs flex-shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
            <span className="text-zinc-500">
              Trang {currentPage + 1} / {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 0 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages - 1 || isLoading}
                onClick={() => setCurrentPage((p) => p + 1)}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Sau
              </Button>
            </div>
          </div>
        )}
    </Modal>
  );
};
