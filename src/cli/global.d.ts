/**
 * CLI 全局类型声明
 *
 * 扩展 Node.js 全局类型，包含以下内容：
 * - Express 相关类型
 * - WebSocket 相关类型
 * - 环境变量类型扩展
 */
/// <reference types="node" />
/// <reference types="express" />
/// <reference types="ws" />
/// <reference types="semver" />
/// <reference types="node-fetch" />
/// <reference types="supertest" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly NODE_ENV: string;
      readonly XIAOZHI_CONFIG_DIR?: string;
      readonly TMPDIR?: string;
      readonly TEMP?: string;
    }
  }
}

export {};
