import { defineConfig } from 'tsup';

export default defineConfig({
  // 入口文件
  entry: {
    cli: 'src/cli.ts',
    mcpWebSocketClient: 'src/mcpWebSocketClient.ts',
    settingManager: 'src/settingManager.ts',
    proxyMcpServer: 'src/proxyMcpServer.ts',
    proxyMcpServerRunner: 'src/proxyMcpServerRunner.ts',
    calculator: 'src/calculator.ts'
  },
  
  // 输出格式
  format: ['esm'],
  
  // 输出目录
  outDir: 'dist',
  
  // 目标环境
  target: 'node18',
  
  // 平台
  platform: 'node',
  
  // 生成类型定义文件
  dts: true,
  
  // 生成 source map
  sourcemap: true,
  
  // 清理输出目录
  clean: true,
  
  // 分割代码
  splitting: false,
  
  // 保留注释
  keepNames: true,
  
  // 外部依赖（不打包进bundle）
  external: [
    'chalk',
    'commander',
    'ora',
    'ws',
    '@modelcontextprotocol/sdk',
    'dotenv'
  ],
  
  // 构建后处理
  onSuccess: async () => {
    // 修复 CLI 文件的重复 shebang
    const fs = await import('fs');
    const path = await import('path');

    const cliPath = path.join(process.cwd(), 'dist/cli.js');
    if (fs.existsSync(cliPath)) {
      let content = fs.readFileSync(cliPath, 'utf8');

      // 移除重复的 shebang
      const lines = content.split('\n');
      const shebangLines = lines.filter(line => line.startsWith('#!/usr/bin/env node'));

      if (shebangLines.length > 1) {
        // 找到第一个非 shebang 行的索引
        let firstNonShebangIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          if (!lines[i].startsWith('#!/usr/bin/env node')) {
            firstNonShebangIndex = i;
            break;
          }
        }

        // 重构内容：一个 shebang + 其余内容
        const newContent = ['#!/usr/bin/env node', ...lines.slice(firstNonShebangIndex)].join('\n');
        fs.writeFileSync(cliPath, newContent);

        // 添加可执行权限
        fs.chmodSync(cliPath, '755');

        console.log('✓ 修复了 CLI 文件的 shebang 并添加了可执行权限');
      }
    }
  }
});
