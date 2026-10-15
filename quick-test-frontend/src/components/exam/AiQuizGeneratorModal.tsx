'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronUp,
  FileCode,
  ListChecks,
  CheckSquare,
  Hash,
  Sliders,
  Layers,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldAlert,
  X,
  FileUp,
} from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { aiGenerateService } from '@/services/aiGenerateService';
import type {
  AiGenerateQuizRequest,
  AiGenerateJobResponse,
  AiGeneratedQuestionDto,
} from '@/types/aiGenerate';
import type { QuestionType } from '@/types/question';
import toast from 'react-hot-toast';

interface AiQuizGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  examId: string;
  onImportSuccess: () => void;
}

type WizardStep = 'CONFIG' | 'POLLING' | 'REVIEW';

const QUESTION_TYPE_OPTIONS: { type: QuestionType; label: string; icon: React.ReactNode }[] = [
  { type: 'SINGLE_CHOICE', label: 'Trắc nghiệm 1 đáp án', icon: <ListChecks className="w-4 h-4 text-indigo-500" /> },
  { type: 'MULTIPLE_CHOICE', label: 'Nhiều đáp án', icon: <CheckSquare className="w-4 h-4 text-emerald-500" /> },
  { type: 'NUMERIC', label: 'Điền số (Numeric)', icon: <Hash className="w-4 h-4 text-amber-500" /> },
  { type: 'ESSAY_TEXT', label: 'Tự luận (Essay)', icon: <FileText className="w-4 h-4 text-purple-500" /> },
];

