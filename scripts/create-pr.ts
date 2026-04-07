#!/usr/bin/env node

/**
 * GitHub Pull Request 创建脚本
 *
 * 功能：
 * - 自动检测当前分支和主分支
 * - 从 commit 信息生成 PR 标题和描述
 * - 使用 GitHub REST API 创建 PR
 * - 支持草稿 PR 和预演模式
 *
 * 使用方法：
 * tsx scripts/create-pr.ts
 * tsx scripts/create-pr.ts --title "自定义标题"
 * tsx scripts/create-pr.ts --draft --dry-run
 */

import { consola } from "consola";
import { execa } from "execa";

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
 * 创建 PR 选项接口
 */
interface CreatePROptions {
  /** 自定义 PR 标题 */
  title?: string;
  /** 自定义 PR 描述 */
  body?: string;
  /** 目标分支（默认自动检测） */
  base?: string;
  /** 是否创建为草稿 */
  draft?: boolean;
  /** 预演模式，不实际创建 PR */
  dryRun?: boolean;
}

/**
 * Git 信息接口
 */
interface GitInfo {
  /** 仓库所有者 */
  owner: string;
  /** 仓库名称 */
  repo: string;
  /** 当前分支名称 */
  currentBranch: string;
  /** 主分支名称 */
  baseBranch: string;
  /** 与主分支的 commits */
  commits: Array<{
    /** commit hash */
    hash: string;
    /** commit 消息 */
    message: string;
  }>;
}

/**
 * PR 数据接口
 */
interface PRData {
  /** PR 标题 */
  title: string;
  /** PR 描述 */
  body: string;
  /** 源分支 */
  head: string;
  /** 目标分支 */
  base: string;
  /** 是否为草稿 */
  draft: boolean;
}

/**
 * GitHub API 错误响应接口
 */
interface GitHubApiError {
  message: string;
  errors?: Array<{
    message: string;
    resource: string;
    field: string;
    code?: string;
  }>;
}

/**
 * 获取远程仓库信息（owner/repo）
 *
 * @returns 仓库所有者和仓库名称
 * @throws 当无法获取远程仓库信息时抛出错误
 */
async function getRepoInfo(): Promise<{ owner: string; repo: string }> {
  try {
    // 获取 origin remote URL
    const { stdout: remoteUrl } = await execa("git", [
      "remote",
      "get-url",
      "origin",
    ]);

    // 解析 URL 格式：
    // - https: //github.com/owner/repo.git
    // - git@github.com:owner/repo.git
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?$/);
    if (!match) {
      throw new Error(`无法解析仓库 URL: ${remoteUrl}`);
    }

    return { owner: match[1], repo: match[2] };
  } catch (error) {
    throw new Error(
      `获取仓库信息失败: ${(error as Error).message}. 请确保已设置 origin remote。`
    );
  }
}

/**
 * 获取当前分支名称
 *
 * @returns 当前分支名称
 * @throws 当无法获取当前分支时抛出错误
 */
async function getCurrentBranch(): Promise<string> {
  try {
    const { stdout: branch } = await execa("git", ["branch", "--show-current"]);
    return branch.trim();
  } catch (error) {
    throw new Error(`获取当前分支失败: ${(error as Error).message}`);
  }
}

/**
 * 获取主分支名称（main 或 master）
 *
 * @returns 主分支名称
 */
async function getBaseBranch(): Promise<string> {
  try {
    // 尝试获取远程的 HEAD 分支
    const { stdout: symbolicRef } = await execa("git", [
      "symbolic-ref",
      "refs/remotes/origin/HEAD",
    ]);
    return symbolicRef.replace("refs/remotes/origin/", "").trim();
  } catch {
    // 如果无法获取，尝试检测 main 或 master
    try {
      await execa("git", ["rev-parse", "--verify", "origin/main"]);
      return "main";
    } catch {
      try {
        await execa("git", ["rev-parse", "--verify", "origin/master"]);
        return "master";
      } catch {
        // 默认返回 main
        return "main";
      }
    }
  }
}

/**
 * 获取与主分支的差异 commits
 *
 * @param baseBranch - 主分支名称
 * @returns commit 列表
 */
async function getCommits(baseBranch: string): Promise<
  Array<{
    hash: string;
    message: string;
  }>
> {
  try {
    // 先更新远程引用
    await execa("git", ["fetch", "origin", "--quiet"]);

    // 获取 commits
    const { stdout: logOutput } = await execa("git", [
      "--no-pager",
      "log",
      `origin/${baseBranch}..HEAD`,
      "--pretty=format:%H|%s",
    ]);

    if (!logOutput.trim()) {
      return [];
    }

    return logOutput
      .trim()
      .split("\n")
      .map((line) => {
        const [hash, ...messageParts] = line.split("|");
        return {
          hash,
          message: messageParts.join("|").trim(),
        };
      });
  } catch (error) {
    throw new Error(`获取 commits 失败: ${(error as Error).message}`);
  }
}

