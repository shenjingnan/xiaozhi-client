import React from 'react';
import { useAuth } from '@/providers/AuthProvider';
import LoginPage from '@/pages/LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 受保护的路由组件
 * 如果用户未认证且启用了认证功能，则显示登录页面
 * 否则显示子组件
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isAuthEnabled, isLoading } = useAuth();

  // 加载中显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">正在加载...</p>
        </div>
      </div>
    );
  }

  // 如果未启用认证，或者已认证，则显示子组件
  if (!isAuthEnabled || isAuthenticated) {
    return <>{children}</>;
  }

  // 否则显示登录页面
  return <LoginPage />;
};

export default ProtectedRoute;
