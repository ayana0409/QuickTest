'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  KeyRound,
  Lock,
  Unlock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Eye,
  AlertTriangle,
  UserCheck,
  GraduationCap,
  X,
  EyeOff,
  BookOpen,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
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
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
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

  // Reset all filters
  const handleResetFilters = () => {
    setSearchKeyword('');
    setSelectedRole('ALL');
    setSelectedStatus('ALL');
    setCurrentPage(0);
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

      toast.success('Đã tạo tài khoản người dùng thành công!');
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
      toast.success('Đã đặt lại mật khẩu mới thành công!');
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
      toast.success('Đã cập nhật vai trò người dùng thành công!');
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
      toast.success(selectedTargetUser.isActive ? 'Đã khóa tài khoản thành công!' : 'Đã mở khóa tài khoản thành công!');
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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
            <Shield className="w-3 h-3" />
            Quản trị viên
          </span>
        );
      case 'TEACHER':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
            <UserCheck className="w-3 h-3" />
            Giáo viên
          </span>
        );
      case 'STUDENT':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
            <GraduationCap className="w-3 h-3" />
            Học sinh
          </span>
        );
    }
  };

  const isFiltered = searchKeyword || selectedRole !== 'ALL' || selectedStatus !== 'ALL';

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-16 font-sans">
      {/* Top Header & Actions (Synchronized with /admin/ai and /admin/moderation) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Quản lý Người dùng
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
              {totalElements} tài khoản
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Quản lý tài khoản người dùng, phân quyền vai trò và điều phối truy cập
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={fetchUsers}
            disabled={isLoading}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors shadow-2xs flex items-center gap-1.5 whitespace-nowrap"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-500 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            <span className="hidden md:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 active:scale-95 transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Thêm người dùng</span>
          </button>
        </div>
      </div>

      {/* 4 Interactive Role Metric Cards (Click to filter by role) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Card 1: All Users */}
        <button
          type="button"
          onClick={() => {
            setSelectedRole('ALL');
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedRole === 'ALL'
              ? 'border-indigo-600 bg-white dark:bg-zinc-900 ring-2 ring-indigo-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate">
              Tất cả tài khoản
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {totalElements}
            </span>
          </div>
        </button>

        {/* Card 2: Teachers */}
        <button
          type="button"
          onClick={() => {
            setSelectedRole((prev) => (prev === 'TEACHER' ? 'ALL' : 'TEACHER'));
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedRole === 'TEACHER'
              ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-indigo-300 dark:hover:border-indigo-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate">
              Giáo viên
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {selectedRole === 'TEACHER' ? totalElements : 'Lọc'}
            </span>
          </div>
        </button>

        {/* Card 3: Students */}
        <button
          type="button"
          onClick={() => {
            setSelectedRole((prev) => (prev === 'STUDENT' ? 'ALL' : 'STUDENT'));
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedRole === 'STUDENT'
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 ring-2 ring-emerald-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-300 dark:hover:border-emerald-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 truncate">
              Học sinh
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {selectedRole === 'STUDENT' ? totalElements : 'Lọc'}
            </span>
          </div>
        </button>

        {/* Card 4: Admins */}
        <button
          type="button"
          onClick={() => {
            setSelectedRole((prev) => (prev === 'ADMIN' ? 'ALL' : 'ADMIN'));
            setCurrentPage(0);
          }}
          className={`p-3.5 sm:p-4 rounded-2xl border text-left transition-all duration-200 shadow-2xs flex flex-col justify-between ${
            selectedRole === 'ADMIN'
              ? 'border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 ring-2 ring-rose-500/20'
              : 'border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-rose-300 dark:hover:border-rose-800/60'
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] sm:text-xs font-semibold text-rose-600 dark:text-rose-400 truncate">
              Quản trị viên
            </span>
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-lg sm:text-2xl font-bold text-rose-600 dark:text-rose-400">
              {selectedRole === 'ADMIN' ? totalElements : 'Lọc'}
            </span>
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Tìm theo tên, email hoặc tài khoản..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full pl-9 pr-9 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-800/50 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          {searchKeyword && (
            <button
              type="button"
              onClick={() => {
                setSearchKeyword('');
                setCurrentPage(0);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>

        {/* Secondary Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Select */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(0);
            }}
            className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70 text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Đã khóa</option>
          </select>

          {/* Reset Filters */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-2 py-1 text-xs text-zinc-500 hover:text-rose-600 transition-colors whitespace-nowrap underline"
            >
              Đặt lại
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Desktop Table + Mobile Card List */}
      {isLoading ? (
        <div className="py-20 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-2" />
          <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Đang tải danh sách người dùng...
          </p>
        </div>
      ) : users.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-800 p-6 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100">
              Không tìm thấy tài khoản nào
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto mt-1">
              Không có người dùng nào khớp với bộ lọc tìm kiếm hiện tại.
            </p>
          </div>
          {isFiltered && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              Đặt lại bộ lọc
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 1. Desktop Table View (Hidden on mobile) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/80 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Người dùng</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Vai trò</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4">Ngày tạo</th>
                  <th className="py-3 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {users.map((u) => {
                  const isCurrentAdmin = u.id === currentAdmin?.id;
                  const isSsoUser = Boolean(u.authProvider && u.authProvider !== 'LOCAL');

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      {/* User Info & Avatar */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                            {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                {u.fullName}
                              </span>
                              {isCurrentAdmin && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 whitespace-nowrap">
                                  Bạn
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              @{u.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email & SSO info */}
                      <td className="py-3.5 px-4">
                        <div className="text-zinc-700 dark:text-zinc-300 text-xs truncate max-w-[200px]">
                          {u.email}
                        </div>
                        {isSsoUser && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap mt-0.5 inline-block">
                            SSO ({u.authProvider})
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">{getRoleBadge(u.role)}</td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Đã khóa
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-xs text-zinc-400 whitespace-nowrap">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* View Detail Button */}
                          <Link href={`/admin/users/${u.id}`}>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="Xem chi tiết"
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
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
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
                                ? 'text-zinc-200 dark:text-zinc-800 cursor-not-allowed'
                                : 'text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                            }`}
                            title={isSsoUser ? 'Không hỗ trợ đổi mật khẩu SSO' : 'Đặt lại mật khẩu'}
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
                                ? 'text-zinc-200 dark:text-zinc-800 cursor-not-allowed'
                                : u.isActive
                                ? 'text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                : 'text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                            }`}
                            title={
                              isCurrentAdmin
                                ? 'Không thể tự khóa tài khoản của bạn'
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
                })}
              </tbody>
            </table>
          </div>

          {/* 2. Mobile Responsive Card List (NO horizontal scrolling on small screens!) */}
          <div className="md:hidden space-y-3">
            {users.map((u) => {
              const isCurrentAdmin = u.id === currentAdmin?.id;
              const isSsoUser = Boolean(u.authProvider && u.authProvider !== 'LOCAL');

              return (
                <div
                  key={u.id}
                  className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs space-y-3"
                >
                  {/* Top Row: User Avatar & Role */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700/60 shrink-0">
                        {u.fullName ? u.fullName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                            {u.fullName}
                          </span>
                          {isCurrentAdmin && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500 whitespace-nowrap">
                              Bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono truncate">
                          @{u.username}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {getRoleBadge(u.role)}
                    </div>
                  </div>

                  {/* Contact info & Status */}
                  <div className="flex items-center justify-between text-xs text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800/80 gap-2">
                    <span className="truncate max-w-[200px]">{u.email}</span>
                    {u.isActive ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Hoạt động
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        Đã khóa
                      </span>
                    )}
                  </div>

                  {/* Action Bar (One-touch buttons) */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <span className="text-[11px] text-zinc-400">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—'}
                    </span>

                    <div className="flex items-center gap-1">
                      <Link href={`/admin/users/${u.id}`}>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTargetUser(u);
                          setNewRoleSelect(u.role);
                          setIsChangeRoleModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                        title="Phân quyền vai trò"
                      >
                        <Shield className="w-4 h-4" />
                      </button>

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
                            ? 'text-zinc-200 dark:text-zinc-800 cursor-not-allowed'
                            : 'text-zinc-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                        }`}
                        title={isSsoUser ? 'Không hỗ trợ tài khoản SSO' : 'Đặt lại mật khẩu'}
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={isCurrentAdmin}
                        onClick={() => {
                          setSelectedTargetUser(u);
                          setIsToggleStatusModalOpen(true);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isCurrentAdmin
                            ? 'text-zinc-200 dark:text-zinc-800 cursor-not-allowed'
                            : u.isActive
                            ? 'text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                            : 'text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                        }`}
                        title={u.isActive ? 'Khóa' : 'Mở khóa'}
                      >
                        {u.isActive ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <Unlock className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-zinc-200/80 dark:border-zinc-800 flex-wrap">
          <div className="text-xs text-zinc-400">
            Trang <strong className="text-zinc-800 dark:text-zinc-200">{currentPage + 1}</strong> / {totalPages} ({totalElements} tài khoản)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 0))}
              disabled={currentPage === 0 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" /> Trước
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages - 1))}
              disabled={currentPage >= totalPages - 1 || isLoading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors shadow-2xs"
            >
              Sau <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE USER (With Sticky Action Footer) */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-600" />
                Tạo tài khoản người dùng
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Họ và tên <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Tên đăng nhập <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: nguyenvana"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Địa chỉ Email <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="nguyenvana@example.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Mật khẩu ban đầu <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    required
                    placeholder="Ít nhất 6 ký tự"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-1"
                  >
                    {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Vai trò chỉ định <span className="text-rose-500">*</span>
                </label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                  className="w-full px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="STUDENT">Học sinh (Làm bài thi)</option>
                  <option value="TEACHER">Giáo viên (Soạn đề & chấm bài)</option>
                  <option value="ADMIN">Quản trị viên (Toàn quyền)</option>
                </select>
              </div>

              {/* Sticky Action Footer */}
              <div className="sticky bottom-0 bg-white dark:bg-zinc-900 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmittingCreate}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isSubmittingCreate ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RESET PASSWORD */}
      {/* ========================================================================= */}
      {isResetPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xl overflow-hidden p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Đặt lại mật khẩu
                  </h3>
                  <p className="text-[11px] text-zinc-400">Cấp mật khẩu mới trực tiếp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target User Info Mini-Banner */}
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center shrink-0">
                {selectedTargetUser?.fullName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {selectedTargetUser?.fullName}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono truncate">
                  @{selectedTargetUser?.username}
                </div>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Mật khẩu mới <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 text-xs sm:text-sm font-mono focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                  >
                    {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetPasswordModalOpen(false)}
                  disabled={isSubmittingReset}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReset}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-600/20 disabled:opacity-50 transition-all"
                >
                  {isSubmittingReset ? 'Đang lưu...' : 'Lưu mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CHANGE ROLE */}
      {/* ========================================================================= */}
      {isChangeRoleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xl overflow-hidden p-5 space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Phân quyền vai trò
                  </h3>
                  <p className="text-[11px] text-zinc-400">Chọn vai trò hệ thống mới</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangeRoleModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target User Info Mini-Banner */}
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center shrink-0">
                {selectedTargetUser?.fullName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {selectedTargetUser?.fullName}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono truncate">
                  @{selectedTargetUser?.username}
                </div>
              </div>
            </div>

            <form onSubmit={handleChangeRole} className="space-y-4">
              {selectedTargetUser?.id === currentAdmin?.id && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] leading-tight">Không thể tự hạ quyền quản trị của chính bạn.</span>
                </div>
              )}

              {/* Linear-style Interactive Role Cards */}
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
                  const isSelected = newRoleSelect === r;
                  const isDemotingSelf = selectedTargetUser?.id === currentAdmin?.id && r !== 'ADMIN';

                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={isDemotingSelf}
                      onClick={() => setNewRoleSelect(r)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all duration-200 ${
                        isSelected
                          ? `${activeColor} ring-1 ring-current`
                          : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/60'
                      } ${isDemotingSelf ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-current/10' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}>
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

              {/* Action Buttons */}
              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangeRoleModalOpen(false)}
                  disabled={isSubmittingRole}
                  className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRole || newRoleSelect === selectedTargetUser?.role}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/20 disabled:opacity-50 transition-all"
                >
                  {isSubmittingRole ? 'Đang lưu...' : 'Lưu vai trò'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: CONFIRM TOGGLE STATUS */}
      {/* ========================================================================= */}
      {isToggleStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  selectedTargetUser?.isActive
                    ? 'bg-rose-500/10 text-rose-600'
                    : 'bg-emerald-500/10 text-emerald-600'
                }`}
              >
                {selectedTargetUser?.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {selectedTargetUser?.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {selectedTargetUser?.isActive ? 'Tạm ngưng quyền truy cập hệ thống' : 'Khôi phục quyền truy cập'}
                </p>
              </div>
            </div>

            {/* Target User Info Mini-Banner */}
            <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-800 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold text-xs flex items-center justify-center shrink-0">
                {selectedTargetUser?.fullName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {selectedTargetUser?.fullName}
                </div>
                <div className="text-[11px] text-zinc-400 font-mono truncate">
                  @{selectedTargetUser?.username}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsToggleStatusModalOpen(false)}
                disabled={isSubmittingToggle}
                className="px-4 py-2 rounded-xl text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={isSubmittingToggle}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all disabled:opacity-50 ${
                  selectedTargetUser?.isActive
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                }`}
              >
                {isSubmittingToggle
                  ? 'Đang xử lý...'
                  : selectedTargetUser?.isActive
                  ? 'Khóa tài khoản'
                  : 'Mở khóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
