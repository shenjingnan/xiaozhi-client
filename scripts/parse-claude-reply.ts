#!/usr/bin/env node

/**
 * Claude Issue 回复解析脚本
 *
 * 功能：
 * - 获取指定 Issue 的所有评论
 * - 找到最新的 Claude 回复（作者为 github-actions[bot] 且包含 "Claude finished"）
 * - 从回复内容中解析分支名、PR 标题和评论内容
 * - 输出 JSON 到 stdout，设置 GitHub Actions 输出变量
 *
 * 使用方法：
 * tsx scripts/parse-claude-reply.ts --issue 761
 * tsx scripts/parse-claude-reply.ts --issue 761 --repo shenjingnan/xiaozhi-client
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
 * 脚本选项接口
 */
interface ParseOptions {
  /** Issue 编号 */
  issue: string;
  /** 仓库路径（默认从 git remote 获取） */
  repo?: string;
}

/**
 * Issue 评论接口
 */
interface IssueComment {
  /** 评论 ID */
  id: number;
  /** 评论作者 */
  user: {
    /** 作者登录名 */
    login: string;
  };
  /** 评论内容 */
  body: string;
  /** 创建时间 */
  created_at: string;
}

/**
 * 解析结果接口
 */
interface ParseResult {
  /** 是否成功 */
  success: boolean;
  /** 分支名称 */
  branchName?: string;
  /** PR 标题 */
  title?: string;
  /** PR 描述 */
  body?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 解析命令行参数
 *
 * @returns 解析后的选项
 */
function parseArgs(): ParseOptions {
  const args = process.argv.slice(2);
  const options: ParseOptions = {
    issue: "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--issue":
      case "-i":
        options.issue = args[++i];
        break;
      case "--repo":
      case "-r":
        options.repo = args[++i];
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

  if (!options.issue) {
    log("error", "缺少必需参数: --issue");
    log("info", "使用 --help 查看帮助信息");
    process.exit(1);
  }

  return options;
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
Claude Issue 回复解析脚本

使用方法：
  tsx scripts/parse-claude-reply.ts --issue <编号> [选项]

选项：
  -i, --issue <编号>     Issue 编号（必需）
  -r, --repo <仓库>      仓库路径（默认从 git remote 获取）
  -h, --help            显示帮助信息

示例：
  # 解析 Issue 761
  tsx scripts/parse-claude-reply.ts --issue 761

  # 指定仓库
  tsx scripts/parse-claude-reply.ts --issue 761 --repo shenjingnan/xiaozhi-client

输出格式：
  {
    "success": true,
    "branchName": "claude/issue-761-20260204-0158",
    "title": "docs(handlers): 添加文件级 JSDoc 注释",
    "body": "## 摘要\\n\\n..."
  }
`);
}

/**
 * 获取远程仓库信息（owner/repo）
 *
 * @returns 仓库所有者和仓库名称
 * @throws 当无法获取远程仓库信息时抛出错误
 */
async function getRepoInfo(): Promise<string> {
  try {
    // 获取 origin remote URL
    const { stdout: remoteUrl } = await execa("git", [
      "remote",
      "get-url",
      "origin",
    ]);

    // 解析 URL 格式：
    // - https://github.com/owner/repo.git
    // - git@github.com:owner/repo.git
    const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?$/);
    if (!match) {
      throw new Error(`无法解析仓库 URL: ${remoteUrl}`);
    }

    return `${match[1]}/${match[2]}`;
  } catch (error) {
    throw new Error(
      `获取仓库信息失败: ${(error as Error).message}. 请确保已设置 origin remote。`
    );
  }
}

/**
 * 获取 Issue 的所有评论
 *
 * @param repo - 仓库路径（owner/repo）
 * @param issueNumber - Issue 编号
 * @returns Issue 评论列表
 * @throws 当获取评论失败时抛出错误
 */
async function getIssueComments(
  repo: string,
  issueNumber: string
): Promise<IssueComment[]> {
  try {
    const { stdout } = await execa("gh", [
      "api",
      `repos/${repo}/issues/${issueNumber}/comments`,
      "--jq",
      ".",
    ]);

    return JSON.parse(stdout) as IssueComment[];
  } catch (error) {
    throw new Error(
      `获取 Issue 评论失败: ${(error as Error).message}. 请确保已安装 gh CLI 并通过认证。`
    );
  }
}

/**
 * 查找最新的 Claude 回复
 *
 * @param comments - Issue 评论列表
 * @returns 最新的 Claude 回复，如果没有找到则返回 null
 */
function findLatestClaudeReply(comments: IssueComment[]): IssueComment | null {
  // 过滤出 Claude 的回复（作者为 github-actions[bot] 且包含 "Claude finished"）
  const claudeComments = comments.filter(
    (comment) =>
      comment.user.login === "github-actions[bot]" &&
      comment.body.includes("Claude finished")
  );

  if (claudeComments.length === 0) {
    return null;
  }

  // 按创建时间排序，返回最新的
  claudeComments.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return claudeComments[0];
}

/**
 * 从回复内容中提取分支名
 *
 * @param body - 回复内容
 * @returns 分支名称，如果没有找到则返回 null
 */
function extractBranchName(body: string): string | null {
  // 匹配格式：`claude/issue-761-20260204-0158`
  const branchRegex = /`([a-z\/\-0-9]+)`/g;
  const matches = body.matchAll(branchRegex);

  for (const match of matches) {
    const branchName = match[1];
    // 检查是否是 claude 分支（以 claude/ 开头）
    if (branchName.startsWith("claude/")) {
      return branchName;
    }
  }

  return null;
}

/**
 * 从回复内容中提取 URL 参数
 *
 * @param body - 回复内容
 * @returns 包含 title 和 body 的对象，如果没有找到则返回 null
 */
function extractUrlParams(body: string): { title: string; body: string } | null {
  // 查找 Create PR 链接
  // 格式：[Create PR ➔](https://github.com/.../compare/main...branch?quick_pull=1&title=xxx&body=xxx)
  // 使用非贪婪匹配来获取完整的 URL，匹配任意字符（包括箭头等特殊字符）
  const prLinkRegex =
    /\[Create[^\]]+PR[^\]]*\]\((https:\/\/github\.com\/[^)]+quick_pull=1[^)]*)\)/;
  const match = body.match(prLinkRegex);

  if (!match) {
    return null;
  }

  try {
    const url = new URL(match[1]);
    const title = url.searchParams.get("title");
    const body = url.searchParams.get("body");

    if (!title || !body) {
      return null;
    }

    // 解码 URL 编码的参数
    return {
      title: decodeURIComponent(title),
      body: decodeURIComponent(body),
    };
  } catch {
    return null;
  }
}

/**
 * 解析 Claude 回复
 *
 * @param body - 回复内容
 * @returns 解析结果
 */
function parseClaudeReply(body: string): ParseResult {
  // 提取分支名
  const branchName = extractBranchName(body);
  if (!branchName) {
    return {
      success: false,
      error: "无法从回复中提取分支名",
    };
  }

  return {
    success: true,
    branchName,
  };
}

/**
 * 主函数
 *
 * @param options - 解析选项
 */
async function main(options: ParseOptions): Promise<void> {
  // 获取仓库信息
  const repo = options.repo || (await getRepoInfo());

  log("info", `📊 获取 Issue #${options.issue} 的评论...`);
  log("info", `  仓库: ${repo}`);

  // 获取 Issue 评论
  const comments = await getIssueComments(repo, options.issue);
  log("info", `  找到 ${comments.length} 条评论`);

  // 查找最新的 Claude 回复
  const claudeReply = findLatestClaudeReply(comments);
  if (!claudeReply) {
    const result: ParseResult = {
      success: false,
      error: "未找到 Claude 的回复",
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
    return;
  }

  log("success", `  找到 Claude 回复（创建于 ${claudeReply.created_at}）`);

  // 解析回复内容
  const result = parseClaudeReply(claudeReply.body);

  if (!result.success) {
    log("error", `解析失败: ${result.error}`);
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
    return;
  }

  // 输出 JSON 到 stdout
  console.log(JSON.stringify(result , null, 2));
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
const isMainModule = process.argv[1]?.endsWith("parse-claude-reply.ts") ?? false;
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

export { main, parseClaudeReply, extractBranchName, extractUrlParams };
