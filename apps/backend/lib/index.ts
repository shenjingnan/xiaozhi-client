/**
 * 后端核心库统一导出模块
 *
 * 此文件作为 apps/backend/lib 的入口点，统一导出核心库功能。
 *
 * @module
 *
 * @example
 * ```typescript
 * import { NPMManager } from '@/lib';
 *
 * const npmManager = new NPMManager();
 * const versions = await npmManager.getAvailableVersions('stable');
 * ```
 */
export * from "./npm/index.js";
