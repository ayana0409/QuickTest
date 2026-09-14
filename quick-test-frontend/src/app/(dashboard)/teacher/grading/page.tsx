'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Check, CheckCircle2, AlertCircle, FileText, Award } from 'lucide-react';
import { Button } from '@/components/common/Button';

interface PendingEssaySubmission {
  id: string;
  candidateName: string;
  examTitle: string;
  questionContent: string;
  maxScore: number;
  candidateTextAnswer: string;
  rubric: string;
  sampleAnswer?: string;
  currentScore?: number;
  feedback?: string;
  isAiGraded?: boolean;
}

export default function TeacherGradingPage() {
  const [submissions] = useState<PendingEssaySubmission[]>([
    {
      id: 'sub-1',
      candidateName: 'Nguyễn Văn Minh (SV202601)',
      examTitle: 'Kiểm tra Giữa kỳ Java & Spring Boot',
      questionContent: 'Hãy phân tích sự khác nhau giữa @Component, @Service và @Repository trong Spring Framework.',
      maxScore: 2.0,
      candidateTextAnswer:
        '@Component là annotation chung cho Spring Bean. @Service dùng cho tầng nghiệp vụ (Business Logic). @Repository đánh dấu tầng DAO/truy cập dữ liệu và hỗ trợ tự động dịch biệt lệ sang DataAccessException của Spring.',
      rubric: 'Đúng bản chất 3 annotations: 1.0đ. Nêu được cơ chế DataAccessException translation của @Repository: 1.0đ.',
      sampleAnswer: '@Component: Bean chung. @Service: Tầng dịch vụ. @Repository: Tầng dữ liệu có Exception Translation.',
      currentScore: 2.0,
      feedback: 'Giải thích chính xác và đầy đủ bản chất kỹ thuật.',
      isAiGraded: true,
    },
  ]);

  const [isTriggeringAi, setIsTriggeringAi] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  const handleTriggerAiGrading = () => {
    setIsTriggeringAi(true);
    setAiMessage(null);
    setTimeout(() => {
      setIsTriggeringAi(false);
      setAiMessage('Đã kích hoạt tác vụ AI chấm tự luận background thành công! Kết quả sẽ được cập nhật.');
    }, 1200);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              href="/teacher/exams"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Quản lý đề</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Chấm Điểm & Phê Duyệt Tự Luận
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Xem xét câu trả lời tự luận của thí sinh, đối chiếu rubric và xác nhận điểm số
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          isLoading={isTriggeringAi}
          onClick={handleTriggerAiGrading}
          leftIcon={<Sparkles className="w-4 h-4" />}
        >
          Chấm AI Tự Động
        </Button>
      </div>

      {/* Main Container */}
      <div>
        {aiMessage && (
          <div className="flex items-start gap-3 p-4 mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{aiMessage}</span>
          </div>
        )}

        <div className="space-y-6">
          {submissions.map((item) => (
            <div
              key={item.id}
              className="p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-zinc-100 dark:border-zinc-800">
                <div>
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
                    {item.examTitle}
                  </span>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                    Thí sinh: {item.candidateName}
                  </h3>
                </div>

                {item.isAiGraded && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    Đã được AI đề xuất điểm
                  </span>
                )}
              </div>

              {/* Question & Rubric */}
              <div className="mb-6 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Đề bài (Tối đa {item.maxScore} điểm):
                </div>
                <div className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  {item.questionContent}
                </div>
                <div className="text-xs text-zinc-500 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                  <strong>Rubric chấm:</strong> {item.rubric}
                </div>
              </div>

              {/* Candidate Answer */}
              <div className="mb-6">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Bài làm của thí sinh:
                </div>
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
                  {item.candidateTextAnswer}
                </div>
              </div>

              {/* Scoring and Feedback Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 items-end">
                <div>
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Điểm số (0 - {item.maxScore}):
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    max={item.maxScore}
                    min={0}
                    defaultValue={item.currentScore}
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm font-semibold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    Nhận xét của giáo viên:
                  </label>
                  <input
                    type="text"
                    defaultValue={item.feedback}
                    placeholder="Góp ý hoặc nhận xét cho thí sinh..."
                    className="w-full px-3.5 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button size="sm" variant="success" leftIcon={<Check className="w-4 h-4" />}>
                  Lưu & Xác nhận điểm
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
