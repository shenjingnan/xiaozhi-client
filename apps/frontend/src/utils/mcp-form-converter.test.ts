/**
 * mcpFormConverter 工具函数测试
 * 测试命令解析、键值对解析、表单与 API 配置的双向转换等功能
 */

import { describe, expect, it } from "vitest";
import {
  apiConfigToForm,
  formToApiConfig,
  formToJson,
  jsonToFormData,
  keyValuePairsToMultilineText,
  parseCommandString,
  parseKeyValuePairs,
} from "@/utils/mcpFormConverter";

describe("parseCommandString", () => {
  it("应该正确解析简单命令", () => {
    const result = parseCommandString("npx -y @z_ai/mcp-server");
    expect(result).toEqual({
      command: "npx",
      args: ["-y", "@z_ai/mcp-server"],
    });
  });

  it("应该正确解析带引号的参数（双引号）", () => {
    const result = parseCommandString(
      'node "/path with spaces/server.js" --arg'
    );
    expect(result).toEqual({
      command: "node",
      args: ["/path with spaces/server.js", "--arg"],
    });
  });

  it("应该正确解析带引号的参数（单引号）", () => {
    const result = parseCommandString(
      "node '/path with spaces/server.js' --arg"
    );
    expect(result).toEqual({
      command: "node",
      args: ["/path with spaces/server.js", "--arg"],
    });
  });

  it("应该正确解析多个带引号的参数", () => {
    const result = parseCommandString(
      'npx server.js --config "/path with spaces/config.json" --output "./out dir"'
    );
    expect(result).toEqual({
      command: "npx",
      args: [
        "server.js",
        "--config",
        "/path with spaces/config.json",
        "--output",
        "./out dir",
      ],
    });
  });

  it("应该处理引号内的不同引号类型", () => {
    const result = parseCommandString(`echo "He said 'hello'"`);
    expect(result).toEqual({
      command: "echo",
      args: ["He said 'hello'"],
    });
  });

  it("空命令应该抛出错误", () => {
    expect(() => parseCommandString("")).toThrow("命令不能为空");
  });

  it("只有空格的命令应该抛出错误", () => {
    expect(() => parseCommandString("   ")).toThrow("命令不能为空");
  });

  it("应该正确处理带空格的路径", () => {
    const result = parseCommandString('"/usr/local/bin/app" --arg');
    expect(result).toEqual({
      command: "/usr/local/bin/app",
      args: ["--arg"],
    });
  });
});

describe("parseKeyValuePairs", () => {
  it("应该正确解析 KEY=value 格式", () => {
    const result = parseKeyValuePairs("ACCESS_TOKEN=xxx\nBASE_URL=yyy");
    expect(result).toEqual({
      ACCESS_TOKEN: "xxx",
      BASE_URL: "yyy",
    });
  });

  it("应该正确解析 KEY: value 格式", () => {
    const result = parseKeyValuePairs("KEY1: value1\nKEY2: value2");
    expect(result).toEqual({
      KEY1: "value1",
      KEY2: "value2",
    });
  });

  it("应该去除值两端的配对引号（双引号）", () => {
    const result = parseKeyValuePairs('PATH="C:\\Program Files\\app"');
    expect(result).toEqual({
      PATH: "C:\\Program Files\\app",
    });
  });

  it("应该去除值两端的配对引号（单引号）", () => {
    const result = parseKeyValuePairs("PATH='C:\\Program Files\\app'");
    expect(result).toEqual({
      PATH: "C:\\Program Files\\app",
    });
  });

  it("应该跳过空行和注释", () => {
    const result = parseKeyValuePairs(
      "# 这是注释\n\nKEY1=value1\n# 另一个注释\nKEY2=value2"
    );
    expect(result).toEqual({
      KEY1: "value1",
      KEY2: "value2",
    });
  });

  it("应该处理混合格式", () => {
    const result = parseKeyValuePairs(
      'KEY1=value1\nKEY2: value2\n# 注释\nKEY3="value with spaces"'
    );
    expect(result).toEqual({
      KEY1: "value1",
      KEY2: "value2",
      KEY3: "value with spaces",
    });
  });

  it("应该处理带等号的值", () => {
    const result = parseKeyValuePairs(
      "DATABASE_URL=postgresql://localhost:5432/db?ssl=true"
    );
    expect(result).toEqual({
      DATABASE_URL: "postgresql://localhost:5432/db?ssl=true",
    });
  });

  it("应该不处理不匹配的引号", () => {
    const result = parseKeyValuePairs('KEY1="unmatched');
    expect(result).toEqual({
      KEY1: '"unmatched',
    });
  });

  it("空输入应该返回空对象", () => {
    const result = parseKeyValuePairs("");
    expect(result).toEqual({});
  });
});

describe("keyValuePairsToMultilineText", () => {
  it("应该将对象转换为多行文本", () => {
    const result = keyValuePairsToMultilineText({
      ACCESS_TOKEN: "xxx",
      BASE_URL: "yyy",
    });
    expect(result).toBe("ACCESS_TOKEN: xxx\nBASE_URL: yyy");
  });

  it("空对象应该返回空字符串", () => {
    const result = keyValuePairsToMultilineText({});
    expect(result).toBe("");
  });

  it("undefined 应该返回空字符串", () => {
    const result = keyValuePairsToMultilineText(undefined);
    expect(result).toBe("");
  });
});

