import { CommandPalette, useCommandPalette } from "@/components/CommandPalette";
import { ToolDebugDialog } from "@/components/ToolDebugDialog";
import { Toaster } from "@/components/ui/sonner";
import { RestartNotificationProvider } from "@/hooks/useRestartNotifications";
import DashboardPage from "@/pages/DashboardPage";
import { WebSocketProvider } from "@/providers/WebSocketProvider";
import { useCallback, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

/**
 * 格式化工具信息接口
 */
interface FormattedTool {
  name: string;
  serverName: string;
  toolName: string;
  description: string;
  enabled: boolean;
  inputSchema: any;
}

function App() {
  // 命令面板状态
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } =
    useCommandPalette();

  // 工具调试对话框状态
  const [debugDialog, setDebugDialog] = useState<{
    open: boolean;
    tool?: {
      name: string;
      serverName: string;
      toolName: string;
      description?: string;
      inputSchema?: any;
    };
  }>({ open: false });

  /**
   * 处理工具选择 - 打开工具调试对话框
   */
  const handleToolSelect = useCallback((tool: FormattedTool) => {
    setDebugDialog({
      open: true,
      tool: {
        name: tool.name,
        serverName: tool.serverName,
        toolName: tool.toolName,
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
    });
  }, []);

  return (
    <WebSocketProvider>
      {/* 重启通知管理器 - 全局监听重启状态变化 */}
      <RestartNotificationProvider />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* 命令面板 - 快捷键 Cmd+K / Ctrl+K 唤起 */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onToolSelect={handleToolSelect}
      />

      {/* 工具调试对话框 */}
      <ToolDebugDialog
        open={debugDialog.open}
        onOpenChange={(open) => setDebugDialog((prev) => ({ ...prev, open }))}
        tool={debugDialog.tool || null}
      />

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
