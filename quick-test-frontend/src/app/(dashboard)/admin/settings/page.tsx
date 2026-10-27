import { redirect } from 'next/navigation';

/**
 * Redirect /admin/settings to AI & System Management workspace
 */
export default function AdminSettingsPage() {
  redirect('/admin/ai');
}
