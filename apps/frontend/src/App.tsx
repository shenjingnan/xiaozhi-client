import { Toaster } from "@/components/ui/sonner";
import { RestartNotificationProvider } from "@/hooks/useRestartNotifications";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { Navigate, Route, Routes } from "react-router-dom";

function App() {
  return (
    <WebSocketProvider>
      {/* 重启通知管理器 - 全局监听重启状态变化 */}
      <RestartNotificationProvider />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

      {/* Toast 通知容器 */}
      <Toaster
        richColors
        closeButton={true} // 启用关闭按钮
        swipeDirections={[]} // 禁用所有方向的滑动手势，只允许点击关闭按钮关闭
        toastOptions={{
          classNames: {
            description: "group-[.toast]:text-muted-foreground",
            actionButton:
              "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-white group-[.toast]:text-black",
            error:
              "group toast group-[.toaster]:bg-red group-[.toaster]:text-red-600 dark:group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
            success:
              "group toast group-[.toaster]:bg-green group-[.toaster]:text-green-600 dark:group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
            warning:
              "group toast group-[.toaster]:bg-yellow group-[.toaster]:text-yellow-600 dark:group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
            info: "group toast group-[.toaster]:bg-blue group-[.toaster]:text-blue-600 dark:group-[.toaster]:text-foreground group-[.toaster]:shadow-lg",
          },
        }}
      />
    </WebSocketProvider>
  );
}

export default App;
