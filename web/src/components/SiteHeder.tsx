import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GithubIcon, QQIcon } from "@/components/icons";
import { VersionDisplay } from "./VersionDisplay";

export function SiteHeader({ title }: { title: string }) {
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear pr-4">
      <div className="flex w-full items-center gap-2 px-4 box-border">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{title}</h1>
      </div>
      <div className="flex w-full justify-end items-center gap-4 box-border">
        <VersionDisplay />
        <a
          href="https://img.shields.io/badge/Join-QQ%20Group-5865F2?style=flat&logo=qq&logoColor=white)](https://qun.qq.com/universal-share/share?ac=1&authKey=c08PvS2zvAF1NN%2F%2BuaOi0ze1AElTIsvFBLwbWUMFc2ixjaZYxqZTUQHzipwd8Kka&busi_data=eyJncm91cENvZGUiOiIxMDU0ODg4NDczIiwidG9rZW4iOiJuSmJUN2cyUEVkNEQ5WXovM3RQbFVNcDluMGVibUNZTUQvL1RuQnFJRjBkZmRZQnRBRTdwU0szL3V2Y0dLc1ZmIiwidWluIjoiMzkxMTcyMDYwMCJ9&data=9cH6_zEC-sN3xYlwzKEWiYF71RLY9CId5taN-gy6XZo7axSlSWDpd1Ojui5hYMQKIgEJYSPw59XYgF5vH2wLog&svctype=4&tempid=h5_group_info"
          target="_blank"
          rel="noopener noreferrer"
        >
          <QQIcon
            size={24}
            className="text-slate-800"
            fill="currentColor"
          />
        </a>
        <a
          href="https://github.com/shenjingnan/xiaozhi-client"
          target="_blank"
          rel="noopener noreferrer"
        >
          <GithubIcon
            size={24}
            className="text-slate-800"
            fill="currentColor"
          />
        </a>
      </div>
    </header>
  );
}