/**
 * 收集 Git 信息
 *
 * @returns Git 信息对象
 */
async function collectGitInfo(): Promise<GitInfo> {
  const repoInfo = await getRepoInfo();
  const currentBranch = await getCurrentBranch();
  const baseBranch = await getBaseBranch();
  const commits = await getCommits(baseBranch);

  return {
    ...repoInfo,
    currentBranch,
    baseBranch,
    commits,
  };
}

/**
 * 从 commit 信息生成 PR 标题
 *
 * @param commits - commit 列表
 * @param customTitle - 自定义标题
 * @returns PR 标题
 */
function generateTitle(
  commits: Array<{ hash: string; message: string }>,
  customTitle?: string
): string {
  if (customTitle) {
    return customTitle;
  }

  if (commits.length === 0) {
    return "feat: 更新";
  }

  // 使用第一个 commit 的消息作为标题
  return commits[0].message;
}

/**
 * 从 commit 信息生成 PR 描述
 *
 * @param commits - commit 列表
 * @param customBody - 自定义描述
 * @returns PR 描述
 */
function generateBody(
  commits: Array<{ hash: string; message: string }>,
  customBody?: string
): string {
  if (customBody) {
    return customBody;
  }

  if (commits.length === 0) {
    return "## 概述\n\n此 PR 包含一些更新。";
  }

  const commitsList = commits
    .map((commit) => `- ${commit.message} (${commit.hash.slice(0, 7)})`)
    .join("\n");

  return `## 概述

此 PR 包含 ${commits.length} 个 commit。

## 变更内容

${commitsList}

## 测试计划

- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试完成

🤖 Generated with [Claude Code](https://claude.com/claude-code)
`;
}

/**
 * 通过 GitHub API 创建 PR
 *
 * @param owner - 仓库所有者
 * @param repo - 仓库名称
 * @param prData - PR 数据
 * @returns 创建的 PR 信息
 * @throws 当 API 请求失败时抛出错误
 */
async function createPullRequest(
  owner: string,
  repo: string,
  prData: PRData
): Promise<{ html_url: string; number: number }> {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error(
      "GITHUB_TOKEN 环境变量未设置。请设置 GitHub Personal Access Token:\n" +
        "  export GITHUB_TOKEN=your_token_here\n\n" +
        "或使用 GitHub CLI:\n" +
        "  export GITHUB_TOKEN=$(gh auth token)"
    );
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(prData),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as GitHubApiError;
      const errorMessage = errorData.message || response.statusText;

      // 检查是否是认证错误
      if (response.status === 401) {
        throw new Error(
          "GitHub 认证失败。请检查 GITHUB_TOKEN 是否正确且具有 repo 权限。"
        );
      }

      // 检查是否是分支未推送错误
      if (errorData.errors?.[0]?.message?.includes("not found")) {
        throw new Error(
          `分支 '${prData.head}' 未推送到远程仓库。请先运行: git push origin ${prData.head}`
        );
      }

      // 检查是否 PR 已存在
      if (response.status === 422) {
        throw new Error(
          `PR 已存在或请求验证失败: ${errorMessage}\n` +
            `可能原因：分支 ${prData.head} 没有与 ${prData.base} 的差异。`
        );
      }

      throw new Error(`GitHub API 错误 (${response.status}): ${errorMessage}`);
    }

    const data = (await response.json()) as {
      html_url: string;
      number: number;
    };
    return data;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`创建 PR 失败: ${String(error)}`);
  }
}

/**
 * 显示预览信息
 *
 * @param gitInfo - Git 信息
 * @param prData - PR 数据
 */
function showPreview(gitInfo: GitInfo, prData: PRData): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("📋 PR 预览");
  console.log("=".repeat(60));
  console.log(`仓库: ${gitInfo.owner}/${gitInfo.repo}`);
  console.log(`源分支: ${prData.head}`);
  console.log(`目标分支: ${prData.base}`);
  console.log(`标题: ${prData.title}`);
  console.log(`草稿: ${prData.draft ? "是" : "否"}`);
  console.log(`\n描述:`);
  console.log("-".repeat(60));
  console.log(prData.body);
  console.log("-".repeat(60));
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 主函数
 *
 * @param options - 创建 PR 选项
 */
