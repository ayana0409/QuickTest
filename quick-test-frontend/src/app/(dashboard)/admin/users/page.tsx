'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  KeyRound,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Badge } from '@/components/common/Badge';
import { Card } from '@/components/common/Card';
import { Modal } from '@/components/common/Modal';
import { adminService } from '@/services/admin.service';
import { useAuthStore } from '@/stores/authStore';
import type { PageResponse } from '@/types/exam';
import type { AdminUser, UserRole } from '@/types/admin';

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentAdmin, isAuthenticated, isInitialized, isLoggedIn } = useAuthStore();

  // State: User List & Pagination
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  // State: Filters
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // State: Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [isChangeRoleModalOpen, setIsChangeRoleModalOpen] = useState(false);
  const [isToggleStatusModalOpen, setIsToggleStatusModalOpen] = useState(false);

  // State: Selected target user for modal actions
  const [selectedTargetUser, setSelectedTargetUser] = useState<AdminUser | null>(null);

  // State: Form inputs
  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    role: 'STUDENT' as UserRole,
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  const [newRoleSelect, setNewRoleSelect] = useState<UserRole>('STUDENT');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  const [isSubmittingToggle, setIsSubmittingToggle] = useState(false);

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeParam =
        selectedStatus === 'ACTIVE' ? true : selectedStatus === 'INACTIVE' ? false : undefined;
      const roleParam = selectedRole === 'ALL' ? undefined : (selectedRole as UserRole);

      const data: PageResponse<AdminUser> = await adminService.listUsers({
        page: currentPage,
        size: pageSize,
        search: searchKeyword,
        role: roleParam,
        isActive: activeParam,
        sort: 'createdAt,desc',
      });

      setUsers(data.content || []);
      setTotalPages(data.totalPages || 0);
      setTotalElements(data.totalElements || 0);
    } catch (error) {
      console.error('Failed to fetch user list:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchKeyword, selectedRole, selectedStatus]);

  useEffect(() => {
    if (isAuthenticated || isLoggedIn()) {
      fetchUsers();
    }
  }, [isAuthenticated, isLoggedIn, fetchUsers]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(0);
    fetchUsers();
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username.trim() || !createForm.email.trim() || !createForm.password.trim() || !createForm.fullName.trim()) {
      toast.error('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }
    if (createForm.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      await adminService.createUser({
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        fullName: createForm.fullName.trim(),
        password: createForm.password,
        role: createForm.role,
      });

      // Notification is handled automatically by axios interceptor
      setIsCreateModalOpen(false);
      setCreateForm({
        username: '',
        email: '',
        fullName: '',
        password: '',
        role: 'STUDENT',
      });
      fetchUsers();
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetUser) return;
    if (newPasswordInput.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setIsSubmittingReset(true);
    try {
      await adminService.resetUserPassword(selectedTargetUser.id, {
        newPassword: newPasswordInput,
      });
      // Notification is handled automatically by axios interceptor
      setIsResetPasswordModalOpen(false);
      setNewPasswordInput('');
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Handle Change Role
  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetUser) return;

    if (selectedTargetUser.id === currentAdmin?.id && newRoleSelect !== 'ADMIN') {
      toast.error('Bạn không thể tự gỡ quyền Quản trị viên của chính mình');
      return;
    }

    setIsSubmittingRole(true);
    try {
      await adminService.updateUserRole(selectedTargetUser.id, newRoleSelect);
      // Notification is handled automatically by axios interceptor
      setIsChangeRoleModalOpen(false);
      fetchUsers();
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Handle Toggle Active/Inactive Status
  const handleToggleStatus = async () => {
    if (!selectedTargetUser) return;

    if (selectedTargetUser.id === currentAdmin?.id) {
      toast.error('Bạn không thể tự khóa tài khoản của chính mình');
      return;
    }

    setIsSubmittingToggle(true);
    try {
      await adminService.toggleUserStatus(selectedTargetUser.id);
      // Notification is handled automatically by axios interceptor
      setIsToggleStatusModalOpen(false);
      fetchUsers();
    } catch {
      // Error handled by global axios interceptor
    } finally {
      setIsSubmittingToggle(false);
    }
  };

  // Helper for role badge variant
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60">
            <Shield className="w-3 h-3" />
            Quản trị viên
          </span>
        );
      case 'TEACHER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60">
            Giáo viên
          </span>
        );
      case 'STUDENT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
            Học sinh
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Quản lý Người dùng
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Tổng số {totalElements} tài khoản
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Quản lý tài khoản người dùng, phân quyền vai trò, đặt lại mật khẩu và điều phối quyền truy cập hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchUsers}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Làm mới
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Thêm người dùng
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Tìm theo tên đăng nhập, email hoặc họ và tên..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-2.5 sm:gap-3">
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full sm:w-auto px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="ADMIN">Quản trị viên</option>
              <option value="TEACHER">Giáo viên</option>
              <option value="STUDENT">Học sinh</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full sm:w-auto px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Đã khóa</option>
            </select>

            <Button type="submit" variant="secondary" size="md" className="col-span-2 sm:col-span-1">
              Lọc
            </Button>
          </div>
        </form>
      </Card>

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[760px]">
            <thead className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/60 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Người dùng</th>
                <th className="py-3.5 px-4">Email & Đăng nhập</th>
                <th className="py-3.5 px-4">Vai trò</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Ngày tạo</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-400" />
                    Đang tải danh sách tài khoản...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                    Không tìm thấy tài khoản nào khớp với tiêu chí tìm kiếm.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrentAdmin = u.id === currentAdmin?.id;
                  const isSsoUser = Boolean(u.authProvider && u.authProvider !== 'LOCAL');

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      {/* User Info & Avatar */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-gradient-to-tr from-zinc-200 to-zinc-100 dark:from-zinc-800 dark:to-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                            {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {u.fullName}
                              </span>
                              {isCurrentAdmin && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Auth Provider */}
                      <td className="py-4 px-4">
                        <div className="text-sm text-zinc-700 dark:text-zinc-300">{u.email}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {isSsoUser ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                              Đăng nhập SSO ({u.authProvider})
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              Mật khẩu nội bộ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-4 px-4">{getRoleBadge(u.role)}</td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Đã khóa
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-4 px-4 text-xs text-zinc-500 dark:text-zinc-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Detail Button */}
                          <Link href={`/admin/users/${u.id}`}>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Xem chi tiết tài khoản"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </Link>

                          {/* Change Role Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTargetUser(u);
                              setNewRoleSelect(u.role);
                              setIsChangeRoleModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                            title="Phân quyền vai trò"
                          >
                            <Shield className="w-4 h-4" />
                          </button>

                          {/* Reset Password Button */}
                          <button
                            type="button"
                            disabled={isSsoUser}
                            onClick={() => {
                              setSelectedTargetUser(u);
                              setNewPasswordInput('');
                              setIsResetPasswordModalOpen(true);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSsoUser
                                ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
                                : 'text-zinc-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            }`}
                            title={isSsoUser ? 'Không hỗ trợ đặt lại mật khẩu cho tài khoản SSO' : 'Đặt lại mật khẩu'}
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Toggle Status Button */}
                          <button
                            type="button"
                            disabled={isCurrentAdmin}
                            onClick={() => {
                              setSelectedTargetUser(u);
                              setIsToggleStatusModalOpen(true);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isCurrentAdmin
                                ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
                                : u.isActive
                                ? 'text-zinc-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            title={
                              isCurrentAdmin
                                ? 'Không thể tự khóa tài khoản của chính mình'
                                : u.isActive
                                ? 'Khóa tài khoản'
                                : 'Mở khóa tài khoản'
                            }
                          >
                            {u.isActive ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Unlock className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-900/40 text-xs text-zinc-500">
          <div>
            Đang hiển thị {users.length > 0 ? currentPage * pageSize + 1 : 0} đến{' '}
            {Math.min((currentPage + 1) * pageSize, totalElements)} trong tổng số {totalElements} người dùng
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Trang trước
            </Button>
            <span className="font-medium text-zinc-700 dark:text-zinc-300 px-1">
              Trang {totalPages > 0 ? currentPage + 1 : 0} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1 || isLoading}
              onClick={() => setCurrentPage((p) => p + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Trang sau
            </Button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE USER */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Tạo tài khoản người dùng mới"
        description="Cấp tài khoản mới với vai trò và thông tin đăng nhập tương ứng."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmittingCreate}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateUser}
              isLoading={isSubmittingCreate}
            >
              Tạo tài khoản
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Họ và tên *"
            placeholder="Ví dụ: Nguyễn Văn A"
            value={createForm.fullName}
            onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
            required
          />

          <Input
            label="Tên đăng nhập *"
            placeholder="Ví dụ: nguyenvana"
            value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
            required
          />

          <Input
            label="Địa chỉ Email *"
            type="email"
            placeholder="Ví dụ: nguyenvana@example.com"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            required
          />

          <Input
            label="Mật khẩu ban đầu *"
            type="password"
            placeholder="Ít nhất 6 ký tự"
            showPasswordToggle
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Vai trò chỉ định *
            </label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="STUDENT">Học sinh (Thí sinh dự thi)</option>
              <option value="TEACHER">Giáo viên (Soạn đề & chấm thi)</option>
              <option value="ADMIN">Quản trị viên (Toàn quyền hệ thống)</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: RESET PASSWORD */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isResetPasswordModalOpen}
        onClose={() => setIsResetPasswordModalOpen(false)}
        title="Đặt lại mật khẩu tài khoản"
        description={
          selectedTargetUser
            ? `Cập nhật mật khẩu mới cho ${selectedTargetUser.fullName} (@${selectedTargetUser.username})`
            : 'Đặt lại mật khẩu'
        }
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsResetPasswordModalOpen(false)}
              disabled={isSubmittingReset}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResetPassword}
              isLoading={isSubmittingReset}
            >
              Lưu mật khẩu mới
            </Button>
          </>
        }
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold mb-1">Lưu ý quản trị</p>
            Người dùng sẽ cần sử dụng mật khẩu mới này cho những lần đăng nhập tiếp theo.
          </div>

          <Input
            label="Mật khẩu mới *"
            type="password"
            placeholder="Ít nhất 6 ký tự"
            showPasswordToggle
            value={newPasswordInput}
            onChange={(e) => setNewPasswordInput(e.target.value)}
            required
            autoFocus
          />
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: CHANGE ROLE */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isChangeRoleModalOpen}
        onClose={() => setIsChangeRoleModalOpen(false)}
        title="Cập nhật vai trò người dùng"
        description={
          selectedTargetUser
            ? `Thay đổi phân quyền hệ thống cho @${selectedTargetUser.username}`
            : 'Thay đổi phân quyền hệ thống'
        }
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsChangeRoleModalOpen(false)}
              disabled={isSubmittingRole}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleChangeRole}
              isLoading={isSubmittingRole}
            >
              Lưu vai trò
            </Button>
          </>
        }
      >
        <form onSubmit={handleChangeRole} className="space-y-4">
          {selectedTargetUser?.id === currentAdmin?.id && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Tự bảo vệ tài khoản:</strong> Bạn đang chỉnh sửa tài khoản quản trị của chính mình. Bạn không thể tự hạ quyền quản trị.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Chọn vai trò
            </label>
            <div className="space-y-2">
              {(['STUDENT', 'TEACHER', 'ADMIN'] as UserRole[]).map((r) => {
                const isSelected = newRoleSelect === r;
                const isDemotingSelf =
                  selectedTargetUser?.id === currentAdmin?.id && r !== 'ADMIN';

                const roleNameMap: Record<UserRole, string> = {
                  ADMIN: 'Quản trị viên',
                  TEACHER: 'Giáo viên',
                  STUDENT: 'Học sinh',
                };

                const roleDescMap: Record<UserRole, string> = {
                  ADMIN: 'Toàn quyền quản trị hệ thống và người dùng',
                  TEACHER: 'Soạn thảo đề thi, chấm điểm và giám sát kỳ thi',
                  STUDENT: 'Tham gia làm bài thi và xem kết quả',
                };

                return (
                  <label
                    key={r}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300'
                    } ${isDemotingSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="userRole"
                        value={r}
                        checked={isSelected}
                        disabled={isDemotingSelf}
                        onChange={() => setNewRoleSelect(r)}
                        className="text-zinc-900 focus:ring-zinc-900"
                      />
                      <div>
                        <div className="font-semibold text-sm">{roleNameMap[r]}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {roleDescMap[r]}
                        </div>
                      </div>
                    </div>
                    {getRoleBadge(r)}
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRM TOGGLE STATUS */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isToggleStatusModalOpen}
        onClose={() => setIsToggleStatusModalOpen(false)}
        title={selectedTargetUser?.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsToggleStatusModalOpen(false)}
              disabled={isSubmittingToggle}
            >
              Hủy bỏ
            </Button>
            <Button
              variant={selectedTargetUser?.isActive ? 'danger' : 'primary'}
              size="sm"
              onClick={handleToggleStatus}
              isLoading={isSubmittingToggle}
            >
              {selectedTargetUser?.isActive ? 'Xác nhận khóa' : 'Xác nhận mở khóa'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm bg-zinc-200 dark:bg-zinc-700">
              {selectedTargetUser?.fullName?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                {selectedTargetUser?.fullName}
              </div>
              <div className="text-xs text-zinc-500">@{selectedTargetUser?.username}</div>
            </div>
          </div>

          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {selectedTargetUser?.isActive ? (
              <>
                Bạn có chắc chắn muốn <strong>khóa</strong> tài khoản này không? Người dùng sẽ bị chặn đăng nhập và không thể tham gia các kỳ thi.
              </>
            ) : (
              <>
                Bạn có chắc chắn muốn <strong>mở khóa</strong> tài khoản này không? Người dùng sẽ được khôi phục quyền truy cập vào hệ thống.
              </>
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
}
