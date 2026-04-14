---
allowed-tools: Bash(playwright-cli:*), Bash(pnpm dev:*), Bash(pnpm build:*), Bash(lsof:*), Bash(node:*), Bash(ls:*), Bash(mkdir:*), Bash(rm:*), Bash(mv:*), Bash(cat:*), Bash(head:*), Bash(tail:*), Bash(wc:*), Bash(grep:*), Bash(date:*), Bash(sort:*), Bash(find:*)
description: 使用 Playwright 对 Web UI 进行端到端测试（支持视频录制、Trace 录制、控制台/网络日志捕获）
---

## 上下文

- 了解如何使用 playwright-cli: !`playwright-cli --help`
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

   a. **准备产物目录**：
   - 创建 `artifacts/` 子目录：`mkdir -p <测试用例绝对路径>/artifacts/trace`
   - 创建 `steps/` 子目录：`mkdir -p <测试用例绝对路径>/steps`
   - 清空 `steps/` 目录中已有的旧截图：`rm -f <测试用例绝对路径>/steps/*.png`
   - 初始化截图计数器为 1

   b. 读取 `test.md`，理解测试步骤

   c. 检查该用例目录下是否有 `expected.png`

   d. 确保浏览器已打开且在正确页面（如未打开则 `playwright-cli open`）

   e. **启动录制**：
   - 开始视频录制：`playwright-cli video-start <测试用例绝对路径>/artifacts/recording.webm`
   - 开始 Trace 录制：`playwright-cli tracing-start`

   f. 按照 `test.md` 中的步骤逐步执行操作：
   - 遇到"截图"指令时：
     * 先添加视频章节标记：`playwright-cli video-chapter "步骤<N>: <描述>" --description="<步骤原文>" --duration=1500`
       - 描述从截图指令的括号中提取，如 `截图（对话框打开状态）` → 描述为 `"对话框打开状态"`；无括号则使用 `"步骤N"`
     * 截图保存到 steps/：`playwright-cli screenshot --filename=<测试用例绝对路径>/steps/<两位数编号>.png`
     * 如果存在 `expected.png`，使用视觉能力对比 `expected.png` 和实际截图，描述差异
     * 一致 → PASS，有明显差异 → FAIL 并说明差异
     * 截图计数器递增
   - 其他操作（导航、点击、填写等）直接执行，trace 自动记录所有操作

   g. **捕获日志**（所有步骤执行完毕后）：
   - 捕获完整控制台日志：`playwright-cli --raw console > <测试用例绝对路径>/artifacts/console.log 2>&1`
   - 捕获控制台警告：`playwright-cli --raw console warning > <测试用例绝对路径>/artifacts/console-warnings.log 2>&1`
   - 捕获网络活动：`playwright-cli --raw network > <测试用例绝对路径>/artifacts/network.log 2>&1`

   h. **停止录制**：
   - 停止 Trace：`playwright-cli tracing-stop`
     - 将 trace 文件从 `.playwright-cli/traces/` 移动到用例的 `artifacts/trace/` 目录：
       ```
       LATEST_TRACE=$(ls -t .playwright-cli/traces/*.trace 2>/dev/null | head -1)
       if [ -n "$LATEST_TRACE" ]; then
         TRACE_BASE=$(basename "$LATEST_TRACE" .trace)
         mv "$LATEST_TRACE" <测试用例绝对路径>/artifacts/trace/test.trace
         mv ".playwright-cli/traces/${TRACE_BASE}.network" <测试用例绝对路径>/artifacts/trace/test.network 2>/dev/null
         [ -d ".playwright-cli/traces/resources" ] && mv .playwright-cli/traces/resources <测试用例绝对路径>/artifacts/trace/resources 2>/dev/null
       fi
       ```
   - 停止视频录制：`playwright-cli video-stop`

   i. **分析日志健康状态**：
   - 分析 `console.log`：
     * 统计 error 级别消息数量（搜索 `[error]` 关键字）
     * 统计 warning 级别消息数量（搜索 `[warning]` 关键字）
     * 如有 error，提取错误内容摘要（前 3 条）
   - 分析 `network.log`：
     * 统计 HTTP 请求总数
     * 统计失败请求（4xx / 5xx）数量
     * 如有失败请求，提取 URL 和状态码

   j. **判定结果**：
   | 等级 | 条件 |
   |------|------|
   | **PASS** | 视觉对比通过 AND console 无 error AND 网络无 5xx |
   | **WARN** | 视觉对比通过 BUT (console 有 error OR 网络 5xx) |
   | **FAIL** | 视觉对比失败 |

   k. **输出单用例报告**：

   ```markdown
   ## 测试报告: {用例名称}
   **总体结果**: PASS / FAIL / WARN

   ### 视觉验证
   | 截图 | 对比结果 | 说明 |
   |------|---------|------|
   | 01.png | - | 初始状态 |
   | 02.png | PASS/FAIL | 与 expected.png 对比 |

   ### 控制台日志分析
   - **Error**: N 条 / **Warning**: N 条
   - 详情: `artifacts/console.log`
   - [ ] 无致命错误

   ### 网络活动分析
   - **总请求数**: N / **失败请求**: N (4xx: N, 5xx: N)
   - 详情: `artifacts/network.log`
   - [ ] 无网络异常

   ### 录制产物
   | 类型 | 文件 |
   |------|------|
   | 视频 | `artifacts/recording.webm` |
   Trace | `artifacts/test.trace` |
   | Console Log | `artifacts/console.log` |
   | Network Log | `artifacts/network.log` |

   ### 结论
   {PASS/FAIL/WARN} - {一句话总结}
   ```

