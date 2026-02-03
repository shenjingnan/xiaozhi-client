/**
 * 客户端连接状态卡片组件
 *
 * 显示 Xiaozhi Client 的连接状态和 WebSocket URL。
 */

import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WebUrlSettingButton } from "@/components/web-url-setting-button";
import { useWebSocketConnected, useWebSocketUrl } from "@/stores/websocket";
import { MiniCircularProgress } from "./mini-circular-progress";

/**
 * 客户端连接状态卡片组件
 *
 * 显示当前 WebSocket 连接状态和 URL，右上角显示连接状态指示器。
 */
export function ClientStatusCard() {
  const connected = useWebSocketConnected();
  const wsUrl = useWebSocketUrl();

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardDescription>Xiaozhi Client</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {connected ? "已连接" : "未连接"}
        </CardTitle>
        <div className="absolute right-4 top-4">
          <MiniCircularProgress
            showValue={false}
            value={1}
            maxValue={1}
            activeColor={connected ? "#16a34a" : "#f87171"}
            inactiveColor={connected ? "#16a34a" : "#f87171"}
            size={30}
            symbol=""
          />
        </div>
      </CardHeader>
      <CardFooter className="flex items-center justify-between gap-1 text-sm">
        <div className="text-muted-foreground">{wsUrl}</div>
        <WebUrlSettingButton />
      </CardFooter>
    </Card>
  );
}
