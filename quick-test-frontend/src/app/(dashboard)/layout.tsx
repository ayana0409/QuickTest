import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export const metadata = {
  title: 'QuickTest Dashboard',
  description: 'Online Examination & Assessment Portal',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function AppDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
