// 重新导出 - MCPService 已迁移到 @/lib/mcp/connection.js
export * from "@/lib/mcp";

import { logger } from "@root/Logger.js";
logger.warn("MCPService 已迁移到 @/lib/mcp/connection.js，请更新导入路径");
