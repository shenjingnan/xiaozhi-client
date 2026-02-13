---
name: github-comment-fixer
description: GitHub 评论修复技能，用于获取 PR 的 Copilot 评论并分析修复问题
---

# GitHub 评论修复技能

我是一个 GitHub PR 评论处理专家，专门获取 Copilot 评论并分析修复相关问题。

## 我的能力

当你需要处理 GitHub PR 中的 Copilot 评论时，我会：

1. **解析 PR 信息** - 从输入中提取 PR 编号或 URL
2. **获取分支名** - 获取 PR 对应的分支名
3. **管理 worktree** - 检查/创建/清理 git worktree
4. **分析评论** - 获取 PR 评论并分析是否真的存在问题
5. **修复问题** - 如果确实存在问题，修复代码并提交推送
6. **清理环境** - 清理创建的 worktree，保持工作区整洁

## 使用方式

使用格式：`/fix-github-comment [PR编号或URL]`

**示例**：
- `/fix-github-comment 1358`
- `/fix-github-comment https://github.com/shenjingnan/xiaozhi-client/pull/1358`

## 执行流程

### 第一步：解析 PR 编号

- 如果输入是数字（如 `1358`），直接使用该 PR 编号
- 如果输入是 PR URL（如 `https://github.com/shenjingnan/xiaozhi-client/pull/1358`），从 URL 路径中提取最后一部分作为 PR 编号

### 第二步：获取 PR 信息并创建 worktree

```bash
# 获取 PR 对应的分支名
gh pr view <pr-number> --json headRefName -q '.headRefName'
```

**分支名转换规则**：
- PR 分支名如 `fix/foo` → worktree 目录名 `fix_foo`
- 使用 `_` 替换分支名中的 `/`

**检查 worktree 是否存在**：
```bash
# 检查本地是否存在对应的 worktree
git worktree list --porcelain | grep "worktrees/"

# 或者查看 worktree 列表
git worktree list
```

**情况 A：worktree 已存在**
- 直接 cd 到 worktree 目录继续执行

**情况 B：worktree 不存在，检查本地分支**

1. 本地已有该分支：
   ```bash
   # 创建 worktree（复用已有分支，无需 -b 参数）
   git worktree add ./worktrees/<dir-name> <pr-branch>
   ```

2. 本地没有该分支：
   ```bash
   # 先 fetch 远端分支
   git fetch origin
   # 创建 worktree 并基于远端分支创建本地分支
   git worktree add ./worktrees/<dir-name> -b <pr-branch> origin/<pr-branch>
   ```

**worktree 已存在但有改动**：
- 提示用户当前 worktree 有未提交的更改
- 询问是否 stash 继续或终止

**远端分支已删除**：
- 无法创建 worktree，提示用户

### 第三步：进入 worktree 目录

```bash
cd ./worktrees/<dir-name>
git pull
```

### 第四步：获取并分析评论

1. 获取 PR #<pr-number> 的所有待解决的评论，主要是 Copilot 的评论
2. 分析这些评论是否真的存在问题
3. 如果的确存在问题，调整代码
4. 如果认为这是无关紧要的问题，或者是过度评论，可以不进行处理

### 第五步：提交并推送更改

在 worktree 中完成修复后：

```bash
# 添加修改的文件
git add -A

# 提交更改
git commit -m "fix: 修复 PR 评论中的问题"

# 推送到远端
git push
```

### 第六步：清理 worktree

完成修复后，清理创建的 worktree：

```bash
# 返回原目录
cd ../..

# 移除 worktree 目录
git worktree remove ./worktrees/<dir-name>
```

**可选：删除本地分支**（如果分支已合并或不需要保留）：
```bash
git branch -d <pr-branch>
```

## 注意事项

- 使用 worktree 可以并行处理多个 PR 评论任务，互不干扰
- 需要安装 `gh` CLI 工具
- 需要已认证 GitHub 账户
- worktree 目录位于项目根目录的 `worktrees/` 文件夹下
