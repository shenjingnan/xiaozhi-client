import { AppSidebar } from "@/components/AppSidebar";
import { McpEndpointTable } from "@/components/McpEndpointTable";
import { SiteHeader } from "@/components/SiteHeder";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import data from "./data.json";

export default function McpEndpoint() {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="小智服务端接入点" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <McpEndpointTable data={data} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
