/**
 * 错误处理系统单元测试
 */

import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../Constants.js";
import {
  CLIError,
  ConfigError,
  FileError,
  ProcessError,
  ServiceError,
  ValidationError,
} from "./index.js";

describe("CLIError", () => {
  it("should create basic CLI error", () => {
    const error = new CLIError("Test error", "TEST_ERROR");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_ERROR");
    expect(error.exitCode).toBe(1);
    expect(error.name).toBe("CLIError");
  });

  it("should create CLI error with suggestions", () => {
    const suggestions = ["Try this", "Or that"];
    const error = CLIError.withSuggestions(
      "Test error",
      "TEST_ERROR",
      suggestions
    );

    expect(error.suggestions).toEqual(suggestions);
  });

  it("should create CLI error with custom exit code", () => {
    const error = new CLIError("Test error", "TEST_ERROR", 2);

    expect(error.exitCode).toBe(2);
  });
});

describe("ConfigError", () => {
  it("should create config error", () => {
    const error = new ConfigError("Config not found");

    expect(error.message).toBe("Config not found");
    expect(error.code).toBe(ERROR_CODES.CONFIG_ERROR);
    expect(error.name).toBe("ConfigError");
  });

  it("should create config not found error", () => {
    const error = ConfigError.configNotFound();

    expect(error.message).toBe("配置文件不存在");
    expect(error.suggestions).toContain('请运行 "xiaozhi init" 初始化配置文件');
  });

  it("should create invalid format error", () => {
    const error = ConfigError.invalidFormat("xml");

    expect(error.message).toBe("无效的配置文件格式: xml");
    expect(error.suggestions).toContain("支持的格式: json, json5, jsonc");
  });
});

describe("ServiceError", () => {
  it("should create service error", () => {
    const error = new ServiceError("Service failed");

    expect(error.message).toBe("Service failed");
    expect(error.code).toBe(ERROR_CODES.SERVICE_ERROR);
    expect(error.name).toBe("ServiceError");
  });

  it("should create already running error", () => {
    const error = ServiceError.alreadyRunning(1234);

    expect(error.message).toBe("服务已经在运行 (PID: 1234)");
    expect(error.suggestions).toContain('请先运行 "xiaozhi stop" 停止现有服务');
    expect(error.suggestions).toContain('或者使用 "xiaozhi restart" 重启服务');
  });

  it("should create auto restarting error", () => {
    const error = ServiceError.autoRestarting(1234);

    expect(error.message).toBe(
      "检测到服务已在运行 (PID: 1234)，正在自动重启..."
    );
    expect(error.suggestions).toContain(
      "如果不希望自动重启，请使用 xiaozhi stop 手动停止服务"
    );
  });

  it("should create not running error", () => {
    const error = ServiceError.notRunning();

    expect(error.message).toBe("服务未运行");
    expect(error.suggestions).toContain('请运行 "xiaozhi start" 启动服务');
  });

  it("should create start failed error", () => {
    const error = ServiceError.startFailed("Port occupied");

    expect(error.message).toBe("服务启动失败: Port occupied");
    expect(error.suggestions).toContain("检查配置文件是否正确");
  });
});

describe("ValidationError", () => {
  it("should create validation error", () => {
    const error = new ValidationError("Invalid value", "port");

    expect(error.message).toBe("验证失败: port - Invalid value");
    expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(error.name).toBe("ValidationError");
  });

  it("should create invalid port error", () => {
    const error = ValidationError.invalidPort(99999);

    expect(error.message).toContain("端口号必须在 1-65535 范围内");
    expect(error.message).toContain("99999");
  });

  it("should create required field error", () => {
    const error = ValidationError.requiredField("name");

    expect(error.message).toBe("验证失败: name - 必填字段不能为空");
  });
});

describe("FileError", () => {
  it("should create file error", () => {
    const error = new FileError("File operation failed", "/path/to/file");

    expect(error.message).toBe("File operation failed: /path/to/file");
    expect(error.code).toBe(ERROR_CODES.FILE_ERROR);
    expect(error.name).toBe("FileError");
  });

  it("should create file not found error", () => {
    const error = FileError.notFound("/missing/file");

    expect(error.message).toBe("文件不存在: /missing/file");
    expect(error.suggestions).toContain("检查文件路径是否正确");
  });

  it("should create permission denied error", () => {
    const error = FileError.permissionDenied("/protected/file");

    expect(error.message).toBe("权限不足: /protected/file");
    expect(error.suggestions).toContain("检查文件权限或使用管理员权限运行");
  });

  it("should create already exists error", () => {
    const error = FileError.alreadyExists("/existing/file");

    expect(error.message).toBe("文件已存在: /existing/file");
    expect(error.suggestions).toContain("使用不同的文件名或删除现有文件");
  });
});

describe("ProcessError", () => {
  it("should create process error", () => {
    const error = new ProcessError("Process failed", 1234);

    expect(error.message).toBe("Process failed (PID: 1234)");
    expect(error.code).toBe(ERROR_CODES.PROCESS_ERROR);
    expect(error.name).toBe("ProcessError");
  });

  it("should create kill failed error", () => {
    const error = ProcessError.killFailed(1234);

    expect(error.message).toBe("无法终止进程 (PID: 1234)");
    expect(error.suggestions).toContain("进程可能已经停止或权限不足");
  });

  it("should create not found error", () => {
    const error = ProcessError.notFound(1234);

    expect(error.message).toBe("进程不存在 (PID: 1234)");
  });
});
