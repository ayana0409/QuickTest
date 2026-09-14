import Link from 'next/link';
import { ShieldCheck, BookOpen, UserCheck, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/common/Button';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-indigo-600/30">
              Q
            </div>
            <span className="font-bold text-xl tracking-tight text-zinc-900 dark:text-zinc-100">
              Quick<span className="text-indigo-600">Test</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Đăng nhập
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="sm">
                Đăng ký ngay
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center">
        <section className="relative overflow-hidden py-20 sm:py-28">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-8">
              <Zap className="w-3.5 h-3.5" />
              Nền tảng kiểm tra trực tuyến thế hệ mới
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 leading-[1.15] mb-6">
              Tổ chức thi & Giám sát thông minh <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Chống gian lận đa tầng
              </span>
            </h1>

            <p className="max-w-2xl mx-auto text-lg text-zinc-600 dark:text-zinc-400 mb-10 leading-relaxed">
              Quick Test kết hợp chấm điểm tự động, hỗ trợ chấm bài tự luận bằng AI, cùng hệ thống
              giám sát camera, phát hiện chuyển tab và cảnh báo vi phạm thời gian thực qua WebSocket.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/login">
                <Button size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Vào phòng thi
                </Button>
              </Link>
              <Link href="/teacher/exams">
                <Button variant="outline" size="lg" leftIcon={<BookOpen className="w-4 h-4" />}>
                  Cổng Giáo viên
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="secondary" size="lg" leftIcon={<ShieldCheck className="w-4 h-4" />}>
                  Quản trị viên
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="py-16 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-2">Giám sát Real-time</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Ghi nhận chuyển tab, thoát toàn màn hình, mở DevTools và truyền dữ liệu cảnh báo vi
                  phạm trực tiếp tới màn hình giám thị qua STOMP WebSocket.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-2">Auto-save & Fail-safe</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Tự động lưu câu trả lời liên tục theo thời gian thực vào Redis & PostgreSQL. Thí
                  sinh có thể khôi phục phiên làm bài ngay lập tức nếu gặp sự cố mạng.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-4">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-2">Chấm điểm AI & Phân tích</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Hỗ trợ chấm trắc nghiệm tức thời, trợ lý AI chấm tự luận so khớp rubric chuẩn xác
                  và xuất thống kê trực quan cho toàn bộ kỳ thi.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-8 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} Quick Test Platform. Hệ thống đánh giá năng lực & kiểm tra thông minh.
        </div>
      </footer>
    </div>
  );
}
