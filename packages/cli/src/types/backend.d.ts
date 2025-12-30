/**
 * Backend 模块类型声明
 * 使用 any 类型避免递归解析 backend 代码
 */

declare module "@/lib/config/manager" {
  export interface LocalMCPServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }

  export interface MCPServerConfig {
    type?: string;
    url?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
  }

  export const configManager: any;
}

declare module "@/lib/config/manager.js" {
  export interface LocalMCPServerConfig {
    command: string;
    args: string[];
    env?: Record<string, string>;
  }

  export interface MCPServerConfig {
    type?: string;
    url?: string;
    command?: string;
    args?: string[];
    headers?: Record<string, string>;
  }

  export const configManager: any;
}

declare module "@root/WebServer" {
  export class WebServer {}
}

declare module "@root/WebServer.js" {
  export class WebServer {}
}
