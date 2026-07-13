import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  error: string | null;
  login: (loginInput: string, passwordInput: string) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

const AUTH_TOKEN_KEY = 'goldquant_auth_token';

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  token: null,
  error: null,

  login: async (loginInput, passwordInput) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          login: loginInput,
          password: passwordInput,
        }),
      });

      const data = await response.json();
      if (data.success && data.token) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(AUTH_TOKEN_KEY, data.token);
        }
        set({ isAuthenticated: true, token: data.token, isLoading: false, error: null });
        return true;
      } else {
        set({ isLoading: false, error: data.error || 'Sai tài khoản hoặc mật khẩu' });
        return false;
      }
    } catch (err) {
      console.error('Login error:', err);
      set({ isLoading: false, error: 'Không thể kết nối đến hệ thống xác thực' });
      return false;
    }
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    set({ isAuthenticated: false, token: null, error: null });
  },

  checkAuth: async () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      set({ isAuthenticated: false, token: null, isLoading: false });
      return;
    }

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          token,
        }),
      });

      const data = await response.json();
      if (data.success) {
        set({ isAuthenticated: true, token, isLoading: false });
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        set({ isAuthenticated: false, token: null, isLoading: false });
      }
    } catch (err) {
      console.error('CheckAuth error:', err);
      // Offline soft-auth: tin token đã lưu cho đến khi verify thành công lần sau
      set({ isAuthenticated: true, token, isLoading: false });
    }
  },
}));
