import { defineConfig } from 'tsup';
import { copyFileSync, cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Plugin } from 'esbuild';

// Plugin to rewrite .js imports to .cjs in CommonJS output
const rewriteImportsPlugin: Plugin = {
  name: 'rewrite-imports',
  setup(build) {
    if (build.initialOptions.format === 'cjs') {
      build.onResolve({ filter: /^\..*\.js$/ }, (args) => {
        const newPath = args.path.replace(/\.js$/, '.cjs');
        return { path: newPath, external: true };
      });
    }
  },
};

export default defineConfig({
  entry: ['src/mcpPipe.ts', 'src/mcpServerProxy.ts', 'src/cli.ts', 'src/configManager.ts'],
  format: ['cjs'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
  bundle: false,
  keepNames: true,
  platform: 'node',
  outExtension({ format }) {
    return {
      js: format === 'cjs' ? '.cjs' : '.js'
    }
  },
  esbuildPlugins: [rewriteImportsPlugin],
  external: [
    'ws',
    'child_process',
    'fs',
    'path',
    'url',
    'process',
    'dotenv',
    'commander',
    'chalk',
    'ora'
  ],
  onSuccess: async () => {
    // 复制配置文件和 mcpServers 目录到 dist
    const distDir = 'dist';

    // 确保 dist 目录存在
    if (!existsSync(distDir)) {
      mkdirSync(distDir, { recursive: true });
    }

    // 复制 config.default.json
    if (existsSync('config.default.json')) {
      copyFileSync('config.default.json', join(distDir, 'config.default.json'));
      console.log('✅ 已复制 config.default.json 到 dist/');
    }

    // 复制 mcpServers 目录
    if (existsSync('mcpServers')) {
      cpSync('mcpServers', join(distDir, 'mcpServers'), { recursive: true });
      console.log('✅ 已复制 mcpServers/ 到 dist/');
    }
  }
});
