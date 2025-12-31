import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 版本同步脚本
 * 将指定的版本号同步到所有包的 package.json 中
 *
 * 使用方法:
 * node scripts/sync-version.js 1.9.5
 */

const version = process.argv[2];

if (!version) {
  console.error('❌ 请提供版本号');
  console.error('使用方法: node scripts/sync-version.js <version>');
  process.exit(1);
}

// 验证版本号格式
const versionRegex = /^\d+\.\d+\.\d+(-(beta|rc)\.\d+)?$/;
if (!versionRegex.test(version)) {
  console.error(`❌ 版本号格式无效: ${version}`);
  console.error('有效格式示例: 1.0.0, 1.0.0-beta.0, 1.0.0-rc.0');
  process.exit(1);
}

// 需要同步版本的包列表
const packages = [
  'package.json',
  'packages/cli/package.json',
  'packages/config/package.json',
  'packages/shared-types/package.json'
];

console.log(`📦 开始同步版本号: ${version}`);
console.log('');

packages.forEach((pkg) => {
  const filePath = resolve(pkg);
  try {
    const content = JSON.parse(readFileSync(filePath, 'utf-8'));
    content.version = version;
    writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n');
    console.log(`✅ 已更新 ${pkg} 版本为 ${version}`);
  } catch (error) {
    console.error(`❌ 更新 ${pkg} 失败:`, error.message);
    process.exit(1);
  }
});

console.log('');
console.log('✨ 版本同步完成！');
