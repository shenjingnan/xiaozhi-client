import { LayoutDashboardIcon, SettingsIcon } from "lucide-react";
import type React from "react";
import { Link } from "react-router-dom";

import { AppSidebarNav } from "@/components/AppSidebarNav";
import { VersionDisplay } from "@/components/VersionDisplay";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  navMain: [
    {
      title: "仪表板",
      url: "/dashboard",
      icon: LayoutDashboardIcon,
    },
    // {
    //   title: "小智服务端",
    //   url: "/mcp-endpoint",
    //   icon: BotIcon,
    // },
    // {
    //   title: "MCP 服务",
    //   url: "#",
    //   icon: CableIcon,
    // },
    // {
    //   title: "烧录固件",
    //   url: "#",
    //   icon: ZapIcon,
    // },
    // {
    //   title: "帮助文档",
    //   url: "#",
    //   icon: BadgeQuestionMarkIcon,
    // },
    {
      title: "全局配置",
      url: "/settings",
      icon: SettingsIcon,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link to="/" className="flex items-center gap-2">
                <span className="text-base font-semibold">Xiaozhi Client</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <AppSidebarNav items={data.navMain} />
      </SidebarContent>
    </Sidebar>
  );
}