async function main(options: CreatePROptions): Promise<void> {
  console.log("\n🚀 GitHub PR 创建脚本启动");
  console.log("=".repeat(60));

  // 1. 收集 Git 信息
  log("info", "📊 收集 Git 信息...");
  const gitInfo = await collectGitInfo();

  log("info", `  仓库: ${gitInfo.owner}/${gitInfo.repo}`);
  log("info", `  当前分支: ${gitInfo.currentBranch}`);
  log("info", `  主分支: ${gitInfo.baseBranch}`);
  log("info", `  差异 commits: ${gitInfo.commits.length} 个`);

  // 检查是否在主分支上
  if (gitInfo.currentBranch === gitInfo.baseBranch) {
    log("error", `当前分支是主分支 (${gitInfo.baseBranch})，无法创建 PR。`);
    log("info", "请先创建并切换到一个新分支:");
    log("info", "  git checkout -b feature/my-feature");
    process.exit(1);
    return;
  }

  // 检查是否有 commits
  if (gitInfo.commits.length === 0) {
    log("warn", `当前分支与 ${gitInfo.baseBranch} 没有差异，无法创建 PR。`);
    log("info", "请先进行一些提交:");
    log("info", "  git add .");
    log("info", "  git commit -m 'feat: 添加新功能'");
    log("info", "  git push origin <branch>");
    process.exit(1);
    return;
  }

  // 2. 生成 PR 内容
  const baseBranch = options.base || gitInfo.baseBranch;
  const prData: PRData = {
    title: generateTitle(gitInfo.commits, options.title),
    body: generateBody(gitInfo.commits, options.body),
    head: gitInfo.currentBranch,
    base: baseBranch,
    draft: options.draft ?? false,
  };

  // 3. 显示预览
  showPreview(gitInfo, prData);

  // 4. 预演模式
  if (options.dryRun) {
    log("info", "💡 这是预演模式，未实际创建 PR");
    log("info", "如需创建 PR，请移除 --dry-run 参数");
    return;
  }

  // 5. 创建 PR
  log("info", "📤 创建 Pull Request...");
  try {
    const result = await createPullRequest(gitInfo.owner, gitInfo.repo, prData);
    log("success", `✅ PR 创建成功！`);
    log("info", `  编号: #${result.number}`);
    log("info", `  链接: ${result.html_url}`);
  } catch (error) {
    log("error", (error as Error).message);
    process.exit(1);
    return;
  }

  console.log(`${"=".repeat(60)}\n`);
}

/**
 * 解析命令行参数
 *
 * @returns 解析后的选项
 */
function parseArgs(): CreatePROptions {
  const args = process.argv.slice(2);

  const options: CreatePROptions = {
    title: undefined,
    body: undefined,
    base: undefined,
    draft: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--title":
      case "-t":
        options.title = args[++i];
        break;
      case "--body":
      case "-b":
        options.body = args[++i];
        break;
      case "--base":
        options.base = args[++i];
        break;
      case "--draft":
      case "-d":
        options.draft = true;
        break;
      case "--dry-run":
      case "-n":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        showHelp();
        process.exit(0);
        break;
      default:
        log("error", `未知参数: ${arg}`);
        log("info", "使用 --help 查看帮助信息");
        process.exit(1);
    }
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
GitHub Pull Request 创建脚本

使用方法：
  tsx scripts/create-pr.ts [选项]

选项：
  -t, --title <标题>    自定义 PR 标题
  -b, --body <描述>     自定义 PR 描述
  --base <分支>         指定目标分支（默认自动检测主分支）
  -d, --draft           创建为草稿 PR
  -n, --dry-run         预演模式，不实际创建 PR
  -h, --help            显示帮助信息

环境变量：
  GITHUB_TOKEN          GitHub Personal Access Token（必需）

示例：
  # 基本用法（自动生成标题和描述）
  tsx scripts/create-pr.ts

  # 自定义标题
  tsx scripts/create-pr.ts --title "feat: 添加新功能"

  # 自定义标题和描述
  tsx scripts/create-pr.ts -t "fix: 修复 bug" -b "详细描述修复内容"

  # 创建草稿 PR
  tsx scripts/create-pr.ts --draft

  # 预演模式（不实际创建）
  tsx scripts/create-pr.ts --dry-run

  # 指定目标分支
  tsx scripts/create-pr.ts --base develop

设置 GitHub Token:
  export GITHUB_TOKEN=your_token_here

  或使用 GitHub CLI:
  export GITHUB_TOKEN=$(gh auth token)
`);
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
const isMainModule = process.argv[1]?.endsWith("create-pr.ts") ?? false;
if (isMainModule) {
  const options = parseArgs();
  main(options).catch((error: Error) => {
    log("error", `主函数执行失败: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { collectGitInfo, generateBody, generateTitle, main, parseArgs };
