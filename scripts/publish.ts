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
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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
  /** 是否为正式版 */
  isRelease: boolean;
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
      isRelease: false,
    };
  }

  if (rcMatch) {
    return {
      original: version,
      type: "prerelease",
      prereleaseId: "rc",
      npmTag: "rc",
      isRelease: false,
    };
  }

  if (releaseMatch) {
    return {
      original: version,
      type: "release",
      prereleaseId: "",
      npmTag: "latest",
      isRelease: true,
    };
  }

  throw new Error(`无效的版本号格式: ${version}`);
}

/**
 * 从 Nx 获取项目的构建依赖关系
 *
 * @returns 项目名到依赖项目列表的映射
 */
async function getNxDependencies(): Promise<Map<string, string[]>> {
  const { stdout } = await execaCommand("npx nx show projects --json", {
    stdio: "pipe",
  });
  const projects: string[] = JSON.parse(stdout);

  const deps = new Map<string, string[]>();
  for (const project of projects) {
    try {
      const result = await execaCommand(
        `npx nx show project ${project} --json`,
        { stdio: "pipe" }
      );
      const data = JSON.parse(result.stdout);
      const buildDeps: string[] = data?.targets?.build?.dependsOn || [];
      // 提取项目名（去掉 :build 等后缀）
      const depProjects = buildDeps
        .map((d: string) => d.split(":")[0])
        .filter((d: string) => d);
      deps.set(project, depProjects);
    } catch {
      // 如果项目没有 build target 或无法获取信息，跳过
      deps.set(project, []);
    }
  }

  return deps;
}

/**
 * 拓扑排序：根据依赖关系对项目排序
 *
 * @param projects - 要排序的项目列表
 * @param dependencies - 项目依赖关系映射
 * @returns 排序后的项目列表
 * @throws 当检测到循环依赖时抛出错误
 */
function topologicalSort(
  projects: string[],
  dependencies: Map<string, string[]>
): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(project: string) {
    if (visited.has(project)) return;
    if (visiting.has(project)) {
      throw new Error(`检测到循环依赖：${project}`);
    }

    visiting.add(project);
    const deps = dependencies.get(project) || [];
    for (const dep of deps) {
      if (projects.includes(dep)) {
        visit(dep);
      }
    }
    visiting.delete(project);
    visited.add(project);
    sorted.push(project);
  }

  for (const project of projects) {
    visit(project);
  }

  return sorted;
}

/**
 * 获取要发布的包列表（自动按依赖关系排序）
 *
 * 该函数从 Nx 获取项目依赖关系，自动进行拓扑排序，
 * 确保包按照正确的依赖顺序发布。
 *
 * @returns 包列表
 */
async function getPackages(): Promise<PackageInfo[]> {
  // Nx 管理的项目（需要发布到 npm 的项目）
  const nxProjects = [
    "shared-types",
    "config",
    "mcp-core",
    "endpoint",
    "calculator-mcp",
    "datetime-mcp",
    "cli",
  ];

  // 从 Nx 获取依赖关系
  const dependencies = await getNxDependencies();

  // 拓扑排序
  const sortedProjects = topologicalSort(nxProjects, dependencies);

  // 项目名到包信息的映射（使用 Map 避免 esbuild 对带连字符键的解析问题）
  const projectToPackage = new Map<string, PackageInfo>([
    ["shared-types", {
      name: "@xiaozhi-client/shared-types",
      path: "packages/shared-types",
    }],
    ["config", {
      name: "@xiaozhi-client/config",
      path: "packages/config",
    }],
    ["mcp-core", {
      name: "@xiaozhi-client/mcp-core",
      path: "packages/mcp-core",
    }],
    ["endpoint", {
      name: "@xiaozhi-client/endpoint",
      path: "packages/endpoint",
    }],
    ["calculator-mcp", {
      name: "@xiaozhi-client/calculator-mcp",
      path: "mcps/calculator-mcp",
    }],
    ["datetime-mcp", {
      name: "@xiaozhi-client/datetime-mcp",
      path: "mcps/datetime-mcp",
    }],
    ["cli", {
      name: "@xiaozhi-client/cli",
      path: "packages/cli",
    }],
  ]);

  // 按排序后的顺序构建包列表
  const packages: PackageInfo[] = [];
  for (const project of sortedProjects) {
    const pkgInfo = projectToPackage.get(project);
    if (pkgInfo) {
      packages.push(pkgInfo);
    }
  }

  // 添加根包（最后发布，因为它依赖所有子包）
  packages.push({
    name: "xiaozhi-client",
    path: ".",
  });

  return packages;
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
  log("info", `📦 使用 Nx Release 更新版本号为: ${version}`);

  // 使用 Nx Release 更新版本（自动处理所有包和依赖）
  await runCommand(
    `npx nx release version ${version}${dryRun ? " --dry-run" : ""}`,
    { dryRun }
  );

  // 手动同步根目录 package.json 的版本号
  // 因为 Nx Release 只更新 release.projects 中的子包（cli、config、shared-types），不更新根目录
  // 而 tsup 构建时从根目录 package.json 读取版本号注入到代码中
  // 如果不在构建前同步，会导致代码中的版本号与实际发布版本不一致
  if (!dryRun) {
    const rootPkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
    pkg.version = version;
    writeFileSync(rootPkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    log("success", `✅ 已同步根 package.json 版本到 ${version}`);
  } else {
    log("info", `[预演] 将同步根 package.json 版本到 ${version}`);
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
 * 推送 Git 提交和 tag 到远程仓库
 *
 * @param dryRun - 是否为预演模式
 */
async function pushToRemote(dryRun: boolean): Promise<void> {
  log("info", "📤 推送 Git 提交和 tag 到远程仓库...");

  if (dryRun) {
    log("info", "[预演] git push origin <current-branch>");
    log("info", "[预演] git push origin --tags");
    return;
  }

  try {
    // 获取当前分支
    const { stdout: currentBranch } = await execaCommand("git branch --show-current", {
      stdio: "pipe",
    });
    const branch = currentBranch.trim();

    // 推送提交和 tag
    await runCommand(`git push origin ${branch}`, { dryRun: false });
    await runCommand("git push origin --tags", { dryRun: false });

    log("success", "✅ Git 提交和 tag 已推送到远程仓库");
  } catch (error) {
    log("error", `推送到远程仓库失败: ${(error as Error).message}`);
    throw error;
  }
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
  const packages = await getPackages();

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

  // 6. 推送 Git 提交和 tag 到远程仓库
  // Nx Release 会自动生成并提交 CHANGELOG.md
  if (versionInfo.isRelease && !dryRun) {
    try {
      await pushToRemote(dryRun);
    } catch (error) {
      log("error", `Git 操作失败: ${(error as Error).message}`);
      log("warn", "⚠️ NPM 包已发布，但 Git 操作失败，请手动处理");
      process.exit(1);
      return;
    }
  }

  // 7. 完成
  console.log(`\n${"=".repeat(60)}`);
  log("success", "🎉 发布流程完成！");
  if (dryRun) {
    log("info", "💡 这是预演模式，未实际发布到 npm");
  }
  if (versionInfo.isRelease) {
    log("info", "💡 正式版：CHANGELOG.md 由 Nx Release 自动更新，Git 提交和 tag 已推送到远程");
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
