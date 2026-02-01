import { AddMcpServerButton } from "@/components/AddMcpServerButton";
import { AppSidebar } from "@/components/AppSidebar";
import { DashboardStatusCard } from "@/components/DashboardStatusCard";
import { RestartButton } from "@/components/RestartButton";
import { SiteHeader } from "@/components/SiteHeder";
import { McpServerTable } from "@/components/mcp-server/mcp-server-table";
import { McpToolTable } from "@/components/mcp-tool/mcp-tool-table";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function DashboardPage() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="看板" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <DashboardStatusCard />
              <div className="flex flex-row gap-4 px-4 lg:px-6">
                <McpToolTable
                  initialStatus="all"
                  className="flex-[1_1_0%] min-w-0"
                />
                <div className="flex-[1_1_0%] min-w-0">
                  <div className="flex items-center gap-4 flex-col">
                    <div className="flex items-center gap-2 w-full">
                      <AddMcpServerButton />
                      <RestartButton />
                    </div>
                    <McpServerTable />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
