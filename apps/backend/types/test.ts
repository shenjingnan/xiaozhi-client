/**
 * 测试相关的类型定义
 * 用于替换测试文件中的 any 类型，提升类型安全性
 */

import type { ConfigManager } from "../configManager";

/**
 * Node.js 服务器地址信息接口
 */
export interface ServerAddress {
  port: number;
  address: string;
  family: string;
}

/**
 * Mock ConfigManager 接口
 */
export interface MockConfigManager extends ConfigManager {
  [key: string]: unknown; // 允许其他 Mock 属性
}
