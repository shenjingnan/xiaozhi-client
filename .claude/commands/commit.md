---
description: 生成 commit 信息
---

### 我希望你提供给我的内容

1. commit 标题和改动说明
2. 你认为合理的一个分支名称
3. 生成的 commit 信息必须是中文

### 一些提示信息

1. 你可以通过命令：git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@' 知道当前仓库的主分支名称。注意：如果 `refs/remotes/origin/HEAD` 不存在，该命令会失败。这种情况下，你可以用 `git remote show origin` 查看远端的主分支，或者尝试 `git branch -r` 查看远端分支列表，通常主分支名称为 `main` 或 `master`。
2. 注意，你知道主分支之后，需要和 远端主分支进行对比，因为本地主分支代码可能落后
3. 当前本地的 origin 可能不是最新的，你应该尝试跑一次 git fetch origin
4. 你应该优先检查没有 git add 的改动
5. 请记住，你执行命令的时候，尽量避免出现需要交互的操作，因为你无法交互，如果出现了交互的操作，就需要用户干预，你的命令应该尽量执行之后就不要交互就可以读取到信息
   比如你不应该直接用 `git diff origin/main HEAD <filePath>` 因为这个命令一旦使用，你需要用户手动点击 q 才能退出
   比如你可以添加 `--no-pager` 选项 `git --no-pager diff origin/main HEAD <filePath>`
6. 还有我发现你使用 `git --no-pager diff origin/main HEAD <filePath>` 往往获取不到具体的改动，但是你用 `git --no-pager diff origin/main <filePath>` 就能获取到具体的改动内容，你可以思考一下为什么加上 `HEAD` 就会获取不到改动内容，避免这种问题发生

### 我的要求

- commit 的标题应该符合 git 规范
- 不要考虑当前的分支名称，当前分支名不具有参考价值
- 不要帮我提交代码，只需要告诉我你觉得合理的 commit 标题和详细内容即可
- type 有以下类型
  feat： 新增 feature
  fix: 修复 bug
  docs: 仅仅修改了文档，比如 README, CHANGELOG, CONTRIBUTE 等等
  style: 仅仅修改了空格、格式缩进、逗号等等，不改变代码逻辑
  refactor: 代码重构，没有加新功能或者修复 bug
  perf: 优化相关，比如提升性能、体验
  test: 测试用例，包括单元测试、集成测试等
  chore: 改变构建流程、或者增加依赖库、工具等
  revert: 回滚到上一个版本
- 分支名请选择: feature / bugfix / docs / test 作为前缀
- 我希望你返回给我的 commit 内容遵循以下格式

```text
<分支名称>
```

```text
<type>(<scope>): <subject>

 <body>
```
