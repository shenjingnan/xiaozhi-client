import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const mcpServerConfig = {
  command: 'node',
  args: ['/Users/nemo/github/shenjingnan/xiaozhi-client/templates/hello-world/mcpServers/datetime.js']
};

async function main() {
  const client = new Client(
    { name: 'mcp-sdk-client', version: '1.0.0' },
    { capabilities: {} }
  );

  const transport = new StdioClientTransport(mcpServerConfig);

  try {
    await client.connect(transport);
    console.log('✅ 已连接到MCP服务');

    const toolsResult = await client.listTools();
    console.log('🛠️  工具列表:', toolsResult.tools);

  } catch (error) {
    console.error('❌ 连接失败:', error);
  } finally {
    await client.close();
  }
}

main().catch(console.error);