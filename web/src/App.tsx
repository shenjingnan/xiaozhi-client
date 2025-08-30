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
      <Toaster />
    </WebSocketProvider>
  );
}

export default App;
