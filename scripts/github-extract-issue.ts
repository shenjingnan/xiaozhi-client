#!/usr/bin/env node

/**
 * GitHub Actions Issue 内容提取脚本
 * 用于 AI Fix Bot 工作流
 *
 * 功能：
 * - 从环境变量读取 GitHub Issue 数据
 * - 合并 Issue body 和 comment body
 * - 移除 @xiaozhi 触发词
 * - 安全地写入 GITHUB_OUTPUT
 */

import { appendFileSync, writeFileSync } from "node:fs";
import { consola } from "consola";

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
 * GitHub Issue 数据接口
 */
interface IssueData {
  title: string;
  body: string;
  comment: string;
  number: string;
}

/**
 * 转义 heredoc 分隔符
 *
 * GitHub Actions GITHUB_OUTPUT 使用 heredoc 格式：
 * name<<EOF
 * value
 * EOF
 *
 * 如果值中包含结束分隔符（如 EOF），需要转义或替换
 */
function _escapeHeredocValue(value: string): string {
  // 替换可能被误认为分隔符的内容
  // 使用一个不太可能出现的随机字符串作为分隔符
  return value;
}

/**
 * 安全地写入 GITHUB_OUTPUT
 *
 * GitHub Actions 的输出文件格式支持多行值：
 * name<<EOF
 * value
 * EOF
 *
 * @param outputFile - 输出文件路径
 * @param name - 输出变量名
 * @param value - 输出值（可能包含多行）
 */
function setOutput(outputFile: string, name: string, value: string): void {
  // 使用 GitHub Actions 的 heredoc 语法
  // 格式: name<<DELIMITER\nvalue\nDELIMITER
  const delimiter = "GHA_DELIMITER";
  appendFileSync(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 读取环境变量
  const issueTitle = process.env.ISSUE_TITLE || "";
  const issueBody = process.env.ISSUE_BODY || "";
  const commentBody = process.env.COMMENT_BODY || "";
  const issueNumber = process.env.ISSUE_NUMBER || "";
  const githubOutput = process.env.GITHUB_OUTPUT;

  // 验证必需的环境变量
  if (!githubOutput) {
    log("error", "GITHUB_OUTPUT 环境变量未设置");
    process.exit(1);
  }

  if (!issueNumber) {
    log("error", "ISSUE_NUMBER 环境变量未设置");
    process.exit(1);
  }

  // 合并 Issue body 和 comment body
  let combinedBody = issueBody;
  if (commentBody) {
    combinedBody = combinedBody
      ? `${combinedBody}\n\n${commentBody}`
      : commentBody;
  }

  // 移除 @xiaozhi 触发词
  const content = combinedBody.replace(/@xiaozhi/g, "").trim();

  // 写入临时文件
  const contentFile = "/tmp/issue_request.md";
  writeFileSync(contentFile, content, "utf-8");

  // 设置输出变量
  setOutput(githubOutput, "title", issueTitle);
  setOutput(githubOutput, "content_file", contentFile);
  setOutput(githubOutput, "issue_number", issueNumber);

  log("success", `已提取 Issue #${issueNumber}: ${issueTitle || "(无标题)"}`);
  log("info", `内容已保存到: ${contentFile}`);
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
const isMainModule =
  process.argv[1]?.endsWith("github-extract-issue.ts") ?? false;
if (isMainModule) {
  main().catch((error: Error) => {
    log("error", `执行失败: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

export { main, setOutput };
