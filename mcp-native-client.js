import { spawn } from "node:child_process";

const mcpServerConfig = {
  command: "node",
  args: [
    "/Users/nemo/github/shenjingnan/xiaozhi-client/templates/hello-world/mcpServers/datetime.js",
  ],
};

class NativeMCPClient {
  constructor(config) {
    this.config = config;
    this.process = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  async connect() {
    this.process = spawn(this.config.command, this.config.args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.process.stdout.on("data", (data) => {
      this.handleMessage(data.toString());
    });

    this.process.stderr.on("data", (data) => {
      const message = data.toString().trim();
      // 过滤掉INFO级别日志，只显示真正的错误
      if (!message.includes("INFO")) {
        console.error("MCP服务错误:", message);
      }
    });

    this.process.on("close", (code) => {
      console.log("MCP服务已关闭，退出码:", code);
    });

    await this.initialize();
  }

  async initialize() {
    const initMessage = {
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcp-native-client", version: "1.0.0" },
      },
    };

    return this.sendRequest(initMessage);
  }

  async listTools() {
    const message = {
      jsonrpc: "2.0",
      id: this.generateId(),
      method: "tools/list",
      params: {},
    };

    return this.sendRequest(message);
  }

  sendRequest(message) {
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(message.id, { resolve, reject });
      this.process.stdin.write(`${JSON.stringify(message)}\n`);

      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(message.id)) {
          this.pendingRequests.delete(message.id);
          reject(new Error("请求超时"));
        }
      }, 5000);

      // 存储超时ID以便后续清理
      this.pendingRequests.set(message.id, { resolve, reject, timeoutId });
    });
  }

  handleMessage(rawData) {
    try {
      const lines = rawData.trim().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          const message = JSON.parse(line);

          if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, timeoutId } = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);
            // 清理超时器
            if (timeoutId) {
              clearTimeout(timeoutId);
            }
            resolve(message);
          }
        }
      }
    } catch (error) {
      console.error("解析消息失败:", error);
    }
  }

  generateId() {
    return ++this.messageId;
  }

  async close() {
    if (!this.process) {
      return;
    }

    // 清理所有待处理的请求和超时器
    for (const [id, request] of this.pendingRequests) {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
    }
    this.pendingRequests.clear();

    // 移除所有事件监听器
    this.process.stdout.removeAllListeners("data");
    this.process.stderr.removeAllListeners("data");
    this.process.removeAllListeners("close");

    // 关闭stdin并终止进程
    try {
      this.process.stdin.end();
      this.process.kill("SIGTERM");
    } catch (error) {
      // 忽略进程已经关闭的错误
    }

    this.process = null;
  }
}

async function main() {
  const client = new NativeMCPClient(mcpServerConfig);

  try {
    await client.connect();
    console.log("✅ 已连接到MCP服务");

    const toolsResult = await client.listTools();
    console.log("🛠️  工具列表:", toolsResult.result?.tools || toolsResult);
  } catch (error) {
    console.error("❌ 连接失败:", error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
