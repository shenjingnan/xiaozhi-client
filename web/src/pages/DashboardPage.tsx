import { AppSidebar } from "@/components/AppSidebar";
import { McpServerList } from "@/components/MCPServerList";
import { SiteHeader } from "@/components/SiteHeder";
import { SectionCards } from "@/components/section-cards";
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
              <SectionCards />
              <McpServerList />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
