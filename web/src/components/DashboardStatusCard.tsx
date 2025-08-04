import { McpEndpointSettingButton } from "@/components/McpEndpointSettingButton";
import { WebUrlSettingButton } from "@/components/WebUrlSettingButton";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useMcpEndpoint,
  useWebSocketConnected,
  useWebSocketMcpServers,
  useWebSocketUrl,
} from "@/stores/websocket";

const MiniCircularProgress = ({
  showValue = true,
  value = 0,
  maxValue = 100,
  size = 60,
  activeColor = "#3b82f6",
  inactiveColor = "#e5e7eb",
  symbol = "%",
}) => {
  const radius = (size - 6) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (value / maxValue) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={inactiveColor}
          strokeWidth={6}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={activeColor}
          strokeWidth={6}
          fill="none"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium">
            {value}
            {symbol}
          </span>
        </div>
      )}
    </div>
  );
};

export function DashboardStatusCard() {
  const mcpServers = useWebSocketMcpServers();
  const connected = useWebSocketConnected();
  const mcpServerCount = Object.keys(mcpServers || {}).length;
  const wsUrl = useWebSocketUrl();
  const mcpEndpoint = useMcpEndpoint();
  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>小智接入点</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {Array.isArray(mcpEndpoint)
              ? mcpEndpoint.length
              : mcpEndpoint
                ? 1
                : 0}
          </CardTitle>
          <div className="absolute right-4 top-4 flex flex-col items-center">
            <MiniCircularProgress
              showValue={false}
              value={1}
              maxValue={1}
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
      <Card className="@container/card">
        <CardHeader className="relative">
          <CardDescription>MCP服务</CardDescription>
          <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
            {mcpServerCount}
          </CardTitle>
          <div className="absolute right-4 top-4">
            <MiniCircularProgress
              showValue={false}
              value={mcpServerCount}
              maxValue={mcpServerCount}
              activeColor="#16a34a"
              inactiveColor="#f87171"
              size={30}
              symbol=""
            />
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
