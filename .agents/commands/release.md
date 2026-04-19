# Release Command

创建项目发布。

## 执行步骤

1. 确保所有测试通过: `pnpm run test`
2. 确保代码检查通过: `pnpm run check`
3. 确保构建成功: `pnpm run build`
4. 运行发布: `pnpm run release`

## 发布流程

release-it 会自动执行以下操作：

1. 检查工作区是否干净
2. 提示选择版本号（major/minor/patch）
3. 更新 package.json 版本
4. 更新 CHANGELOG.md
5. 创建 Git commit
6. 创建 Git tag
7. 推送到远程仓库
8. 创建 GitHub Release

## 版本规范

遵循语义化版本规范：

- **major**: 不兼容的 API 变更
- **minor**: 向后兼容的新功能
- **patch**: 向后兼容的 Bug 修复

## 配置文件

发布配置位于 `.release-it.json`。