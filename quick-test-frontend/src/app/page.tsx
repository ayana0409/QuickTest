import Link from 'next/link';
import {
  ShieldCheck,
  Zap,
  Sparkles,
  BarChart3,
  CheckCircle2,
  FileText,
  RefreshCw,
  FileSpreadsheet,
  Clock,
  Award,
} from 'lucide-react';
import { AuthNav } from '@/components/common/AuthNav';
import { HeroQuickJoin } from '@/components/home/HeroQuickJoin';
import { PublicExamsSection } from '@/components/home/PublicExamsSection';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Sticky Glass Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="QuickTest Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-xl shadow-xs"
            />
            <span className="font-extrabold text-lg sm:text-xl tracking-tight text-zinc-900 dark:text-zinc-100">
              Quick<span className="text-indigo-600 dark:text-indigo-400">Test</span>
            </span>
          </Link>

          <AuthNav />
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-10 sm:py-20 lg:py-24">
          {/* Subtle Ambient Radial Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-[280px] bg-indigo-500/10 dark:bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />

          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-200/80 dark:border-indigo-800/60 text-indigo-600 dark:text-indigo-400 text-[11px] sm:text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Nền tảng kiểm tra và đánh giá học tập thông minh</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.15] mb-4 sm:mb-6">
              Tổ chức kỳ thi trực tuyến{' '}
              <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Công bằng, tiện lợi và an tâm
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-sm sm:text-base lg:text-lg text-zinc-600 dark:text-zinc-400 mb-8 sm:mb-10 leading-relaxed">
              Giúp thầy cô tiết kiệm thời gian ra đề và chấm bài kiểm tra. Giúp học sinh tập trung làm bài, minh bạch và thuận tiện trên mọi thiết bị.
            </p>

            {/* Interactive Access Code Input Bar & Role Portals */}
            <HeroQuickJoin />
          </div>
        </section>

        {/* Random Public Explore Exams Section */}
        <PublicExamsSection />

        {/* Feature Showcase (Bento Grid) */}
        <section className="py-12 sm:py-20 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10">
            <div className="max-w-2xl space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Tính năng nổi bật
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
                Giải pháp toàn diện cho mọi kỳ thi
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Đồng hành cùng nhà trường, thầy cô và học sinh trong việc tổ chức kiểm tra và theo dõi kết quả học tập chính xác.
              </p>
            </div>

            {/* Asymmetric Bento Grid (7-5 / 5-7) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
              {/* Bento Card 1: Exam Proctoring & Integrity (col-span-7) */}
              <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between space-y-5">
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Phòng thi nghiêm túc, đảm bảo tính công bằng
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Hệ thống tự động nhắc nhở khi học sinh vô tình rời màn hình bài làm hoặc có dấu hiệu mất tập trung, đồng thời gửi thông tin ngay tới thầy cô giám sát để hỗ trợ kịp thời.
                  </p>
                </div>

                {/* User-friendly Highlight Tags */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Giữ môi trường thi trung thực
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-2xs">
                    Nhắc nhở khi rời màn hình
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-2xs">
                    Báo cáo trực tiếp tới giám thị
                  </span>
                </div>
              </div>

              {/* Bento Card 2: AI Quiz Creation & Grading (col-span-5) */}
              <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between space-y-5">
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Tạo đề nhanh & Hỗ trợ chấm bài tự động
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Thầy cô có thể tải lên tài liệu bài giảng sẵn có để hệ thống gợi ý câu hỏi kiểm tra, kèm đáp án mẫu và hướng dẫn chấm chi tiết để tiết kiệm thời gian.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/50">
                    <FileText className="w-3.5 h-3.5" />
                    Tạo câu hỏi từ tài liệu
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/50">
                    Gợi ý chấm theo thang điểm
                  </span>
                </div>
              </div>

              {/* Bento Card 3: Auto-save & Continuity (col-span-5) */}
              <div className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between space-y-5">
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Tự động lưu bài, không lo mất dữ liệu
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Mỗi phương án chọn được lưu lại ngay tức thì. Nếu không may bị mất mạng hoặc tắt nhầm trang, học sinh vẫn có thể tiếp tục làm bài bình thường mà không bị mất kết quả.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/50">
                    <Clock className="w-3.5 h-3.5" />
                    Lưu đáp án từng giây
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-2xs">
                    Tiếp tục thi khi có mạng lại
                  </span>
                </div>
              </div>

              {/* Bento Card 4: Reports & Excel Export (col-span-7) */}
              <div className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-zinc-50/70 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between space-y-5">
                <div className="space-y-2.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                    Báo cáo kết quả & Xuất bảng điểm lớp học
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    Dễ dàng theo dõi điểm trung bình của cả lớp, nắm bắt những câu hỏi nhiều học sinh làm sai để kịp thời củng cố kiến thức, và tải về bảng điểm chi tiết để lưu sổ điểm.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-2xs">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                    Tải bảng điểm Excel tiện lợi
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 shadow-2xs">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    Tổng kết điểm số trực quan
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/80 dark:border-zinc-800/80 py-6 sm:py-8 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-800 dark:text-zinc-200">QuickTest</span>
            <span>•</span>
            <span>Nền tảng kiểm tra & đánh giá năng lực học tập</span>
          </div>
          <div>
            © {new Date().getFullYear()} QuickTest. Bảo lưu mọi quyền.
          </div>
        </div>
      </footer>
    </div>
  );
}
