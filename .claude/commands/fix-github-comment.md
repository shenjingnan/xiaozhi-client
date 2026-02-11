---
description: 获取GitHub PR的Copilot评论并分析修复问题
argument-hint: [pr-number-or-url]
---

<input>$1</input>

## 第一步：解析 PR 编号

请首先解析输入参数：
- 如果输入是数字（如 `1358`），直接使用该 PR 编号
- 如果输入是 PR URL（如 `https://github.com/shenjingnan/xiaozhi-client/pull/1358`），从 URL 路径中提取最后一部分作为 PR 编号

解析后得到 PR 编号：记为 `<pr-number>`

## 第二步：检查工作区状态

执行命令检查当前工作区是否有未提交的更改：
```bash
git status --porcelain
```

如果输出非空（有未提交的更改），请停止执行并向用户提示：
```
错误：当前工作区存在未提交的代码，请先处理完成后再重新执行此命令。

你可以选择：
1. 提交当前更改：git commit
2. 暂存当前更改：git stash
3. 放弃当前更改：git checkout -- .
```

如果工作区是干净的（输出为空），继续执行下一步。

## 第三步：获取 PR 信息并切换分支

执行以下命令获取 PR 对应的分支名：
```bash
gh pr view <pr-number> --json headRefName -q '.headRefName'
```

将获取的分支名记为 `<pr-branch>`。

然后检查本地是否已存在该分支：
```bash
git branch --list "<pr-branch>"
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

## 第四步：获取并分析评论

现在分支已切换到 PR 对应的分支，请执行以下操作：

1. 获取 PR #<pr-number> 的所有待解决的评论，主要是 Copilot 的评论
2. 分析这些评论是否真的存在问题
3. 如果的确存在问题，请帮我调整代码
4. 如果认为这是无关紧要的问题，或者是过度评论可以不进行处理
