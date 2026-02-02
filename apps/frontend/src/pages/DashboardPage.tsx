import { DashboardStatusCard } from "@/components/DashboardStatusCard";
import { SiteHeader } from "@/components/SiteHeder";
import { McpToolTable } from "@/components/mcp-tool/mcp-tool-table";

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
