import { useState } from "react";
import { toast } from "sonner";
import { RestartButton, type RestartStatus } from "./RestartButton";

/**
 * RestartButton 组件使用示例
 * 展示如何在不同场景下使用 RestartButton 组件
 */
export function RestartButtonExample() {
  const [restartStatus, setRestartStatus] = useState<
    RestartStatus | undefined
  >();

  // 模拟重启服务的函数
  const handleRestart = async () => {
    console.log("开始重启服务...");

    // 设置重启状态为进行中
    setRestartStatus({
      status: "restarting",
      timestamp: Date.now(),
    });

    try {
      // 模拟重启过程（实际应用中这里会调用真实的重启 API）
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // 模拟 80% 成功率
          if (Math.random() > 0.2) {
            resolve(void 0);
          } else {
            reject(new Error("模拟重启失败"));
          }
        }, 2000);
      });

      // 重启成功
      setRestartStatus({
        status: "completed",
        timestamp: Date.now(),
      });

      toast.success("服务重启成功");
    } catch (error) {
      // 重启失败
      const errorMessage = error instanceof Error ? error.message : "重启失败";
      setRestartStatus({
        status: "failed",
        error: errorMessage,
        timestamp: Date.now(),
      });

      // 注意：错误处理已经在 RestartButton 组件内部处理了
      // 这里不需要再次显示 toast，避免重复
    }
  };

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold">RestartButton 组件示例</h2>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">基本用法</h3>
          <RestartButton
            onRestart={handleRestart}
            restartStatus={restartStatus}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">自定义文本</h3>
          <RestartButton
            onRestart={handleRestart}
            restartStatus={restartStatus}
            defaultText="重新启动"
            restartingText="正在重启..."
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">不同样式变体</h3>
          <div className="flex gap-2">
            <RestartButton
              onRestart={handleRestart}
              restartStatus={restartStatus}
              variant="default"
            />
            <RestartButton
              onRestart={handleRestart}
              restartStatus={restartStatus}
              variant="secondary"
            />
            <RestartButton
              onRestart={handleRestart}
              restartStatus={restartStatus}
              variant="outline"
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">禁用状态</h3>
          <RestartButton
            onRestart={handleRestart}
            restartStatus={restartStatus}
            disabled={true}
          />
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">只有按钮（无回调）</h3>
          <RestartButton />
        </div>
      </div>

      {/* 状态显示 */}
      {restartStatus && (
        <div className="mt-6 p-4 border rounded-lg bg-muted">
          <h3 className="text-lg font-semibold mb-2">当前重启状态</h3>
          <div className="space-y-1 text-sm">
            <div>
              <strong>状态:</strong> {restartStatus.status}
            </div>
            <div>
              <strong>时间:</strong>{" "}
              {new Date(restartStatus.timestamp).toLocaleString()}
            </div>
            {restartStatus.error && (
              <div className="text-destructive">
                <strong>错误:</strong> {restartStatus.error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 在 ConfigEditor 中使用 RestartButton 的示例
 * 替换原有的内联重启按钮实现
 */
export function ConfigEditorWithRestartButton() {
  // 假设这些是从 props 或 hooks 获取的
  const [restartStatus] = useState<RestartStatus | undefined>();

  const handleRestart = async () => {
    // 实际的重启逻辑
    console.log("ConfigEditor: 重启服务");
  };

  return (
    <div className="flex gap-2">
      <button type="button" className="flex-1">
        保存配置
      </button>

      {/* 使用新的 RestartButton 组件替换原有实现 */}
      <RestartButton onRestart={handleRestart} restartStatus={restartStatus} />
    </div>
  );
}