3. **汇总报告**（多个用例时）：

   所有用例执行完毕后，输出汇总表格：

   | 用例名称 | 结果 | Console Errors | Network Failures | 说明 |
   | -------- | ---- | -------------- | ---------------- | ---- |
   | xxx      | PASS | 0              | 0                | xxx  |
   | yyy      | WARN | 2              | 0                | 有 console 错误 |

4. **清理收尾**：`playwright-cli close` 关闭浏览器

### 模式二：文字描述模式（$ARGUMENTS 不是路径或为空）

当 `$ARGUMENTS` 不是有效目录路径时，将 `$ARGUMENTS` 视为测试场景的文字描述：

1. **环境准备**：确认 Web 服务已在端口 9999 运行，如未运行则先启动服务
2. **打开页面**：`playwright-cli open http://localhost:9999`
3. **获取快照**：`playwright-cli snapshot` 了解页面结构和元素引用
4. **启动录制**：
   - 创建临时产物目录：`mkdir -p tests/e2e/adhoc-artifacts`
   - 开始视频录制：`playwright-cli video-start tests/e2e/adhoc-artifacts/recording-$(date +%Y%m%d-%H%M%S).webm`
   - 开始 Trace 录制：`playwright-cli tracing-start`
5. **执行测试**：根据用户描述的场景进行交互操作（click、fill、type、select、press 等）
6. **验证结果**：每步操作后通过 snapshot 验证页面状态
7. **捕获日志并停止录制**：
   - `playwright-cli --raw console > tests/e2e/adhoc-artifacts/console-output.log 2>&1`
   - `playwright-cli --raw network > tests/e2e/adhoc-artifacts/network-output.log 2>&1`
   - `playwright-cli tracing-stop`
   - `playwright-cli video-stop`
8. **分析日志**：检查 console 是否有 error、network 是否有失败请求
9. **清理收尾**：`playwright-cli close` 关闭浏览器，报告测试结果和日志分析

## 使用示例

- `/e2e` → 文字描述模式（等待用户补充描述）
- `/e2e 测试首页加载是否正常` → 文字描述模式
- `/e2e tests/e2e/测试MCPTool调试按钮是否正常` → 执行单个测试用例（含视频+trace+日志）
- `/e2e /Users/nemo/Projects/shenjingnan/xiaozhi-client/tests/e2e/测试MCPTool调试按钮是否正常` → 绝对路径执行单个用例
- `/e2e tests/e2e` → 执行所有测试用例（每个用例独立生成 artifacts）

## 产物说明

每个测试用例执行后会在对应目录生成以下产物：

```
<测试用例>/
├── test.md                    # 测试步骤定义
├── expected.png               # 期望结果截图（可选）
├── steps/                     # 步骤截图（保留用于视觉对比）
│   ├── 01.png
│   └── ...
└── artifacts/                 # 运行时产物（不入库）
    ├── recording.webm         # 操作视频回放
    ├── console.log            # 完整控制台日志
    ├── console-warnings.log   # 控制台警告过滤
    ├── network.log            # 网络请求/响应记录
    └── trace/                 # Playwright Trace（可用 Trace Viewer 打开）
        ├── test.trace         # 操作日志 + DOM 快照 + 时序
        ├── test.network       # 完整网络瀑布数据
        └── resources/         # 缓存资源文件
```

### 如何查看产物

| 产物 | 查看方式 |
|------|---------|
| 视频 (.webm) | 任意视频播放器打开 |
| Trace (.trace) | 使用 [Playwright Trace Viewer](https://trace.playwright.dev/) 打开 `test.trace`，可交互式回放每一步操作、查看 DOM 变化、网络瀑布、控制台消息 |
| console.log | 文本编辑器直接查看 |
| network.log | 文本编辑器直接查看，包含完整的请求/响应信息 |
