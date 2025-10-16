import { AppSidebar } from "@/components/AppSidebar";
import { DashboardStatusCard } from "@/components/DashboardStatusCard";
import { McpServerList } from "@/components/McpServerList";
import { SiteHeader } from "@/components/SiteHeder";
import { VersionUpgradeDialog } from "@/components/VersionUpgradeDialog";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useWebSocketActions } from "@/providers/WebSocketProvider";

export default function DashboardPage() {
  // 从 WebSocketProvider 获取操作方法
  const { updateConfig } = useWebSocketActions();

  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="看板" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 md:px-6">
                <VersionUpgradeDialog defaultSelectedVersion="1.7.5" />
              </div>
              <DashboardStatusCard />
              <McpServerList updateConfig={updateConfig} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
