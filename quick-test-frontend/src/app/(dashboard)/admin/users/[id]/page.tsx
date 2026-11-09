'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Shield,
  KeyRound,
  Lock,
  Unlock,
  UserCheck,
  UserX,
  Mail,
  Calendar,
  Clock,
  Fingerprint,
  Save,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/common/Card';
import { adminService } from '@/services/admin.service';
import { useAuthStore } from '@/stores/authStore';
import type { AdminUser, UserRole } from '@/types/admin';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminUserDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id: userId } = use(params);
  const { user: currentAdmin, isAuthenticated, isInitialized, isLoggedIn } = useAuthStore();

  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopiedId, setIsCopiedId] = useState(false);

  // Edit profile form state
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    username: '',
    email: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Role update state
  const [selectedRole, setSelectedRole] = useState<UserRole>('STUDENT');
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Reset password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Toggle status state
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Fetch user details
  const fetchUser = async () => {
    setIsLoading(true);
    try {
      const data = await adminService.getUserDetail(userId);
      setUser(data);
      setProfileForm({
        fullName: data.fullName || '',
        username: data.username || '',
        email: data.email || '',
      });
      setSelectedRole(data.role);
    } catch (error) {
      console.error('Failed to load user details:', error);
      router.push('/admin/users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated || isLoggedIn()) {
      fetchUser();
    }
  }, [userId, isAuthenticated, isLoggedIn]);

  const handleCopyId = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.id);
    setIsCopiedId(true);
    setTimeout(() => setIsCopiedId(false), 2000);
    toast.success('Đã sao chép mã người dùng vào bộ nhớ tạm');
  };

  // Submit profile changes
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.fullName.trim() || !profileForm.username.trim() || !profileForm.email.trim()) {
      toast.error('Vui lòng điền đầy đủ các thông tin cá nhân');
      return;
    }

    setIsSavingProfile(true);
    try {
      const updated = await adminService.updateUserProfile(userId, {
        fullName: profileForm.fullName.trim(),
        username: profileForm.username.trim(),
        email: profileForm.email.trim(),
      });
      setUser(updated);
      // Notification is handled automatically by axios interceptor
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Submit role update
  const handleUpdateRole = async () => {
    if (!user) return;

    if (user.id === currentAdmin?.id && selectedRole !== 'ADMIN') {
      toast.error('Bạn không thể tự gỡ quyền Quản trị viên của chính mình');
      return;
    }

    setIsSavingRole(true);
    try {
      const updated = await adminService.updateUserRole(userId, selectedRole);
      setUser(updated);
      // Notification is handled automatically by axios interceptor
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsSavingRole(false);
    }
  };

  // Submit reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      toast.error('Mật khẩu không được để trống');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsSavingPassword(true);
    try {
      await adminService.resetUserPassword(userId, { newPassword });
      // Notification is handled automatically by axios interceptor
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Submit toggle active status
  const handleToggleStatus = async () => {
    if (!user) return;
    if (user.id === currentAdmin?.id) {
      toast.error('Bạn không thể tự khóa tài khoản quản trị của chính mình');
      return;
    }

    setIsTogglingStatus(true);
    try {
      const updated = await adminService.toggleUserStatus(userId);
      setUser(updated);
      // Notification is handled automatically by axios interceptor
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const isCurrentAdmin = user?.id === currentAdmin?.id;
  const isSsoUser = Boolean(user?.authProvider && user.authProvider !== 'LOCAL');

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-16 text-center text-zinc-500">
        <div className="w-8 h-8 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Đang tải thông tin tài khoản...
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại Danh sách Người dùng
        </Link>
      </div>

      {/* Hero User Profile Card */}
      <div className="relative p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6">
          <div className="flex items-start sm:items-center gap-3.5 sm:gap-5 min-w-0">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl bg-gradient-to-tr from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700 text-zinc-800 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-inner shrink-0">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
            </div>

            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 break-words">
                  {user.fullName}
                </h1>
                {isCurrentAdmin && (
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium shrink-0">
                    Tài khoản của bạn
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 font-mono break-all">
                <span>@{user.username}</span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className="break-all">{user.email}</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
                {/* Role Badge */}
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border shrink-0 ${user.role === 'ADMIN'
                      ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/60'
                      : user.role === 'TEACHER'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/60'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/60'
                    }`}
                >
                  {user.role === 'ADMIN' ? 'Quản trị viên' : user.role === 'TEACHER' ? 'Giáo viên' : 'Học sinh'}
                </span>

                {/* Status Badge */}
                {user.isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Đang hoạt động
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Đã khóa
                  </span>
                )}

                {/* Auth Provider */}
                <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 shrink-0">
                  {isSsoUser ? `SSO (${user.authProvider})` : 'Nội bộ'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col sm:items-center md:items-end justify-start md:justify-center text-xs text-zinc-500 space-y-1.5 border-t md:border-t-0 pt-3 md:pt-0 border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Tham gia: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>
                Đăng nhập gần nhất: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('vi-VN') : 'Chưa từng'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form & Governance Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Edit Profile (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Thông tin Tài khoản</CardTitle>
                <CardDescription>
                  Chỉnh sửa thông tin định danh người dùng bao gồm họ tên, tên đăng nhập và địa chỉ email.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <Input
                  label="Họ và tên *"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Tên đăng nhập *"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                    required
                  />

                  <Input
                    label="Địa chỉ Email *"
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    required
                  />
                </div>

                {/* ID & Metadata Display */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                    Mã định danh (UUID)
                  </label>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="truncate mr-2">{user.id}</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                      title="Sao chép mã người dùng"
                    >
                      {isCopiedId ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isSavingProfile}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Lưu thay đổi
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Reset Password Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Bảo mật & Đặt lại Mật khẩu</CardTitle>
                <CardDescription>
                  Cấp trực tiếp mật khẩu mới cho tài khoản này mà không cần nhập mật khẩu cũ.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {isSsoUser ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Tài khoản liên kết SSO:</strong> Người dùng này đăng nhập thông qua nhà cung cấp tài khoản bên ngoài ({user.authProvider}). Mật khẩu được quản lý riêng và không thể đặt lại tại đây.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Mật khẩu mới *"
                      type="password"
                      placeholder="Ít nhất 6 ký tự"
                      showPasswordToggle
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />

                    <Input
                      label="Xác nhận mật khẩu mới *"
                      type="password"
                      placeholder="Nhập lại mật khẩu"
                      showPasswordToggle
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="secondary"
                      size="md"
                      isLoading={isSavingPassword}
                      leftIcon={<KeyRound className="w-4 h-4" />}
                    >
                      Cập nhật mật khẩu
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Roles & Governance Actions (1 col) */}
        <div className="space-y-6">
          {/* Role Governance Card */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Vai trò & Phân quyền</CardTitle>
                <CardDescription>Điều chỉnh quyền hạn truy cập của người dùng trên toàn hệ thống.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isCurrentAdmin && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    Cơ chế tự bảo vệ ngăn bạn tự hạ quyền quản trị viên của chính mình.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {(['STUDENT', 'TEACHER', 'ADMIN'] as UserRole[]).map((r) => {
                  const isSelected = selectedRole === r;
                  const isDemotingSelf = isCurrentAdmin && r !== 'ADMIN';

                  const roleLabelMap: Record<UserRole, { name: string; desc: string }> = {
                    ADMIN: { name: 'Quản trị viên', desc: 'Toàn quyền quản trị hệ thống' },
                    TEACHER: { name: 'Giáo viên', desc: 'Soạn đề & chấm bài thi' },
                    STUDENT: { name: 'Học sinh', desc: 'Tham gia thi & xem kết quả' },
                  };

                  return (
                    <label
                      key={r}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${isSelected
                          ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800'
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                        } ${isDemotingSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="roleOption"
                          value={r}
                          checked={isSelected}
                          disabled={isDemotingSelf}
                          onChange={() => setSelectedRole(r)}
                          className="text-zinc-900 focus:ring-zinc-900"
                        />
                        <div>
                          <div className="font-semibold text-sm">{roleLabelMap[r].name}</div>
                          <div className="text-[11px] text-zinc-500">
                            {roleLabelMap[r].desc}
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleUpdateRole}
                disabled={selectedRole === user.role}
                isLoading={isSavingRole}
              >
                Lưu thay đổi vai trò
              </Button>
            </CardContent>
          </Card>

          {/* Account Status Governance */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Trạng thái Tài khoản</CardTitle>
                <CardDescription>Khóa hoặc mở khóa quyền đăng nhập vào hệ thống.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800">
                <div>
                  <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                    Trạng thái: {user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {user.isActive
                      ? 'Người dùng có thể đăng nhập & tham gia thi'
                      : 'Quyền truy cập hiện đang bị hạn chế'}
                  </div>
                </div>

                {user.isActive ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-500" />
                )}
              </div>

              <Button
                variant={user.isActive ? 'danger' : 'secondary'}
                size="sm"
                className="w-full"
                disabled={isCurrentAdmin}
                onClick={handleToggleStatus}
                isLoading={isTogglingStatus}
                leftIcon={user.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              >
                {user.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
              </Button>

              {isCurrentAdmin && (
                <p className="text-[11px] text-zinc-400 text-center">
                  Bạn không thể tự khóa tài khoản quản trị của chính mình.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
