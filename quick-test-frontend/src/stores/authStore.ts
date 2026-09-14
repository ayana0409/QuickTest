import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Role } from '@/types/auth';
import { setAuthCookie, getAuthCookie, removeAuthCookie, setRefreshTokenCookie, getRefreshTokenCookie, removeRefreshTokenCookie } from '@/lib/cookie';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setRefreshToken: (refreshToken: string) => void;
  initializeAuth: () => void;
  hasRole: (role: Role | string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: (token: string, refreshToken: string, user: User) => {
        // Dual-Storage: persist token in both Cookie (for Next.js Middleware) and localStorage
        setAuthCookie(token);
        setRefreshTokenCookie(refreshToken);

        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          localStorage.setItem('accessToken', token);
          localStorage.setItem('refreshToken', refreshToken);
        }

        set({
          token,
          refreshToken,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        // Clear Dual-Storage: delete cookie and local storage keys
        removeAuthCookie();
        removeRefreshTokenCookie();

        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setUser: (user: User) => {
        set({ user });
      },

      setToken: (token: string) => {
        setAuthCookie(token);

        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
          localStorage.setItem('accessToken', token);
        }

        set({ token, isAuthenticated: !!token });
      },

      setRefreshToken: (refreshToken: string) => {
        setRefreshTokenCookie(refreshToken);

        if (typeof window !== 'undefined') {
          localStorage.setItem('refreshToken', refreshToken);
        }

        set({ refreshToken });
      },

      initializeAuth: () => {
        if (typeof window === 'undefined') return;

        const cookieToken = getAuthCookie();
        const localToken = localStorage.getItem('token') || localStorage.getItem('accessToken');
        const token = cookieToken || localToken;

        const cookieRefreshToken = getRefreshTokenCookie();
        const localRefreshToken = localStorage.getItem('refreshToken');
        const refreshToken = cookieRefreshToken || localRefreshToken;

        if (token) {
          // Keep cookie and localStorage in sync
          if (!cookieToken) {
            setAuthCookie(token);
          }
          if (!localToken) {
            localStorage.setItem('token', token);
            localStorage.setItem('accessToken', token);
          }
          if (refreshToken) {
             if (!cookieRefreshToken) setRefreshTokenCookie(refreshToken);
             if (!localRefreshToken) localStorage.setItem('refreshToken', refreshToken);
          }

          const currentToken = get().token;
          if (!currentToken) {
            set({ token, refreshToken, isAuthenticated: true });
          }
        } else if (get().isAuthenticated) {
          // Token vanished from both storages
          set({ user: null, token: null, refreshToken: null, isAuthenticated: false });
        }
      },

      hasRole: (expectedRole: Role | string) => {
        const currentUser = get().user;
        if (!currentUser) return false;

        // Extract list of assigned roles from UserSummaryDto roles array or fallback single role
        const userRoles: string[] = Array.isArray(currentUser.roles) && currentUser.roles.length > 0
          ? currentUser.roles
          : currentUser.role
          ? [currentUser.role]
          : [];

        if (userRoles.length === 0) return false;

        const normalizedRoles = userRoles.map((r) => r.replace(/^ROLE_/, '').toUpperCase());
        const normalizedTarget = expectedRole.replace(/^ROLE_/, '').toUpperCase();

        // ADMIN has super-user access to all views
        if (normalizedRoles.includes('ADMIN')) {
          return true;
        }

        return normalizedRoles.includes(normalizedTarget);
      },
    }),
    {
      name: 'quicktest_auth_store',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
