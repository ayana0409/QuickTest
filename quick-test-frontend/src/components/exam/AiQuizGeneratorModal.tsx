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
  ListChecks,
  CheckSquare,
  Hash,
  X,
  Check,
  Minus,
  Plus,
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

const QUESTION_TYPE_OPTIONS: {
  type: QuestionType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    type: 'SINGLE_CHOICE',
    label: 'Trắc nghiệm 1 đáp án',
    desc: '4 phương án, 1 đáp án đúng',
    icon: ListChecks,
  },
  {
    type: 'MULTIPLE_CHOICE',
    label: 'Nhiều đáp án đúng',
    desc: 'Chọn từ 2 đáp án đúng trở lên',
    icon: CheckSquare,
  },
  {
    type: 'NUMERIC',
    label: 'Điền số',
    desc: 'Học sinh tự nhập kết quả',
    icon: Hash,
  },
  {
    type: 'ESSAY_TEXT',
    label: 'Tự luận',
    desc: 'Kèm đáp án mẫu và thang điểm',
    icon: FileText,
  },
];

const PRESET_COUNTS = [5, 10, 15, 20, 30, 40, 50, 60];

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
            setSelectedQuestionIds(new Set(questions.map((_, i) => i)));
            setCurrentStep('REVIEW');
          } else if (snapshot.status === 'FAILED') {
            stopPolling();
          } else if (snapshot.status === 'CANCELLED') {
            stopPolling();
            setCurrentStep('CONFIG');
          }
        } catch {
          // Handled by Axios Interceptor
        }
      };

      poll();
      pollingIntervalRef.current = setInterval(poll, 2000);
    },
    [stopPolling]
  );

  // Adjust question count safely between 1 and 60
  const handleCountChange = (val: number) => {
    if (isNaN(val)) return;
    const clamped = Math.max(1, Math.min(60, val));
    setTotalQuestions(clamped);
  };

  // Toggle question type selection
  const handleToggleType = (type: QuestionType) => {
    setTargetTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) {
          toast.error('Bạn cần giữ lại ít nhất 1 loại câu hỏi');
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
      toast.error('Chỉ hỗ trợ file PDF (.pdf), Word (.docx) hoặc file văn bản (.txt, .md)');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error('Dung lượng file tối đa là 8MB, vui lòng chọn file nhỏ hơn');
      return;
    }

    setSelectedFile(file);
  };

  // Submit start generation
  const handleStartGeneration = async () => {
    if (inputTab === 'FILE' && !selectedFile) {
      toast.error('Vui lòng chọn hoặc kéo thả 1 file tài liệu');
      return;
    }

    if (inputTab === 'TEXT' && (!rawText.trim() || rawText.trim().length < 30)) {
      toast.error('Nội dung văn bản cần ít nhất 30 ký tự để tạo câu hỏi');
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
      // Handled by Axios Interceptor
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
      toast.error('Nội dung câu hỏi không được để trống');
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
      toast.error('Vui lòng chọn ít nhất 1 câu hỏi để thêm vào đề');
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
          toast.success('Hệ thống đang tiếp tục tạo câu hỏi ngầm, bạn có thể xem lại sau');
        } else {
          onClose();
        }
      }}
      title={
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-indigo-600 text-white shadow-sm flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Tạo câu hỏi bằng AI
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400">
              Tải tài liệu hoặc dán nội dung để tự động soạn câu hỏi
            </p>
          </div>
        </div>
      }
      size="2xl"
      className="max-h-[94vh] flex flex-col"
      bodyClassName="p-0 overflow-y-auto"
    >
      {/* ================= RESPONSIVE STEP BAR ================= */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40">
        <div className="grid grid-cols-3 gap-2 text-xs font-medium">
          {/* Step 1 */}
          <div
            className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2 py-1 rounded-lg ${
              currentStep === 'CONFIG'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-white dark:bg-zinc-800 shadow-xs'
                : 'text-zinc-400'
            }`}
          >
            <span
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold ${
                currentStep === 'CONFIG'
                  ? 'bg-indigo-600 text-white'
                  : currentStep === 'POLLING' || currentStep === 'REVIEW'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}
            >
              {currentStep === 'POLLING' || currentStep === 'REVIEW' ? (
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              ) : (
                '1'
              )}
            </span>
            <span className="truncate">1. Cài đặt</span>
          </div>

          {/* Step 2 */}
          <div
            className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2 py-1 rounded-lg ${
              currentStep === 'POLLING'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-white dark:bg-zinc-800 shadow-xs'
                : 'text-zinc-400'
            }`}
          >
            <span
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold ${
                currentStep === 'POLLING'
                  ? 'bg-indigo-600 text-white'
                  : currentStep === 'REVIEW'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}
            >
              {currentStep === 'REVIEW' ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : '2'}
            </span>
            <span className="truncate">2. Đang tạo</span>
          </div>

          {/* Step 3 */}
          <div
            className={`flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2 py-1 rounded-lg ${
              currentStep === 'REVIEW'
                ? 'text-indigo-600 dark:text-indigo-400 font-semibold bg-white dark:bg-zinc-800 shadow-xs'
                : 'text-zinc-400'
            }`}
          >
            <span
              className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold ${
                currentStep === 'REVIEW'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
              }`}
            >
              3
            </span>
            <span className="truncate">3. Chọn câu</span>
          </div>
        </div>
      </div>

      {/* ================= STEP 1: CONFIGURATION ================= */}
      {currentStep === 'CONFIG' && (
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
          {/* Source Tabs - Full Width on Mobile */}
          <div className="grid grid-cols-2 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl w-full sm:w-fit gap-1">
            <button
              type="button"
              onClick={() => setInputTab('FILE')}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                inputTab === 'FILE'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Chọn file</span>
            </button>
            <button
              type="button"
              onClick={() => setInputTab('TEXT')}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                inputTab === 'TEXT'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Dán văn bản</span>
            </button>
          </div>

          {/* Input Source: File or Text */}
          {inputTab === 'FILE' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 sm:p-7 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                  : selectedFile
                  ? 'border-emerald-500/70 bg-emerald-50/30 dark:bg-emerald-950/20'
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
                <div className="flex items-center justify-between max-w-md mx-auto p-3 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-500/30 shadow-sm">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div className="p-2 sm:p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB • Bấm để đổi file khác
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0 ml-2"
                    title="Xóa file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-1.5">
                    <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Kéo thả file vào đây hoặc <span className="text-indigo-600 dark:text-indigo-400 underline">chọn từ thiết bị</span>
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Hỗ trợ PDF, Word (.docx) hoặc file văn bản (.txt) • Tối đa 8MB
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>Dán nội dung bài học hoặc tóm tắt lý thuyết:</span>
                <span className="font-mono text-[11px]">{rawText.length} ký tự</span>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Dán nội dung bài học vào đây để AI tạo câu hỏi..."
                rows={5}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
              />
            </div>
          )}

          {/* ================= QUESTION COUNT CONTROLLER (NO SLIDER) ================= */}
          <div className="p-4 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                  Số lượng câu hỏi (1 - 60 câu):
                </label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Nhập số lượng cụ thể hoặc bấm chọn các mốc bên dưới
                </p>
              </div>

              {/* Number Stepper - liền lạc: [-] [ số ] [+] câu hỏi */}
              <div className="flex items-center gap-2 self-center sm:self-auto">
                <div className="inline-flex items-center bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => handleCountChange(totalQuestions - 1)}
                    disabled={totalQuestions <= 1}
                    className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700/80 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 active:scale-95 disabled:opacity-30 transition-all"
                    title="Giảm 1 câu"
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={totalQuestions}
                    onChange={(e) => handleCountChange(parseInt(e.target.value, 10))}
                    className="w-12 h-8 text-center text-sm font-bold text-zinc-900 dark:text-zinc-100 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />

                  <button
                    type="button"
                    onClick={() => handleCountChange(totalQuestions + 1)}
                    disabled={totalQuestions >= 60}
                    className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-700/80 flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 active:scale-95 disabled:opacity-30 transition-all"
                    title="Tăng 1 câu"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  câu hỏi
                </span>
              </div>
            </div>

            {/* Quick Preset Buttons - Grid on Mobile, Flex on Desktop */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                Mốc gợi ý:
              </span>
              <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5 sm:gap-2">
                {PRESET_COUNTS.map((count) => {
                  const isSelected = totalQuestions === count;
                  return (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTotalQuestions(count)}
                      className={`py-2 sm:py-1 px-2 sm:px-3 rounded-lg text-xs font-semibold text-center transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm font-bold'
                          : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {count} câu
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ================= QUESTION TYPES GRID ================= */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
              Loại câu hỏi muốn tạo:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {QUESTION_TYPE_OPTIONS.map((item) => {
                const isSelected = targetTypes.includes(item.type);
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => handleToggleType(item.type)}
                    className={`p-3 rounded-xl border text-left transition-all min-h-[56px] flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-xs ring-1 ring-indigo-500/20'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-zinc-500 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <IconComponent className="w-4 h-4 text-indigo-500" />
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-transparent'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ================= DIFFICULTY & LANGUAGE ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Mức độ câu hỏi:
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="BALANCED">Đan xen các mức độ</option>
                <option value="EASY">Cơ bản / Dễ</option>
                <option value="MEDIUM">Vừa phải / Thông hiểu</option>
                <option value="HARD">Nâng cao / Khó</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Ngôn ngữ:
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">Tiếng Anh</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Ghi chú thêm (nếu có):
              </label>
              <input
                type="text"
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="VD: Tập trung vào chương 2..."
                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 h-9"
            >
              Đóng
            </Button>
            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 h-9 shadow-sm"
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
              {isSubmitting ? 'Đang gửi...' : `Bắt đầu tạo ${totalQuestions} câu hỏi`}
            </Button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: POLLING / WAITING ================= */}
      {currentStep === 'POLLING' && (
        <div className="p-6 sm:p-8 text-center space-y-6 max-w-md mx-auto">
          {jobSnapshot?.status === 'FAILED' ? (
            <div className="space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-red-600 dark:text-red-400 mb-1">
                  Chưa thể tạo câu hỏi
                </h4>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {jobSnapshot.error || jobSnapshot.message || 'Đã xảy ra lỗi khi đọc tài liệu. Vui lòng thử lại.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep('CONFIG')}>
                  Quay lại
                </Button>
                <Button size="sm" onClick={handleStartGeneration}>
                  Thử lại
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Đang tạo {totalQuestions} câu hỏi...
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {jobSnapshot?.message || 'Hệ thống đang đọc nội dung bài học và chuẩn bị câu hỏi.'}
                </p>
              </div>

              {/* Clean Progress Bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(jobSnapshot?.progressPercent || 20, 10)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Tiến độ: {jobSnapshot?.progressPercent || 20}%</span>
                  <span className="truncate max-w-[180px]">{jobSnapshot?.fileName || 'Tài liệu'}</span>
                </div>
              </div>

              {/* Helpful notice */}
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 text-left">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-0.5">
                  Bạn có thể đóng cửa sổ này
                </p>
                <p className="text-[11px] leading-relaxed">
                  Hệ thống vẫn tiếp tục tạo câu hỏi ngầm. Bạn có thể làm việc khác và kiểm tra lại ở mục "Tác vụ AI".
                </p>
              </div>

              {/* Action Buttons - Stacked on Mobile */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    stopPolling();
                    onClose();
                  }}
                >
                  Đóng cửa sổ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    stopPolling();
                    onClose();
                    router.push('/teacher/ai-tasks');
                  }}
                >
                  Xem trang Tác vụ AI
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleCancelJob}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Đang hủy...' : 'Hủy'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= STEP 3: REVIEW & ADD TO EXAM ================= */}
      {currentStep === 'REVIEW' && (
        <div className="flex flex-col h-full">
          {/* Review Header Banner */}
          <div className="p-3.5 sm:p-4 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">
                Đã tạo {reviewQuestions.length} câu hỏi
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">•</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                Đã chọn {selectedQuestionIds.size}/{reviewQuestions.length} câu ({totalSelectedPoints} điểm)
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7 px-3 bg-white dark:bg-zinc-800 self-start sm:self-auto"
              onClick={handleToggleSelectAll}
            >
              {selectedQuestionIds.size === reviewQuestions.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </Button>
          </div>

          {/* Question List */}
          <div className="p-3.5 sm:p-5 space-y-3 max-h-[55vh] overflow-y-auto">
            {reviewQuestions.map((q, idx) => {
              const isSelected = selectedQuestionIds.has(idx);
              const isExpanded = expandedIndices.has(idx);
              const isEditing = editingIndex === idx;

              return (
                <div
                  key={idx}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-indigo-300 dark:border-indigo-800 bg-white dark:bg-zinc-900 shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 opacity-70'
                  }`}
                >
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectQuestion(idx)}
                      className="mt-1 w-4 h-4 sm:w-4.5 sm:h-4.5 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 cursor-pointer flex-shrink-0"
                    />

                    <div className="flex-1 space-y-2 min-w-0">
                      {/* Meta badges */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-xs font-bold text-zinc-500">
                          Câu {idx + 1}
                        </span>
                        <Badge variant="info">
                          {q.questionType === 'SINGLE_CHOICE'
                            ? 'Trắc nghiệm 1 đáp án'
                            : q.questionType === 'MULTIPLE_CHOICE'
                            ? 'Nhiều đáp án'
                            : q.questionType === 'NUMERIC'
                            ? 'Điền số'
                            : 'Tự luận'}
                        </Badge>
                        <Badge variant="warning">
                          {q.difficulty === 'EASY'
                            ? 'Dễ'
                            : q.difficulty === 'HARD'
                            ? 'Khó'
                            : q.difficulty === 'BALANCED'
                            ? 'Cân bằng'
                            : 'Vừa'}
                        </Badge>
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                          {q.points || 1.0} điểm
                        </span>
                      </div>

                      {/* Question content */}
                      {isEditing ? (
                        <div className="space-y-2 pt-1">
                          <textarea
                            value={editedContent}
                            onChange={(e) => setEditedContent(e.target.value)}
                            rows={3}
                            className="w-full p-2.5 rounded-lg border border-indigo-400 bg-white dark:bg-zinc-950 text-xs leading-relaxed focus:outline-none"
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(idx)}>
                              Lưu
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setEditingIndex(null)}
                            >
                              Hủy
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed break-words">
                          {q.content}
                        </p>
                      )}

                      {/* Options preview for Choices - Stacked on Mobile, 2 Cols on Desktop */}
                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 pt-1">
                          {q.options.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 ${
                                opt.isCorrect
                                  ? 'border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 font-medium'
                                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-300'
                              }`}
                            >
                              <span
                                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                                  opt.isCorrect
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                                }`}
                              >
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                              <span className="truncate flex-1">{opt.content}</span>
                              {opt.isCorrect && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              )}
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
                          {q.gradingRubric && (
                            <p className="text-[11px] text-purple-700 dark:text-purple-300">
                              <strong>Thang điểm:</strong> {q.gradingRubric}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Explanation toggle */}
                      {q.explanation && (
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleToggleExpand(idx)}
                            className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                          >
                            <span>Xem giải thích</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {isExpanded && (
                            <p className="mt-1.5 p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                              {q.explanation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Question actions */}
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingIndex(idx);
                          setEditedContent(q.content);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Sửa nội dung"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(idx)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        title="Xóa câu này"
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
          <div className="p-3.5 sm:p-4 border-t border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep('CONFIG')}
              disabled={isCommitting}
              className="px-3 sm:px-4"
            >
              Tạo lại
            </Button>

            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 sm:px-5"
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
                ? 'Đang thêm vào đề...'
                : `Thêm ${selectedQuestionIds.size} câu vào đề thi`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
