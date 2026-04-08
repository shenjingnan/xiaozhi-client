import { DashboardStatusCard } from "@/components/dashboard-status-card";
import { McpToolTable } from "@/components/mcp-tool/mcp-tool-table";
import { SiteHeader } from "@/components/site-header";

/**
 * 仪表板页面
 *
 * 主仪表板页面，显示：
 * - 看板标题
 * - 仪表板状态卡片
 * - MCP 工具表格（显示所有工具）
 *
 * @returns 仪表板页面的 JSX 元素
 */
export default function DashboardPage() {
  return (
    <div className="flex h-screen flex-col">
      <SiteHeader title="看板" />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <DashboardStatusCard />
            <div className="flex flex-col gap-4 px-4 lg:px-6">
              <McpToolTable initialStatus="all" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
