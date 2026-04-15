/**
 * NPM 管理器模块
 *
 * 提供与 NPM 交互的功能，包括：
 * - 安装指定版本
 * - 获取当前版本列表（支持 stable、rc、beta、all 类型）
 * - 检查最新版本
 * - SSE 日志流式推送
 *
 * @example
 * ```typescript
 * import { NPMManager, InstallLogStream } from '@/lib/npm';
 *
 * const logStream = new InstallLogStream();
 * const npmManager = new NPMManager(undefined, logStream);
 * const versions = await npmManager.getAvailableVersions('stable');
 * await npmManager.installVersion('1.0.0');
 * ```
 */
export * from "./manager.js";
export { InstallLogStream } from "./install-log-stream.js";
export type {
  InstallLogEntry,
  InstallStartedData,
  InstallCompletedData,
  InstallFailedData,
} from "./install-log-stream.js";
