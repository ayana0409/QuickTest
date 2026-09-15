'use client';

import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Layers,
  FileText,
  Hash,
  ListChecks,
  CheckSquare,
  Upload,
  X,
  Sparkles,
  ImageIcon,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { examService } from '@/services/exam.service';
import type {
  QuestionResponse,
  QuestionType,
  QuestionCreateRequest,
  QuestionUpdateRequest,
  AnswerOptionDto,
} from '@/types/question';
import toast from 'react-hot-toast';

interface OptionItem {
  id?: string;
  content: string;
  isCorrect: boolean;
  imageUrl?: string;
  imagePublicId?: string;
}

interface QuestionFormData {
  content: string;
  questionType: QuestionType;
  points: number;
  sampleAnswer: string;
  numericTolerance: number;
  gradingRubric: string;
  imageUrl: string;
  options: OptionItem[];
}

interface QuestionBuilderProps {
  examId: string;
  questions: QuestionResponse[];
  isLocked?: boolean;
  onQuestionsChange: () => void;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, { label: string; icon: React.ReactNode; desc: string }> = {
  SINGLE_CHOICE: {
    label: 'Trắc nghiệm 1 đáp án',
    icon: <ListChecks className="w-4 h-4 text-indigo-500" />,
    desc: 'Thí sinh chỉ được chọn một đáp án chính xác duy nhất.',
  },
  MULTIPLE_CHOICE: {
    label: 'Trắc nghiệm nhiều đáp án',
    icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
    desc: 'Thí sinh chọn một hoặc nhiều đáp án đúng.',
  },
  NUMERIC: {
    label: 'Điền số (Numeric)',
    icon: <Hash className="w-4 h-4 text-amber-500" />,
    desc: 'Hệ thống tự động chấm theo giá trị số và sai số cho phép.',
  },
  ESSAY_TEXT: {
    label: 'Tự luận (Essay)',
    icon: <FileText className="w-4 h-4 text-purple-500" />,
    desc: 'Trả lời bằng văn bản dài, hỗ trợ barem điểm cho GV hoặc AI chấm.',
  },
};

const DEFAULT_OPTIONS: OptionItem[] = [
  { content: '', isCorrect: true, imageUrl: '' },
  { content: '', isCorrect: false, imageUrl: '' },
  { content: '', isCorrect: false, imageUrl: '' },
  { content: '', isCorrect: false, imageUrl: '' },
];

export const QuestionBuilder: React.FC<QuestionBuilderProps> = ({
  examId,
  questions,
  isLocked = false,
  onQuestionsChange,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Temporary local image states for Question (deferred upload until form is saved)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imagePublicId, setImagePublicId] = useState<string | null>(null);
  const [isImageRemoved, setIsImageRemoved] = useState(false);

  // Temporary local image states for Answer Options
  const [optionPendingFiles, setOptionPendingFiles] = useState<Record<number, File | null>>({});
  const [optionPreviewUrls, setOptionPreviewUrls] = useState<Record<number, string | null>>({});
  const [optionPublicIds, setOptionPublicIds] = useState<Record<number, string | null>>({});
  const [optionImagesRemoved, setOptionImagesRemoved] = useState<Record<number, boolean>>({});

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<QuestionFormData>({
    defaultValues: {
      content: '',
      questionType: 'SINGLE_CHOICE',
      points: 1,
      sampleAnswer: '',
      numericTolerance: 0,
      gradingRubric: '',
      imageUrl: '',
      options: DEFAULT_OPTIONS,
    },
  });

  const selectedType = watch('questionType');
  const watchedImageUrl = watch('imageUrl') || '';
  const watchedOptions = watch('options') || [];

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'options',
  });

  // Open modal to add a brand new question
  const handleOpenAddModal = (type: QuestionType = 'SINGLE_CHOICE') => {
    // Clean any prior temporary object URLs
    if (pendingImageFile && imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    // Clean any prior temporary object URLs
    if (pendingImageFile && imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    Object.values(optionPreviewUrls).forEach((url) => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });

    setPendingImageFile(null);
    setImagePreviewUrl(null);
    setImagePublicId(null);
    setIsImageRemoved(false);
    setOptionPendingFiles({});
    setOptionPreviewUrls({});
    setOptionPublicIds({});
    setOptionImagesRemoved({});
    setEditingQuestion(null);

    reset({
      content: '',
      questionType: type,
      points: 1,
      sampleAnswer: '',
      numericTolerance: 0,
      gradingRubric: '',
      imageUrl: '',
      options:
        type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE'
          ? [
              { content: '', isCorrect: true, imageUrl: '' },
              { content: '', isCorrect: false, imageUrl: '' },
              { content: '', isCorrect: false, imageUrl: '' },
              { content: '', isCorrect: false, imageUrl: '' },
            ]
          : [],
    });
    setIsModalOpen(true);
  };

  // Open modal to edit an existing question
  const handleOpenEditModal = (q: QuestionResponse) => {
    // Clean any prior temporary object URLs
    if (pendingImageFile && imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    Object.values(optionPreviewUrls).forEach((url) => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });

    setPendingImageFile(null);
    setImagePreviewUrl(q.imageUrl || null);
    setImagePublicId(q.imagePublicId || null);
    setIsImageRemoved(false);
    setEditingQuestion(q);

    // Initialize option preview URLs and public IDs from question options
    const initialPreviews: Record<number, string | null> = {};
    const initialPublicIds: Record<number, string | null> = {};
    q.options?.forEach((opt, idx) => {
      initialPreviews[idx] = opt.imageUrl || null;
      initialPublicIds[idx] = opt.imagePublicId || null;
    });
    setOptionPreviewUrls(initialPreviews);
    setOptionPublicIds(initialPublicIds);
    setOptionPendingFiles({});
    setOptionImagesRemoved({});

    reset({
      content: q.content || '',
      questionType: q.questionType,
      points: q.points || 1,
      sampleAnswer: q.sampleAnswer || '',
      numericTolerance: q.numericTolerance ?? 0,
      gradingRubric: q.gradingRubric || '',
      imageUrl: q.imageUrl || '',
      options:
        q.options && q.options.length > 0
          ? q.options.map((opt) => ({
              id: opt.id,
              content: opt.content || '',
              isCorrect: Boolean(opt.isCorrect),
              imageUrl: opt.imageUrl || '',
              imagePublicId: opt.imagePublicId || '',
            }))
          : [
              { content: '', isCorrect: true, imageUrl: '' },
              { content: '', isCorrect: false, imageUrl: '' },
            ],
    });
    setIsModalOpen(true);
  };

  // Safely close modal and revoke temporary blob previews if user cancelled
  const handleCloseModal = () => {
    if (pendingImageFile && imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    Object.values(optionPreviewUrls).forEach((url) => {
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    });

    setPendingImageFile(null);
    setImagePreviewUrl(null);
    setImagePublicId(null);
    setIsImageRemoved(false);
    setOptionPendingFiles({});
    setOptionPreviewUrls({});
    setOptionPublicIds({});
    setOptionImagesRemoved({});
    setIsModalOpen(false);
  };

  // Switch question type inside modal safely using replace()
  const handleTypeSelect = (type: QuestionType) => {
    setValue('questionType', type);
    if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') {
      if (fields.length === 0) {
        replace([
          { content: '', isCorrect: true, imageUrl: '' },
          { content: '', isCorrect: false, imageUrl: '' },
          { content: '', isCorrect: false, imageUrl: '' },
          { content: '', isCorrect: false, imageUrl: '' },
        ]);
      }
    }
  };

  // Handle single choice selection (unchecks all others)
  const handleSelectSingleCorrect = (selectedIndex: number) => {
    fields.forEach((_, idx) => {
      setValue(`options.${idx}.isCorrect`, idx === selectedIndex, {
        shouldDirty: true,
        shouldValidate: true,
      });
    });
  };

  // Select image file locally for Question WITHOUT uploading to backend yet
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước ảnh câu hỏi vượt quá giới hạn cho phép (tối đa 10MB).');
      return;
    }

    if (pendingImageFile && imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    const localBlobUrl = URL.createObjectURL(file);
    setPendingImageFile(file);
    setImagePreviewUrl(localBlobUrl);
    setIsImageRemoved(false);
    setValue('imageUrl', localBlobUrl);
  };

  // Remove/Delete image from question
  const handleRemoveImage = () => {
    if (pendingImageFile && imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setPendingImageFile(null);
    setImagePreviewUrl(null);
    setImagePublicId(null);
    setIsImageRemoved(true);
    setValue('imageUrl', '');

    const fileInput = document.getElementById('question-image-upload') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  };

  // Select image file locally for a specific Option
  const handleOptionImageChange = (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Kích thước ảnh đáp án vượt quá giới hạn cho phép (tối đa 10MB).');
      return;
    }

    const oldUrl = optionPreviewUrls[idx];
    if (oldUrl && oldUrl.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }

    const blobUrl = URL.createObjectURL(file);
    setOptionPendingFiles((prev) => ({ ...prev, [idx]: file }));
    setOptionPreviewUrls((prev) => ({ ...prev, [idx]: blobUrl }));
    setOptionImagesRemoved((prev) => ({ ...prev, [idx]: false }));
    setValue(`options.${idx}.imageUrl`, blobUrl, { shouldDirty: true });
  };

  // Remove image from a specific Option
  const handleRemoveOptionImage = (idx: number) => {
    const oldUrl = optionPreviewUrls[idx];
    if (oldUrl && oldUrl.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }

    setOptionPendingFiles((prev) => ({ ...prev, [idx]: null }));
    setOptionPreviewUrls((prev) => ({ ...prev, [idx]: null }));
    setOptionPublicIds((prev) => ({ ...prev, [idx]: null }));
    setOptionImagesRemoved((prev) => ({ ...prev, [idx]: true }));
    setValue(`options.${idx}.imageUrl`, '', { shouldDirty: true });
    setValue(`options.${idx}.imagePublicId`, '', { shouldDirty: true });

    const input = document.getElementById(`option-image-upload-${idx}`) as HTMLInputElement | null;
    if (input) input.value = '';
  };

  // Remove option row and re-index image states
  const handleRemoveOption = (idx: number) => {
    const oldUrl = optionPreviewUrls[idx];
    if (oldUrl && oldUrl.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }

    const newPending: Record<number, File | null> = {};
    const newPreviews: Record<number, string | null> = {};
    const newPublicIds: Record<number, string | null> = {};
    const newRemoved: Record<number, boolean> = {};

    const currentKeys = Object.keys(optionPreviewUrls).map(Number);
    currentKeys.forEach((k) => {
      if (k < idx) {
        newPending[k] = optionPendingFiles[k] || null;
        newPreviews[k] = optionPreviewUrls[k] || null;
        newPublicIds[k] = optionPublicIds[k] || null;
        newRemoved[k] = optionImagesRemoved[k] || false;
      } else if (k > idx) {
        newPending[k - 1] = optionPendingFiles[k] || null;
        newPreviews[k - 1] = optionPreviewUrls[k] || null;
        newPublicIds[k - 1] = optionPublicIds[k] || null;
        newRemoved[k - 1] = optionImagesRemoved[k] || false;
      }
    });

    setOptionPendingFiles(newPending);
    setOptionPreviewUrls(newPreviews);
    setOptionPublicIds(newPublicIds);
    setOptionImagesRemoved(newRemoved);

    remove(idx);
  };

  // Submit form for Create or Edit question
  const onSubmit = async (data: QuestionFormData) => {
    // Validation checks for choices
    if (data.questionType === 'SINGLE_CHOICE' || data.questionType === 'MULTIPLE_CHOICE') {
      if (!data.options || data.options.length < 2) {
        toast.error('Câu hỏi trắc nghiệm cần có ít nhất 2 đáp án lựa chọn.');
        return;
      }
      const hasCorrect = data.options.some((opt) => Boolean(opt.isCorrect));
      if (!hasCorrect) {
        toast.error('Vui lòng đánh dấu ít nhất một đáp án đúng.');
        return;
      }
    }

    if (data.questionType === 'NUMERIC' && !data.sampleAnswer?.trim()) {
      toast.error('Vui lòng nhập đáp án số tiêu chuẩn cho câu hỏi Numeric.');
      return;
    }

    if (data.questionType === 'ESSAY_TEXT' && !data.gradingRubric?.trim()) {
      toast.error('Vui lòng nhập barem điểm chi tiết (Grading Rubric) cho câu hỏi tự luận.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl: string | null = null;
      let finalImagePublicId: string | null = null;

      // STEP 1: Execute media uploads in parallel (Promise.all) to prevent sequential waiting
      type UploadTask = {
        type: 'question' | 'option';
        idx?: number;
        file: File;
        folder: string;
      };

      const tasks: UploadTask[] = [];
      if (pendingImageFile) {
        tasks.push({ type: 'question', file: pendingImageFile, folder: 'questions' });
      }

      Object.entries(optionPendingFiles).forEach(([idxStr, file]) => {
        if (file) {
          tasks.push({ type: 'option', idx: Number(idxStr), file, folder: 'options' });
        }
      });

      let uploadedResults: { type: 'question' | 'option'; idx?: number; url: string; publicId: string }[] = [];
      if (tasks.length > 0) {
        try {
          uploadedResults = await Promise.all(
            tasks.map((task) =>
              examService.uploadMedia(task.file, task.folder).then((res) => ({
                type: task.type,
                idx: task.idx,
                url: res.url,
                publicId: res.publicId,
              }))
            )
          );
        } catch {
          setIsSubmitting(false);
          return;
        }
      }

      // STEP 2: Resolve Question Image
      const qUpload = uploadedResults.find((r) => r.type === 'question');
      if (qUpload) {
        finalImageUrl = qUpload.url;
        finalImagePublicId = qUpload.publicId;
      } else if (!isImageRemoved) {
        finalImageUrl =
          editingQuestion?.imageUrl ||
          (data.imageUrl && !data.imageUrl.startsWith('blob:') ? data.imageUrl : null);
        finalImagePublicId = imagePublicId || editingQuestion?.imagePublicId || null;
      } else {
        finalImageUrl = null;
        finalImagePublicId = null;
      }

      // STEP 3: Prepare Options DTO with Images
      const optionsDto: AnswerOptionDto[] | undefined =
        data.questionType === 'SINGLE_CHOICE' || data.questionType === 'MULTIPLE_CHOICE'
          ? data.options.map((opt, idx) => {
              const optUpload = uploadedResults.find((r) => r.type === 'option' && r.idx === idx);
              let optImageUrl: string | null = null;
              let optImagePublicId: string | null = null;

              if (optUpload) {
                optImageUrl = optUpload.url;
                optImagePublicId = optUpload.publicId;
              } else if (!optionImagesRemoved[idx]) {
                const existingOpt = editingQuestion?.options?.[idx];
                optImageUrl =
                  existingOpt?.imageUrl ||
                  (opt.imageUrl && !opt.imageUrl.startsWith('blob:') ? opt.imageUrl : null);
                optImagePublicId = optionPublicIds[idx] || existingOpt?.imagePublicId || null;
              }

              return {
                orderIndex: idx + 1,
                content: opt.content || '',
                isCorrect: Boolean(opt.isCorrect),
                imageUrl: optImageUrl,
                imagePublicId: optImagePublicId,
              };
            })
          : undefined;

      // STEP 4: Save to backend
      if (editingQuestion) {
        // Update existing question
        const payload: QuestionUpdateRequest = {
          content: data.content,
          questionType: data.questionType,
          points: Number(data.points),
          imageUrl: finalImageUrl,
          imagePublicId: finalImagePublicId,
          sampleAnswer: data.sampleAnswer || null,
          numericTolerance: data.numericTolerance ? Number(data.numericTolerance) : null,
          gradingRubric: data.gradingRubric || null,
          options: optionsDto,
        };
        await examService.updateQuestion(editingQuestion.id, payload);
      } else {
        // Create new question
        const payload: QuestionCreateRequest = {
          orderIndex: questions.length + 1,
          content: data.content,
          questionType: data.questionType,
          points: Number(data.points),
          imageUrl: finalImageUrl,
          imagePublicId: finalImagePublicId,
          sampleAnswer: data.sampleAnswer || null,
          numericTolerance: data.numericTolerance ? Number(data.numericTolerance) : null,
          gradingRubric: data.gradingRubric || null,
          options: optionsDto,
        };
        await examService.addQuestion(examId, payload);
      }

      handleCloseModal();
      onQuestionsChange();
    } catch {
      // Handled by Axios Interceptor
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete question handler (Backend automatically deletes question image and options images from Cloudinary)
  const handleDeleteQuestion = async () => {
    if (!deleteConfirmId) return;
    try {
      await examService.deleteQuestion(deleteConfirmId);
      setDeleteConfirmId(null);
      onQuestionsChange();
    } catch {
      // Handled by Axios Interceptor
    }
  };

  // Aggregate stats
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);
  const typeCounts = questions.reduce((acc, q) => {
    acc[q.questionType] = (acc[q.questionType] || 0) + 1;
    return acc;
  }, {} as Record<QuestionType, number>);

  return (
    <div className="space-y-6">
      {/* Header Stat Strip */}
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {questions.length} câu hỏi
            </span>
            <span className="text-zinc-400">•</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              Tổng {totalPoints} điểm
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 border-l border-zinc-200 dark:border-zinc-800 pl-4">
            {Object.entries(typeCounts).map(([type, count]) => (
              <span
                key={type}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-700/60"
              >
                {QUESTION_TYPE_LABELS[type as QuestionType]?.label}: {count}
              </span>
            ))}
          </div>
        </div>

        {!isLocked && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => handleOpenAddModal('SINGLE_CHOICE')}
            >
              Thêm câu hỏi
            </Button>
          </div>
        )}
      </div>

      {/* Questions Canvas List */}
      {questions.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
          <Layers className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base mb-1">
            Đề thi chưa có câu hỏi nào
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-6">
            Bắt đầu tạo câu hỏi trắc nghiệm, điền số hoặc tự luận để cấu trúc đề kiểm tra của bạn.
          </p>
          {!isLocked && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<ListChecks className="w-4 h-4 text-indigo-500" />}
                onClick={() => handleOpenAddModal('SINGLE_CHOICE')}
              >
                Trắc nghiệm 1 đáp án
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<CheckSquare className="w-4 h-4 text-emerald-500" />}
                onClick={() => handleOpenAddModal('MULTIPLE_CHOICE')}
              >
                Nhiều đáp án
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Hash className="w-4 h-4 text-amber-500" />}
                onClick={() => handleOpenAddModal('NUMERIC')}
              >
                Điền số
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="w-4 h-4 text-purple-500" />}
                onClick={() => handleOpenAddModal('ESSAY_TEXT')}
              >
                Tự luận
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => {
            const typeConfig = QUESTION_TYPE_LABELS[question.questionType];

            return (
              <Card
                key={question.id}
                className="overflow-hidden border-zinc-200/90 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="p-5 sm:p-6">
                  {/* Top line: Index, Type Badge, Points, Action buttons */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {index + 1}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        {typeConfig?.icon}
                        <span>{typeConfig?.label}</span>
                      </span>
                      <Badge variant="default" size="sm">
                        {question.points} điểm
                      </Badge>
                    </div>

                    {!isLocked && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                          onClick={() => handleOpenEditModal(question)}
                          title="Chỉnh sửa câu hỏi"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          onClick={() => setDeleteConfirmId(question.id)}
                          title="Xóa câu hỏi (Xóa luôn ảnh trên đám mây)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Question Prompt Content */}
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-relaxed mb-4 whitespace-pre-wrap">
                    {question.content}
                  </div>

                  {/* Question Image View */}
                  {question.imageUrl && (
                    <div className="mb-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={question.imageUrl}
                        alt="Minh họa câu hỏi"
                        className="max-h-64 rounded-xl border border-zinc-200 dark:border-zinc-800 object-contain bg-zinc-50 dark:bg-zinc-950"
                      />
                    </div>
                  )}

                  {/* Options Render for Choices */}
                  {(question.questionType === 'SINGLE_CHOICE' ||
                    question.questionType === 'MULTIPLE_CHOICE') &&
                    question.options &&
                    question.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                        {question.options.map((opt, optIdx) => (
                          <div
                            key={opt.id || optIdx}
                            className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs sm:text-sm transition-all ${
                              opt.isCorrect
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300'
                                : 'bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200/70 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            <span
                              className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold shrink-0 mt-0.5 ${
                                opt.isCorrect
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                              }`}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <div className="flex-1">
                              <p className="font-medium">{opt.content}</p>
                              {opt.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={opt.imageUrl}
                                  alt="Hình đáp án"
                                  className="mt-2 max-h-24 rounded border object-contain"
                                />
                              )}
                            </div>
                            {opt.isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Numeric Details */}
                  {question.questionType === 'NUMERIC' && (
                    <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                      <div className="flex items-center gap-2 font-medium">
                        <span>Đáp án chính xác:</span>
                        <span className="font-mono font-bold bg-white dark:bg-amber-900/50 px-2 py-0.5 rounded border border-amber-300">
                          {question.sampleAnswer || 'N/A'}
                        </span>
                      </div>
                      <p className="text-amber-700 dark:text-amber-400">
                        Sai số cho phép: ±{question.numericTolerance ?? 0}
                      </p>
                    </div>
                  )}

                  {/* Essay Details & Grading Rubric */}
                  {question.questionType === 'ESSAY_TEXT' && (
                    <div className="space-y-2 pt-2">
                      {question.sampleAnswer && (
                        <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-800/40 text-xs text-purple-900 dark:text-purple-300">
                          <p className="font-semibold mb-1">Gợi ý đáp án:</p>
                          <p className="whitespace-pre-wrap">{question.sampleAnswer}</p>
                        </div>
                      )}
                      {question.gradingRubric && (
                        <div className="p-3.5 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-300">
                          <p className="font-semibold flex items-center gap-1.5 mb-1 text-indigo-600 dark:text-indigo-400">
                            <Sparkles className="w-3.5 h-3.5" />
                            Barem chấm điểm (Rubric):
                          </p>
                          <p className="whitespace-pre-wrap">{question.gradingRubric}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Question Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingQuestion ? 'Chỉnh sửa câu hỏi' : 'Tạo câu hỏi mới'}
        description="Điền thông tin nội dung, loại câu hỏi, điểm số và hình ảnh minh họa."
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Question Type Selector (Disabled when editing) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Loại câu hỏi
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => {
                const config = QUESTION_TYPE_LABELS[type];
                const isSelected = selectedType === type;

                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!!editingQuestion}
                    onClick={() => handleTypeSelect(type)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 ring-1 ring-indigo-600'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                    } ${editingQuestion ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <div className="shrink-0 mt-0.5">{config.icon}</div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                        {config.label}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                        {config.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row: Points and Image Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Điểm số câu hỏi *
              </label>
              <input
                type="number"
                step="0.25"
                min="0.25"
                {...register('points', { required: 'Vui lòng nhập điểm số', min: 0.25 })}
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {errors.points && (
                <p className="text-xs text-rose-500 mt-1">{errors.points.message}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                Hình ảnh minh họa (Lưu tạm - Chỉ tải lên khi bấm Lưu)
              </label>
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                    onClick={() => document.getElementById('question-image-upload')?.click()}
                  >
                    {imagePreviewUrl ? 'Đổi ảnh khác' : 'Chọn ảnh từ máy'}
                  </Button>
                  <input
                    id="question-image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageFileChange}
                  />
                </label>

                {imagePreviewUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    onClick={handleRemoveImage}
                    leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                  >
                    Gỡ ảnh
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Visual Image Preview Box (Temporary local preview) */}
          {imagePreviewUrl && !isImageRemoved && (
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Xem trước ảnh minh họa"
                  className="w-16 h-16 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shrink-0"
                />
                <div className="min-w-0 text-xs">
                  <div className="flex items-center gap-2">
                    {pendingImageFile ? (
                      <Badge variant="warning" size="sm" dot>
                        Ảnh mới (Chờ lưu)
                      </Badge>
                    ) : (
                      <Badge variant="info" size="sm" dot>
                        Ảnh hiện tại trên Cloud
                      </Badge>
                    )}
                  </div>
                  <p className="text-zinc-600 dark:text-zinc-400 mt-1 truncate">
                    {pendingImageFile ? pendingImageFile.name : 'Ảnh đã được gán vào câu hỏi'}
                  </p>
                  {pendingImageFile && (
                    <p className="text-[11px] text-zinc-400">
                      Dung lượng: {(pendingImageFile.size / 1024).toFixed(1)} KB (Chưa gửi về server)
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-zinc-400 hover:text-rose-600"
                onClick={handleRemoveImage}
                title="Xóa ảnh này"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Question Content */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
              Nội dung câu hỏi *
            </label>
            <textarea
              rows={4}
              placeholder="Nhập nội dung đề bài, câu hỏi..."
              {...register('content', { required: 'Nội dung câu hỏi không được để trống' })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            {errors.content && (
              <p className="text-xs text-rose-500 mt-1">{errors.content.message}</p>
            )}
          </div>

          {/* Choice Options (Single or Multiple) */}
          {(selectedType === 'SINGLE_CHOICE' || selectedType === 'MULTIPLE_CHOICE') && (
            <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Danh sách đáp án ({selectedType === 'SINGLE_CHOICE' ? 'Chọn 1 đáp án đúng' : 'Đánh dấu các đáp án đúng'})
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  onClick={() => append({ content: '', isCorrect: false, imageUrl: '' })}
                >
                  Thêm đáp án
                </Button>
              </div>

              <div className="space-y-2.5">
                {fields.map((field, idx) => {
                  const isChecked = Boolean(watchedOptions[idx]?.isCorrect);

                  return (
                    <div
                      key={field.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-colors ${
                        isChecked
                          ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-800'
                          : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50'
                      }`}
                    >
                      {/* Strictly Controlled Selection Control */}
                      {selectedType === 'SINGLE_CHOICE' ? (
                        <input
                          type="radio"
                          name={`singleChoiceRadio-${editingQuestion ? editingQuestion.id : 'create'}`}
                          checked={isChecked}
                          onChange={() => handleSelectSingleCorrect(idx)}
                          className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer shrink-0"
                          title="Đánh dấu là đáp án đúng duy nhất"
                        />
                      ) : (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            setValue(`options.${idx}.isCorrect`, e.target.checked, {
                              shouldDirty: true,
                              shouldValidate: true,
                            });
                          }}
                          className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer shrink-0"
                          title="Đánh dấu là đáp án đúng"
                        />
                      )}

                      <span className="text-xs font-bold text-zinc-500 w-5 shrink-0">
                        {String.fromCharCode(65 + idx)}.
                      </span>

                      <input
                        type="text"
                        placeholder={`Nội dung lựa chọn ${String.fromCharCode(65 + idx)}...`}
                        defaultValue={field.content ?? ''}
                        {...register(`options.${idx}.content` as const, {
                          required: 'Nội dung lựa chọn không được để trống',
                        })}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />

                      {/* Option Image Attachment or Preview Thumbnail */}
                      {optionPreviewUrls[idx] ? (
                        <div className="relative group shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={optionPreviewUrls[idx]!}
                            alt={`Ảnh đáp án ${String.fromCharCode(65 + idx)}`}
                            className="w-9 h-9 rounded-lg object-cover border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOptionImage(idx)}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-sm transition-transform hover:scale-110 cursor-pointer"
                            title="Gỡ ảnh đáp án này"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor={`option-image-upload-${idx}`}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer shrink-0"
                          title="Đính kèm ảnh cho đáp án này"
                        >
                          <ImageIcon className="w-4 h-4" />
                          <input
                            id={`option-image-upload-${idx}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleOptionImageChange(idx, e)}
                          />
                        </label>
                      )}

                      {fields.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx)}
                          className="p-1.5 text-zinc-400 hover:text-rose-500 transition-colors shrink-0 cursor-pointer"
                          title="Xóa lựa chọn này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Numeric Configuration */}
          {selectedType === 'NUMERIC' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Đáp án số chuẩn *
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: 3.1415 hoặc 42"
                  {...register('sampleAnswer', { required: 'Cần cung cấp đáp án số chuẩn' })}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Sai số cho phép (Tolerance ±)
                </label>
                <input
                  type="number"
                  step="0.001"
                  placeholder="0.05"
                  {...register('numericTolerance')}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <p className="text-[11px] text-zinc-400 mt-1">
                  Nếu sai số = 0.05 và đáp án = 10, thí sinh nhập 9.95 - 10.05 đều được chấp nhận.
                </p>
              </div>
            </div>
          )}

          {/* Essay Configuration */}
          {selectedType === 'ESSAY_TEXT' && (
            <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Gợi ý đáp án / Dàn ý chuẩn (Sample Answer)
                </label>
                <textarea
                  rows={3}
                  placeholder="Nhập nội dung đáp án chuẩn giúp người chấm bài đối chiếu..."
                  {...register('sampleAnswer')}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Barem điểm chi tiết (Grading Rubric cho GV hoặc AI chấm) *
                </label>
                <textarea
                  rows={3}
                  placeholder="Ví dụ:&#10;- Trình bày đúng định nghĩa: +1.0đ&#10;- Nêu được 3 ưu điểm: +1.5đ&#10;- Có ví dụ minh họa: +0.5đ"
                  {...register('gradingRubric', {
                    validate: (val) => {
                      if (selectedType === 'ESSAY_TEXT' && (!val || !val.trim())) {
                        return 'Barem điểm chi tiết (Grading Rubric) là bắt buộc cho câu hỏi tự luận';
                      }
                      return true;
                    },
                  })}
                  className={`w-full px-3.5 py-2 rounded-xl border ${
                    errors.gradingRubric
                      ? 'border-rose-500 focus:ring-rose-500'
                      : 'border-indigo-200 dark:border-indigo-900 focus:ring-indigo-500'
                  } bg-indigo-50/20 dark:bg-indigo-950/20 text-sm focus:ring-2 focus:outline-none`}
                />
                {errors.gradingRubric && (
                  <p className="text-xs text-rose-500 mt-1">{errors.gradingRubric.message}</p>
                )}
              </div>
            </div>
          )}


          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
            >
              Hủy
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingQuestion ? 'Lưu thay đổi' : 'Thêm vào đề thi'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Xác nhận xóa câu hỏi"
        description="Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa câu hỏi này khỏi đề thi?"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Hủy
            </Button>
            <Button variant="danger" onClick={handleDeleteQuestion}>
              Xác nhận xóa
            </Button>
          </>
        }
      >
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Câu hỏi và toàn bộ hình ảnh đính kèm trên hệ thống đám mây sẽ bị xóa vĩnh viễn ngay lập tức.
        </p>
      </Modal>
    </div>
  );
};
