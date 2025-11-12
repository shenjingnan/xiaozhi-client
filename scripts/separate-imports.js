#!/usr/bin/env node

/**
 * 分离 type 和 value 导入的脚本
 * 将类似 `import { type Logger, logger } from "../Logger.js";` 的导入语句分离为：
 * import type { Logger } from "../Logger.js";
 * import { logger } from "../Logger.js";
 */

import { readFileSync, writeFileSync } from "node:fs";
import { globSync } from "glob";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const mixedImportPattern =
  /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["'];?/g;

function processFile(filePath) {
  const content = readFileSync(filePath, "utf-8");
  let modified = false;
  const newContent = content.replace(
    mixedImportPattern,
    (match, imports, fromModule) => {
      // 解析导入项
      const items = imports.split(",").map((item) => item.trim());
      const typeImports = [];
      const valueImports = [];

      items.forEach((item) => {
        if (item.startsWith("type ")) {
          const typeName = item.replace("type ", "").trim();
          typeImports.push(typeName);
        } else {
          valueImports.push(item);
        }
      });

      // 如果既有 type 导入又有 value 导入，则分离它们
      if (typeImports.length > 0 && valueImports.length > 0) {
        modified = true;
        const typeImport = `import type { ${typeImports.join(", ")} } from "${fromModule}";`;
        const valueImport = `import { ${valueImports.join(", ")} } from "${fromModule}";`;
        return typeImport + "\n" + valueImport;
      }

      return match;
    }
  );

  if (modified && newContent !== content) {
    writeFileSync(filePath, newContent, "utf-8");
    console.log(`✅ Updated ${filePath}`);
    return true;
  }

  return false;
}

function main() {
  const files = globSync("src/**/*.ts", {
    ignore: ["**/node_modules/**", "**/dist/**"],
    absolute: true,
  });

  console.log(`🔍 检查 ${files.length} 个 TypeScript 文件...`);

  let updatedCount = 0;
  for (const file of files) {
    if (processFile(file)) {
      updatedCount++;
    }
  }

  console.log(`\n✨ 完成! 更新了 ${updatedCount} 个文件`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { processFile, mixedImportPattern };
