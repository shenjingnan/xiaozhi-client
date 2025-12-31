#!/usr/bin/env node

/**
 * NPM 多包发布脚本
 *
 * 功能：
 * - 解析版本号，识别类型 (beta/rc/正式版)
 * - 确定对应的 npm 标签 (beta/rc/latest)
 * - 使用 Nx Release 更新版本
 * - 执行构建
 * - 按依赖顺序发布所有包
 * - 支持预演模式 (dry-run)
 *
 * 使用方法：
 * pnpm release:publish --version 1.0.0-beta.0
 * pnpm release:publish --version 1.0.0-rc.0
 * pnpm release:publish --version 1.0.0
 * pnpm release:publish:dry --version 1.0.0-beta.0
 */

import { execaCommand } from "execa";
import { consola } from "consola";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * 版本类型
 */
type VersionType = "release" | "prerelease";

/**
 * 预发布标识
 */
type PrereleaseId = "beta" | "rc" | "";

/**
 * 版本信息接口
 */
interface VersionInfo {
  /** 原始版本号 */
  original: string;
  /** 版本类型 */
  type: VersionType;
  /** 预发布标识 */
  prereleaseId: PrereleaseId;
  /** npm 标签 */
  npmTag: "latest" | "beta" | "rc";
}

/**
 * 发布包信息接口
 */
interface PackageInfo {
  /** 包名 */
  name: string;
  /** 发布路径 */
  path: string;
}

/**
 * 日志级别
 */
type LogLevel = "info" | "success" | "error" | "warn";

/**
 * 日志函数
 */
function log(level: LogLevel, message: string): void {
  const methods: Record<LogLevel, keyof typeof consola> = {
    info: "info",
    success: "success",
    error: "error",
    warn: "warn",
  };
  (consola[methods[level]] as (msg: string) => void)(message);
}

/**
 * 解析版本号
 *
 * @param version - 版本号字符串
 * @returns 版本信息
 * @throws 当版本号格式无效时抛出错误
 */
function parseVersion(version: string): VersionInfo {
  const betaMatch = version.match(/^(\d+\.\d+\.\d+)-beta\.(\d+)$/);
  const rcMatch = version.match(/^(\d+\.\d+\.\d+)-rc\.(\d+)$/);
  const releaseMatch = version.match(/^(\d+\.\d+\.\d+)$/);

  if (betaMatch) {
    return {
      original: version,
      type: "prerelease",
      prereleaseId: "beta",
      npmTag: "beta",
    };
  }

  if (rcMatch) {
    return {
      original: version,
      type: "prerelease",
      prereleaseId: "rc",
      npmTag: "rc",
    };
  }

  if (releaseMatch) {
    return {
      original: version,
      type: "release",
      prereleaseId: "",
      npmTag: "latest",
    };
  }

  throw new Error(`无效的版本号格式: ${version}`);
}

/**
 * 获取要发布的包列表
 *
 * 发布顺序：按依赖关系排序
 * 1. shared-types (无依赖)
 * 2. config (无内部依赖)
 * 3. cli (依赖 config)
 * 4. xiaozhi-client (根包)
 *
 * @returns 包列表
 */
function getPackages(): PackageInfo[] {
  return [
    {
      name: "@xiaozhi-client/shared-types",
      path: "packages/shared-types",
    },
    {
      name: "@xiaozhi-client/config",
      path: "packages/config",
    },
    {
      name: "@xiaozhi-client/cli",
      path: "packages/cli",
    },
    {
      name: "xiaozhi-client",
      path: ".",
    },
  ];
}

/**
 * 执行命令
 *
 * @param command - 要执行的命令
 * @param options - 执行选项
 * @returns 执行结果
 */
