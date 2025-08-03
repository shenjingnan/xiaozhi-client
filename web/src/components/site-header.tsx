import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GithubIcon } from "lucide-react";

export function SiteHeader({ title }: { title: string }) {
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
      </div>
      <div className="flex w-full justify-end items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <a
          href="https://github.com/shenjingnan/xiaozhi-client"
          target="_blank"
          rel="noopener noreferrer"
        >
          <GithubIcon size={24} className="text-gray-500" fill="currentColor" />
        </a>
      </div>
    </header>
  );
}
