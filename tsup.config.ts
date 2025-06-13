import { copyFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Plugin } from "esbuild";
import { defineConfig } from "tsup";

// Plugin to rewrite .js imports to .cjs in CommonJS output
const rewriteImportsPlugin: Plugin = {
	name: "rewrite-imports",
	setup(build) {
		if (build.initialOptions.format === "cjs") {
			build.onResolve({ filter: /^\..*\.js$/ }, (args) => {
				const newPath = args.path.replace(/\.js$/, ".cjs");
				return { path: newPath, external: true };
			});
		}
	},
};

export default defineConfig({
	entry: [
		"src/mcpPipe.ts",
		"src/mcpServerProxy.ts",
		"src/cli.ts",
		"src/configManager.ts",
	],
	format: ["cjs"],
	target: "node18",
	outDir: "dist",
	clean: true,
	sourcemap: true,
	dts: true,
	splitting: false,
	bundle: false,
	keepNames: true,
	platform: "node",
	outExtension({ format }) {
		return {
			js: format === "cjs" ? ".cjs" : ".js",
		};
	},
	esbuildPlugins: [rewriteImportsPlugin],
	external: [
		"ws",
		"child_process",
		"fs",
		"path",
		"url",
		"process",
		"dotenv",
		"commander",
		"chalk",
		"ora",
	],
	onSuccess: async () => {
		// 复制配置文件到 dist
		const distDir = "dist";

		// 确保 dist 目录存在
		if (!existsSync(distDir)) {
			mkdirSync(distDir, { recursive: true });
		}

		// 复制 xiaozhi.config.default.json
		if (existsSync("xiaozhi.config.default.json")) {
			copyFileSync(
				"xiaozhi.config.default.json",
				join(distDir, "xiaozhi.config.default.json")
			);
			console.log("✅ 已复制 xiaozhi.config.default.json 到 dist/");
		}

		console.log("✅ 构建完成，mcpServers 现在位于 templates/ 目录中");
	},
});
