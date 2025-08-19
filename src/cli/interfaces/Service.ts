/**
 * 服务接口定义
 */

/**
 * 服务管理器接口
 */
export interface ServiceManager {
  /** 启动服务 */
  start(options: ServiceStartOptions): Promise<void>;
  /** 停止服务 */
  stop(): Promise<void>;
  /** 重启服务 */
  restart(options: ServiceStartOptions): Promise<void>;
  /** 获取服务状态 */
  getStatus(): ServiceStatus;
}

/**
 * 服务启动选项
 */
export interface ServiceStartOptions {
  /** 是否后台运行 */
  daemon?: boolean;
  /** 是否启动 Web UI */
  ui?: boolean;
  /** 端口号 */
  port?: number;
  /** 运行模式 */
  mode?: "normal" | "mcp-server" | "stdio";
}

/**
 * 服务状态
 */
export interface ServiceStatus {
  /** 是否正在运行 */
  running: boolean;
  /** 进程 ID */
  pid?: number;
  /** 运行时间 */
  uptime?: string;
  /** 运行模式 */
  mode?: "foreground" | "daemon";
}

/**
 * 进程管理器接口
 */
export interface ProcessManager {
  /** 获取服务状态 */
  getServiceStatus(): ServiceStatus;
  /** 杀死进程 */
  killProcess(pid: number): Promise<void>;
  /** 清理 PID 文件 */
  cleanupPidFile(): void;
  /** 检查是否为 xiaozhi 进程 */
  isXiaozhiProcess(pid: number): boolean;
}

/**
 * 守护进程管理器接口
 */
export interface DaemonManager {
  /** 启动守护进程 */
  startDaemon(serverFactory: () => Promise<any>): Promise<void>;
  /** 停止守护进程 */
  stopDaemon(): Promise<void>;
}

/**
 * 模板管理器接口
 */
export interface TemplateManager {
  /** 获取可用模板列表 */
  getAvailableTemplates(): string[];
  /** 复制模板到目标目录 */
  copyTemplate(templateName: string, targetPath: string): Promise<void>;
  /** 验证模板是否存在 */
  validateTemplate(templateName: string): boolean;
}
