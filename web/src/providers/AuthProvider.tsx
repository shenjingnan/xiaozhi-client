import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthService, type AuthUser, type AuthStatus } from '@/services/AuthService';

interface AuthContextType {
  isAuthenticated: boolean;
  isAuthEnabled: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthEnabled, setIsAuthEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  // 检查认证状态
  const checkAuth = async () => {
    try {
      setIsLoading(true);
      
      // 首先检查是否启用了认证
      const authStatus: AuthStatus = await AuthService.getAuthStatus();
      setIsAuthEnabled(authStatus.enabled);
      
      if (!authStatus.enabled) {
        // 如果未启用认证，则视为已认证状态
        setIsAuthenticated(true);
        setUser({ username: 'admin', role: 'admin' });
        return;
      }
      
      // 如果启用了认证，检查token是否有效
      const isValid = await AuthService.verifyToken();
      setIsAuthenticated(isValid);
      
      if (!isValid) {
        setUser(null);
      }
    } catch (error) {
      console.error('检查认证状态失败:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // 登录
  const login = async (username: string, password: string) => {
    try {
      const result = await AuthService.login({ username, password });
      
      if (result.success) {
        setIsAuthenticated(true);
        setUser({ username, role: 'admin' });
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('登录失败:', error);
      return { success: false, message: '登录过程中发生错误' };
    }
  };

  // 登出
  const logout = async () => {
    try {
      await AuthService.logout();
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  // 初始化时检查认证状态
  useEffect(() => {
    checkAuth();
  }, []);

  // 定期检查token有效性（如果启用了认证）
  useEffect(() => {
    if (!isAuthEnabled || !isAuthenticated) {
      return;
    }

    const interval = setInterval(async () => {
      const isValid = await AuthService.verifyToken();
      if (!isValid) {
        setIsAuthenticated(false);
        setUser(null);
      }
    }, 5 * 60 * 1000); // 每5分钟检查一次

    return () => clearInterval(interval);
  }, [isAuthEnabled, isAuthenticated]);

  const value: AuthContextType = {
    isAuthenticated,
    isAuthEnabled,
    isLoading,
    user,
    login,
    logout,
    checkAuth,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
