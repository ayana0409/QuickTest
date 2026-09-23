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
  const { user: currentAdmin, isAuthenticated } = useAuthStore();

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
    } catch (error: any) {
      console.error('Failed to fetch user list:', error);
      toast.error(error?.response?.data?.message || 'Failed to load user accounts');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchKeyword, selectedRole, selectedStatus]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    fetchUsers();
  }, [isAuthenticated, router, fetchUsers]);

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
      toast.error('Please fill in all required fields');
      return;
    }
    if (createForm.password.length < 6) {
      toast.error('Password must be at least 6 characters');
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

      toast.success('User account created successfully');
      setIsCreateModalOpen(false);
      setCreateForm({
        username: '',
        email: '',
        fullName: '',
        password: '',
        role: 'STUDENT',
      });
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create user account');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetUser) return;
    if (newPasswordInput.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setIsSubmittingReset(true);
    try {
      await adminService.resetUserPassword(selectedTargetUser.id, {
        newPassword: newPasswordInput,
      });
      toast.success(`Password reset successfully for @${selectedTargetUser.username}`);
      setIsResetPasswordModalOpen(false);
      setNewPasswordInput('');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to reset password');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Handle Change Role
  const handleChangeRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTargetUser) return;

    if (selectedTargetUser.id === currentAdmin?.id && newRoleSelect !== 'ADMIN') {
      toast.error('You cannot remove the ADMIN role from your own account');
      return;
    }

    setIsSubmittingRole(true);
    try {
      await adminService.updateUserRole(selectedTargetUser.id, newRoleSelect);
      toast.success(`Role updated to ${newRoleSelect} for @${selectedTargetUser.username}`);
      setIsChangeRoleModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update user role');
    } finally {
      setIsSubmittingRole(false);
    }
  };

  // Handle Toggle Active/Inactive Status
  const handleToggleStatus = async () => {
    if (!selectedTargetUser) return;

    if (selectedTargetUser.id === currentAdmin?.id) {
      toast.error('You cannot deactivate your own account');
      return;
    }

    setIsSubmittingToggle(true);
    try {
      const updated = await adminService.toggleUserStatus(selectedTargetUser.id);
      const actionName = updated.isActive ? 'activated' : 'deactivated';
      toast.success(`Account @${selectedTargetUser.username} has been ${actionName}`);
      setIsToggleStatusModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update account status');
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
            ADMIN
          </span>
        );
      case 'TEACHER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/60">
            TEACHER
          </span>
        );
      case 'STUDENT':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
            STUDENT
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
              User Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {totalElements} Total
            </span>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Govern user accounts, assign roles, reset credentials, and manage platform permissions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={fetchUsers}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Create User
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
              placeholder="Search by username, email, or full name..."
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
              <option value="ALL">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="TEACHER">Teacher</option>
              <option value="STUDENT">Student</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full sm:w-auto px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Deactivated</option>
            </select>

            <Button type="submit" variant="secondary" size="md" className="col-span-2 sm:col-span-1">
              Filter
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
                <th className="py-3.5 px-4 sm:px-6">User</th>
                <th className="py-3.5 px-4">Contact & Auth</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-400" />
                    Loading accounts...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                    No user accounts found matching your criteria.
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
                                  You
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
                              SSO ({u.authProvider})
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                              Local Auth
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
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            Deactivated
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-4 px-4 text-xs text-zinc-500 dark:text-zinc-400">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Detail Button */}
                          <Link href={`/admin/users/${u.id}`}>
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                              title="View user details"
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
                            title="Assign role"
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
                            title={isSsoUser ? 'Password reset unavailable for SSO accounts' : 'Reset password'}
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
                                ? 'Cannot deactivate your own account'
                                : u.isActive
                                ? 'Deactivate account'
                                : 'Activate account'
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
            Showing {users.length > 0 ? currentPage * pageSize + 1 : 0} to{' '}
            {Math.min((currentPage + 1) * pageSize, totalElements)} of {totalElements} users
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Previous
            </Button>
            <span className="font-medium text-zinc-700 dark:text-zinc-300 px-1">
              Page {totalPages > 0 ? currentPage + 1 : 0} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1 || isLoading}
              onClick={() => setCurrentPage((p) => p + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
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
        title="Create New User Account"
        description="Provision a new user account with customized roles and credentials."
        size="md"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmittingCreate}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateUser}
              isLoading={isSubmittingCreate}
            >
              Create Account
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <Input
            label="Full Name *"
            placeholder="e.g. John Doe"
            value={createForm.fullName}
            onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
            required
          />

          <Input
            label="Username *"
            placeholder="e.g. johndoe"
            value={createForm.username}
            onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
            required
          />

          <Input
            label="Email Address *"
            type="email"
            placeholder="e.g. john@example.com"
            value={createForm.email}
            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            required
          />

          <Input
            label="Password *"
            type="password"
            placeholder="At least 6 characters"
            showPasswordToggle
            value={createForm.password}
            onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            required
          />

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
              Assigned Role *
            </label>
            <select
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            >
              <option value="STUDENT">STUDENT (Assessment candidate)</option>
              <option value="TEACHER">TEACHER (Exam creator & grader)</option>
              <option value="ADMIN">ADMIN (System administrator)</option>
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
        title="Reset User Password"
        description={
          selectedTargetUser
            ? `Setting new credentials for ${selectedTargetUser.fullName} (@${selectedTargetUser.username})`
            : 'Reset credentials'
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
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleResetPassword}
              isLoading={isSubmittingReset}
            >
              Update Password
            </Button>
          </>
        }
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold mb-1">Administrative Override</p>
            This user will immediately be required to use this new password for subsequent logins.
          </div>

          <Input
            label="New Password *"
            type="password"
            placeholder="At least 6 characters"
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
        title="Update User Role"
        description={
          selectedTargetUser
            ? `Modify system role & permissions for @${selectedTargetUser.username}`
            : 'Modify system role'
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
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleChangeRole}
              isLoading={isSubmittingRole}
            >
              Save Role
            </Button>
          </>
        }
      >
        <form onSubmit={handleChangeRole} className="space-y-4">
          {selectedTargetUser?.id === currentAdmin?.id && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <strong>Self-protection active:</strong> You are editing your own administrator
                account. You cannot demote yourself.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Select Role
            </label>
            <div className="space-y-2">
              {(['STUDENT', 'TEACHER', 'ADMIN'] as UserRole[]).map((r) => {
                const isSelected = newRoleSelect === r;
                const isDemotingSelf =
                  selectedTargetUser?.id === currentAdmin?.id && r !== 'ADMIN';

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
                        <div className="font-semibold text-sm">{r}</div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400">
                          {r === 'ADMIN'
                            ? 'Full administrative governance over platform'
                            : r === 'TEACHER'
                            ? 'Author exams, evaluate submissions, question banking'
                            : 'Participate in assessments and view results'}
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
        title={selectedTargetUser?.isActive ? 'Deactivate Account' : 'Activate Account'}
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsToggleStatusModalOpen(false)}
              disabled={isSubmittingToggle}
            >
              Cancel
            </Button>
            <Button
              variant={selectedTargetUser?.isActive ? 'danger' : 'primary'}
              size="sm"
              onClick={handleToggleStatus}
              isLoading={isSubmittingToggle}
            >
              {selectedTargetUser?.isActive ? 'Confirm Deactivate' : 'Confirm Activate'}
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
                Are you sure you want to <strong>deactivate</strong> this account? The user will be
                immediately blocked from signing in and interacting with examinations.
              </>
            ) : (
              <>
                Are you sure you want to <strong>reactivate</strong> this account? The user will
                regain access to the platform.
              </>
            )}
          </p>
        </div>
      </Modal>
    </div>
  );
}