async function runCommand(
  command: string,
  options: {
    dryRun?: boolean;
    extraEnv?: Record<string, string>;
    cwd?: string;
  } = {}
): Promise<void> {
  const { dryRun = false, extraEnv = {}, cwd } = options;

  if (dryRun) {
    const envPrefix = Object.keys(extraEnv).length > 0
      ? `${Object.entries(extraEnv).map(([k, v]) => `${k}=${v}`).join(" ")} `
      : "";
    const cwdPrefix = cwd ? `(cd ${cwd}) ` : "";
    log("info", `[预演] ${cwdPrefix}${envPrefix}${command}`);
    return;
  }

  log("info", `执行: ${command}${cwd ? ` (在 ${cwd})` : ""}`);
  try {
    const result = await execaCommand(command, {
      stdio: "inherit",
      env: { NODE_ENV: "production", ...extraEnv },
      cwd,
    });

    // 检查退出码
    if (result.exitCode !== 0) {
      throw new Error(`命令退出码: ${result.exitCode}`);
    }
  } catch (error) {
    log("error", `命令执行失败: ${command}`);
    if (error instanceof Error) {
      log("error", `错误信息: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 更新版本号
 *
 * @param version - 目标版本号
 * @param dryRun - 是否为预演模式
 */
async function updateVersion(
  version: string,
  dryRun: boolean
): Promise<void> {
  log("info", `📦 更新版本号为: ${version}`);

  // 更新子包版本号（通过 Nx Release）
  await runCommand(
    `npx nx release version --version ${version}${dryRun ? " --dry-run" : ""}`,
    { dryRun }
  );

  // 额外更新根包版本号（Nx Release 只更新子包，不更新根包）
  if (!dryRun) {
    const rootPackageJsonPath = join(process.cwd(), "package.json");
    const packageJson = JSON.parse(await readFile(rootPackageJsonPath, "utf-8"));
    packageJson.version = version;
    await writeFile(
      rootPackageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
    log("info", "✅ 根包版本号已更新");
  }

  log("success", `✅ 版本号已更新: ${version}`);
}

/**
 * 执行构建
 *
 * @param dryRun - 是否为预演模式
 */
async function runBuild(dryRun: boolean): Promise<void> {
  log("info", "🔨 开始构建项目...");

  // 禁用 Nx daemon 以避免状态异常问题
  await runCommand("pnpm build", { dryRun, extraEnv: { NX_DAEMON: "false" } });
  log("success", "✅ 项目构建完成");
}

/**
 * 发布单个包
 *
 * @param pkg - 包信息
 * @param npmTag - npm 标签
 * @param dryRun - 是否为预演模式
 */
async function publishPackage(
  pkg: PackageInfo,
  npmTag: string,
  dryRun: boolean
): Promise<void> {
  // 所有包都使用相同的标签
  const tag = npmTag;
  const tagFlag = `--tag ${tag}`;

  log("info", `📤 发布包: ${pkg.name} (标签: ${tag})`);

  const publishCmd = `pnpm publish --access public ${tagFlag} --no-git-checks`;
  await runCommand(publishCmd, { dryRun, cwd: pkg.path || "." });

  log("success", `✅ ${pkg.name} 发布成功`);
}

/**
 * 发布所有包
 *
 * @param npmTag - npm 标签
 * @param dryRun - 是否为预演模式
 */
async function publishAllPackages(npmTag: string, dryRun: boolean): Promise<void> {
  const packages = getPackages();

  log("info", `📚 开始发布所有包 (标签: ${npmTag})`);

  for (const pkg of packages) {
    await publishPackage(pkg, npmTag, dryRun);
  }

  log("success", "✅ 所有包发布完成");
}

/**
 * 显示发布摘要
 *
 * @param versionInfo - 版本信息
 * @param dryRun - 是否为预演模式
 */
function showSummary(versionInfo: VersionInfo, dryRun: boolean): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("📋 发布摘要");
  console.log("=".repeat(60));
  console.log(`版本号: ${versionInfo.original}`);
  console.log(`版本类型: ${versionInfo.type === "release" ? "正式版" : "预发布版"}`);
  console.log(`预发布标识: ${versionInfo.prereleaseId || "无"}`);
  console.log(`npm 标签: ${versionInfo.npmTag}`);
  console.log(`预演模式: ${dryRun ? "是" : "否"}`);
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 主函数
 *
 * @param version - 版本号
 * @param dryRun - 是否为预演模式
 */
async function main(version: string, dryRun: boolean): Promise<void> {
  console.log("\n🚀 NPM 多包发布脚本启动");
  console.log("=".repeat(60));

  // 1. 解析版本号
  let versionInfo: VersionInfo;
  try {
    versionInfo = parseVersion(version);
  } catch (error) {
    log("error", (error as Error).message);
    log("info", "\n支持的版本号格式:");
    log("info", "  - 正式版: 1.0.0");
    log("info", "  - Beta版: 1.0.0-beta.0");
    log("info", "  - RC版: 1.0.0-rc.0");
    process.exit(1);
    return;
  }

  // 2. 显示发布摘要
  showSummary(versionInfo, dryRun);

  // 3. 更新版本号
  try {
    await updateVersion(version, dryRun);
  } catch (error) {
    log("error", `版本号更新失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 4. 执行构建
  try {
    await runBuild(dryRun);
  } catch (error) {
    log("error", `项目构建失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 5. 发布所有包
  try {
    await publishAllPackages(versionInfo.npmTag, dryRun);
  } catch (error) {
    log("error", `包发布失败: ${(error as Error).message}`);
    process.exit(1);
    return;
  }

  // 6. 完成
  console.log(`\n${"=".repeat(60)}`);
  log("success", "🎉 发布流程完成！");
  if (dryRun) {
    log("info", "💡 这是预演模式，未实际发布到 npm");
  }
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 解析命令行参数
 */
function parseArgs(): { version: string; dryRun: boolean } {
  const args = process.argv.slice(2);

  let version = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--version" || arg === "-v") {
      version = args[++i];
    } else if (arg === "--dry-run" || arg === "-d") {
      dryRun = true;
    } else if (!version && !arg.startsWith("--")) {
      version = arg;
    }
  }

  if (!version) {
    log("error", "缺少版本号参数");
    log("info", "\n使用方法:");
    log("info", "  tsx scripts/publish.ts --version <版本号>");
    log("info", "  tsx scripts/publish.ts --version <版本号> --dry-run");
    log("info", "\n示例:");
    log("info", "  tsx scripts/publish.ts --version 1.0.0-beta.0");
    log("info", "  tsx scripts/publish.ts --version 1.0.0-rc.0");
    log("info", "  tsx scripts/publish.ts --version 1.0.0");
    process.exit(1);
  }

  return { version, dryRun };
}

// 错误处理
process.on("uncaughtException", (error: Error) => {
  log("error", `未捕获的异常: ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  log("error", `未处理的 Promise 拒绝: ${String(reason)}`);
  process.exit(1);
});

// 检查是否直接运行此脚本
const isMainModule = process.argv[1]?.endsWith("publish.ts") ?? false;
if (isMainModule) {
  const { version, dryRun } = parseArgs();
  main(version, dryRun).catch((error: Error) => {
    log("error", `主函数执行失败: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { main, parseVersion, getPackages };
