import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("CLI create command", () => {
  const testProjectName = "test-cli-project";
  const testProjectPath = path.join(process.cwd(), testProjectName);

  beforeEach(() => {
    // 清理测试项目目录
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // 清理测试项目目录
    if (fs.existsSync(testProjectPath)) {
      fs.rmSync(testProjectPath, { recursive: true, force: true });
    }
  });

  it("should create basic project and exit properly", async () => {
    const cliPath = path.join(process.cwd(), "dist", "cli.js");

    // 确保 CLI 文件存在
    expect(fs.existsSync(cliPath)).toBe(true);

    // 执行 create 命令
    const child = spawn("node", [cliPath, "create", testProjectName], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // 等待进程完成
    const exitCode = await new Promise<number>((resolve) => {
      child.on("exit", (code) => {
        resolve(code || 0);
      });
    });

    // 验证进程正常退出
    expect(exitCode).toBe(0);
    // stderr 可能包含 spinner 输出，所以不严格检查为空

    // 验证输出包含成功消息
    expect(stdout).toContain("基本项目创建完成");

    // 验证项目目录和文件被创建
    expect(fs.existsSync(testProjectPath)).toBe(true);
    expect(
      fs.existsSync(path.join(testProjectPath, "xiaozhi.config.json"))
    ).toBe(true);
    expect(fs.existsSync(path.join(testProjectPath, "xiaozhi.log"))).toBe(true);

    // 验证配置文件内容
    const configContent = fs.readFileSync(
      path.join(testProjectPath, "xiaozhi.config.json"),
      "utf8"
    );
    const config = JSON.parse(configContent);
    expect(config).toHaveProperty("mcpEndpoint");
    expect(config).toHaveProperty("mcpServers");
  }, 10000);

  it("should create project with template and exit properly", async () => {
    const cliPath = path.join(process.cwd(), "dist", "cli.js");

    // 执行 create 命令使用模板
    const child = spawn(
      "node",
      [cliPath, "create", testProjectName, "--template", "hello-world"],
      {
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // 等待进程完成
    const exitCode = await new Promise<number>((resolve) => {
      child.on("exit", (code) => {
        resolve(code || 0);
      });
    });

    // 验证进程正常退出
    expect(exitCode).toBe(0);
    // stderr 可能包含 spinner 输出，所以不严格检查为空

    // 验证输出包含成功消息
    expect(stdout).toContain("项目创建完成");

    // 验证项目目录和文件被创建
    expect(fs.existsSync(testProjectPath)).toBe(true);
    expect(
      fs.existsSync(path.join(testProjectPath, "xiaozhi.config.json"))
    ).toBe(true);
  }, 10000);

  it("should handle existing directory gracefully", async () => {
    // 先创建目录
    fs.mkdirSync(testProjectPath, { recursive: true });

    const cliPath = path.join(process.cwd(), "dist", "cli.js");

    const child = spawn("node", [cliPath, "create", testProjectName], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    // 等待进程完成
    const exitCode = await new Promise<number>((resolve) => {
      child.on("exit", (code) => {
        resolve(code || 0);
      });
    });

    // 验证进程退出（失败情况下退出码为1）
    expect(exitCode).toBe(1);
    // stderr 可能包含 spinner 输出，所以不严格检查为空

    // 验证输出包含错误消息
    expect(stdout).toContain("请选择不同的项目名称");
  }, 15000);
});
