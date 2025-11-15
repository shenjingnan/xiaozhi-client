# 🚀 xiaozhi-client 发版指南

> **适用对象**：项目维护者、新加入的开发者
> **更新时间**：2025-08-27
> **前置要求**：具备 GitHub 和 NPM 基础操作知识

## 📖 文档导航

- [🚀 快速开始](#-快速开始) - 5分钟完成首次发版
- [📋 发版前准备](#-发版前准备) - 权限配置和环境检查
- [🎯 发版操作指南](#-发版操作指南) - 详细操作步骤
- [📝 Commit 规范](#-commit-规范) - 代码提交规范
- [🔍 发版后验证](#-发版后验证) - 发版成功检查清单
- [🆘 故障排除](#-故障排除) - 常见问题解决方案

## � 快速开始

**新手必读**：如果你是第一次进行发版操作，请按以下步骤操作：

### 第一步：检查权限
确认你具备以下权限：
- ✅ GitHub 仓库的 **Write** 权限或更高
- ✅ NPM 包的 **Maintainer** 权限或更高
- ✅ 能够访问仓库的 **Settings** 页面

### 第二步：选择发版方式
- **🎯 推荐方式**：[手动触发发版](#1-手动触发发版推荐) - 安全可控
- **⚡ 快速方式**：[自动触发发版](#2-自动触发发版) - 适合熟练用户

### 第三步：执行发版
跳转到 [发版操作指南](#-发版操作指南) 查看详细步骤。

## 📋 发版前准备

### 🔐 权限配置检查清单

在进行发版前，请确保以下配置已完成：

#### GitHub 权限配置
- [ ] **仓库权限**：确认你有 `Write` 或 `Admin` 权限
- [ ] **Actions 权限**：确认 GitHub Actions 已启用
- [ ] **Secrets 配置**：确认以下 Secrets 已配置
  - [ ] `NPM_TOKEN` - NPM 发布令牌
  - [ ] `GITHUB_TOKEN` - GitHub 自动提供（无需手动配置）

#### NPM 权限配置
- [ ] **包权限**：确认你是 `xiaozhi-client` 包的维护者
- [ ] **Token 有效性**：确认 NPM Token 未过期

### 🛠️ 环境配置详细步骤

#### 配置 NPM Token（仅需配置一次）

**步骤 1：获取 NPM Token**
1. 打开 [npmjs.com](https://www.npmjs.com/) 并登录
2. 点击右上角头像 → `Access Tokens`
3. 点击 `Generate New Token` → 选择 `Automation`
4. 输入 Token 名称（如：`xiaozhi-client-ci`）
5. 点击 `Generate Token`
6. **重要**：立即复制生成的 Token（只显示一次）

**步骤 2：配置 GitHub Secrets**
1. 打开 [GitHub 仓库页面](https://github.com/shenjingnan/xiaozhi-client)
2. 点击 `Settings` 标签页
3. 在左侧菜单中点击 `Secrets and variables` → `Actions`
4. 点击 `New repository secret`
5. 填写：
   - **Name**: `NPM_TOKEN`
   - **Secret**: 粘贴刚才复制的 NPM Token
6. 点击 `Add secret`

#### 验证配置是否正确
运行以下命令验证配置：
```bash
# 检查 NPM 登录状态
npm whoami

# 检查包权限
npm access list collaborators xiaozhi-client
```

## 🎯 发版操作指南

### 1. 手动触发发版（推荐）

**适用场景**：
- 🎯 **常规发版**：功能发布、bug 修复
- 🚨 **紧急发版**：安全漏洞修复、严重 bug 修复
- 🧪 **预发布版本**：beta、alpha 版本发布

#### 📱 详细操作步骤

**步骤 1：进入 GitHub Actions 页面**
1. 打开 [GitHub 仓库页面](https://github.com/shenjingnan/xiaozhi-client)
2. 点击顶部的 `Actions` 标签页
3. 在左侧工作流列表中找到并点击 `NPM 发布`

**步骤 2：触发工作流**
1. 点击右侧的 `Run workflow` 按钮
2. 确认分支选择为 `main`（通常已默认选择）
3. 根据发版需求填写参数：

#### 🎛️ 发版参数配置

| 参数 | 说明 | 示例值 | 使用场景 |
|------|------|--------|----------|
| **版本号** | 指定发布版本 | `1.2.0` | 精确控制版本号 |
| | 语义化递增 | `patch`/`minor`/`major` | 自动递增版本 |
| | 预发布版本 | `1.2.0-beta.1` | 测试版本发布 |
| | 留空 | （空） | 根据 commit 类型自动递增 |
| **预演模式** | 预览发版内容 | ✅ 勾选 | 首次发版或重要版本 |

#### 📋 不同场景的发版配置

**场景 1：常规功能发版**
- 版本号：留空或填写 `minor`
- 预演模式：建议勾选（首次操作）
- 适用：新功能发布

**场景 2：Bug 修复发版**
- 版本号：留空或填写 `patch`
- 预演模式：可选
- 适用：问题修复

**场景 3：重大版本发版**
- 版本号：填写 `major` 或具体版本号（如 `2.0.0`）
- 预演模式：强烈建议勾选
- 适用：破坏性变更、重大功能更新

**场景 4：预发布版本**
- 版本号：填写具体预发布版本（如 `1.2.0-beta.1`）
- 预演模式：建议勾选
- 适用：测试版本、候选版本

**步骤 3：执行发版**
1. 配置完参数后，点击绿色的 `Run workflow` 按钮
2. 页面会自动刷新，显示工作流执行状态
3. 点击工作流名称可查看详细执行日志

**步骤 4：监控执行过程**
- ⏳ **执行中**：黄色圆圈图标，正在执行
- ✅ **成功**：绿色对勾图标，发版完成
- ❌ **失败**：红色叉号图标，需要排查问题

### 2. 自动触发发版

**适用场景**：熟练用户的快速发版流程

#### 📝 触发条件
当推送符合以下格式的 commit 到 main 分支时自动触发：
```bash
chore: release v1.0.0    # 推荐格式
release: 1.0.0           # 兼容格式
```

#### 🚀 操作步骤
1. 确保本地代码已同步到最新
2. 创建发版 commit：
   ```bash
   git add .
   git commit -m "chore: release v1.2.0"
   git push origin main
   ```
3. 推送后自动触发发版流程

**⚠️ 注意事项**：
- 版本号必须与 `package.json` 中的版本号一致
- 推送前建议先在本地运行测试：`pnpm run check:all`
- 此方式无法使用预演模式，请谨慎使用

## 📝 Commit 规范

项目使用 [Conventional Commits](https://conventionalcommits.org/) 规范，这直接影响自动版本递增和变更日志生成。

### 📐 Commit 格式

```bash
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 🏷️ Commit 类型详解

| 类型 | 版本影响 | 说明 | 使用场景 |
|------|----------|------|----------|
| `feat` | **minor** ⬆️ | 新功能 | 添加新特性、新命令、新API |
| `fix` | **patch** ⬆️ | Bug 修复 | 修复问题、错误处理 |
| `docs` | 无影响 | 文档更新 | README、注释、文档修改 |
| `style` | 无影响 | 代码格式 | 代码风格、格式化、分号等 |
| `refactor` | 无影响 | 代码重构 | 重构代码但不改变功能 |
| `perf` | **patch** ⬆️ | 性能优化 | 提升性能的代码更改 |
| `test` | 无影响 | 测试相关 | 添加测试、修改测试 |
| `chore` | 无影响 | 构建/工具 | 依赖更新、构建配置等 |
| `ci` | 无影响 | CI/CD | GitHub Actions、构建脚本 |

### 💥 破坏性变更

当有破坏性变更时，需要在 commit 中标明：

**方式 1：在 footer 中添加**
```bash
feat(api): 重构用户认证接口

BREAKING CHANGE: 用户认证接口参数格式发生变化，需要更新客户端代码
```

**方式 2：在 type 后添加 !**
```bash
feat(api)!: 重构用户认证接口
```

### 📋 Scope 使用指南

Scope 用于标识变更影响的模块或功能：

| Scope | 说明 | 示例 |
|-------|------|------|
| `cli` | 命令行相关 | `feat(cli): 添加新的启动参数` |
| `api` | API 接口相关 | `fix(api): 修复接口响应格式` |
| `config` | 配置相关 | `feat(config): 支持环境变量配置` |
| `docker` | Docker 相关 | `fix(docker): 修复容器启动问题` |
| `mcp` | MCP 协议相关 | `feat(mcp): 添加新的工具支持` |
| `web` | Web 界面相关 | `style(web): 优化界面布局` |
| `test` | 测试相关 | `test(cli): 添加命令行测试用例` |

### ✅ 良好的 Commit 示例

```bash
# 新功能
feat(cli): 添加服务状态检查命令
feat(mcp): 支持自定义工具配置

# Bug 修复
fix(docker): 修复容器重启时的PID文件清理问题
fix(api): 解决并发请求时的数据竞争问题

# 文档更新
docs: 更新安装指南和使用说明
docs(api): 完善接口文档和示例代码

# 破坏性变更
feat(config)!: 重构配置文件格式

BREAKING CHANGE: 配置文件格式从 JSON 改为 YAML，需要手动迁移现有配置
```

### ❌ 避免的 Commit 格式

```bash
# ❌ 不好的示例
update code
fix bug
add feature
修复问题
更新文档

# ✅ 改进后
feat(cli): 添加用户认证功能
fix(api): 修复数据获取超时问题
docs: 更新 API 使用文档
```

### 🔄 版本递增规则

根据 commit 类型自动递增版本：

- **Major (x.0.0)**：包含 `BREAKING CHANGE` 的任何 commit
- **Minor (x.y.0)**：包含 `feat` 类型的 commit
- **Patch (x.y.z)**：包含 `fix`、`perf` 类型的 commit
- **无变化**：`docs`、`style`、`refactor`、`test`、`chore`、`ci` 类型

## 🔄 发版流程详解

### 完整流程
1. **代码检查**：运行 `pnpm run check:all`
2. **项目构建**：运行 `pnpm run build`
3. **版本更新**：更新 package.json 版本号
4. **生成变更日志**：基于 commit 历史生成更新日志
5. **NPM 发布**：发布到 npm registry
6. **创建 Git 标签**：创建并推送版本标签
7. **GitHub Release**：创建 GitHub Release 页面

### 自动生成内容
- **更新日志**：标准化的变更日志，位于 docs/changelog.mdx
- **Git 标签**：格式为 `v1.0.0`
- **GitHub Release**：包含变更日志和下载链接

## ⚙️ 配置文件说明

### `.release-it.json`
```json
{
  "git": {
    "commitMessage": "chore: release v${version}",
    "tagName": "v${version}",
    "requireCleanWorkingDir": false,
    "commit": false,  // CI 环境中不创建 commit
    "tag": true,      // 创建 Git 标签
    "push": true      // 推送标签到远程
  },
  "github": {
    "release": true,  // 创建 GitHub Release
    "releaseName": "🚀 v${version}"
  },
  "npm": {
    "publish": true,  // 发布到 NPM
    "publishArgs": ["--access", "public"]
  },
  "plugins": {
    "@release-it/conventional-changelog": {
      "preset": "conventionalcommits",
      "infile": "docs/changelog.mdx"
    }
  }
}
```

### GitHub Actions 工作流
- **触发条件**：push 到 main 分支或手动触发
- **环境变量**：需要 `NPM_TOKEN` 和 `GITHUB_TOKEN`
- **权限**：`contents: write` 用于创建标签和 Release

## 🔐 环境配置

### 必需的 Secrets
在 GitHub 仓库设置中配置：
- `NPM_TOKEN`：NPM 发布令牌
- `GITHUB_TOKEN`：GitHub 自动提供，用于创建 Release

### NPM Token 获取
1. 登录 [npmjs.com](https://www.npmjs.com/)
2. 进入 Access Tokens 页面
3. 创建 Automation token
4. 在 GitHub 仓库 Settings > Secrets 中添加 `NPM_TOKEN`

## 🚨 注意事项

1. **版本号格式**：必须遵循 [SemVer](https://semver.org/) 规范
2. **分支保护**：建议对 main 分支启用保护规则
3. **权限检查**：确保 GitHub Actions 有足够权限
4. **预发布版本**：包含 `-` 的版本会标记为 prerelease
5. **回滚处理**：如需回滚，请手动删除对应的标签和 Release

## � 发版后验证

### 📋 发版成功检查清单

发版完成后，请按以下清单逐项检查：

#### ✅ 基础验证
- [ ] **GitHub Actions 状态**：工作流显示绿色 ✅ 成功状态
- [ ] **版本号更新**：`package.json` 中的版本号已更新
- [ ] **Git 标签创建**：在 [Tags 页面](https://github.com/shenjingnan/xiaozhi-client/tags) 能看到新标签

#### ✅ NPM 发布验证
- [ ] **NPM 包页面**：访问 [xiaozhi-client](https://www.npmjs.com/package/xiaozhi-client) 确认新版本
- [ ] **安装测试**：运行 `npm install -g xiaozhi-client@latest` 测试安装
- [ ] **版本验证**：运行 `xiaozhi --version` 确认版本号正确

#### ✅ GitHub Release 验证
- [ ] **Release 页面**：访问 [Releases](https://github.com/shenjingnan/xiaozhi-client/releases) 确认新 Release
- [ ] **Release 内容**：检查 Release 描述和变更日志是否正确
- [ ] **下载链接**：确认源码下载链接可用

#### ✅ 文档更新验证
- [ ] **更新日志**：确认变更日志已更新并包含新版本（位于 docs/changelog.mdx）
- [ ] **变更内容**：检查变更日志内容是否准确反映了实际变更
- [ ] **链接有效性**：确认 commit 和 PR 链接可正常访问

### 🔧 验证命令

```bash
# 检查 NPM 最新版本
npm view xiaozhi-client version

# 检查本地安装版本
xiaozhi --version

# 检查 Git 标签
git ls-remote --tags origin | grep v1.x.x

# 本地测试安装
npm install -g xiaozhi-client@latest
```

### 📊 发版数据监控

发版后建议关注以下数据：
- **下载量**：NPM 包的下载统计
- **GitHub Stars**：关注度变化
- **Issues**：是否有新的问题报告
- **用户反馈**：社区反馈和使用情况

## 🆘 故障排除

### 🚨 常见问题及解决方案

#### 问题 1：NPM 发布失败

**错误信息**：
```
npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/xiaozhi-client
npm ERR! 403 You do not have permission to publish "xiaozhi-client"
```

**解决方案**：
1. **检查 NPM Token**：
   ```bash
   # 验证 token 是否有效
   npm whoami
   ```
2. **检查包权限**：
   ```bash
   # 检查是否有发布权限
   npm access list collaborators xiaozhi-client
   ```
3. **更新 GitHub Secrets**：
   - 重新生成 NPM Token
   - 更新 GitHub 仓库中的 `NPM_TOKEN` Secret

#### 问题 2：GitHub Release 创建失败

**错误信息**：
```
Error: Resource not accessible by integration
```

**解决方案**：
1. **检查仓库权限**：确认 GitHub Actions 有 `contents: write` 权限
2. **检查分支保护**：确认 main 分支保护规则允许 Actions 推送
3. **检查 Token 权限**：`GITHUB_TOKEN` 应自动具备所需权限

#### 问题 3：版本号冲突

**错误信息**：
```
npm ERR! 403 Forbidden - PUT https://registry.npmjs.org/xiaozhi-client
npm ERR! 403 You cannot publish over the previously published versions
```

**解决方案**：
1. **检查版本号**：确认要发布的版本号未被使用
2. **递增版本号**：使用更高的版本号
3. **删除错误标签**（如果需要）：
   ```bash
   git tag -d v1.x.x
   git push origin :refs/tags/v1.x.x
   ```

#### 问题 4：构建失败

**错误信息**：
```
Error: Command failed: pnpm run check:all
```

**解决方案**：
1. **本地测试**：
   ```bash
   pnpm install
   pnpm run check:all
   pnpm run build
   ```
2. **修复问题**：根据错误信息修复代码问题
3. **重新发版**：问题修复后重新触发发版

#### 问题 5：变更日志生成失败

**错误信息**：
```
Empty release notes
```

**解决方案**：
1. **检查 Commit 格式**：确保 commit 遵循 Conventional Commits 规范
2. **手动生成**：
   ```bash
   npx conventional-changelog -p conventionalcommits -i docs/changelog.mdx -s
   ```
3. **检查配置**：确认 `.release-it.json` 配置正确

### 🔍 调试方法

#### 1. 使用预演模式
```bash
# 在 GitHub Actions 中勾选 "预演模式"
# 或本地运行
npx release-it --dry-run
```

#### 2. 查看详细日志
1. 进入 GitHub Actions 页面
2. 点击失败的工作流
3. 展开各个步骤查看详细错误信息

#### 3. 本地调试
```bash
# 本地测试 release-it 配置
npx release-it --dry-run --verbose

# 检查 conventional-changelog
npx conventional-changelog -p conventionalcommits -r 2

# 测试 NPM 发布
npm publish --dry-run
```

### 📞 获取帮助

如果遇到无法解决的问题：

1. **查看文档**：重新阅读本指南相关部分
2. **搜索 Issues**：在 [GitHub Issues](https://github.com/shenjingnan/xiaozhi-client/issues) 中搜索类似问题
3. **创建 Issue**：详细描述问题和错误信息
4. **联系维护者**：通过 GitHub 或其他渠道联系项目维护者

### 🔄 回滚操作

如果发版出现严重问题，需要回滚：

#### 回滚 NPM 发布
```bash
# 废弃有问题的版本（不推荐删除）
npm deprecate xiaozhi-client@1.x.x "This version has critical issues, please upgrade"
```

#### 回滚 GitHub Release
1. 进入 [Releases 页面](https://github.com/shenjingnan/xiaozhi-client/releases)
2. 找到有问题的 Release
3. 点击 "Edit" → 勾选 "This is a pre-release" 或删除 Release

#### 删除 Git 标签
```bash
# 删除本地标签
git tag -d v1.x.x

# 删除远程标签
git push origin :refs/tags/v1.x.x
```

---

## 🎉 总结

现在你已经掌握了 xiaozhi-client 的完整发版流程！

**记住这些要点**：
- ✅ 首次发版建议使用预演模式
- ✅ 遵循 Conventional Commits 规范
- ✅ 发版后进行完整的验证检查
- ✅ 遇到问题时查看详细日志
- ✅ 不确定时寻求帮助

**快速链接**：
- 📦 [NPM 包页面](https://www.npmjs.com/package/xiaozhi-client)
- 🏷️ [GitHub Releases](https://github.com/shenjingnan/xiaozhi-client/releases)
- 🔧 [GitHub Actions](https://github.com/shenjingnan/xiaozhi-client/actions)
- 📋 [项目 Issues](https://github.com/shenjingnan/xiaozhi-client/issues)

祝你发版顺利！🚀
