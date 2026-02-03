/**
 * 小智接入点状态卡片组件
 *
 * 显示当前配置的小智接入点数量，并提供设置按钮。
 */

import { McpEndpointSettingButton } from "@/components/mcp-endpoint-setting-button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMcpEndpoint } from "@/stores/config";
import { MiniCircularProgress } from "./mini-circular-progress";

/**
 * 小智接入点状态卡片组件
 *
 * 显示当前配置的小智接入点数量，右上角显示状态指示器。
 */
export function EndpointStatusCard() {
  const mcpEndpoint = useMcpEndpoint();
  const endpointCount = Array.isArray(mcpEndpoint)
    ? mcpEndpoint.length
    : mcpEndpoint
      ? 1
      : 0;

  return (
    <Card className="@container/card">
      <CardHeader className="relative">
        <CardDescription>小智接入点</CardDescription>
        <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          {endpointCount}
        </CardTitle>
        <div className="absolute right-4 top-4 flex flex-col items-center">
          <MiniCircularProgress
            showValue={false}
            value={endpointCount}
            maxValue={Math.max(endpointCount, 1)}
            activeColor="#16a34a"
            inactiveColor="#f87171"
            size={30}
            symbol=""
          />
        </div>
      </CardHeader>
      <CardFooter className="flex-col items-end gap-1 text-sm">
        <McpEndpointSettingButton />
      </CardFooter>
    </Card>
  );
}
