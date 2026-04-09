---
allowed-tools: Bash(git checkout --branch:*), Bash(git add:*), Bash(git status:*), Bash(git push:*), Bash(git commit:*), Bash(gh pr create:*)
description: 提交、推送并创建 PR
---

## 上下文

- 当前 git 状态: !`git status`
- 当前 git diff（已暂存和未暂存的变更）: !`git diff HEAD`
- 当前分支: !`git branch --show-current`

## 你的任务

根据上述变更：

1. 如果当前在 main 分支，则创建一个新分支
2. 创建一个包含合适提交信息的 commit
3. 将分支推送到 origin
4. 使用 `gh pr create` 创建 Pull Request
5. 你可以在单次响应中调用多个工具。你必须在单条消息中完成上述所有操作。不要使用任何其他工具或执行任何其他操作。除了工具调用之外，不要发送任何其他文本或消息。
