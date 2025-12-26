/**
 * 构建后处理脚本
 * 将路径别名替换为相对路径
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const filePath = resolve('./dist/cli/index.js');
let content = readFileSync(filePath, 'utf-8');

// 替换 @root/* 为指向 dist/backend 的相对路径
content = content
  .replace(/from "@\/lib\/config\/manager\.js"/g, 'from "../../dist/backend/lib/config/manager.js"')
  .replace(/from "@\/lib\/config\/manager"/g, 'from "../../dist/backend/lib/config/manager.js"')
  .replace(/from "@root\/Logger\.js"/g, 'from "../../dist/backend/Logger.js"')
  .replace(/from "@root\/Logger"/g, 'from "../../dist/backend/Logger.js"')
  .replace(/from "@root\/WebServer\.js"/g, 'from "../../dist/backend/WebServer.js"')
  .replace(/from "@root\/WebServer"/g, 'from "../../dist/backend/WebServer.js"');

writeFileSync(filePath, content);
console.log('✅ 已修复 dist/cli/index.js 中的导入路径');
