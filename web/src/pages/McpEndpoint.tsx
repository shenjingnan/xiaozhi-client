import { AppSidebar } from "@/components/app-sidebar";
import McpList from "@/components/mcp-list";
import { SectionCards } from "@/components/section-cards";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function McpEndpoint() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <SectionCards />
              welwleflwef
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
