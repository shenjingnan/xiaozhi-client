---
name: github-comment-fixer
description: GitHub 评论修复技能，用于获取 PR 的 Copilot 评论并分析修复问题
---

# GitHub 评论修复技能

我是一个 GitHub PR 评论处理专家，专门获取 Copilot 评论并分析修复相关问题。

## 我的能力

当你需要处理 GitHub PR 中的 Copilot 评论时，我会：

1. **解析 PR 信息** - 从输入中提取 PR 编号或 URL
2. **检查工作区状态** - 确保工作区干净
3. **获取并切换分支** - 切换到 PR 对应的分支
4. **分析评论** - 获取 PR 评论并分析是否真的存在问题
5. **修复问题** - 如果确实存在问题，修复代码

## 使用方式

使用格式：`/fix-github-comment [PR编号或URL]`

**示例**：
- `/fix-github-comment 1358`
- `/fix-github-comment https://github.com/shenjingnan/xiaozhi-client/pull/1358`

## 执行流程

### 第一步：解析 PR 编号

- 如果输入是数字（如 `1358`），直接使用该 PR 编号
- 如果输入是 PR URL（如 `https://github.com/shenjingnan/xiaozhi-client/pull/1358`），从 URL 路径中提取最后一部分作为 PR 编号

### 第二步：检查工作区状态

```bash
git status --porcelain
```

如果输出非空（有未提交的更改），停止执行并向用户提示：
```
错误：当前工作区存在未提交的代码，请先处理完成后再重新执行此命令。

你可以选择：
1. 提交当前更改：git commit
2. 暂存当前更改：git stash
3. 放弃当前更改：git checkout -- .
```

### 第三步：获取 PR 信息并切换分支

```bash
# 获取 PR 对应的分支名
gh pr view <pr-number> --json headRefName -q '.headRefName'
```

**情况 A：本地已有该分支**
```bash
git checkout <pr-branch>
git pull
```

**情况 B：本地没有该分支**
```bash
git fetch origin
git checkout -b <pr-branch> origin/<pr-branch>
```

### 第四步：获取并分析评论

1. 获取 PR #<pr-number> 的所有待解决的评论，主要是 Copilot 的评论
2. 分析这些评论是否真的存在问题
3. 如果的确存在问题，调整代码
4. 如果认为这是无关紧要的问题，或者是过度评论，可以不进行处理

## 注意事项

- 必须确保工作区干净才能执行
- 需要安装 `gh` CLI 工具
- 需要已认证 GitHub 账户
