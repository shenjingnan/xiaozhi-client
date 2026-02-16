#!/usr/bin/env node

/**
 * DateTime MCP 服务包装脚本
 * 用于解决 ESM 模块 shebang 限制问题
 */

import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 动态导入主模块
await import("./dist/index.js");