export const AiQuizGeneratorModal: React.FC<AiQuizGeneratorModalProps> = ({
  isOpen,
  onClose,
  examId,
  onImportSuccess,
}) => {
  const router = useRouter();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('CONFIG');
  const [inputTab, setInputTab] = useState<'FILE' | 'TEXT'>('FILE');

  // Input states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [totalQuestions, setTotalQuestions] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<'BALANCED' | 'EASY' | 'MEDIUM' | 'HARD'>('BALANCED');
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [targetTypes, setTargetTypes] = useState<QuestionType[]>([
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'ESSAY_TEXT',
  ]);

  // Polling & Background Job State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobSnapshot, setJobSnapshot] = useState<AiGenerateJobResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  // Review & Selection State
  const [reviewQuestions, setReviewQuestions] = useState<AiGeneratedQuestionDto[]>([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<number>>(new Set());
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState('');

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling timer
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Reset modal when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('CONFIG');
      setSelectedFile(null);
      setRawText('');
      setJobSnapshot(null);
      setActiveJobId(null);
      setIsSubmitting(false);
      setIsCancelling(false);
      setIsCommitting(false);
      setReviewQuestions([]);
      setSelectedQuestionIds(new Set());
      setExpandedIndices(new Set());
      setEditingIndex(null);
      stopPolling();
    }
  }, [isOpen, stopPolling]);

  // Polling loop
  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      setActiveJobId(jobId);
      setCurrentStep('POLLING');

      const poll = async () => {
        try {
          const snapshot = await aiGenerateService.getJobStatus(jobId);
          setJobSnapshot(snapshot);

          if (snapshot.status === 'COMPLETED') {
            stopPolling();
            const questions = snapshot.questions || [];
            setReviewQuestions(questions);
            // Default select all questions
            setSelectedQuestionIds(new Set(questions.map((_, i) => i)));
            setCurrentStep('REVIEW');
            toast.success(`AI đã soạn thành công ${questions.length} câu hỏi!`);
          } else if (snapshot.status === 'FAILED') {
            stopPolling();
            toast.error(snapshot.error || snapshot.message || 'Soạn đề thi thất bại.');
          } else if (snapshot.status === 'CANCELLED') {
            stopPolling();
            toast.error('Tiến trình đã bị hủy.');
            setCurrentStep('CONFIG');
          }
        } catch {
          // Suppress intermittent polling network glitches
        }
      };

      // Immediate first poll, then interval
      poll();
      pollingIntervalRef.current = setInterval(poll, 2000);
    },
    [stopPolling]
  );

  // Toggle question type selection
  const handleToggleType = (type: QuestionType) => {
    setTargetTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) {
          toast.error('Bạn phải chọn ít nhất một loại câu hỏi!');
          return prev;
        }
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  // File drop handler
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const validExts = ['.pdf', '.docx', '.txt', '.md'];
    const lowerName = file.name.toLowerCase();
    const isSupported = validExts.some((ext) => lowerName.endsWith(ext));

    if (!isSupported) {
      toast.error('Định dạng file không được hỗ trợ. Vui lòng tải file PDF (.pdf), Word (.docx) hoặc Văn bản (.txt, .md)!');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('Kích thước file vượt quá 20MB. Vui lòng chọn file nhỏ hơn!');
      return;
    }

    setSelectedFile(file);
  };

  // Submit start generation
  const handleStartGeneration = async () => {
    if (inputTab === 'FILE' && !selectedFile) {
      toast.error('Vui lòng chọn hoặc kéo thả một file tài liệu!');
      return;
    }

    if (inputTab === 'TEXT' && (!rawText.trim() || rawText.trim().length < 30)) {
      toast.error('Nội dung văn bản quá ngắn (tối thiểu 30 ký tự) để AI có thể phân tích!');
      return;
    }

    setIsSubmitting(true);
    try {
      const requestPayload: AiGenerateQuizRequest = {
        examId,
        totalQuestions,
        difficulty,
        language,
        rawText: inputTab === 'TEXT' ? rawText.trim() : undefined,
        additionalInstructions: additionalInstructions.trim() || undefined,
        targetQuestionTypes: targetTypes,
      };

      const jobResponse = await aiGenerateService.generateFromDocument(
        inputTab === 'FILE' ? selectedFile : null,
        requestPayload
      );

      setJobSnapshot(jobResponse);
      startPolling(jobResponse.jobId);
    } catch {
      // Handled by Axios Interceptor (e.g. 409 Conflict if user already has an active AI task)
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel running job
  const handleCancelJob = async () => {
    if (!activeJobId) return;
    setIsCancelling(true);
    try {
      await aiGenerateService.cancelJob(activeJobId);
      stopPolling();
      setCurrentStep('CONFIG');
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsCancelling(false);
    }
  };

  // Review: Toggle select all questions
  const handleToggleSelectAll = () => {
    if (selectedQuestionIds.size === reviewQuestions.length) {
      setSelectedQuestionIds(new Set());
    } else {
      setSelectedQuestionIds(new Set(reviewQuestions.map((_, i) => i)));
    }
  };

  // Review: Toggle individual question selection
  const handleToggleSelectQuestion = (index: number) => {
    setSelectedQuestionIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Review: Toggle expand details
  const handleToggleExpand = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Review: Delete question from list
  const handleDeleteQuestion = (index: number) => {
    setReviewQuestions((prev) => prev.filter((_, i) => i !== index));
    setSelectedQuestionIds((prev) => {
      const next = new Set<number>();
      prev.forEach((id) => {
        if (id < index) next.add(id);
        else if (id > index) next.add(id - 1);
      });
      return next;
    });
  };

  // Review: Save inline edit
  const handleSaveEdit = (index: number) => {
    if (!editedContent.trim()) {
      toast.error('Nội dung câu hỏi không được để trống!');
      return;
    }
    setReviewQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], content: editedContent.trim() };
      return next;
    });
    setEditingIndex(null);
  };

  // Review: Commit selected questions to Exam
  const handleCommitToExam = async () => {
    const selectedQuestions = reviewQuestions.filter((_, i) => selectedQuestionIds.has(i));
    if (selectedQuestions.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 câu hỏi để thêm vào đề thi!');
      return;
    }

    setIsCommitting(true);
    try {
      await aiGenerateService.commitQuestionsToExam(examId, selectedQuestions);
      onImportSuccess();
      onClose();
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsCommitting(false);
    }
  };

  // Review: Calculate selected points
  const selectedQuestionsList = reviewQuestions.filter((_, i) => selectedQuestionIds.has(i));
  const totalSelectedPoints = selectedQuestionsList.reduce((sum, q) => sum + (q.points || 1.0), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (currentStep === 'POLLING') {
          stopPolling();
          onClose();
          toast.success(
            'Tác vụ AI đang tiếp tục xử lý trong hàng đợi nền! Bạn có thể xem lại tại trang "Tác vụ AI".',
            { duration: 5000, icon: '⚡' }
          );
        } else {
          onClose();
        }
      }}
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              Soạn đề thi thông minh bằng AI
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                Gemini Pro Pool
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">
              Tự động phân tích tài liệu bài giảng (PDF, Word, TXT) và tạo bộ câu hỏi hoàn chỉnh
            </p>
          </div>
        </div>
      }
      size="2xl"
      className="max-h-[92vh] flex flex-col"
      bodyClassName="p-0 overflow-y-auto"
    >
      {/* Step Indicators */}
      <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40 flex items-center justify-between text-xs font-medium">
        <div className="flex items-center gap-2 sm:gap-6">
          <div
            className={`flex items-center gap-2 ${
              currentStep === 'CONFIG'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-zinc-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === 'CONFIG'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              1
            </span>
            <span>Tải tài liệu & Cấu hình</span>
          </div>

          <div className="w-6 h-px bg-zinc-200 dark:bg-zinc-800" />

          <div
            className={`flex items-center gap-2 ${
              currentStep === 'POLLING'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-zinc-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === 'POLLING'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              2
            </span>
            <span>Xử lý & Hàng đợi</span>
          </div>

          <div className="w-6 h-px bg-zinc-200 dark:bg-zinc-800" />

          <div
            className={`flex items-center gap-2 ${
              currentStep === 'REVIEW'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                : 'text-zinc-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === 'REVIEW'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              3
            </span>
            <span>Kiểm duyệt & Thêm vào đề</span>
          </div>
        </div>

        {/* Global queue fairness badge */}
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          <span>Hàng đợi đơn FIFO (1 tác vụ/tài khoản)</span>
        </div>
      </div>

      {/* ================= STEP 1: CONFIGURATION & UPLOAD ================= */}
      {currentStep === 'CONFIG' && (
        <div className="p-6 space-y-6">
          {/* Tab Selection: File vs Text */}
          <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setInputTab('FILE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                inputTab === 'FILE'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              Tải file tài liệu (.PDF, .DOCX, .TXT)
            </button>
            <button
              type="button"
              onClick={() => setInputTab('TEXT')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                inputTab === 'TEXT'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <FileCode className="w-4 h-4" />
              Dán văn bản trực tiếp
            </button>
          </div>

          {/* Input Area */}
          {inputTab === 'FILE' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/20'
                  : selectedFile
                  ? 'border-emerald-500/80 bg-emerald-50/30 dark:bg-emerald-950/20'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-indigo-400 bg-zinc-50/50 dark:bg-zinc-900/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                    <FileText className="w-8 h-8" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Nhấp hoặc thả file khác để thay đổi
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    title="Xóa file"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                    <FileUp className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Kéo thả tài liệu vào đây hoặc <span className="text-indigo-600 dark:text-indigo-400 underline">chọn từ máy tính</span>
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Hỗ trợ định dạng PDF (.pdf), Microsoft Word (.docx), Plain Text (.txt, .md) • Tối đa 20MB
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>Dán văn bản giáo trình, bài giảng hoặc tóm tắt kiến thức:</span>
                <span>{rawText.length} ký tự</span>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Nhập hoặc dán nội dung bài học tại đây (ví dụ: các định nghĩa, quy trình, công thức toán lý hóa, văn bản phân tích...)"
                rows={6}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono text-xs leading-relaxed"
              />
            </div>
          )}

          {/* Generation Parameters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {/* Number of Questions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                  Số lượng câu hỏi muốn sinh:
                </label>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200/60 dark:border-indigo-800">
                  {totalQuestions} câu
                </span>
              </div>
              <input
                type="range"
                min={3}
                max={30}
                step={1}
                value={totalQuestions}
                onChange={(e) => setTotalQuestions(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>3 câu</span>
                <span>10 câu (chuẩn)</span>
                <span>20 câu</span>
                <span>30 câu</span>
              </div>
            </div>

            {/* Difficulty Setting */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Độ khó & Phân hóa:
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="BALANCED">Cân bằng (30% Dễ - 50% Trung bình - 20% Khó)</option>
                <option value="EASY">Cơ bản / Nhận biết (Dễ hiểu cho học sinh yếu - trung bình)</option>
                <option value="MEDIUM">Thông hiểu & Vận dụng (Phù hợp thi giữa kỳ/học kỳ)</option>
                <option value="HARD">Nâng cao / Phân loại học sinh giỏi</option>
              </select>
            </div>
          </div>

          {/* Target Question Types */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              Các dạng câu hỏi AI sẽ biên soạn:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {QUESTION_TYPE_OPTIONS.map((item) => {
                const isSelected = targetTypes.includes(item.type);
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleToggleType(item.type)}
                    className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-zinc-500 hover:border-zinc-300'
                    }`}
                  >
                    <div className="mt-0.5">{item.icon}</div>
                    <div className="text-xs">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{item.label}</p>
                      <span className="text-[10px] text-zinc-400">
                        {isSelected ? 'Đã bật' : 'Bỏ qua'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Language & Extra Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Ngôn ngữ câu hỏi:
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Ghi chú hoặc yêu cầu trọng tâm cho AI (Tùy chọn):
              </label>
              <input
                type="text"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="VD: Tập trung vào các định lý ở chương 2, câu hỏi cần kèm giải thích cặn kẽ..."
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Policy / Rate Limit Notice */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-[11px] leading-relaxed">
              <p className="font-semibold">Quy định xử lý tác vụ AI tại QuickTest:</p>
              <p>
                Để đảm bảo công bằng tài nguyên và tránh quá tải quota Google Gemini, mỗi tài khoản Giáo viên được cấp tối đa <strong>1 tác vụ AI duy nhất</strong> (soạn đề hoặc chấm bài) chạy nền tại một thời điểm. Tác vụ sẽ xếp hàng an toàn và tự động thực hiện tuần tự.
              </p>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-between gap-3 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 hidden sm:inline">
              ⚡ Tác vụ sẽ tự động xếp vào hàng đợi nền an toàn
            </span>
            <div className="flex items-center gap-2.5 ml-auto">
              <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Đóng
              </Button>
            <Button
              size="sm"
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 border-0"
              leftIcon={
                isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )
              }
              disabled={isSubmitting}
              onClick={handleStartGeneration}
            >
              {isSubmitting ? 'Đang gửi tài liệu...' : 'Bắt đầu soạn đề AI'}
            </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 2: POLLING & QUEUE PROGRESS ================= */}
      {currentStep === 'POLLING' && (
        <div className="p-8 text-center space-y-6 max-w-lg mx-auto">
          {jobSnapshot?.status === 'QUEUED' ? (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-inner animate-pulse">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                  Đang xếp hàng chờ xử lý...
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Hệ thống đang phục vụ các tác vụ AI trước đó trên luồng nền đơn để đảm bảo độ chính xác và tiết kiệm quota.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/80 text-xs text-zinc-600 dark:text-zinc-300">
                Tài liệu: <span className="font-semibold">{jobSnapshot.fileName}</span>
              </div>
            </div>
          ) : jobSnapshot?.status === 'FAILED' ? (
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-base font-bold text-red-600 dark:text-red-400 mb-1">
                  Soạn đề thi không thành công
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {jobSnapshot.error || jobSnapshot.message || 'Đã xảy ra lỗi trong quá trình phân tích hoặc gọi AI.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep('CONFIG')}>
                  Quay lại cấu hình
                </Button>
                <Button size="sm" onClick={handleStartGeneration}>
                  Thử lại
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-md shadow-indigo-500/20">
                <Sparkles className="w-8 h-8 animate-spin" />
              </div>

              <div>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-1">
                  AI đang phân tích & Soạn đề...
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {jobSnapshot?.message || 'Đang trích xuất nội dung bài học và cấu trúc bộ câu hỏi...'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-indigo-500 to-violet-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(jobSnapshot?.progressPercent || 35, 15)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400 font-medium">
                  <span>Tiến độ: {jobSnapshot?.progressPercent || 35}%</span>
                  <span>Đang xử lý trên luồng đơn an toàn</span>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons during active or queued states */}
          {jobSnapshot?.status !== 'FAILED' && (
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-200 text-left flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-indigo-950 dark:text-indigo-200">
                    Tác vụ đang chạy trong hàng đợi ngầm
                  </p>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
                    Bạn không cần phải giữ cửa sổ này! Hãy thoải mái đóng hộp thoại để tiếp tục làm việc khác, hệ thống sẽ lưu kết quả vào trang <strong>Tác vụ AI</strong>.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    stopPolling();
                    onClose();
                    toast.success('Tác vụ đang tiếp tục chạy ngầm! Bạn có thể xem lại tại trang "Tác vụ AI".', {
                      duration: 5000,
                      icon: '⚡',
                    });
                  }}
                  className="w-full sm:w-auto text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  leftIcon={<Layers className="w-3.5 h-3.5" />}
                >
                  Chạy ngầm & Đóng
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    stopPolling();
                    onClose();
                    router.push('/teacher/ai-tasks');
                  }}
                  className="w-full sm:w-auto text-xs rounded-xl border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  leftIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Đến trang Tác vụ AI
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto text-xs text-red-600 hover:text-red-700 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl"
                  onClick={handleCancelJob}
                  disabled={isCancelling}
                  leftIcon={isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                >
                  {isCancelling ? 'Đang hủy...' : 'Hủy tác vụ'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 3: REVIEW & APPROVAL CANVAS ================= */}
      {currentStep === 'REVIEW' && (
        <div className="flex flex-col h-full">
          {/* Review Header Banner */}
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                AI đã soạn xong {reviewQuestions.length} câu hỏi
              </span>
              <span className="text-zinc-400">•</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                Đã chọn {selectedQuestionIds.size}/{reviewQuestions.length} câu ({totalSelectedPoints} điểm)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={handleToggleSelectAll}
              >
                {selectedQuestionIds.size === reviewQuestions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
              </Button>
            </div>
          </div>

          {/* Questions Scrollable List */}
          <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
            {reviewQuestions.map((q, idx) => {
              const isSelected = selectedQuestionIds.has(idx);
              const isExpanded = expandedIndices.has(idx);
              const isEditing = editingIndex === idx;

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border transition-all ${
                    isSelected
                      ? 'border-indigo-300 dark:border-indigo-700 bg-white dark:bg-zinc-900 shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 opacity-70'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-4 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectQuestion(idx)}
                      className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
                    />

                    <div className="flex-1 space-y-2">
                      {/* Meta badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-zinc-500">#{idx + 1}</span>
                        <Badge variant="info">
                          {q.questionType === 'SINGLE_CHOICE'
                            ? 'Trắc nghiệm 1 đáp án'
                            : q.questionType === 'MULTIPLE_CHOICE'
                            ? 'Nhiều đáp án'
                            : q.questionType === 'NUMERIC'
                            ? 'Điền số'
                            : 'Tự luận'}
                        </Badge>
                        <Badge variant="warning">{q.difficulty || 'MEDIUM'}</Badge>
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {q.points || 1.0} điểm
                        </span>
                      </div>

                      {/* Question Content */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            rows={3}
                            className="w-full p-2.5 rounded-xl border border-indigo-400 bg-white dark:bg-zinc-950 text-xs leading-relaxed focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(idx)}>
                              Lưu
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setEditingIndex(null)}>
                              Hủy
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed">
                          {q.content}
                        </p>
                      )}

                      {/* Options preview for Choices */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={`p-2 rounded-lg border text-xs flex items-center gap-2 ${
                                opt.isCorrect
                                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium'
                                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                  opt.isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="truncate">{opt.content}</span>
                              {opt.isCorrect && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-600 flex-shrink-0" />}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Numeric details */}
                      {q.questionType === 'NUMERIC' && q.sampleAnswer && (
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
                          <strong>Đáp án số:</strong> {q.sampleAnswer} (Sai số cho phép: ±{q.numericTolerance ?? 0})
                        </div>
                      )}

                      {/* Essay details */}
                      {q.questionType === 'ESSAY_TEXT' && q.sampleAnswer && (
                        <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-xs text-purple-900 dark:text-purple-200 space-y-1">
                          <p><strong>Đáp án mẫu:</strong> {q.sampleAnswer}</p>
                          {q.gradingRubric && <p className="text-[11px] text-purple-700 dark:text-purple-300"><strong>Barem điểm:</strong> {q.gradingRubric}</p>}
                        </div>
                      )}

                      {/* Explanation accordion */}
                      {q.explanation && (
                        <div>
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(idx)}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 mt-1"
                          >
                            <span>💡 Lời giải chi tiết & Căn cứ tài liệu</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {isExpanded && (
                            <p className="mt-1.5 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions on Question */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIndex(idx);
                          setEditedContent(q.content);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Chỉnh sửa câu hỏi"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(idx)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Xóa câu hỏi này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Review Footer */}
          <div className="p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep('CONFIG')}
              disabled={isCommitting}
            >
              Soạn lại
            </Button>

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-lg shadow-indigo-500/25 border-0"
                onClick={handleCommitToExam}
                disabled={isCommitting || selectedQuestionIds.size === 0}
                leftIcon={
                  isCommitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )
                }
              >
                {isCommitting
                  ? 'Đang thêm vào đề thi...'
                  : `Thêm ${selectedQuestionIds.size} câu hỏi vào đề thi`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
