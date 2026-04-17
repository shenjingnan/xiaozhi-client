/**
 * 仪表板状态卡片容器组件
 *
 * 组合显示小智接入点、客户端连接、MCP 服务、实时语音和系统设置的状态卡片。
 */

import {
  ClientStatusCard,
  EndpointStatusCard,
  ServerStatusCard,
  SystemStatusCard,
  VoiceInteractionCard,
} from "@/components/status-cards";

/**
 * 仪表板状态卡片组件
 *
 * 按网格布局排列五个状态卡片：小智接入点、Xiaozhi Client 连接状态、MCP 服务数量、实时语音、系统设置。
 */
export function DashboardStatusCard() {
  return (
    <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-5 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
      <EndpointStatusCard />
      <ClientStatusCard />
      <ServerStatusCard />
      <VoiceInteractionCard />
      <SystemStatusCard />
    </div>
  );
}
