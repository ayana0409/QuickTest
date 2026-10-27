import { redirect } from 'next/navigation';

/**
 * Redirect /admin/exams to unified Exam Management workspace
 */
export default function AdminExamsPage() {
  redirect('/teacher/exams');
}