describe("表单与 API 配置转换（stdio）", () => {
  it("应该将 stdio 表单数据转换为 API 配置", () => {
    const formData = {
      type: "stdio" as const,
      name: "test-server",
      command: "npx -y @test/mcp-server",
      env: "API_KEY=xxx\nBASE_URL=yyy",
    };

    const result = formToApiConfig(formData);

    expect(result.name).toBe("test-server");
    expect(result.config).toEqual({
      command: "npx",
      args: ["-y", "@test/mcp-server"],
      env: {
        API_KEY: "xxx",
        BASE_URL: "yyy",
      },
    });
  });

  it("应该将 stdio API 配置转换为表单数据", () => {
    const apiConfig = {
      command: "npx",
      args: ["-y", "@test/mcp-server"],
      env: {
        API_KEY: "xxx",
        BASE_URL: "yyy",
      },
    };

    const result = apiConfigToForm("test-server", apiConfig);

    expect(result).toEqual({
      type: "stdio",
      name: "test-server",
      command: "npx -y @test/mcp-server",
      env: "API_KEY: xxx\nBASE_URL: yyy",
    });
  });

  it("应该正确处理带引号的命令参数", () => {
    const formData = {
      type: "stdio" as const,
      name: "test-server",
      command: 'node "/path with spaces/server.js" --arg',
      env: "",
    };

    const result = formToApiConfig(formData);

    expect(result.config).toEqual({
      command: "node",
      args: ["/path with spaces/server.js", "--arg"],
    });
  });
});

describe("表单与 API 配置转换（http）", () => {
  it("应该将 http 表单数据转换为 API 配置", () => {
    const formData = {
      type: "http" as const,
      name: "test-server",
      url: "https://example.com/mcp",
      headers: "Authorization: Bearer token\nContent-Type: application/json",
    };

    const result = formToApiConfig(formData);

    expect(result.name).toBe("test-server");
    expect(result.config).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
    });
  });

  it("应该将 http API 配置转换为表单数据", () => {
    const apiConfig = {
      type: "streamable-http" as const,
      url: "https://example.com/mcp",
      headers: {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      },
    };

    const result = apiConfigToForm("test-server", apiConfig);

    expect(result).toEqual({
      type: "http",
      name: "test-server",
      url: "https://example.com/mcp",
      headers: "Authorization: Bearer token\nContent-Type: application/json",
    });
  });
});

describe("表单与 API 配置转换（sse）", () => {
  it("应该将 sse 表单数据转换为 API 配置", () => {
    const formData = {
      type: "sse" as const,
      name: "test-server",
      url: "https://example.com/sse",
      headers: "Authorization: Bearer token",
    };

    const result = formToApiConfig(formData);

    expect(result.name).toBe("test-server");
    expect(result.config).toEqual({
      type: "sse",
      url: "https://example.com/sse",
      headers: {
        Authorization: "Bearer token",
      },
    });
  });

  it("应该将 sse API 配置转换为表单数据", () => {
    const apiConfig = {
      type: "sse" as const,
      url: "https://example.com/sse",
      headers: {
        Authorization: "Bearer token",
      },
    };

    const result = apiConfigToForm("test-server", apiConfig);

    expect(result).toEqual({
      type: "sse",
      name: "test-server",
      url: "https://example.com/sse",
      headers: "Authorization: Bearer token",
    });
  });
});

describe("JSON 与表单数据转换", () => {
  it("应该将表单数据转换为 JSON 字符串", () => {
    const formData = {
      type: "stdio" as const,
      name: "test-server",
      command: "npx -y @test/mcp-server",
      env: "",
    };

    const result = formToJson(formData);
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({
      mcpServers: {
        "test-server": {
          command: "npx",
          args: ["-y", "@test/mcp-server"],
        },
      },
    });
  });

  it("应该将 JSON 字符串转换为表单数据（包含 mcpServers）", () => {
    const jsonString = JSON.stringify(
      {
        mcpServers: {
          "test-server": {
            command: "npx",
            args: ["-y", "@test/mcp-server"],
          },
        },
      },
      null,
      2
    );

    const result = jsonToFormData(jsonString);

    expect(result).toEqual({
      type: "stdio",
      name: "test-server",
      command: "npx -y @test/mcp-server",
      env: "",
    });
  });

  it("应该将 JSON 字符串转换为表单数据（单个服务）", () => {
    const jsonString = JSON.stringify({
      command: "npx",
      args: ["-y", "@test/mcp-server"],
    });

    const result = jsonToFormData(jsonString);

    expect(result?.type).toBe("stdio");
    if (result?.type === "stdio") {
      expect(result.command).toBe("npx -y @test/mcp-server");
    }
  });

  it("应该将 SSE 服务的 JSON 转换为表单数据", () => {
    const jsonString = JSON.stringify({
      mcpServers: {
        "sse-server": {
          type: "sse",
          url: "https://example.com/sse",
        },
      },
    });

    const result = jsonToFormData(jsonString);

    expect(result).toEqual({
      type: "sse",
      name: "sse-server",
      url: "https://example.com/sse",
      headers: "",
    });
  });

  it("无效的 JSON 应该返回 null", () => {
    const result = jsonToFormData("{invalid json}");
    expect(result).toBeNull();
  });

  it("空字符串应该返回 null", () => {
    const result = jsonToFormData("");
    expect(result).toBeNull();
  });
});
