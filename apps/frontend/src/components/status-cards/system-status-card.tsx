/**
 * 系统设置状态卡片组件
 *
 * 显示系统配置完成度和快速打开设置对话框的入口。
 */

import { RestartButton } from "@/components/restart-button";
import { SystemSettingDialog } from "@/components/system-setting-dialog";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useConfig } from "@/stores/config";
import { useMemo } from "react";
import { MiniCircularProgress } from "./mini-circular-progress";

/**
 * 系统配置项总数
 */
const TOTAL_CONFIG_ITEMS = 5;

/**
 * 系统设置状态卡片组件
 *
 * 显示系统配置完成度（已配置项/总配置项），右上角显示配置完成度的圆形进度指示器。
 * 底部提供快速打开设置对话框的按钮。
 */
export function SystemStatusCard() {
  const config = useConfig();

  // 计算已配置项数量
  const configuredCount = useMemo(() => {
    if (!config) return 0;
    let count = 0;
    if (config.modelscope?.apiKey) count++;
    if (config.platforms?.coze?.token) count++;
    if (config.connection?.heartbeatInterval) count++;
    if (config.connection?.heartbeatTimeout) count++;
    if (config.connection?.reconnectInterval) count++;
    return count;
  }, [config]);

  const completionRate = configuredCount / TOTAL_CONFIG_ITEMS;

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardDescription>系统设置</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          已配置 {configuredCount}/{TOTAL_CONFIG_ITEMS}
        </CardTitle>
        <div className="absolute right-4 top-4">
          <MiniCircularProgress
            showValue={true}
            value={configuredCount}
            maxValue={TOTAL_CONFIG_ITEMS}
            activeColor={
              completionRate >= 0.8
                ? "#16a34a"
                : completionRate >= 0.5
                  ? "#f59e0b"
                  : "#f87171"
            }
            inactiveColor="#e5e7eb"
            size={30}
            symbol=""
          />
        </div>
      </CardHeader>
      <CardFooter className="flex items-center justify-between gap-1 text-sm">
        <div className="text-muted-foreground">
          {completionRate === 1
            ? "配置已完成"
            : completionRate >= 0.6
              ? `还差 ${TOTAL_CONFIG_ITEMS - configuredCount} 项配置`
              : "请完善系统配置"}
        </div>
        <div className="flex gap-2">
          <RestartButton iconMode />
          <SystemSettingDialog />
        </div>
      </CardFooter>
    </Card>
  );
}
