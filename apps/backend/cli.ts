#!/usr/bin/env node

/**
 * 小智客户端 CLI 入口文件
 * 从 @xiaozhi/client-cli 包重新导出，保持向后兼容
 */

// @ts-ignore - 向后兼容导入，dist 文件在 rootDir 之外
export * from "../../dist/cli/index.js";
