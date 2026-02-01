import { GithubIcon, QQIcon } from "@/components/icons";
import { VersionDisplay } from "./VersionDisplay";

export function SiteHeader({ title }: { title: string }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <h1 className="text-base font-medium">{title}</h1>
      <div className="flex flex-1 justify-end items-center gap-4">
        <VersionDisplay />
        <a
          href="https://qun.qq.com/universal-share/share?ac=1&authKey=c08PvS2zvAF1NN%2F%2BuaOi0ze1AElTIsvFBLwbWUMFc2ixjaZYxqZTUQHzipwd8Kka&busi_data=eyJncm91cENvZGUiOiIxMDU0ODg4NDczIiwidG9rZW4iOiJuSmJUN2cyUEVkNEQ5WXovM3RQbFVNcDluMGVibUNZTUQvL1RuQnFJRjBkZmRZQnRBRTdwU0szL3V2Y0dLc1ZmIiwidWluIjoiMzkxMTcyMDYwMCJ9&data=9cH6_zEC-sN3xYlwzKEWiYF71RLY9CId5taN-gy6XZo7axSlSWDpd1Ojui5hYMQKIgEJYSPw59XYgF5vH2wLog&svctype=4&tempid=h5_group_info"
          target="_blank"
          rel="noopener noreferrer"
        >
          <QQIcon size={24} className="text-slate-800" fill="currentColor" />
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
