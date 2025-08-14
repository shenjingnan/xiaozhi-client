/**
 * 兼容性验证脚本
 * 验证适配器的工具前缀机制与旧实现的兼容性
 */

import type {
  LocalMCPServerConfig,
  SSEMCPServerConfig,
} from "../configManager.js";
import { MCPTransportType } from "../services/MCPService.js";
import { convertLegacyToNew } from "./ConfigAdapter.js";
import { MCPClientAdapter } from "./MCPClientAdapter.js";

/**
 * 验证工具前缀机制
 */
function verifyToolPrefixCompatibility() {
  console.log("🔍 验证工具前缀机制兼容性...\n");

  // 测试用例
  const testCases = [
    {
      serviceName: "calculator",
      originalToolName: "add",
      expectedPrefixedName: "calculator_xzcli_add",
    },
    {
      serviceName: "weather-service",
      originalToolName: "get_weather",
      expectedPrefixedName: "weather_service_xzcli_get_weather",
    },
    {
      serviceName: "my-awesome-tool",
      originalToolName: "process_data",
      expectedPrefixedName: "my_awesome_tool_xzcli_process_data",
    },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    const config = convertLegacyToNew(testCase.serviceName, {
      command: "node",
      args: ["test.js"],
    } as LocalMCPServerConfig);

    const adapter = new MCPClientAdapter(testCase.serviceName, config);

    // 测试前缀生成
    const actualPrefixedName = (adapter as any).generatePrefixedToolName(
      testCase.originalToolName
    );
    const prefixMatch = actualPrefixedName === testCase.expectedPrefixedName;

    // 测试前缀解析
    const parsedOriginalName = adapter.getOriginalToolName(
      testCase.expectedPrefixedName
    );
    const parseMatch = parsedOriginalName === testCase.originalToolName;

    console.log(`📋 测试服务: ${testCase.serviceName}`);
    console.log(`   原始工具名: ${testCase.originalToolName}`);
    console.log(`   期望前缀名: ${testCase.expectedPrefixedName}`);
    console.log(`   实际前缀名: ${actualPrefixedName}`);
    console.log(`   前缀生成: ${prefixMatch ? "✅ 通过" : "❌ 失败"}`);
    console.log(`   前缀解析: ${parseMatch ? "✅ 通过" : "❌ 失败"}`);
    console.log(`   解析结果: ${parsedOriginalName}`);
    console.log("");

    if (!prefixMatch || !parseMatch) {
      allPassed = false;
    }
  }

  return allPassed;
}

/**
 * 验证配置转换兼容性
 */
function verifyConfigCompatibility() {
  console.log("🔧 验证配置转换兼容性...\n");

  const testConfigs = [
    {
      name: "local-calculator",
      legacy: {
        command: "python",
        args: ["-m", "calculator"],
      } as LocalMCPServerConfig,
      expectedType: MCPTransportType.STDIO,
    },
    {
      name: "sse-service",
      legacy: {
        type: "sse",
        url: "https://example.com/sse",
      } as SSEMCPServerConfig,
      expectedType: MCPTransportType.SSE,
    },
    {
      name: "modelscope-service",
      legacy: {
        type: "sse",
        url: "https://api.modelscope.net/mcp/sse",
      } as SSEMCPServerConfig,
      expectedType: MCPTransportType.MODELSCOPE_SSE,
    },
  ];

  let allPassed = true;

  for (const testConfig of testConfigs) {
    try {
      const converted = convertLegacyToNew(testConfig.name, testConfig.legacy);
      const typeMatch = converted.type === testConfig.expectedType;
      const nameMatch = converted.name === testConfig.name;

      console.log(`📋 测试配置: ${testConfig.name}`);
      console.log(`   期望类型: ${testConfig.expectedType}`);
      console.log(`   实际类型: ${converted.type}`);
      console.log(`   类型匹配: ${typeMatch ? "✅ 通过" : "❌ 失败"}`);
      console.log(`   名称匹配: ${nameMatch ? "✅ 通过" : "❌ 失败"}`);
      console.log("");

      if (!typeMatch || !nameMatch) {
        allPassed = false;
      }
    } catch (error) {
      console.log(`📋 测试配置: ${testConfig.name}`);
      console.log(
        `   转换失败: ❌ ${error instanceof Error ? error.message : String(error)}`
      );
      console.log("");
      allPassed = false;
    }
  }

  return allPassed;
}

/**
 * 验证接口兼容性
 */
function verifyInterfaceCompatibility() {
  console.log("🔌 验证接口兼容性...\n");

  const config = convertLegacyToNew("test-service", {
    command: "node",
    args: ["test.js"],
  } as LocalMCPServerConfig);

  const adapter = new MCPClientAdapter("test-service", config);

  // 检查 IMCPClient 接口的所有属性和方法
  const requiredProperties = ["initialized", "tools", "originalTools"];
  const requiredMethods = [
    "start",
    "refreshTools",
    "callTool",
    "stop",
    "getOriginalToolName",
  ];

  let allPassed = true;

  console.log("📋 检查必需属性:");
  for (const prop of requiredProperties) {
    const exists = prop in adapter;
    console.log(`   ${prop}: ${exists ? "✅ 存在" : "❌ 缺失"}`);
    if (!exists) allPassed = false;
  }

  console.log("\n📋 检查必需方法:");
  for (const method of requiredMethods) {
    const exists = typeof (adapter as any)[method] === "function";
    console.log(`   ${method}: ${exists ? "✅ 存在" : "❌ 缺失"}`);
    if (!exists) allPassed = false;
  }

  console.log("");
  return allPassed;
}

/**
 * 主验证函数
 */
function main() {
  console.log("🚀 开始兼容性验证...\n");
  console.log("=".repeat(60));
  console.log("");

  const results = {
    toolPrefix: verifyToolPrefixCompatibility(),
    configConversion: verifyConfigCompatibility(),
    interfaceCompatibility: verifyInterfaceCompatibility(),
  };

  console.log("=".repeat(60));
  console.log("📊 验证结果汇总:\n");

  console.log(`🔧 工具前缀机制: ${results.toolPrefix ? "✅ 通过" : "❌ 失败"}`);
  console.log(
    `🔧 配置转换功能: ${results.configConversion ? "✅ 通过" : "❌ 失败"}`
  );
  console.log(
    `🔧 接口兼容性: ${results.interfaceCompatibility ? "✅ 通过" : "❌ 失败"}`
  );

  const allPassed = Object.values(results).every((result) => result);
  console.log(`\n🎯 总体结果: ${allPassed ? "✅ 全部通过" : "❌ 存在问题"}`);

  if (allPassed) {
    console.log("\n🎉 恭喜！所有兼容性验证都通过了。");
    console.log("适配器已准备好用于阶段1的基础设施准备。");
  } else {
    console.log("\n⚠️  发现兼容性问题，请检查并修复后再继续。");
  }

  return allPassed;
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as verifyCompatibility };
