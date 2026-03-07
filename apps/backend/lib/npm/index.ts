/**
 * NPM 管理器模块
 *
 * 提供与 NPM 交互的功能，包括：
 * - 安装指定版本
 * - 获取当前版本
 * - 获取可用版本列表
 * - 检查最新版本
 *
 * @example
 * ```typescript
 * import { NPMManager } from '@/lib/npm';
 *
 * const npmManager = new NPMManager();
 * const versions = await npmManager.getAvailableVersions('stable');
 * await npmManager.installVersion('1.0.0');
 * ```
 */
export * from "./manager.js";
