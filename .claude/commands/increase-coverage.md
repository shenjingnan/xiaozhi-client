---
allowed-tools: Bash(git diff:*), Bash(git diff --name-only:*), Bash(git merge-base:*), Bash(pnpm run test:*), Bash(pnpm run test:coverage:*), Bash(pnpm run test:coverage), Read, Glob, Grep, Edit, Write
description: 分析当前分支改动并补充单测覆盖率
---

## 上下文

- 分叉点 commit: !`git merge-base main HEAD`
- 当前分支改动文件列表: !`git --no-pager diff --name-only main...HEAD`
- 当前分支改动内容: !`git --no-pager diff main...HEAD`
- 当前覆盖率基线: !`pnpm run test:coverage 2>&1`

## 你的任务

根据上述信息，为当前分支的改动补充测试覆盖：

1. 分析当前分支改动，识别变更的核心逻辑文件（排除配置文件、类型定义等非逻辑文件）
2. 查看当前覆盖率报告，记录基线数据
3. 分析哪些核心逻辑缺少测试覆盖，重点关注：
   - 新增的函数和方法
   - 修改后的条件分支
   - 边界场景和异常处理
4. 为缺少覆盖的逻辑补充测试用例，测试文件放在 `src/__tests__/` 目录下
5. 运行 `pnpm run test` 确保全部测试通过，如有失败则修复
6. 运行 `pnpm run test:coverage` 获取更新后的覆盖率
7. 输出总结：覆盖率从 X% 提升到 Y%，新增了哪些测试用例
