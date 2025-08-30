/**
 * 重启重连检查机制演示组件
 *
 * 展示新的重启重连检查功能：
 * 1. 实时进度显示
 * 2. 智能超时处理
 * 3. 状态管理集成
 */

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useConnectionStatus,
  useRestartPollingStatus,
  useRestartStatus,
  useStatusStore,
} from "@/stores/status";
import { RestartButton } from "./RestartButton";

export function RestartDemo() {
  const {
    loading: { isRestarting },
  } = useStatusStore();
  const restartPollingStatus = useRestartPollingStatus();
  const restartStatus = useRestartStatus();
  const isConnected = useConnectionStatus();

  // 计算重连进度信息
  const getProgressInfo = () => {
    if (!restartPollingStatus.enabled || !restartPollingStatus.startTime) {
      return null;
    }

    const elapsed = Math.round(
      (Date.now() - restartPollingStatus.startTime) / 1000
    );
    const progress =
      (restartPollingStatus.currentAttempts /
        restartPollingStatus.maxAttempts) *
      100;

    return {
      elapsed,
      attempts: restartPollingStatus.currentAttempts,
      maxAttempts: restartPollingStatus.maxAttempts,
      progress: Math.min(progress, 100),
      timeRemaining: Math.max(
        0,
        Math.round((restartPollingStatus.timeout - elapsed * 1000) / 1000)
      ),
    };
  };

  const progressInfo = getProgressInfo();

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>重启服务重连检查演示</CardTitle>
          <CardDescription>
            展示新的智能重连检查机制，包括实时进度显示和自动超时处理
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 重启按钮 */}
          <div className="flex items-center gap-4">
            <RestartButton />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">连接状态:</span>
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "已连接" : "未连接"}
              </Badge>
            </div>
          </div>

          {/* 重启状态显示 */}
          {restartStatus && (
            <div className="p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">重启状态</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">状态:</span>
                  <Badge
                    variant={
                      restartStatus.status === "completed"
                        ? "default"
                        : restartStatus.status === "failed"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {restartStatus.status === "restarting"
                      ? "重启中"
                      : restartStatus.status === "completed"
                        ? "已完成"
                        : "失败"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">时间:</span>
                  <span>
                    {new Date(restartStatus.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {restartStatus.error && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">错误:</span>
                    <span className="text-destructive">
                      {restartStatus.error}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 重连检查进度 */}
          {progressInfo && (
            <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <h4 className="font-medium mb-3 text-blue-900 dark:text-blue-100">
                重连检查进度
              </h4>
              <div className="space-y-3">
                {/* 进度条 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>检查进度</span>
                    <span>
                      {progressInfo.attempts}/{progressInfo.maxAttempts}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progressInfo.progress}%` }}
                    />
                  </div>
                </div>

                {/* 时间信息 */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">已用时间:</span>
                    <span className="ml-2 font-mono">
                      {progressInfo.elapsed}s
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">剩余时间:</span>
                    <span className="ml-2 font-mono">
                      {progressInfo.timeRemaining}s
                    </span>
                  </div>
                </div>

                {/* 检查次数 */}
                <div className="text-sm">
                  <span className="text-muted-foreground">检查次数:</span>
                  <span className="ml-2 font-mono">
                    {progressInfo.attempts} / {progressInfo.maxAttempts}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 功能说明 */}
          <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
            <h4 className="font-medium mb-2 text-green-900 dark:text-green-100">
              功能特性
            </h4>
            <ul className="text-sm space-y-1 text-green-800 dark:text-green-200">
              <li>• 每1秒自动检查服务重连状态</li>
              <li>• 实时显示检查进度和已用时间</li>
              <li>• 60秒超时或60次检查后自动停止</li>
              <li>• 重连成功后立即停止检查并更新状态</li>
              <li>• 完整的错误处理和状态恢复机制</li>
            </ul>
          </div>

          {/* 使用说明 */}
          <div className="p-4 border rounded-lg">
            <h4 className="font-medium mb-2">使用说明</h4>
            <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
              <li>点击"重启服务"按钮开始重启流程</li>
              <li>按钮会显示"重连检查中..."和实时进度</li>
              <li>系统每秒检查一次连接状态</li>
              <li>重连成功后按钮恢复正常状态</li>
              <li>如果60秒内未重连成功，会显示超时错误</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
