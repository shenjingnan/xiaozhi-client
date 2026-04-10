---
allowed-tools: Bash(playwright-cli:*), Bash(pnpm dev:*), Bash(pnpm build:*), Bash(lsof:*), Bash(node:*), Bash(ls:*), Bash(mkdir:*), Bash(rm:*)
description: 使用 Playwright 对 Web UI 进行端到端测试
---

## 上下文

- 当前 git 分支: !`git branch --show-current`
- 构建产物状态: !`ls -la dist/cli/index.js 2>/dev/null || echo "未构建"`
- Web 服务端口占用情况: !`lsof -i :9999 2>/dev/null | head -5 || echo "端口 9999 未被占用"`
- 可用测试用例: !`ls -d tests/e2e/*/ 2>/dev/null | sed 's|tests/e2e/||;s|/||' || echo "无测试用例"`

## 输入参数

用户参数: $ARGUMENTS

## 模式判断

根据 `$ARGUMENTS` 判断执行模式：

### 模式一：路径模式（$ARGUMENTS 是一个目录路径）

当 `$ARGUMENTS` 指向一个存在的目录路径时（支持相对路径和绝对路径），进入路径模式：

1. **识别目标**：
   - 检查该目录下是否存在 `test.md` 文件
   - 如果存在 → 这是**单个测试用例**，只执行这一个
   - 如果不存在 → 扫描子目录，找出所有包含 `test.md` 的子目录作为待执行用例列表

2. **执行每个测试用例**：

   对每个测试用例，按以下流程执行：

   a. 读取 `test.md`，理解测试步骤
   b. 准备截图目录：
      - 在测试用例目录下创建 `steps/` 子目录（如不存在）：`mkdir -p <测试用例绝对路径>/steps`
      - 清空 `steps/` 目录中已有的旧截图：`rm -f <测试用例绝对路径>/steps/*.png`
      - 初始化截图计数器为 1
   c. 检查该用例目录下是否有 `expected.png`
   d. 确保浏览器已打开且在正确页面（如未打开则 `playwright-cli open`）
   e. 按照 `test.md` 中的步骤逐步执行操作
   f. 如果存在 `expected.png`：
      - 在关键步骤后截图：`playwright-cli screenshot --filename=<测试用例绝对路径>/steps/<两位数编号>.png`
      - 编号从 01 开始递增（01.png, 02.png, ...）
      - 使用视觉能力对比 `expected.png` 和实际截图，描述差异
      - 一致 → PASS，有明显差异 → FAIL 并说明差异
   g. 如果不存在 `expected.png`：
      - 执行完所有步骤后截图：`playwright-cli screenshot --filename=<测试用例绝对路径>/steps/<两位数编号>.png`
      - 根据步骤是否顺利执行判定 PASS 或 FAIL

3. **汇总报告**（多个用例时）：

   所有用例执行完毕后，输出汇总表格：

   | 用例名称 | 结果 | 说明 |
   |---------|------|------|
   | xxx     | PASS | xxx  |
   | yyy     | FAIL | xxx  |

4. **清理收尾**：`playwright-cli close` 关闭浏览器

### 模式二：文字描述模式（$ARGUMENTS 不是路径或为空）

当 `$ARGUMENTS` 不是有效目录路径时，将 `$ARGUMENTS` 视为测试场景的文字描述：

1. **环境准备**：确认 Web 服务已在端口 9999 运行，如未运行则先启动服务
2. **打开页面**：`playwright-cli open http://localhost:9999`
3. **获取快照**：`playwright-cli snapshot` 了解页面结构和元素引用
4. **执行测试**：根据用户描述的场景进行交互操作（click、fill、type、select、press 等）
5. **验证结果**：每步操作后通过 snapshot 验证页面状态，用 `screenshot --filename=<name>.png` 保存截图（截图保存到当前工作目录）
6. **清理收尾**：`playwright-cli close` 关闭浏览器，报告测试结果

## 使用示例

- `/e2e` → 文字描述模式（等待用户补充描述）
- `/e2e 测试首页加载是否正常` → 文字描述模式
- `/e2e tests/e2e/测试MCPTool调试按钮是否正常` → 执行单个测试用例
- `/e2e /Users/nemo/Projects/shenjingnan/xiaozhi-client/tests/e2e/测试MCPTool调试按钮是否正常` → 绝对路径执行单个用例
- `/e2e tests/e2e` → 执行所有测试用例
