import type { Config } from 'release-it';

/**
 * Release-it 配置文件
 * 支持正式版和预发布版的不同发布策略
 */

// 从环境变量获取发布类型
const versionType = process.env.VERSION_TYPE || '正式版';
const isPrerelease = versionType !== '正式版';

console.log(`🔧 Release-it 配置加载 - 版本类型: ${versionType}, 预发布: ${isPrerelease}`);

const config: Config = {
  git: {
    // 正式版才进行 git 操作
    commitMessage: isPrerelease ? undefined : "chore: release v${version}",
    tagName: isPrerelease ? undefined : "v${version}",
    pushArgs: isPrerelease ? undefined : ["--follow-tags"],
    requireCleanWorkingDir: false,
    requireUpstream: false,
    commit: !isPrerelease,
    tag: !isPrerelease,
    push: !isPrerelease
  },
  github: {
    // 正式版才创建 GitHub release
    release: !isPrerelease,
    releaseName: isPrerelease ? undefined : "🚀 v${version}",
    releaseNotes: isPrerelease ? undefined : "npx conventional-changelog -p conventionalcommits -r 2"
  },
  npm: {
    // 所有版本都不通过 release-it 发布到 npm（由脚本单独处理）
    publish: false
  },
  hooks: {
    // 预发布版本的钩子
    ...(isPrerelease ? {
      "before:init": ["pnpm audit --audit-level moderate"],
      "after:release": "echo \"🎉 预发布版本 v${version} 发布完成！\""
    } : {
      // 正式版本的钩子
      "before:init": ["pnpm audit --audit-level moderate"],
      "after:bump": [
        // 更新 CHANGELOG.md
        "npx conventional-changelog -p conventionalcommits -i CHANGELOG.md -s",
        // 发布到 npm（正式版）
        "npm publish --access public"
      ],
      "after:release": "echo \"🎉 正式版本 v${version} 发布完成！\""
    })
  },
  // 正式版才使用 conventional-changelog 插件
  ...(isPrerelease ? {} : {
    plugins: {
      "@release-it/conventional-changelog": {
        preset: "conventionalcommits",
        infile: "CHANGELOG.md",
        header: "# Changelog\n\nAll notable changes to this project will be documented in this file. See [Conventional Commits](https://conventionalcommits.org) for commit guidelines."
      }
    }
  })
};

export default config;
