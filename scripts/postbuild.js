import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

console.log("🔧 开始后处理构建文件...");

// 查找所有 .cjs 文件
const cjsFiles = glob.sync("dist/**/*.cjs");

if (cjsFiles.length === 0) {
  console.log("⚠️  未找到 .cjs 文件");
  process.exit(0);
}

for (const file of cjsFiles) {
  try {
    let content = fs.readFileSync(file, "utf8");
    let modified = false;

    // 1. 替换 .js" 为 .cjs"
    const originalContent = content;
    content = content.replace(/\.js"/g, '.cjs"');
    if (content !== originalContent) {
      modified = true;
      console.log(`  ✅ 修复导入路径: ${path.basename(file)}`);
    }

    // 2. 删除 const __dirname = 行
    const beforeDirname = content;
    content = content.replace(/^.*const __dirname = .*$/gm, "");
    if (content !== beforeDirname) {
      modified = true;
      console.log(`  ✅ 移除 __dirname 定义: ${path.basename(file)}`);
    }

    // 3. 清理多余的空行
    content = content.replace(/\n\n\n+/g, "\n\n");

    if (modified) {
      fs.writeFileSync(file, content, "utf8");
      console.log(`  📝 已更新: ${file}`);
    }
  } catch (error) {
    console.error(`❌ 处理文件失败 ${file}:`, error.message);
    process.exit(1);
  }
}

console.log(`🎉 成功处理了 ${cjsFiles.length} 个 .cjs 文件`);
