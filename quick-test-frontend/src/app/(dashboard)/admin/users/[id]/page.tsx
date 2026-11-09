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
  BookOpen,
  GraduationCap,
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
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Danh sách người dùng</span>
        </Link>
      </div>

      {/* Hero User Profile Card */}
      <div className="relative p-4 sm:p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
            {/* User Avatar */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black text-lg sm:text-xl bg-gradient-to-tr from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 text-zinc-800 dark:text-zinc-100 border border-zinc-200/80 dark:border-zinc-700/80 shadow-inner shrink-0">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
            </div>

            {/* User Identity Details */}
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <h1 className="text-base sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                  {user.fullName}
                </h1>
                {isCurrentAdmin && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold shrink-0">
                    Bạn
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate">
                <span>@{user.username}</span>
                <span className="text-zinc-300 dark:text-zinc-700">•</span>
                <span className="truncate">{user.email}</span>
              </div>

              {/* Status and Role Badges */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {/* Role Badge */}
                <span
                  className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1 shrink-0 ${
                    user.role === 'ADMIN'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                      : user.role === 'TEACHER'
                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {user.role === 'ADMIN' ? (
                    <>
                      <Shield className="w-3 h-3" />
                      Quản trị viên
                    </>
                  ) : user.role === 'TEACHER' ? (
                    <>
                      <BookOpen className="w-3 h-3" />
                      Giáo viên
                    </>
                  ) : (
                    <>
                      <GraduationCap className="w-3 h-3" />
                      Học sinh
                    </>
                  )}
                </span>

                {/* Status Badge */}
                {user.isActive ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Đang hoạt động
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2.5 py-0.5 rounded-full border border-rose-500/20 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    Đã khóa
                  </span>
                )}

                {/* SSO Provider Badge (Only shown if SSO) */}
                {isSsoUser && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                    SSO ({user.authProvider})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Registration & Login Metadata Chips */}
          <div className="flex sm:flex-col items-start sm:items-end justify-between sm:justify-center text-[11px] text-zinc-400 gap-1.5 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-zinc-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>Tham gia: {user.createdAt ? new Date(user.createdAt).toLocaleDateString('vi-VN') : '—'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              <span>
                Đăng nhập: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString('vi-VN') : 'Chưa từng'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Form & Governance Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Edit Profile & Password (2 cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Card 1: Account Information */}
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-sm sm:text-base">Thông tin tài khoản</CardTitle>
                <CardDescription className="text-xs">Cập nhật họ tên, tài khoản và email</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                <Input
                  label="Họ và tên *"
                  value={profileForm.fullName}
                  onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                  required
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

                {/* Compact UUID Pill */}
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                    Mã người dùng (UUID)
                  </label>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 font-mono text-xs text-zinc-500">
                    <span className="truncate mr-2 select-all">{user.id}</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors shrink-0"
                      title="Sao chép UUID"
                    >
                      {isCopiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSavingProfile}
                    leftIcon={<Save className="w-4 h-4" />}
                  >
                    Lưu thông tin
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Card 2: Security & Password */}
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-sm sm:text-base">Bảo mật & Mật khẩu</CardTitle>
                <CardDescription className="text-xs">Cấp mật khẩu mới cho tài khoản</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {isSsoUser ? (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Tài khoản SSO ({user.authProvider}):</strong> Mật khẩu do hệ thống bên ngoài quản lý và không thể đặt lại tại đây.
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <Input
                      label="Mật khẩu mới *"
                      type="password"
                      placeholder="Tối thiểu 6 ký tự"
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

                  <div className="flex justify-end pt-1">
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
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
        <div className="space-y-5">
          {/* Card 3: Role Governance */}
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-sm sm:text-base">Phân quyền vai trò</CardTitle>
                <CardDescription className="text-xs">Quyền hạn truy cập trên hệ thống</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {isCurrentAdmin && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] leading-tight">Không thể tự hạ quyền quản trị của chính bạn.</span>
                </div>
              )}

              {/* Interactive Role Cards */}
              <div className="space-y-2">
                {(
                  [
                    {
                      role: 'ADMIN' as UserRole,
                      name: 'Quản trị viên',
                      desc: 'Toàn quyền điều hành hệ thống',
                      icon: Shield,
                      activeColor: 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400',
                    },
                    {
                      role: 'TEACHER' as UserRole,
                      name: 'Giáo viên',
                      desc: 'Soạn đề thi & chấm điểm',
                      icon: BookOpen,
                      activeColor: 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400',
                    },
                    {
                      role: 'STUDENT' as UserRole,
                      name: 'Học sinh',
                      desc: 'Tham gia thi & xem điểm',
                      icon: GraduationCap,
                      activeColor: 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400',
                    },
                  ]
                ).map(({ role: r, name, desc, icon: Icon, activeColor }) => {
                  const isSelected = selectedRole === r;
                  const isDemotingSelf = isCurrentAdmin && r !== 'ADMIN';

                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={isDemotingSelf}
                      onClick={() => setSelectedRole(r)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 ${
                        isSelected
                          ? `${activeColor} ring-1 ring-current`
                          : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'
                      } ${isDemotingSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-current/10' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                            {name}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {desc}
                          </div>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-current flex items-center justify-center text-white shrink-0 ml-2">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
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
                Lưu vai trò
              </Button>
            </CardContent>
          </Card>

          {/* Card 4: Account Status Governance */}
          <Card>
            <CardHeader className="pb-3">
              <div>
                <CardTitle className="text-sm sm:text-base">Trạng thái tài khoản</CardTitle>
                <CardDescription className="text-xs">Khóa hoặc mở quyền đăng nhập</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3.5">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      user.isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    }`}
                  >
                    {user.isActive ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      {user.isActive ? 'Đang hoạt động' : 'Tài khoản đã khóa'}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      {user.isActive ? 'Quyền truy cập bình thường' : 'Đang bị chặn đăng nhập'}
                    </div>
                  </div>
                </div>
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
