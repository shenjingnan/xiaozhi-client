// @ts-nocheck
import {
  ArrowUpCircleIcon,
  BadgeQuestionMarkIcon,
  BarChartIcon,
  BotIcon,
  CableIcon,
  CameraIcon,
  ClipboardListIcon,
  DatabaseIcon,
  FileCodeIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  Link2Icon,
  ListIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import type React from "react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "仪表板",
      url: "/",
      icon: LayoutDashboardIcon,
    },
    {
      title: "小智服务端",
      url: "/mcp-endpoint",
      icon: BotIcon,
    },
    {
      title: "MCP 服务",
      url: "#",
      icon: CableIcon,
    },
    {
      title: "烧录固件",
      url: "#",
      icon: ZapIcon,
    },
    {
      title: "帮助文档",
      url: "#",
      icon: BadgeQuestionMarkIcon,
    },
    {
      title: "全局配置",
      url: "#",
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
              <button type="button">
                {/* <ArrowUpCircleIcon className="h-5 w-5" /> */}
                <span className="text-base font-semibold">Xiaozhi Client</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
    </Sidebar>
  );
}
