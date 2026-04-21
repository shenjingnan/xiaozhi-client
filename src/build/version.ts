/**
 * 构建时版本配置工具
 *
 * 从根目录 package.json 读取版本信息，供构建工具统一使用
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 获取版本注入配置
 *
 * @param fromDir - 调用方所在的目录路径，用于定位根 package.json
 *                  默认为当前文件向上两级（即项目根目录）
 * @returns 构建工具 define 所需的键值对
 */
export function getVersionDefine(fromDir?: string): Record<string, string> {
  const rootPkgPath = resolve(
    fromDir ?? import.meta.dirname,
    "..",
    "..",
    "package.json"
  );
  const pkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));

  return {
    __VERSION__: JSON.stringify(pkg.version),
    __APP_NAME__: JSON.stringify(pkg.name),
  };
}
