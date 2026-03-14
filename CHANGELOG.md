## 2.1.0 (2026-03-14)

### 🚀 Features

- **config:** 添加提示词文件选择功能 ([#2262](https://github.com/shenjingnan/xiaozhi-client/pull/2262))
- **config:** 添加系统提示词编辑功能 ([#2292](https://github.com/shenjingnan/xiaozhi-client/pull/2292))
- **docker:** 添加 ffmpeg 支持以支持语音互动功能 ([#2140](https://github.com/shenjingnan/xiaozhi-client/pull/2140))
- **frontend:** 添加实时语音卡片功能 ([#2190](https://github.com/shenjingnan/xiaozhi-client/pull/2190))
- **llm:** 支持 LLM 服务配置热更新 ([#2388](https://github.com/shenjingnan/xiaozhi-client/pull/2388))
- **templates:** 为模板添加语音交互配置和默认提示词 ([#2141](https://github.com/shenjingnan/xiaozhi-client/pull/2141))
- **tts:** 添加 TTS 音色配置支持 ([#2432](https://github.com/shenjingnan/xiaozhi-client/pull/2432))

### 🩹 Fixes

- 修复 packages/endpoint tsconfig.json 的 outDir 配置 ([#1964](https://github.com/shenjingnan/xiaozhi-client/pull/1964), [#1958](https://github.com/shenjingnan/xiaozhi-client/issues/1958))
- 修复 WebServer 中 eventBus 事件监听器内存泄漏 ([#1773](https://github.com/shenjingnan/xiaozhi-client/pull/1773), [#1772](https://github.com/shenjingnan/xiaozhi-client/issues/1772))
- 将 workflow-parameter-config-dialog 中的 any 类型替换为 JSONSchema ([#2340](https://github.com/shenjingnan/xiaozhi-client/pull/2340), [#2337](https://github.com/shenjingnan/xiaozhi-client/issues/2337))
- **event-bus:** 将 status:updated 事件的 status 字段类型从 any 改为 ClientInfo ([#2359](https://github.com/shenjingnan/xiaozhi-client/pull/2359), [#2358](https://github.com/shenjingnan/xiaozhi-client/issues/2358))
- **frontend:** 修复语音交互设置弹窗表单初始化问题 ([#2433](https://github.com/shenjingnan/xiaozhi-client/pull/2433))
- **security:** 修复 @discordjs/opus 传递依赖中 tar 包的 CVE 漏洞 ([#2353](https://github.com/shenjingnan/xiaozhi-client/pull/2353), [#2352](https://github.com/shenjingnan/xiaozhi-client/issues/2352))
- **tsconfig:** 添加 packages/tts 到 TypeScript 项目引用 ([#2333](https://github.com/shenjingnan/xiaozhi-client/pull/2333), [#2332](https://github.com/shenjingnan/xiaozhi-client/issues/2332))
- **types:** 移除 realtime-notification.handler.ts 中的 any 类型 ([#1905](https://github.com/shenjingnan/xiaozhi-client/pull/1905), [#1903](https://github.com/shenjingnan/xiaozhi-client/issues/1903))

### 🔥 Performance

- **backend:** 缓存 Object.values(ToolType) 避免重复数组创建 ([#1973](https://github.com/shenjingnan/xiaozhi-client/pull/1973), [#1970](https://github.com/shenjingnan/xiaozhi-client/issues/1970))
- **config:** 优化 ConfigManager.getConfig() 性能 ([#819](https://github.com/shenjingnan/xiaozhi-client/pull/819), [#816](https://github.com/shenjingnan/xiaozhi-client/issues/816))
- **frontend:** 使用 useMemo 优化 ToolPagination 页码计算 ([#1986](https://github.com/shenjingnan/xiaozhi-client/pull/1986), [#1983](https://github.com/shenjingnan/xiaozhi-client/issues/1983))
- **handlers:** 缓存正则表达式以减少验证场景下的性能开销 ([#1816](https://github.com/shenjingnan/xiaozhi-client/pull/1816), [#1815](https://github.com/shenjingnan/xiaozhi-client/issues/1815))

### ❤️ Thank You

- Claude Opus 4.6
- shenjingnan @shenjingnan

## 2.1.0-beta.0 (2026-03-14)

### 🚀 Features

- **config:** 添加提示词文件选择功能 ([#2262](https://github.com/shenjingnan/xiaozhi-client/pull/2262))
- **config:** 添加系统提示词编辑功能 ([#2292](https://github.com/shenjingnan/xiaozhi-client/pull/2292))
- **docker:** 添加 ffmpeg 支持以支持语音互动功能 ([#2140](https://github.com/shenjingnan/xiaozhi-client/pull/2140))
- **frontend:** 添加实时语音卡片功能 ([#2190](https://github.com/shenjingnan/xiaozhi-client/pull/2190))
- **llm:** 支持 LLM 服务配置热更新 ([#2388](https://github.com/shenjingnan/xiaozhi-client/pull/2388))
- **templates:** 为模板添加语音交互配置和默认提示词 ([#2141](https://github.com/shenjingnan/xiaozhi-client/pull/2141))
- **tts:** 添加 TTS 音色配置支持 ([#2432](https://github.com/shenjingnan/xiaozhi-client/pull/2432))

### 🩹 Fixes

- 修复 packages/endpoint tsconfig.json 的 outDir 配置 ([#1964](https://github.com/shenjingnan/xiaozhi-client/pull/1964), [#1958](https://github.com/shenjingnan/xiaozhi-client/issues/1958))
- 修复 WebServer 中 eventBus 事件监听器内存泄漏 ([#1773](https://github.com/shenjingnan/xiaozhi-client/pull/1773), [#1772](https://github.com/shenjingnan/xiaozhi-client/issues/1772))
- 将 workflow-parameter-config-dialog 中的 any 类型替换为 JSONSchema ([#2340](https://github.com/shenjingnan/xiaozhi-client/pull/2340), [#2337](https://github.com/shenjingnan/xiaozhi-client/issues/2337))
- **event-bus:** 将 status:updated 事件的 status 字段类型从 any 改为 ClientInfo ([#2359](https://github.com/shenjingnan/xiaozhi-client/pull/2359), [#2358](https://github.com/shenjingnan/xiaozhi-client/issues/2358))
- **frontend:** 修复语音交互设置弹窗表单初始化问题 ([#2433](https://github.com/shenjingnan/xiaozhi-client/pull/2433))
- **security:** 修复 @discordjs/opus 传递依赖中 tar 包的 CVE 漏洞 ([#2353](https://github.com/shenjingnan/xiaozhi-client/pull/2353), [#2352](https://github.com/shenjingnan/xiaozhi-client/issues/2352))
- **tsconfig:** 添加 packages/tts 到 TypeScript 项目引用 ([#2333](https://github.com/shenjingnan/xiaozhi-client/pull/2333), [#2332](https://github.com/shenjingnan/xiaozhi-client/issues/2332))
- **types:** 移除 realtime-notification.handler.ts 中的 any 类型 ([#1905](https://github.com/shenjingnan/xiaozhi-client/pull/1905), [#1903](https://github.com/shenjingnan/xiaozhi-client/issues/1903))

### 🔥 Performance

- **backend:** 缓存 Object.values(ToolType) 避免重复数组创建 ([#1973](https://github.com/shenjingnan/xiaozhi-client/pull/1973), [#1970](https://github.com/shenjingnan/xiaozhi-client/issues/1970))
- **config:** 优化 ConfigManager.getConfig() 性能 ([#819](https://github.com/shenjingnan/xiaozhi-client/pull/819), [#816](https://github.com/shenjingnan/xiaozhi-client/issues/816))
- **frontend:** 使用 useMemo 优化 ToolPagination 页码计算 ([#1986](https://github.com/shenjingnan/xiaozhi-client/pull/1986), [#1983](https://github.com/shenjingnan/xiaozhi-client/issues/1983))
- **handlers:** 缓存正则表达式以减少验证场景下的性能开销 ([#1816](https://github.com/shenjingnan/xiaozhi-client/pull/1816), [#1815](https://github.com/shenjingnan/xiaozhi-client/issues/1815))

### ❤️ Thank You

- Claude Opus 4.6
- shenjingnan @shenjingnan

# 2.0.0 (2026-03-01)

### 🚀 Features

- 优化 github-comment-fixer 技能使用 worktree ([#1496](https://github.com/shenjingnan/xiaozhi-client/pull/1496))
- 实现 TTS 语音合成 API ([#1632](https://github.com/shenjingnan/xiaozhi-client/pull/1632))
- PR 创建时自动关联 Issue ([#1738](https://github.com/shenjingnan/xiaozhi-client/pull/1738))
- **asr:** 新增 ASR 语音识别包 ([#1824](https://github.com/shenjingnan/xiaozhi-client/pull/1824))
- **asr:** 添加流式语音识别支持 ([#1825](https://github.com/shenjingnan/xiaozhi-client/pull/1825))
- **asr:** 添加 V2 协议 Opus 流式识别示例 ([#1879](https://github.com/shenjingnan/xiaozhi-client/pull/1879))
- **asr:** 添加流式语音识别支持 ([#1848](https://github.com/shenjingnan/xiaozhi-client/pull/1848))
- **asr:** 添加 V3 支持及 zod 配置校验 ([#1904](https://github.com/shenjingnan/xiaozhi-client/pull/1904))
- **asr:** 实现 ASR 服务实例销毁重建机制 ([#2032](https://github.com/shenjingnan/xiaozhi-client/pull/2032))
- **backend:** 添加 @xiaozhi-client/tts 依赖 ([#1962](https://github.com/shenjingnan/xiaozhi-client/pull/1962))
- **ci:** 限制定时任务仅在夜间时段执行 ([#1785](https://github.com/shenjingnan/xiaozhi-client/pull/1785))
- **esp32:** 完善 ESP32 WebSocket 协议一致性实现 ([#1787](https://github.com/shenjingnan/xiaozhi-client/pull/1787))
- **esp32:** 添加 STT 消息异步发送到设备端 ([#2030](https://github.com/shenjingnan/xiaozhi-client/pull/2030))
- **llm:** 支持自定义系统提示词配置 ([#2096](https://github.com/shenjingnan/xiaozhi-client/pull/2096))
- **tts:** 提取 TTS 模块到独立包 @xiaozhi-client/tts ([#1944](https://github.com/shenjingnan/xiaozhi-client/pull/1944))
- **voice:** 添加 LLM 集成支持 ([#1961](https://github.com/shenjingnan/xiaozhi-client/pull/1961))

### 🩹 Fixes

- 移除 mcp-errors.ts 中不合适的 shebang ([#1230](https://github.com/shenjingnan/xiaozhi-client/pull/1230), [#1229](https://github.com/shenjingnan/xiaozhi-client/issues/1229))
- 在 shared-types 的 tsup.config.ts 中添加 target: "node18" ([#1285](https://github.com/shenjingnan/xiaozhi-client/pull/1285), [#1282](https://github.com/shenjingnan/xiaozhi-client/issues/1282))
- 修复 routes/domains 目录下路径别名一致性问题 ([#1277](https://github.com/shenjingnan/xiaozhi-client/pull/1277), [#1274](https://github.com/shenjingnan/xiaozhi-client/issues/1274))
- 移除 apps/backend/lib/mcp/manager.ts 中不必要的 shebang ([#1273](https://github.com/shenjingnan/xiaozhi-client/pull/1273), [#1270](https://github.com/shenjingnan/xiaozhi-client/issues/1270))
- 更新 axios 依赖至 >=1.13.5 以修复 CVE-2026-25639 ([#1259](https://github.com/shenjingnan/xiaozhi-client/pull/1259))
- 升级 calculator-mcp 和 datetime-mcp 包中的 tsup 版本至 ^8.3.5 ([#1248](https://github.com/shenjingnan/xiaozhi-client/pull/1248), [#1247](https://github.com/shenjingnan/xiaozhi-client/issues/1247))
- 将 @modelcontextprotocol/sdk 升级到 ^1.26.0 以修复 CVE-2026-25536 ([#1217](https://github.com/shenjingnan/xiaozhi-client/pull/1217))
- 移除 apps/backend 中覆盖 noImplicitAny 的配置 ([#1221](https://github.com/shenjingnan/xiaozhi-client/pull/1221), [#1220](https://github.com/shenjingnan/xiaozhi-client/issues/1220))
- 统一 TypeScript 版本为 ^5.9.2 ([#1199](https://github.com/shenjingnan/xiaozhi-client/pull/1199), [#1198](https://github.com/shenjingnan/xiaozhi-client/issues/1198))
- 统一 shared-types package.json 中的路径格式，添加 ./ 前缀 ([#1133](https://github.com/shenjingnan/xiaozhi-client/pull/1133), [#1132](https://github.com/shenjingnan/xiaozhi-client/issues/1132))
- 统一 shared-types 包的 TypeScript 版本至 ^5.9.2 ([#1114](https://github.com/shenjingnan/xiaozhi-client/pull/1114), [#1113](https://github.com/shenjingnan/xiaozhi-client/issues/1113))
- 修复 shared-types 包配置中 main 和 types 字段路径格式 ([#1110](https://github.com/shenjingnan/xiaozhi-client/pull/1110), [#1109](https://github.com/shenjingnan/xiaozhi-client/issues/1109))
- 使用统一的 Logger 系统替换 console.warn ([#1107](https://github.com/shenjingnan/xiaozhi-client/pull/1107), [#1106](https://github.com/shenjingnan/xiaozhi-client/issues/1106))
- 统一 Node.js 版本要求为 20+ ([#1059](https://github.com/shenjingnan/xiaozhi-client/pull/1059), [#1058](https://github.com/shenjingnan/xiaozhi-client/issues/1058))
- 修复 TemplateManager 接口使用 any 类型的问题 ([#1030](https://github.com/shenjingnan/xiaozhi-client/pull/1030), [#1029](https://github.com/shenjingnan/xiaozhi-client/issues/1029))
- 统一 service.handler.ts 中的路径别名导入 ([#1307](https://github.com/shenjingnan/xiaozhi-client/pull/1307), [#1305](https://github.com/shenjingnan/xiaozhi-client/issues/1305))
- 修复 websocket-compat.ts 中废弃函数的 any 类型问题 ([#1266](https://github.com/shenjingnan/xiaozhi-client/pull/1266), [#1264](https://github.com/shenjingnan/xiaozhi-client/issues/1264))
- 在 shouldCleanupCache 中使用 DEFAULT_CONFIG.CLEANUP_INTERVAL 常量 ([#1254](https://github.com/shenjingnan/xiaozhi-client/pull/1254), [#1251](https://github.com/shenjingnan/xiaozhi-client/issues/1251))
- 在根 tsconfig.json 中添加 packages/mcp-core 的 project reference ([#1189](https://github.com/shenjingnan/xiaozhi-client/pull/1189))
- 修复 hono.context.ts 中使用相对路径导入类型的问题 ([#1163](https://github.com/shenjingnan/xiaozhi-client/pull/1163), [#1161](https://github.com/shenjingnan/xiaozhi-client/issues/1161))
- 将 shared-types MCP 协议类型中的 any 替换为 unknown ([#1162](https://github.com/shenjingnan/xiaozhi-client/pull/1162), [#1160](https://github.com/shenjingnan/xiaozhi-client/issues/1160))
- shared-types 添加 target 字段以确保构建配置一致性 ([#1139](https://github.com/shenjingnan/xiaozhi-client/pull/1139), [#1136](https://github.com/shenjingnan/xiaozhi-client/issues/1136))
- 改进 Validation.ts 中的类型安全性，移除 any 类型 ([#1074](https://github.com/shenjingnan/xiaozhi-client/pull/1074), [#1072](https://github.com/shenjingnan/xiaozhi-client/issues/1072))
- 使用路径别名替换相对路径导入错误类型 ([#1071](https://github.com/shenjingnan/xiaozhi-client/pull/1071))
- 移除 error-helper.ts 中的 any 类型以提升类型安全性 ([#1070](https://github.com/shenjingnan/xiaozhi-client/pull/1070))
- 修复 middlewares/index.ts 中的路径别名一致性 ([#1026](https://github.com/shenjingnan/xiaozhi-client/pull/1026))
- 修复 service.handler.ts 中导入不一致问题 ([#1002](https://github.com/shenjingnan/xiaozhi-client/pull/1002), [#1001](https://github.com/shenjingnan/xiaozhi-client/issues/1001))
- RouteManager 使用统一的 Logger 系统替代 console ([#987](https://github.com/shenjingnan/xiaozhi-client/pull/987), [#984](https://github.com/shenjingnan/xiaozhi-client/issues/984))
- 将 endpointManager 中间件的 console.warn 替换为统一的 Logger 系统 ([#978](https://github.com/shenjingnan/xiaozhi-client/pull/978), [#976](https://github.com/shenjingnan/xiaozhi-client/issues/976))
- 更新 @modelcontextprotocol/sdk 版本范围至 ^1.26.0 以修复 CVE-2026-25536 安全漏洞 ([#959](https://github.com/shenjingnan/xiaozhi-client/pull/959), [#958](https://github.com/shenjingnan/xiaozhi-client/issues/958))
- 使用 CommandArguments 和 CommandOptions 替换 any 类型 ([#957](https://github.com/shenjingnan/xiaozhi-client/pull/957))
- 修复 version-manager.tsx 中 setTimeout 定时器资源泄漏 ([#930](https://github.com/shenjingnan/xiaozhi-client/pull/930), [#927](https://github.com/shenjingnan/xiaozhi-client/issues/927))
- npm/manager.ts 使用统一的 Logger 系统 ([#880](https://github.com/shenjingnan/xiaozhi-client/pull/880), [#879](https://github.com/shenjingnan/xiaozhi-client/issues/879))
- 将 packages/mcp-core/tsconfig.json 的 composite 设置为 true ([#1197](https://github.com/shenjingnan/xiaozhi-client/pull/1197))
- 移除根 tsconfig.json 中与 monorepo 结构不一致的 rootDir 配置 ([#1165](https://github.com/shenjingnan/xiaozhi-client/pull/1165), [#1164](https://github.com/shenjingnan/xiaozhi-client/issues/1164))
- 修复 tool-call-logs-dialog.tsx 中 CopyButton 组件的资源泄漏风险 ([#983](https://github.com/shenjingnan/xiaozhi-client/pull/983))
- 将 WebSocket 服务中的 any 类型替换为 unknown 提升类型安全性 ([#888](https://github.com/shenjingnan/xiaozhi-client/pull/888), [#887](https://github.com/shenjingnan/xiaozhi-client/issues/887))
- 移除 mcp-manage.handler.ts 中重复的 toolNames 声明 ([#1354](https://github.com/shenjingnan/xiaozhi-client/pull/1354))
- 使用 HTTP_TIMEOUTS.LONG_RUNNING 常量替换硬编码的超时值 ([#1356](https://github.com/shenjingnan/xiaozhi-client/pull/1356))
- 修复 packages/endpoint 示例代码使用过时的 API 导致无法运行 ([#1363](https://github.com/shenjingnan/xiaozhi-client/pull/1363))
- 移除 default export of MCPServiceManager ([#1045](https://github.com/shenjingnan/xiaozhi-client/pull/1045))
- 修复 WebServer.stop 方法中 setTimeout 定时器未清理导致 doResolve 多次调用的问题 ([#871](https://github.com/shenjingnan/xiaozhi-client/pull/871))
- 移除 apps/backend/tsconfig.json 中的 noImplicitAny: false 配置 ([#894](https://github.com/shenjingnan/xiaozhi-client/pull/894), [#891](https://github.com/shenjingnan/xiaozhi-client/issues/891))
- 移除 tsup.config.ts 中重复的 ws 模块声明 ([#901](https://github.com/shenjingnan/xiaozhi-client/pull/901), [#903](https://github.com/shenjingnan/xiaozhi-client/pull/903))
- 禁用 nx-release-publish 任务缓存 ([#1639](https://github.com/shenjingnan/xiaozhi-client/pull/1639))
- 移除 RestartButton 组件中未使用的 restartStatus prop ([#1715](https://github.com/shenjingnan/xiaozhi-client/pull/1715), [#1714](https://github.com/shenjingnan/xiaozhi-client/issues/1714))
- 移除 endpoint 包中重复的 JSONSchema 类型定义 ([#1704](https://github.com/shenjingnan/xiaozhi-client/pull/1704), [#1703](https://github.com/shenjingnan/xiaozhi-client/issues/1703))
- 将 formatUtils 中的 any 类型替换为 unknown 提高类型安全性 ([#1680](https://github.com/shenjingnan/xiaozhi-client/pull/1680), [#1679](https://github.com/shenjingnan/xiaozhi-client/issues/1679))
- 修复 removeEndpoint 方法缺少 await 导致资源未正确清理 ([#1672](https://github.com/shenjingnan/xiaozhi-client/pull/1672))
- 替换 cozeApi.ts 中的 any 类型为更安全的类型 ([#1667](https://github.com/shenjingnan/xiaozhi-client/pull/1667), [#1666](https://github.com/shenjingnan/xiaozhi-client/issues/1666))
- 修复 CVE-2026-2391 安全漏洞 - 升级 qs 依赖 ([#1665](https://github.com/shenjingnan/xiaozhi-client/pull/1665))
- 修复 apps/backend 中相对路径导入，统一使用 @/ 路径别名 ([#1659](https://github.com/shenjingnan/xiaozhi-client/pull/1659), [#1658](https://github.com/shenjingnan/xiaozhi-client/issues/1658))
- 将 ValidationRule 和 ValidationError 中的 any 类型替换为 unknown ([#1623](https://github.com/shenjingnan/xiaozhi-client/pull/1623))
- 统一 ErrorCategory 枚举定义，移除重复 ([#1595](https://github.com/shenjingnan/xiaozhi-client/pull/1595), [#1594](https://github.com/shenjingnan/xiaozhi-client/issues/1594))
- 修复 sidebar.tsx 中的英文错误消息和用户界面文本违反本地化规范 ([#1585](https://github.com/shenjingnan/xiaozhi-client/pull/1585), [#1584](https://github.com/shenjingnan/xiaozhi-client/issues/1584))
- 让 mcp-core tsconfig 继承根配置以消除重复 ([#1537](https://github.com/shenjingnan/xiaozhi-client/pull/1537), [#1536](https://github.com/shenjingnan/xiaozhi-client/issues/1536))
- 修复 checkPortAvailability 函数中 catch 块缺少 timeoutId 清理导致资源泄漏 ([#1503](https://github.com/shenjingnan/xiaozhi-client/pull/1503))
- 为 CozeApiService 添加错误处理 ([#1498](https://github.com/shenjingnan/xiaozhi-client/pull/1498), [#1497](https://github.com/shenjingnan/xiaozhi-client/issues/1497))
- 移除 coze-workflow-integration.tsx 中的 console 日志调用 ([#1385](https://github.com/shenjingnan/xiaozhi-client/pull/1385), [#1384](https://github.com/shenjingnan/xiaozhi-client/issues/1384))
- 替换 TTS 协议文件中的 console.log 为统一的 Logger 系统 ([#1649](https://github.com/shenjingnan/xiaozhi-client/pull/1649))
- 移除 endpoint.route.ts 中重复定义的 createErrorResponse 函数 ([#1561](https://github.com/shenjingnan/xiaozhi-client/pull/1561), [#1560](https://github.com/shenjingnan/xiaozhi-client/issues/1560))
- 将 service.handler.ts 中的硬编码超时值提取为常量 ([#1437](https://github.com/shenjingnan/xiaozhi-client/pull/1437), [#1436](https://github.com/shenjingnan/xiaozhi-client/issues/1436))
- 为 endpoint 包添加 TypeScript 项目引用配置 ([#1375](https://github.com/shenjingnan/xiaozhi-client/pull/1375), [#1374](https://github.com/shenjingnan/xiaozhi-client/issues/1374))
- 使用 process.once() 替代 process.on() 修复 MaxListenersExceededWarning ([#1371](https://github.com/shenjingnan/xiaozhi-client/pull/1371), [#1370](https://github.com/shenjingnan/xiaozhi-client/issues/1370))
- 修复 CustomMCPHandler 事件监听器未清理导致内存泄漏 ([#991](https://github.com/shenjingnan/xiaozhi-client/pull/991), [#989](https://github.com/shenjingnan/xiaozhi-client/issues/989))
- 移除 packages/config 中冗余的 json5 依赖 ([#905](https://github.com/shenjingnan/xiaozhi-client/pull/905), [#904](https://github.com/shenjingnan/xiaozhi-client/issues/904))
- 将 toolSorters.ts 中的 console.warn 替换为统一的 Logger 系统 ([#898](https://github.com/shenjingnan/xiaozhi-client/pull/898), [#895](https://github.com/shenjingnan/xiaozhi-client/issues/895))
- 修复测试文件中的本地化规范违规问题（部分完成） ([#1727](https://github.com/shenjingnan/xiaozhi-client/pull/1727))
- 替换 shared-types 中 CozeApi* 和 CacheItem 的 any 类型为 unknown ([#1778](https://github.com/shenjingnan/xiaozhi-client/pull/1778), [#1777](https://github.com/shenjingnan/xiaozhi-client/issues/1777))
- 修复 NPMManager.spawn 进程资源泄漏问题 ([#1754](https://github.com/shenjingnan/xiaozhi-client/pull/1754), [#1752](https://github.com/shenjingnan/xiaozhi-client/issues/1752))
- 将 manager.ts 和 log.ts 中的 console.* 替换为统一的 Logger 系统 ([#1745](https://github.com/shenjingnan/xiaozhi-client/pull/1745), [#1744](https://github.com/shenjingnan/xiaozhi-client/issues/1744))
- 将 CozeWorkflow.inputSchema 类型从 any 改为 JSONSchema ([#1741](https://github.com/shenjingnan/xiaozhi-client/pull/1741), [#1740](https://github.com/shenjingnan/xiaozhi-client/issues/1740))
- 更新 hono 到安全版本 4.12.0 修复时序攻击漏洞 ([#1866](https://github.com/shenjingnan/xiaozhi-client/pull/1866), [#1863](https://github.com/shenjingnan/xiaozhi-client/issues/1863))
- 修复 tool-call-logs-dialog.tsx 中的本地化问题 ([#1808](https://github.com/shenjingnan/xiaozhi-client/pull/1808), [#1807](https://github.com/shenjingnan/xiaozhi-client/issues/1807))
- 重命名 fix-comment skill 以符合命名规范 ([#1989](https://github.com/shenjingnan/xiaozhi-client/pull/1989))
- **Logger:** 添加 initLogFile 方法的错误处理 ([#1888](https://github.com/shenjingnan/xiaozhi-client/pull/1888), [#1887](https://github.com/shenjingnan/xiaozhi-client/issues/1887))
- **asr:** 添加 @discordjs/opus 依赖解决 Opus 编码器缺失问题 ([#2104](https://github.com/shenjingnan/xiaozhi-client/pull/2104))
- **ci:** 在发布时跳过 nx 缓存 ([#2098](https://github.com/shenjingnan/xiaozhi-client/pull/2098))
- **ci:** 确保 nx 缓存目录存在 ([#2100](https://github.com/shenjingnan/xiaozhi-client/pull/2100))
- **cli:** 修复 backend 类型声明路径错误并删除 any 类型使用 ([#1886](https://github.com/shenjingnan/xiaozhi-client/pull/1886), [#1885](https://github.com/shenjingnan/xiaozhi-client/issues/1885))
- **deps:** 为 packages/cli 和 packages/config 添加缺失的 tsup 依赖 ([#1287](https://github.com/shenjingnan/xiaozhi-client/pull/1287), [#1286](https://github.com/shenjingnan/xiaozhi-client/issues/1286))
- **deps:** 统一 vitest 版本为 ^3.2.4 ([#1228](https://github.com/shenjingnan/xiaozhi-client/pull/1228), [#1227](https://github.com/shenjingnan/xiaozhi-client/issues/1227))
- **deps:** 统一 packages/tts 的 @types/node 版本至 ^24.3.0 ([#2020](https://github.com/shenjingnan/xiaozhi-client/pull/2020), [#2019](https://github.com/shenjingnan/xiaozhi-client/issues/2019))
- **endpoint:** 为 sendErrorResponse 方法添加错误处理 ([#1225](https://github.com/shenjingnan/xiaozhi-client/pull/1225))
- **npm:** 添加 spawn 进程 error 事件监听器 ([#1255](https://github.com/shenjingnan/xiaozhi-client/pull/1255), [#1252](https://github.com/shenjingnan/xiaozhi-client/issues/1252))
- **release:** 确保 nx-release-publish 在发布前执行构建 ([#1241](https://github.com/shenjingnan/xiaozhi-client/pull/1241))
- **release:** 将 asr 和 tts 包纳入发布流程 ([#2102](https://github.com/shenjingnan/xiaozhi-client/pull/2102))
- **routes:** 统一 esp32.route.ts 使用 @/ 路径别名 ([#1896](https://github.com/shenjingnan/xiaozhi-client/pull/1896), [#1895](https://github.com/shenjingnan/xiaozhi-client/issues/1895))
- **status:** 将 status.service.ts 中的英文注释翻译为中文 ([#1268](https://github.com/shenjingnan/xiaozhi-client/pull/1268))
- **tts:** 修复 TTS 流式播放问题并增加调试日志 ([#2031](https://github.com/shenjingnan/xiaozhi-client/pull/2031))
- **types:** 移除 test-voice-session.service.ts 中的 any 类型 ([#1832](https://github.com/shenjingnan/xiaozhi-client/pull/1832), [#1831](https://github.com/shenjingnan/xiaozhi-client/issues/1831))
- **websocket:** 移除 websocket.ts 和 websocket-compat.ts 之间的循环依赖 ([#1612](https://github.com/shenjingnan/xiaozhi-client/pull/1612), [#1610](https://github.com/shenjingnan/xiaozhi-client/issues/1610))

### 🔥 Performance

- 缓存 tools.map 结果避免重复映射操作 ([#1290](https://github.com/shenjingnan/xiaozhi-client/pull/1290))
- 优化 mcp-manage.handler.ts 中重复的 map 调用 ([#1193](https://github.com/shenjingnan/xiaozhi-client/pull/1193), [#1191](https://github.com/shenjingnan/xiaozhi-client/issues/1191))
- 移除 tool-call-logs-dialog 中不必要的人为延迟 ([#1461](https://github.com/shenjingnan/xiaozhi-client/pull/1461), [#1460](https://github.com/shenjingnan/xiaozhi-client/issues/1460))
- **frontend:** 优化表单 condition 函数中的 form.watch 调用 ([#1805](https://github.com/shenjingnan/xiaozhi-client/pull/1805), [#1804](https://github.com/shenjingnan/xiaozhi-client/issues/1804))
- **install-log-dialog:** 优化正则表达式使用避免重复创建 ([#1841](https://github.com/shenjingnan/xiaozhi-client/pull/1841), [#1839](https://github.com/shenjingnan/xiaozhi-client/issues/1839))
- **mcp-server-list:** 优化 _handleToggleTool 方法避免不必要的临时数组创建 ([#1857](https://github.com/shenjingnan/xiaozhi-client/pull/1857), [#1855](https://github.com/shenjingnan/xiaozhi-client/issues/1855))

### ❤️ Thank You

- Claude
- GeoDaoyu @GeoDaoyu
- shenjingnan @shenjingnan

## 2.0.0-beta.7 (2026-03-01)

### 🩹 Fixes

- **asr:** 添加 @discordjs/opus 依赖解决 Opus 编码器缺失问题 ([#2104](https://github.com/shenjingnan/xiaozhi-client/pull/2104))

### ❤️ Thank You

- Claude
- shenjingnan @shenjingnan

## 2.0.0-beta.6 (2026-03-01)

This was a version bump only, there were no code changes.

## 2.0.0-beta.5 (2026-03-01)

### 🩹 Fixes

- **release:** 将 asr 和 tts 包纳入发布流程 ([#2102](https://github.com/shenjingnan/xiaozhi-client/pull/2102))

### ❤️ Thank You

- Claude
- shenjingnan @shenjingnan

## 2.0.0-beta.4 (2026-03-01)

This was a version bump only, there were no code changes.

## 2.0.0-beta.3 (2026-03-01)

### 🩹 Fixes

- **ci:** 确保 nx 缓存目录存在 ([#2100](https://github.com/shenjingnan/xiaozhi-client/pull/2100))

### ❤️ Thank You

- Claude
- shenjingnan @shenjingnan

## 2.0.0-beta.2 (2026-03-01)

This was a version bump only, there were no code changes.

## 2.0.0-beta.1 (2026-03-01)

### 🩹 Fixes

- **ci:** 在发布时跳过 nx 缓存 ([#2098](https://github.com/shenjingnan/xiaozhi-client/pull/2098))

### ❤️ Thank You

- Claude
- shenjingnan @shenjingnan

## 2.0.0-beta.0 (2026-03-01)

### 🚀 Features

- 优化 github-comment-fixer 技能使用 worktree ([#1496](https://github.com/shenjingnan/xiaozhi-client/pull/1496))
- 实现 TTS 语音合成 API ([#1632](https://github.com/shenjingnan/xiaozhi-client/pull/1632))
- PR 创建时自动关联 Issue ([#1738](https://github.com/shenjingnan/xiaozhi-client/pull/1738))
- **asr:** 新增 ASR 语音识别包 ([#1824](https://github.com/shenjingnan/xiaozhi-client/pull/1824))
- **asr:** 添加流式语音识别支持 ([#1825](https://github.com/shenjingnan/xiaozhi-client/pull/1825))
- **asr:** 添加 V2 协议 Opus 流式识别示例 ([#1879](https://github.com/shenjingnan/xiaozhi-client/pull/1879))
- **asr:** 添加流式语音识别支持 ([#1848](https://github.com/shenjingnan/xiaozhi-client/pull/1848))
- **asr:** 添加 V3 支持及 zod 配置校验 ([#1904](https://github.com/shenjingnan/xiaozhi-client/pull/1904))
- **asr:** 实现 ASR 服务实例销毁重建机制 ([#2032](https://github.com/shenjingnan/xiaozhi-client/pull/2032))
- **backend:** 添加 @xiaozhi-client/tts 依赖 ([#1962](https://github.com/shenjingnan/xiaozhi-client/pull/1962))
- **ci:** 限制定时任务仅在夜间时段执行 ([#1785](https://github.com/shenjingnan/xiaozhi-client/pull/1785))
- **esp32:** 完善 ESP32 WebSocket 协议一致性实现 ([#1787](https://github.com/shenjingnan/xiaozhi-client/pull/1787))
- **esp32:** 添加 STT 消息异步发送到设备端 ([#2030](https://github.com/shenjingnan/xiaozhi-client/pull/2030))
- **llm:** 支持自定义系统提示词配置 ([#2096](https://github.com/shenjingnan/xiaozhi-client/pull/2096))
- **tts:** 提取 TTS 模块到独立包 @xiaozhi-client/tts ([#1944](https://github.com/shenjingnan/xiaozhi-client/pull/1944))
- **voice:** 添加 LLM 集成支持 ([#1961](https://github.com/shenjingnan/xiaozhi-client/pull/1961))

### 🩹 Fixes

- 移除 mcp-errors.ts 中不合适的 shebang ([#1230](https://github.com/shenjingnan/xiaozhi-client/pull/1230), [#1229](https://github.com/shenjingnan/xiaozhi-client/issues/1229))
- 在 shared-types 的 tsup.config.ts 中添加 target: "node18" ([#1285](https://github.com/shenjingnan/xiaozhi-client/pull/1285), [#1282](https://github.com/shenjingnan/xiaozhi-client/issues/1282))
- 修复 routes/domains 目录下路径别名一致性问题 ([#1277](https://github.com/shenjingnan/xiaozhi-client/pull/1277), [#1274](https://github.com/shenjingnan/xiaozhi-client/issues/1274))
- 移除 apps/backend/lib/mcp/manager.ts 中不必要的 shebang ([#1273](https://github.com/shenjingnan/xiaozhi-client/pull/1273), [#1270](https://github.com/shenjingnan/xiaozhi-client/issues/1270))
- 更新 axios 依赖至 >=1.13.5 以修复 CVE-2026-25639 ([#1259](https://github.com/shenjingnan/xiaozhi-client/pull/1259))
- 升级 calculator-mcp 和 datetime-mcp 包中的 tsup 版本至 ^8.3.5 ([#1248](https://github.com/shenjingnan/xiaozhi-client/pull/1248), [#1247](https://github.com/shenjingnan/xiaozhi-client/issues/1247))
- 将 @modelcontextprotocol/sdk 升级到 ^1.26.0 以修复 CVE-2026-25536 ([#1217](https://github.com/shenjingnan/xiaozhi-client/pull/1217))
- 移除 apps/backend 中覆盖 noImplicitAny 的配置 ([#1221](https://github.com/shenjingnan/xiaozhi-client/pull/1221), [#1220](https://github.com/shenjingnan/xiaozhi-client/issues/1220))
- 统一 TypeScript 版本为 ^5.9.2 ([#1199](https://github.com/shenjingnan/xiaozhi-client/pull/1199), [#1198](https://github.com/shenjingnan/xiaozhi-client/issues/1198))
- 统一 shared-types package.json 中的路径格式，添加 ./ 前缀 ([#1133](https://github.com/shenjingnan/xiaozhi-client/pull/1133), [#1132](https://github.com/shenjingnan/xiaozhi-client/issues/1132))
- 统一 shared-types 包的 TypeScript 版本至 ^5.9.2 ([#1114](https://github.com/shenjingnan/xiaozhi-client/pull/1114), [#1113](https://github.com/shenjingnan/xiaozhi-client/issues/1113))
- 修复 shared-types 包配置中 main 和 types 字段路径格式 ([#1110](https://github.com/shenjingnan/xiaozhi-client/pull/1110), [#1109](https://github.com/shenjingnan/xiaozhi-client/issues/1109))
- 使用统一的 Logger 系统替换 console.warn ([#1107](https://github.com/shenjingnan/xiaozhi-client/pull/1107), [#1106](https://github.com/shenjingnan/xiaozhi-client/issues/1106))
- 统一 Node.js 版本要求为 20+ ([#1059](https://github.com/shenjingnan/xiaozhi-client/pull/1059), [#1058](https://github.com/shenjingnan/xiaozhi-client/issues/1058))
- 修复 TemplateManager 接口使用 any 类型的问题 ([#1030](https://github.com/shenjingnan/xiaozhi-client/pull/1030), [#1029](https://github.com/shenjingnan/xiaozhi-client/issues/1029))
- 统一 service.handler.ts 中的路径别名导入 ([#1307](https://github.com/shenjingnan/xiaozhi-client/pull/1307), [#1305](https://github.com/shenjingnan/xiaozhi-client/issues/1305))
- 修复 websocket-compat.ts 中废弃函数的 any 类型问题 ([#1266](https://github.com/shenjingnan/xiaozhi-client/pull/1266), [#1264](https://github.com/shenjingnan/xiaozhi-client/issues/1264))
- 在 shouldCleanupCache 中使用 DEFAULT_CONFIG.CLEANUP_INTERVAL 常量 ([#1254](https://github.com/shenjingnan/xiaozhi-client/pull/1254), [#1251](https://github.com/shenjingnan/xiaozhi-client/issues/1251))
- 在根 tsconfig.json 中添加 packages/mcp-core 的 project reference ([#1189](https://github.com/shenjingnan/xiaozhi-client/pull/1189))
- 修复 hono.context.ts 中使用相对路径导入类型的问题 ([#1163](https://github.com/shenjingnan/xiaozhi-client/pull/1163), [#1161](https://github.com/shenjingnan/xiaozhi-client/issues/1161))
- 将 shared-types MCP 协议类型中的 any 替换为 unknown ([#1162](https://github.com/shenjingnan/xiaozhi-client/pull/1162), [#1160](https://github.com/shenjingnan/xiaozhi-client/issues/1160))
- shared-types 添加 target 字段以确保构建配置一致性 ([#1139](https://github.com/shenjingnan/xiaozhi-client/pull/1139), [#1136](https://github.com/shenjingnan/xiaozhi-client/issues/1136))
- 改进 Validation.ts 中的类型安全性，移除 any 类型 ([#1074](https://github.com/shenjingnan/xiaozhi-client/pull/1074), [#1072](https://github.com/shenjingnan/xiaozhi-client/issues/1072))
- 使用路径别名替换相对路径导入错误类型 ([#1071](https://github.com/shenjingnan/xiaozhi-client/pull/1071))
- 移除 error-helper.ts 中的 any 类型以提升类型安全性 ([#1070](https://github.com/shenjingnan/xiaozhi-client/pull/1070))
- 修复 middlewares/index.ts 中的路径别名一致性 ([#1026](https://github.com/shenjingnan/xiaozhi-client/pull/1026))
- 修复 service.handler.ts 中导入不一致问题 ([#1002](https://github.com/shenjingnan/xiaozhi-client/pull/1002), [#1001](https://github.com/shenjingnan/xiaozhi-client/issues/1001))
- RouteManager 使用统一的 Logger 系统替代 console ([#987](https://github.com/shenjingnan/xiaozhi-client/pull/987), [#984](https://github.com/shenjingnan/xiaozhi-client/issues/984))
- 将 endpointManager 中间件的 console.warn 替换为统一的 Logger 系统 ([#978](https://github.com/shenjingnan/xiaozhi-client/pull/978), [#976](https://github.com/shenjingnan/xiaozhi-client/issues/976))
- 更新 @modelcontextprotocol/sdk 版本范围至 ^1.26.0 以修复 CVE-2026-25536 安全漏洞 ([#959](https://github.com/shenjingnan/xiaozhi-client/pull/959), [#958](https://github.com/shenjingnan/xiaozhi-client/issues/958))
- 使用 CommandArguments 和 CommandOptions 替换 any 类型 ([#957](https://github.com/shenjingnan/xiaozhi-client/pull/957))
- 修复 version-manager.tsx 中 setTimeout 定时器资源泄漏 ([#930](https://github.com/shenjingnan/xiaozhi-client/pull/930), [#927](https://github.com/shenjingnan/xiaozhi-client/issues/927))
- npm/manager.ts 使用统一的 Logger 系统 ([#880](https://github.com/shenjingnan/xiaozhi-client/pull/880), [#879](https://github.com/shenjingnan/xiaozhi-client/issues/879))
- 将 packages/mcp-core/tsconfig.json 的 composite 设置为 true ([#1197](https://github.com/shenjingnan/xiaozhi-client/pull/1197))
- 移除根 tsconfig.json 中与 monorepo 结构不一致的 rootDir 配置 ([#1165](https://github.com/shenjingnan/xiaozhi-client/pull/1165), [#1164](https://github.com/shenjingnan/xiaozhi-client/issues/1164))
- 修复 tool-call-logs-dialog.tsx 中 CopyButton 组件的资源泄漏风险 ([#983](https://github.com/shenjingnan/xiaozhi-client/pull/983))
- 将 WebSocket 服务中的 any 类型替换为 unknown 提升类型安全性 ([#888](https://github.com/shenjingnan/xiaozhi-client/pull/888), [#887](https://github.com/shenjingnan/xiaozhi-client/issues/887))
- 移除 mcp-manage.handler.ts 中重复的 toolNames 声明 ([#1354](https://github.com/shenjingnan/xiaozhi-client/pull/1354))
- 使用 HTTP_TIMEOUTS.LONG_RUNNING 常量替换硬编码的超时值 ([#1356](https://github.com/shenjingnan/xiaozhi-client/pull/1356))
- 修复 packages/endpoint 示例代码使用过时的 API 导致无法运行 ([#1363](https://github.com/shenjingnan/xiaozhi-client/pull/1363))
- 移除 default export of MCPServiceManager ([#1045](https://github.com/shenjingnan/xiaozhi-client/pull/1045))
- 修复 WebServer.stop 方法中 setTimeout 定时器未清理导致 doResolve 多次调用的问题 ([#871](https://github.com/shenjingnan/xiaozhi-client/pull/871))
- 移除 apps/backend/tsconfig.json 中的 noImplicitAny: false 配置 ([#894](https://github.com/shenjingnan/xiaozhi-client/pull/894), [#891](https://github.com/shenjingnan/xiaozhi-client/issues/891))
- 移除 tsup.config.ts 中重复的 ws 模块声明 ([#901](https://github.com/shenjingnan/xiaozhi-client/pull/901), [#903](https://github.com/shenjingnan/xiaozhi-client/pull/903))
- 禁用 nx-release-publish 任务缓存 ([#1639](https://github.com/shenjingnan/xiaozhi-client/pull/1639))
- 移除 RestartButton 组件中未使用的 restartStatus prop ([#1715](https://github.com/shenjingnan/xiaozhi-client/pull/1715), [#1714](https://github.com/shenjingnan/xiaozhi-client/issues/1714))
- 移除 endpoint 包中重复的 JSONSchema 类型定义 ([#1704](https://github.com/shenjingnan/xiaozhi-client/pull/1704), [#1703](https://github.com/shenjingnan/xiaozhi-client/issues/1703))
- 将 formatUtils 中的 any 类型替换为 unknown 提高类型安全性 ([#1680](https://github.com/shenjingnan/xiaozhi-client/pull/1680), [#1679](https://github.com/shenjingnan/xiaozhi-client/issues/1679))
- 修复 removeEndpoint 方法缺少 await 导致资源未正确清理 ([#1672](https://github.com/shenjingnan/xiaozhi-client/pull/1672))
- 替换 cozeApi.ts 中的 any 类型为更安全的类型 ([#1667](https://github.com/shenjingnan/xiaozhi-client/pull/1667), [#1666](https://github.com/shenjingnan/xiaozhi-client/issues/1666))
- 修复 CVE-2026-2391 安全漏洞 - 升级 qs 依赖 ([#1665](https://github.com/shenjingnan/xiaozhi-client/pull/1665))
- 修复 apps/backend 中相对路径导入，统一使用 @/ 路径别名 ([#1659](https://github.com/shenjingnan/xiaozhi-client/pull/1659), [#1658](https://github.com/shenjingnan/xiaozhi-client/issues/1658))
- 将 ValidationRule 和 ValidationError 中的 any 类型替换为 unknown ([#1623](https://github.com/shenjingnan/xiaozhi-client/pull/1623))
- 统一 ErrorCategory 枚举定义，移除重复 ([#1595](https://github.com/shenjingnan/xiaozhi-client/pull/1595), [#1594](https://github.com/shenjingnan/xiaozhi-client/issues/1594))
- 修复 sidebar.tsx 中的英文错误消息和用户界面文本违反本地化规范 ([#1585](https://github.com/shenjingnan/xiaozhi-client/pull/1585), [#1584](https://github.com/shenjingnan/xiaozhi-client/issues/1584))
- 让 mcp-core tsconfig 继承根配置以消除重复 ([#1537](https://github.com/shenjingnan/xiaozhi-client/pull/1537), [#1536](https://github.com/shenjingnan/xiaozhi-client/issues/1536))
- 修复 checkPortAvailability 函数中 catch 块缺少 timeoutId 清理导致资源泄漏 ([#1503](https://github.com/shenjingnan/xiaozhi-client/pull/1503))
- 为 CozeApiService 添加错误处理 ([#1498](https://github.com/shenjingnan/xiaozhi-client/pull/1498), [#1497](https://github.com/shenjingnan/xiaozhi-client/issues/1497))
- 移除 coze-workflow-integration.tsx 中的 console 日志调用 ([#1385](https://github.com/shenjingnan/xiaozhi-client/pull/1385), [#1384](https://github.com/shenjingnan/xiaozhi-client/issues/1384))
- 替换 TTS 协议文件中的 console.log 为统一的 Logger 系统 ([#1649](https://github.com/shenjingnan/xiaozhi-client/pull/1649))
- 移除 endpoint.route.ts 中重复定义的 createErrorResponse 函数 ([#1561](https://github.com/shenjingnan/xiaozhi-client/pull/1561), [#1560](https://github.com/shenjingnan/xiaozhi-client/issues/1560))
- 将 service.handler.ts 中的硬编码超时值提取为常量 ([#1437](https://github.com/shenjingnan/xiaozhi-client/pull/1437), [#1436](https://github.com/shenjingnan/xiaozhi-client/issues/1436))
- 为 endpoint 包添加 TypeScript 项目引用配置 ([#1375](https://github.com/shenjingnan/xiaozhi-client/pull/1375), [#1374](https://github.com/shenjingnan/xiaozhi-client/issues/1374))
- 使用 process.once() 替代 process.on() 修复 MaxListenersExceededWarning ([#1371](https://github.com/shenjingnan/xiaozhi-client/pull/1371), [#1370](https://github.com/shenjingnan/xiaozhi-client/issues/1370))
- 修复 CustomMCPHandler 事件监听器未清理导致内存泄漏 ([#991](https://github.com/shenjingnan/xiaozhi-client/pull/991), [#989](https://github.com/shenjingnan/xiaozhi-client/issues/989))
- 移除 packages/config 中冗余的 json5 依赖 ([#905](https://github.com/shenjingnan/xiaozhi-client/pull/905), [#904](https://github.com/shenjingnan/xiaozhi-client/issues/904))
- 将 toolSorters.ts 中的 console.warn 替换为统一的 Logger 系统 ([#898](https://github.com/shenjingnan/xiaozhi-client/pull/898), [#895](https://github.com/shenjingnan/xiaozhi-client/issues/895))
- 修复测试文件中的本地化规范违规问题（部分完成） ([#1727](https://github.com/shenjingnan/xiaozhi-client/pull/1727))
- 替换 shared-types 中 CozeApi* 和 CacheItem 的 any 类型为 unknown ([#1778](https://github.com/shenjingnan/xiaozhi-client/pull/1778), [#1777](https://github.com/shenjingnan/xiaozhi-client/issues/1777))
- 修复 NPMManager.spawn 进程资源泄漏问题 ([#1754](https://github.com/shenjingnan/xiaozhi-client/pull/1754), [#1752](https://github.com/shenjingnan/xiaozhi-client/issues/1752))
- 将 manager.ts 和 log.ts 中的 console.* 替换为统一的 Logger 系统 ([#1745](https://github.com/shenjingnan/xiaozhi-client/pull/1745), [#1744](https://github.com/shenjingnan/xiaozhi-client/issues/1744))
- 将 CozeWorkflow.inputSchema 类型从 any 改为 JSONSchema ([#1741](https://github.com/shenjingnan/xiaozhi-client/pull/1741), [#1740](https://github.com/shenjingnan/xiaozhi-client/issues/1740))
- 更新 hono 到安全版本 4.12.0 修复时序攻击漏洞 ([#1866](https://github.com/shenjingnan/xiaozhi-client/pull/1866), [#1863](https://github.com/shenjingnan/xiaozhi-client/issues/1863))
- 修复 tool-call-logs-dialog.tsx 中的本地化问题 ([#1808](https://github.com/shenjingnan/xiaozhi-client/pull/1808), [#1807](https://github.com/shenjingnan/xiaozhi-client/issues/1807))
- 重命名 fix-comment skill 以符合命名规范 ([#1989](https://github.com/shenjingnan/xiaozhi-client/pull/1989))
- **Logger:** 添加 initLogFile 方法的错误处理 ([#1888](https://github.com/shenjingnan/xiaozhi-client/pull/1888), [#1887](https://github.com/shenjingnan/xiaozhi-client/issues/1887))
- **cli:** 修复 backend 类型声明路径错误并删除 any 类型使用 ([#1886](https://github.com/shenjingnan/xiaozhi-client/pull/1886), [#1885](https://github.com/shenjingnan/xiaozhi-client/issues/1885))
- **deps:** 为 packages/cli 和 packages/config 添加缺失的 tsup 依赖 ([#1287](https://github.com/shenjingnan/xiaozhi-client/pull/1287), [#1286](https://github.com/shenjingnan/xiaozhi-client/issues/1286))
- **deps:** 统一 vitest 版本为 ^3.2.4 ([#1228](https://github.com/shenjingnan/xiaozhi-client/pull/1228), [#1227](https://github.com/shenjingnan/xiaozhi-client/issues/1227))
- **deps:** 统一 packages/tts 的 @types/node 版本至 ^24.3.0 ([#2020](https://github.com/shenjingnan/xiaozhi-client/pull/2020), [#2019](https://github.com/shenjingnan/xiaozhi-client/issues/2019))
- **endpoint:** 为 sendErrorResponse 方法添加错误处理 ([#1225](https://github.com/shenjingnan/xiaozhi-client/pull/1225))
- **npm:** 添加 spawn 进程 error 事件监听器 ([#1255](https://github.com/shenjingnan/xiaozhi-client/pull/1255), [#1252](https://github.com/shenjingnan/xiaozhi-client/issues/1252))
- **release:** 确保 nx-release-publish 在发布前执行构建 ([#1241](https://github.com/shenjingnan/xiaozhi-client/pull/1241))
- **routes:** 统一 esp32.route.ts 使用 @/ 路径别名 ([#1896](https://github.com/shenjingnan/xiaozhi-client/pull/1896), [#1895](https://github.com/shenjingnan/xiaozhi-client/issues/1895))
- **status:** 将 status.service.ts 中的英文注释翻译为中文 ([#1268](https://github.com/shenjingnan/xiaozhi-client/pull/1268))
- **tts:** 修复 TTS 流式播放问题并增加调试日志 ([#2031](https://github.com/shenjingnan/xiaozhi-client/pull/2031))
- **types:** 移除 test-voice-session.service.ts 中的 any 类型 ([#1832](https://github.com/shenjingnan/xiaozhi-client/pull/1832), [#1831](https://github.com/shenjingnan/xiaozhi-client/issues/1831))
- **websocket:** 移除 websocket.ts 和 websocket-compat.ts 之间的循环依赖 ([#1612](https://github.com/shenjingnan/xiaozhi-client/pull/1612), [#1610](https://github.com/shenjingnan/xiaozhi-client/issues/1610))

### 🔥 Performance

- 缓存 tools.map 结果避免重复映射操作 ([#1290](https://github.com/shenjingnan/xiaozhi-client/pull/1290))
- 优化 mcp-manage.handler.ts 中重复的 map 调用 ([#1193](https://github.com/shenjingnan/xiaozhi-client/pull/1193), [#1191](https://github.com/shenjingnan/xiaozhi-client/issues/1191))
- 移除 tool-call-logs-dialog 中不必要的人为延迟 ([#1461](https://github.com/shenjingnan/xiaozhi-client/pull/1461), [#1460](https://github.com/shenjingnan/xiaozhi-client/issues/1460))
- **frontend:** 优化表单 condition 函数中的 form.watch 调用 ([#1805](https://github.com/shenjingnan/xiaozhi-client/pull/1805), [#1804](https://github.com/shenjingnan/xiaozhi-client/issues/1804))
- **install-log-dialog:** 优化正则表达式使用避免重复创建 ([#1841](https://github.com/shenjingnan/xiaozhi-client/pull/1841), [#1839](https://github.com/shenjingnan/xiaozhi-client/issues/1839))
- **mcp-server-list:** 优化 _handleToggleTool 方法避免不必要的临时数组创建 ([#1857](https://github.com/shenjingnan/xiaozhi-client/pull/1857), [#1855](https://github.com/shenjingnan/xiaozhi-client/issues/1855))

### ❤️ Thank You

- Claude
- GeoDaoyu @GeoDaoyu
- shenjingnan @shenjingnan

## 1.10.9 (2026-02-15)

### 🚀 Features

- 优化 github-comment-fixer 技能使用 worktree ([#1496](https://github.com/shenjingnan/xiaozhi-client/pull/1496))

### 🩹 Fixes

- 移除 mcp-errors.ts 中不合适的 shebang ([#1230](https://github.com/shenjingnan/xiaozhi-client/pull/1230), [#1229](https://github.com/shenjingnan/xiaozhi-client/issues/1229))
- 在 shared-types 的 tsup.config.ts 中添加 target: "node18" ([#1285](https://github.com/shenjingnan/xiaozhi-client/pull/1285), [#1282](https://github.com/shenjingnan/xiaozhi-client/issues/1282))
- 修复 routes/domains 目录下路径别名一致性问题 ([#1277](https://github.com/shenjingnan/xiaozhi-client/pull/1277), [#1274](https://github.com/shenjingnan/xiaozhi-client/issues/1274))
- 移除 apps/backend/lib/mcp/manager.ts 中不必要的 shebang ([#1273](https://github.com/shenjingnan/xiaozhi-client/pull/1273), [#1270](https://github.com/shenjingnan/xiaozhi-client/issues/1270))
- 更新 axios 依赖至 >=1.13.5 以修复 CVE-2026-25639 ([#1259](https://github.com/shenjingnan/xiaozhi-client/pull/1259))
- 升级 calculator-mcp 和 datetime-mcp 包中的 tsup 版本至 ^8.3.5 ([#1248](https://github.com/shenjingnan/xiaozhi-client/pull/1248), [#1247](https://github.com/shenjingnan/xiaozhi-client/issues/1247))
- 将 @modelcontextprotocol/sdk 升级到 ^1.26.0 以修复 CVE-2026-25536 ([#1217](https://github.com/shenjingnan/xiaozhi-client/pull/1217))
- 移除 apps/backend 中覆盖 noImplicitAny 的配置 ([#1221](https://github.com/shenjingnan/xiaozhi-client/pull/1221), [#1220](https://github.com/shenjingnan/xiaozhi-client/issues/1220))
- 统一 TypeScript 版本为 ^5.9.2 ([#1199](https://github.com/shenjingnan/xiaozhi-client/pull/1199), [#1198](https://github.com/shenjingnan/xiaozhi-client/issues/1198))
- 统一 shared-types package.json 中的路径格式，添加 ./ 前缀 ([#1133](https://github.com/shenjingnan/xiaozhi-client/pull/1133), [#1132](https://github.com/shenjingnan/xiaozhi-client/issues/1132))
- 统一 shared-types 包的 TypeScript 版本至 ^5.9.2 ([#1114](https://github.com/shenjingnan/xiaozhi-client/pull/1114), [#1113](https://github.com/shenjingnan/xiaozhi-client/issues/1113))
- 修复 shared-types 包配置中 main 和 types 字段路径格式 ([#1110](https://github.com/shenjingnan/xiaozhi-client/pull/1110), [#1109](https://github.com/shenjingnan/xiaozhi-client/issues/1109))
- 使用统一的 Logger 系统替换 console.warn ([#1107](https://github.com/shenjingnan/xiaozhi-client/pull/1107), [#1106](https://github.com/shenjingnan/xiaozhi-client/issues/1106))
- 统一 Node.js 版本要求为 20+ ([#1059](https://github.com/shenjingnan/xiaozhi-client/pull/1059), [#1058](https://github.com/shenjingnan/xiaozhi-client/issues/1058))
- 修复 TemplateManager 接口使用 any 类型的问题 ([#1030](https://github.com/shenjingnan/xiaozhi-client/pull/1030), [#1029](https://github.com/shenjingnan/xiaozhi-client/issues/1029))
- 统一 service.handler.ts 中的路径别名导入 ([#1307](https://github.com/shenjingnan/xiaozhi-client/pull/1307), [#1305](https://github.com/shenjingnan/xiaozhi-client/issues/1305))
- 修复 websocket-compat.ts 中废弃函数的 any 类型问题 ([#1266](https://github.com/shenjingnan/xiaozhi-client/pull/1266), [#1264](https://github.com/shenjingnan/xiaozhi-client/issues/1264))
- 在 shouldCleanupCache 中使用 DEFAULT_CONFIG.CLEANUP_INTERVAL 常量 ([#1254](https://github.com/shenjingnan/xiaozhi-client/pull/1254), [#1251](https://github.com/shenjingnan/xiaozhi-client/issues/1251))
- 在根 tsconfig.json 中添加 packages/mcp-core 的 project reference ([#1189](https://github.com/shenjingnan/xiaozhi-client/pull/1189))
- 修复 hono.context.ts 中使用相对路径导入类型的问题 ([#1163](https://github.com/shenjingnan/xiaozhi-client/pull/1163), [#1161](https://github.com/shenjingnan/xiaozhi-client/issues/1161))
- 将 shared-types MCP 协议类型中的 any 替换为 unknown ([#1162](https://github.com/shenjingnan/xiaozhi-client/pull/1162), [#1160](https://github.com/shenjingnan/xiaozhi-client/issues/1160))
- shared-types 添加 target 字段以确保构建配置一致性 ([#1139](https://github.com/shenjingnan/xiaozhi-client/pull/1139), [#1136](https://github.com/shenjingnan/xiaozhi-client/issues/1136))
- 改进 Validation.ts 中的类型安全性，移除 any 类型 ([#1074](https://github.com/shenjingnan/xiaozhi-client/pull/1074), [#1072](https://github.com/shenjingnan/xiaozhi-client/issues/1072))
- 使用路径别名替换相对路径导入错误类型 ([#1071](https://github.com/shenjingnan/xiaozhi-client/pull/1071))
- 移除 error-helper.ts 中的 any 类型以提升类型安全性 ([#1070](https://github.com/shenjingnan/xiaozhi-client/pull/1070))
- 修复 middlewares/index.ts 中的路径别名一致性 ([#1026](https://github.com/shenjingnan/xiaozhi-client/pull/1026))
- 修复 service.handler.ts 中导入不一致问题 ([#1002](https://github.com/shenjingnan/xiaozhi-client/pull/1002), [#1001](https://github.com/shenjingnan/xiaozhi-client/issues/1001))
- RouteManager 使用统一的 Logger 系统替代 console ([#987](https://github.com/shenjingnan/xiaozhi-client/pull/987), [#984](https://github.com/shenjingnan/xiaozhi-client/issues/984))
- 将 endpointManager 中间件的 console.warn 替换为统一的 Logger 系统 ([#978](https://github.com/shenjingnan/xiaozhi-client/pull/978), [#976](https://github.com/shenjingnan/xiaozhi-client/issues/976))
- 更新 @modelcontextprotocol/sdk 版本范围至 ^1.26.0 以修复 CVE-2026-25536 安全漏洞 ([#959](https://github.com/shenjingnan/xiaozhi-client/pull/959), [#958](https://github.com/shenjingnan/xiaozhi-client/issues/958))
- 使用 CommandArguments 和 CommandOptions 替换 any 类型 ([#957](https://github.com/shenjingnan/xiaozhi-client/pull/957))
- 修复 version-manager.tsx 中 setTimeout 定时器资源泄漏 ([#930](https://github.com/shenjingnan/xiaozhi-client/pull/930), [#927](https://github.com/shenjingnan/xiaozhi-client/issues/927))
- npm/manager.ts 使用统一的 Logger 系统 ([#880](https://github.com/shenjingnan/xiaozhi-client/pull/880), [#879](https://github.com/shenjingnan/xiaozhi-client/issues/879))
- 将 packages/mcp-core/tsconfig.json 的 composite 设置为 true ([#1197](https://github.com/shenjingnan/xiaozhi-client/pull/1197))
- 移除根 tsconfig.json 中与 monorepo 结构不一致的 rootDir 配置 ([#1165](https://github.com/shenjingnan/xiaozhi-client/pull/1165), [#1164](https://github.com/shenjingnan/xiaozhi-client/issues/1164))
- 修复 tool-call-logs-dialog.tsx 中 CopyButton 组件的资源泄漏风险 ([#983](https://github.com/shenjingnan/xiaozhi-client/pull/983))
- 将 WebSocket 服务中的 any 类型替换为 unknown 提升类型安全性 ([#888](https://github.com/shenjingnan/xiaozhi-client/pull/888), [#887](https://github.com/shenjingnan/xiaozhi-client/issues/887))
- 移除 mcp-manage.handler.ts 中重复的 toolNames 声明 ([#1354](https://github.com/shenjingnan/xiaozhi-client/pull/1354))
- 使用 HTTP_TIMEOUTS.LONG_RUNNING 常量替换硬编码的超时值 ([#1356](https://github.com/shenjingnan/xiaozhi-client/pull/1356))
- 修复 packages/endpoint 示例代码使用过时的 API 导致无法运行 ([#1363](https://github.com/shenjingnan/xiaozhi-client/pull/1363))
- 移除 default export of MCPServiceManager ([#1045](https://github.com/shenjingnan/xiaozhi-client/pull/1045))
- 修复 WebServer.stop 方法中 setTimeout 定时器未清理导致 doResolve 多次调用的问题 ([#871](https://github.com/shenjingnan/xiaozhi-client/pull/871))
- 移除 apps/backend/tsconfig.json 中的 noImplicitAny: false 配置 ([#894](https://github.com/shenjingnan/xiaozhi-client/pull/894), [#891](https://github.com/shenjingnan/xiaozhi-client/issues/891))
- 移除 tsup.config.ts 中重复的 ws 模块声明 ([#901](https://github.com/shenjingnan/xiaozhi-client/pull/901), [#903](https://github.com/shenjingnan/xiaozhi-client/pull/903))
- 禁用 nx-release-publish 任务缓存 ([#1639](https://github.com/shenjingnan/xiaozhi-client/pull/1639))
- **deps:** 为 packages/cli 和 packages/config 添加缺失的 tsup 依赖 ([#1287](https://github.com/shenjingnan/xiaozhi-client/pull/1287), [#1286](https://github.com/shenjingnan/xiaozhi-client/issues/1286))
- **deps:** 统一 vitest 版本为 ^3.2.4 ([#1228](https://github.com/shenjingnan/xiaozhi-client/pull/1228), [#1227](https://github.com/shenjingnan/xiaozhi-client/issues/1227))
- **endpoint:** 为 sendErrorResponse 方法添加错误处理 ([#1225](https://github.com/shenjingnan/xiaozhi-client/pull/1225))
- **npm:** 添加 spawn 进程 error 事件监听器 ([#1255](https://github.com/shenjingnan/xiaozhi-client/pull/1255), [#1252](https://github.com/shenjingnan/xiaozhi-client/issues/1252))
- **release:** 确保 nx-release-publish 在发布前执行构建 ([#1241](https://github.com/shenjingnan/xiaozhi-client/pull/1241))
- **status:** 将 status.service.ts 中的英文注释翻译为中文 ([#1268](https://github.com/shenjingnan/xiaozhi-client/pull/1268))

### 🔥 Performance

- 缓存 tools.map 结果避免重复映射操作 ([#1290](https://github.com/shenjingnan/xiaozhi-client/pull/1290))
- 优化 mcp-manage.handler.ts 中重复的 map 调用 ([#1193](https://github.com/shenjingnan/xiaozhi-client/pull/1193), [#1191](https://github.com/shenjingnan/xiaozhi-client/issues/1191))

### ❤️ Thank You

- Claude
- GeoDaoyu @GeoDaoyu
- shenjingnan @shenjingnan

## 1.10.8 (2026-02-15)

### 🚀 Features

- 优化 github-comment-fixer 技能使用 worktree ([#1496](https://github.com/shenjingnan/xiaozhi-client/pull/1496))

### 🩹 Fixes

- 移除 mcp-errors.ts 中不合适的 shebang ([#1230](https://github.com/shenjingnan/xiaozhi-client/pull/1230), [#1229](https://github.com/shenjingnan/xiaozhi-client/issues/1229))
- 在 shared-types 的 tsup.config.ts 中添加 target: "node18" ([#1285](https://github.com/shenjingnan/xiaozhi-client/pull/1285), [#1282](https://github.com/shenjingnan/xiaozhi-client/issues/1282))
- 修复 routes/domains 目录下路径别名一致性问题 ([#1277](https://github.com/shenjingnan/xiaozhi-client/pull/1277), [#1274](https://github.com/shenjingnan/xiaozhi-client/issues/1274))
- 移除 apps/backend/lib/mcp/manager.ts 中不必要的 shebang ([#1273](https://github.com/shenjingnan/xiaozhi-client/pull/1273), [#1270](https://github.com/shenjingnan/xiaozhi-client/issues/1270))
- 更新 axios 依赖至 >=1.13.5 以修复 CVE-2026-25639 ([#1259](https://github.com/shenjingnan/xiaozhi-client/pull/1259))
- 升级 calculator-mcp 和 datetime-mcp 包中的 tsup 版本至 ^8.3.5 ([#1248](https://github.com/shenjingnan/xiaozhi-client/pull/1248), [#1247](https://github.com/shenjingnan/xiaozhi-client/issues/1247))
- 将 @modelcontextprotocol/sdk 升级到 ^1.26.0 以修复 CVE-2026-25536 ([#1217](https://github.com/shenjingnan/xiaozhi-client/pull/1217))
- 移除 apps/backend 中覆盖 noImplicitAny 的配置 ([#1221](https://github.com/shenjingnan/xiaozhi-client/pull/1221), [#1220](https://github.com/shenjingnan/xiaozhi-client/issues/1220))
- 统一 TypeScript 版本为 ^5.9.2 ([#1199](https://github.com/shenjingnan/xiaozhi-client/pull/1199), [#1198](https://github.com/shenjingnan/xiaozhi-client/issues/1198))
- 统一 shared-types package.json 中的路径格式，添加 ./ 前缀 ([#1133](https://github.com/shenjingnan/xiaozhi-client/pull/1133), [#1132](https://github.com/shenjingnan/xiaozhi-client/issues/1132))
- 统一 shared-types 包的 TypeScript 版本至 ^5.9.2 ([#1114](https://github.com/shenjingnan/xiaozhi-client/pull/1114), [#1113](https://github.com/shenjingnan/xiaozhi-client/issues/1113))
- 修复 shared-types 包配置中 main 和 types 字段路径格式 ([#1110](https://github.com/shenjingnan/xiaozhi-client/pull/1110), [#1109](https://github.com/shenjingnan/xiaozhi-client/issues/1109))
- 使用统一的 Logger 系统替换 console.warn ([#1107](https://github.com/shenjingnan/xiaozhi-client/pull/1107), [#1106](https://github.com/shenjingnan/xiaozhi-client/issues/1106))
- 统一 Node.js 版本要求为 20+ ([#1059](https://github.com/shenjingnan/xiaozhi-client/pull/1059), [#1058](https://github.com/shenjingnan/xiaozhi-client/issues/1058))
- 修复 TemplateManager 接口使用 any 类型的问题 ([#1030](https://github.com/shenjingnan/xiaozhi-client/pull/1030), [#1029](https://github.com/shenjingnan/xiaozhi-client/issues/1029))
- 统一 service.handler.ts 中的路径别名导入 ([#1307](https://github.com/shenjingnan/xiaozhi-client/pull/1307), [#1305](https://github.com/shenjingnan/xiaozhi-client/issues/1305))
- 修复 websocket-compat.ts 中废弃函数的 any 类型问题 ([#1266](https://github.com/shenjingnan/xiaozhi-client/pull/1266), [#1264](https://github.com/shenjingnan/xiaozhi-client/issues/1264))
- 在 shouldCleanupCache 中使用 DEFAULT_CONFIG.CLEANUP_INTERVAL 常量 ([#1254](https://github.com/shenjingnan/xiaozhi-client/pull/1254), [#1251](https://github.com/shenjingnan/xiaozhi-client/issues/1251))
- 在根 tsconfig.json 中添加 packages/mcp-core 的 project reference ([#1189](https://github.com/shenjingnan/xiaozhi-client/pull/1189))
- 修复 hono.context.ts 中使用相对路径导入类型的问题 ([#1163](https://github.com/shenjingnan/xiaozhi-client/pull/1163), [#1161](https://github.com/shenjingnan/xiaozhi-client/issues/1161))
- 将 shared-types MCP 协议类型中的 any 替换为 unknown ([#1162](https://github.com/shenjingnan/xiaozhi-client/pull/1162), [#1160](https://github.com/shenjingnan/xiaozhi-client/issues/1160))
- shared-types 添加 target 字段以确保构建配置一致性 ([#1139](https://github.com/shenjingnan/xiaozhi-client/pull/1139), [#1136](https://github.com/shenjingnan/xiaozhi-client/issues/1136))
- 改进 Validation.ts 中的类型安全性，移除 any 类型 ([#1074](https://github.com/shenjingnan/xiaozhi-client/pull/1074), [#1072](https://github.com/shenjingnan/xiaozhi-client/issues/1072))
- 使用路径别名替换相对路径导入错误类型 ([#1071](https://github.com/shenjingnan/xiaozhi-client/pull/1071))
- 移除 error-helper.ts 中的 any 类型以提升类型安全性 ([#1070](https://github.com/shenjingnan/xiaozhi-client/pull/1070))
- 修复 middlewares/index.ts 中的路径别名一致性 ([#1026](https://github.com/shenjingnan/xiaozhi-client/pull/1026))
- 修复 service.handler.ts 中导入不一致问题 ([#1002](https://github.com/shenjingnan/xiaozhi-client/pull/1002), [#1001](https://github.com/shenjingnan/xiaozhi-client/issues/1001))
- RouteManager 使用统一的 Logger 系统替代 console ([#987](https://github.com/shenjingnan/xiaozhi-client/pull/987), [#984](https://github.com/shenjingnan/xiaozhi-client/issues/984))
- 将 endpointManager 中间件的 console.warn 替换为统一的 Logger 系统 ([#978](https://github.com/shenjingnan/xiaozhi-client/pull/978), [#976](https://github.com/shenjingnan/xiaozhi-client/issues/976))
- 更新 @modelcontextprotocol/sdk 版本范围至 ^1.26.0 以修复 CVE-2026-25536 安全漏洞 ([#959](https://github.com/shenjingnan/xiaozhi-client/pull/959), [#958](https://github.com/shenjingnan/xiaozhi-client/issues/958))
- 使用 CommandArguments 和 CommandOptions 替换 any 类型 ([#957](https://github.com/shenjingnan/xiaozhi-client/pull/957))
- 修复 version-manager.tsx 中 setTimeout 定时器资源泄漏 ([#930](https://github.com/shenjingnan/xiaozhi-client/pull/930), [#927](https://github.com/shenjingnan/xiaozhi-client/issues/927))
- npm/manager.ts 使用统一的 Logger 系统 ([#880](https://github.com/shenjingnan/xiaozhi-client/pull/880), [#879](https://github.com/shenjingnan/xiaozhi-client/issues/879))
- 将 packages/mcp-core/tsconfig.json 的 composite 设置为 true ([#1197](https://github.com/shenjingnan/xiaozhi-client/pull/1197))
- 移除根 tsconfig.json 中与 monorepo 结构不一致的 rootDir 配置 ([#1165](https://github.com/shenjingnan/xiaozhi-client/pull/1165), [#1164](https://github.com/shenjingnan/xiaozhi-client/issues/1164))
- 修复 tool-call-logs-dialog.tsx 中 CopyButton 组件的资源泄漏风险 ([#983](https://github.com/shenjingnan/xiaozhi-client/pull/983))
- 将 WebSocket 服务中的 any 类型替换为 unknown 提升类型安全性 ([#888](https://github.com/shenjingnan/xiaozhi-client/pull/888), [#887](https://github.com/shenjingnan/xiaozhi-client/issues/887))
- 移除 mcp-manage.handler.ts 中重复的 toolNames 声明 ([#1354](https://github.com/shenjingnan/xiaozhi-client/pull/1354))
- 使用 HTTP_TIMEOUTS.LONG_RUNNING 常量替换硬编码的超时值 ([#1356](https://github.com/shenjingnan/xiaozhi-client/pull/1356))
- 修复 packages/endpoint 示例代码使用过时的 API 导致无法运行 ([#1363](https://github.com/shenjingnan/xiaozhi-client/pull/1363))
- 移除 default export of MCPServiceManager ([#1045](https://github.com/shenjingnan/xiaozhi-client/pull/1045))
- 修复 WebServer.stop 方法中 setTimeout 定时器未清理导致 doResolve 多次调用的问题 ([#871](https://github.com/shenjingnan/xiaozhi-client/pull/871))
- 移除 apps/backend/tsconfig.json 中的 noImplicitAny: false 配置 ([#894](https://github.com/shenjingnan/xiaozhi-client/pull/894), [#891](https://github.com/shenjingnan/xiaozhi-client/issues/891))
- 移除 tsup.config.ts 中重复的 ws 模块声明 ([#901](https://github.com/shenjingnan/xiaozhi-client/pull/901), [#903](https://github.com/shenjingnan/xiaozhi-client/pull/903))
- **deps:** 为 packages/cli 和 packages/config 添加缺失的 tsup 依赖 ([#1287](https://github.com/shenjingnan/xiaozhi-client/pull/1287), [#1286](https://github.com/shenjingnan/xiaozhi-client/issues/1286))
- **deps:** 统一 vitest 版本为 ^3.2.4 ([#1228](https://github.com/shenjingnan/xiaozhi-client/pull/1228), [#1227](https://github.com/shenjingnan/xiaozhi-client/issues/1227))
- **endpoint:** 为 sendErrorResponse 方法添加错误处理 ([#1225](https://github.com/shenjingnan/xiaozhi-client/pull/1225))
- **npm:** 添加 spawn 进程 error 事件监听器 ([#1255](https://github.com/shenjingnan/xiaozhi-client/pull/1255), [#1252](https://github.com/shenjingnan/xiaozhi-client/issues/1252))
- **release:** 确保 nx-release-publish 在发布前执行构建 ([#1241](https://github.com/shenjingnan/xiaozhi-client/pull/1241))
- **status:** 将 status.service.ts 中的英文注释翻译为中文 ([#1268](https://github.com/shenjingnan/xiaozhi-client/pull/1268))

### 🔥 Performance

- 缓存 tools.map 结果避免重复映射操作 ([#1290](https://github.com/shenjingnan/xiaozhi-client/pull/1290))
- 优化 mcp-manage.handler.ts 中重复的 map 调用 ([#1193](https://github.com/shenjingnan/xiaozhi-client/pull/1193), [#1191](https://github.com/shenjingnan/xiaozhi-client/issues/1191))

### ❤️ Thank You

- Claude
- GeoDaoyu @GeoDaoyu
- shenjingnan @shenjingnan

## 1.10.8-beta.9 (2026-02-10)

### 🩹 Fixes

- 移除 mcp-errors.ts 中不合适的 shebang ([#1230](https://github.com/shenjingnan/xiaozhi-client/pull/1230), [#1229](https://github.com/shenjingnan/xiaozhi-client/issues/1229))
- **endpoint:** 为 sendErrorResponse 方法添加错误处理 ([#1225](https://github.com/shenjingnan/xiaozhi-client/pull/1225))
- **release:** 确保 nx-release-publish 在发布前执行构建 ([#1241](https://github.com/shenjingnan/xiaozhi-client/pull/1241))

### ❤️ Thank You

- Claude
- shenjingnan @shenjingnan

## 1.10.8-beta.8 (2026-02-09)

### 🩹 Fixes

- 移除 mcp-errors.ts 中不合适的 shebang ([#1230](https://github.com/shenjingnan/xiaozhi-client/pull/1230), [#1229](https://github.com/shenjingnan/xiaozhi-client/issues/1229))
- **endpoint:** 为 sendErrorResponse 方法添加错误处理 ([#1225](https://github.com/shenjingnan/xiaozhi-client/pull/1225))
- **release:** 确保 nx-release-publish 在发布前执行构建 ([#1241](https://github.com/shenjingnan/xiaozhi-client/pull/1241))

### ❤️ Thank You

- Claude
- shenjingnan @shenjingnan

## 1.10.8-beta.7 (2026-02-09)

### 🩹 Fixes

- 移除 mcp-errors.ts 中不合适的 shebang ([#1230](https://github.com/shenjingnan/xiaozhi-client/pull/1230), [#1229](https://github.com/shenjingnan/xiaozhi-client/issues/1229))
- **endpoint:** 为 sendErrorResponse 方法添加错误处理 ([#1225](https://github.com/shenjingnan/xiaozhi-client/pull/1225))

### ❤️ Thank You

- shenjingnan @shenjingnan

## 1.11.0 (2026-02-09)

### 🚀 Features

- 迁移到 Nx Release 发布流程 ([#1223](https://github.com/shenjingnan/xiaozhi-client/pull/1223))

### ❤️ Thank You

- Claude
- shenjingnan @shenjingnan

# 更新日志

## [1.9.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.9.3-rc.0...v1.9.3) (2025-12-21)

### Features

* **coze:** 集成官方 SDK 并优化工作流调用机制 ([#504](https://github.com/shenjingnan/xiaozhi-client/issues/504)) ([990f55c](https://github.com/shenjingnan/xiaozhi-client/commit/990f55ce7c1e51f80244b401d5dcf6f9ea3a6875))

### Bug Fixes

* **endpoint:** 修复 ProxyMCPServer 连接状态流转问题 ([#484](https://github.com/shenjingnan/xiaozhi-client/issues/484)) ([1172e04](https://github.com/shenjingnan/xiaozhi-client/commit/1172e047091140db3d19d1542f14d21fad66bbeb))
* **security:** 修复 mdast-util-to-hast 安全漏洞并更新依赖 ([#505](https://github.com/shenjingnan/xiaozhi-client/issues/505)) ([f0a6257](https://github.com/shenjingnan/xiaozhi-client/commit/f0a62570e235c29e6d1abd957c3c3272ddab7025))

## [1.9.3-rc.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.9.3-beta.2...v1.9.3-rc.0) (2025-12-01)

### Features

* **mcp:** 新增自定义 headers 配置支持 ([#466](https://github.com/shenjingnan/xiaozhi-client/issues/466)) ([f41e6fa](https://github.com/shenjingnan/xiaozhi-client/commit/f41e6faf55e620633b54bca9513fa3717ad2f30c))

## [1.9.3-beta.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.9.3-beta.1...v1.9.3-beta.2) (2025-11-27)

### Features

* **claude:** 新增务实开发验证技能并优化现有技能体系 ([#455](https://github.com/shenjingnan/xiaozhi-client/issues/455)) ([a7b2daa](https://github.com/shenjingnan/xiaozhi-client/commit/a7b2daab3e96ee159a7d3b57125a26dbebfc7b0a))
* **core:** 实现 Logger 注入机制统一日志配置管理 ([#454](https://github.com/shenjingnan/xiaozhi-client/issues/454)) ([5644149](https://github.com/shenjingnan/xiaozhi-client/commit/56441498f7ba41864d5bec9fc53eb147283287f9))

### Bug Fixes

* **security:** 修复 body-parser 依赖安全漏洞 ([#462](https://github.com/shenjingnan/xiaozhi-client/issues/462)) ([8b71057](https://github.com/shenjingnan/xiaozhi-client/commit/8b7105727fc8b7280f91d3bcaef77a173a3c0a75))

## [1.9.3-beta.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.9.2...v1.9.3-beta.1) (2025-11-24)

### Features

* **claude:** 适配 .claude 命令和技能文件至 xiaozhi-client 项目 ([#438](https://github.com/shenjingnan/xiaozhi-client/issues/438)) ([7fa119a](https://github.com/shenjingnan/xiaozhi-client/commit/7fa119a655b636847905d3c2c5c56f7d0e5a080a))

### Bug Fixes

* **deps:** 修复依赖安全漏洞并更新包版本约束 ([#448](https://github.com/shenjingnan/xiaozhi-client/issues/448)) ([211e341](https://github.com/shenjingnan/xiaozhi-client/commit/211e34141d0e56c66a3b15e5a6b2735780673f6e))

### Reverts

* Revert "refactor(config): 重构TypeScript配置文件组织结构 (#423)" (#424) ([a775c79](https://github.com/shenjingnan/xiaozhi-client/commit/a775c7959df7c19aa0a43fa2e43a8e2fe2154f44)), closes [#423](https://github.com/shenjingnan/xiaozhi-client/issues/423) [#424](https://github.com/shenjingnan/xiaozhi-client/issues/424)

## [1.9.3-beta.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.9.2...v1.9.3-beta.0) (2025-11-15)

### Reverts

* Revert "refactor(config): 重构TypeScript配置文件组织结构 (#423)" (#424) ([a775c79](https://github.com/shenjingnan/xiaozhi-client/commit/a775c7959df7c19aa0a43fa2e43a8e2fe2154f44)), closes [#423](https://github.com/shenjingnan/xiaozhi-client/issues/423) [#424](https://github.com/shenjingnan/xiaozhi-client/issues/424)

# Changelog

## [1.9.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.9.1...v1.9.2) (2025-11-14)

## [1.9.2-beta.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.9.1...v1.9.2-beta.0) (2025-11-13)

## [1.9.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.9.0...v1.9.1) (2025-11-12)

### Features

* **core:** 实现 MCP 服务类型字段自动格式转换 ([#404](https://github.com/shenjingnan/xiaozhi-client/issues/404)) ([7b40b0e](https://github.com/shenjingnan/xiaozhi-client/commit/7b40b0ed84070f449e221a10ab2921627fa6b965))
* **web:** 优化安装对话框交互体验 ([#403](https://github.com/shenjingnan/xiaozhi-client/issues/403)) ([d97df23](https://github.com/shenjingnan/xiaozhi-client/commit/d97df23a564f0bb7dfb9c6ee5ac333a3318ed6be))
* **web:** 优化工具调用状态徽章的显示效果 ([#408](https://github.com/shenjingnan/xiaozhi-client/issues/408)) ([594dd22](https://github.com/shenjingnan/xiaozhi-client/commit/594dd22a17c66bc9b387cc45f9ff43c8a8d96b9b))
* **web:** 优化无参数工具的用户界面体验 ([#406](https://github.com/shenjingnan/xiaozhi-client/issues/406)) ([d2f3812](https://github.com/shenjingnan/xiaozhi-client/commit/d2f38127264783d90f63c269668c41a018557903))

### Bug Fixes

* **core:** 修复Web界面重启服务功能失效问题 ([#402](https://github.com/shenjingnan/xiaozhi-client/issues/402)) ([5097450](https://github.com/shenjingnan/xiaozhi-client/commit/5097450def5f0947adc9c427672b487d50948908))

### Reverts

* Revert "fix(core): 修复Web界面重启服务功能失效问题 (#402)" (#405) ([d4ae98b](https://github.com/shenjingnan/xiaozhi-client/commit/d4ae98b668e4a43317405de9656e48b3230f47cf)), closes [#402](https://github.com/shenjingnan/xiaozhi-client/issues/402) [#405](https://github.com/shenjingnan/xiaozhi-client/issues/405)

## [1.9.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.8.4...v1.9.0) (2025-11-09)

### Features

* **api:** 新增工具调用日志查询和统计 API ([#396](https://github.com/shenjingnan/xiaozhi-client/issues/396)) ([8a53941](https://github.com/shenjingnan/xiaozhi-client/commit/8a539413d63e17ac033279643c06ba7387bee99e))
* **cli:** 重构 Claude Code 命令文件标准化 ([#395](https://github.com/shenjingnan/xiaozhi-client/issues/395)) ([71f0e55](https://github.com/shenjingnan/xiaozhi-client/commit/71f0e557dfd3c092506b46a5d812f1cb1652a11c))
* **dashboard:** 新增MCP工具调用日志查看功能 ([#398](https://github.com/shenjingnan/xiaozhi-client/issues/398)) ([549cc50](https://github.com/shenjingnan/xiaozhi-client/commit/549cc5043869eff7c455ef95e475f33d75a6847a))
* **web:** 新增MCP工具调试功能 ([#399](https://github.com/shenjingnan/xiaozhi-client/issues/399)) ([0bf50c7](https://github.com/shenjingnan/xiaozhi-client/commit/0bf50c761b8778b177effd35a9585ef702b1bfbe))

## [1.8.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.8.3...v1.8.4) (2025-11-07)

### Features

* **mcp:** 增强 MCP 服务管理器的容错和重试机制 ([#391](https://github.com/shenjingnan/xiaozhi-client/issues/391)) ([48b8897](https://github.com/shenjingnan/xiaozhi-client/commit/48b88976563a6db9c836ae0626108e230a77dd22))
* **mcp:** 新增MCP工具调用JSON日志记录功能 ([#390](https://github.com/shenjingnan/xiaozhi-client/issues/390)) ([7c6c2b7](https://github.com/shenjingnan/xiaozhi-client/commit/7c6c2b7ae5c178747bf597a0207f530b3d1ee08a))
* **test:** 优化测试执行效率和结构 ([#393](https://github.com/shenjingnan/xiaozhi-client/issues/393)) ([fa514cc](https://github.com/shenjingnan/xiaozhi-client/commit/fa514cc06670042d732b34cb1092d6073d2bb2bb))

## [1.8.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.8.2...v1.8.3) (2025-10-29)

### Features

* **api:** 接入点状态查询接口改为POST请求 ([#386](https://github.com/shenjingnan/xiaozhi-client/issues/386)) ([b0d458a](https://github.com/shenjingnan/xiaozhi-client/commit/b0d458a953ec83766f204f3c76823df2c76c001b))
* **logging:** 优化MCP工具调用日志记录和错误处理 ([#384](https://github.com/shenjingnan/xiaozhi-client/issues/384)) ([4a09252](https://github.com/shenjingnan/xiaozhi-client/commit/4a0925234edb79e70021948d5c993b7d5bc87cea))
* **logging:** 优化错误日志记录和连接失败处理 ([#383](https://github.com/shenjingnan/xiaozhi-client/issues/383)) ([a9d9ad4](https://github.com/shenjingnan/xiaozhi-client/commit/a9d9ad460f2c3075ab67f3f30b3ce8908c9a4c77))

### Bug Fixes

* **deps:** 升级 Hono 版本修复 Vary Header 注入漏洞 ([#389](https://github.com/shenjingnan/xiaozhi-client/issues/389)) ([4ad735d](https://github.com/shenjingnan/xiaozhi-client/commit/4ad735d5ad62ed8887973f0fc426b3738b405eaf))

### Performance Improvements

* **test:** 优化 WebServer.test.ts 执行效率 ([#388](https://github.com/shenjingnan/xiaozhi-client/issues/388)) ([d48b879](https://github.com/shenjingnan/xiaozhi-client/commit/d48b87945cbcd5e31813e7ef54b2545fc96854d4))

## [1.8.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.8.1...v1.8.2) (2025-10-23)

### Bug Fixes

* **deps:** 修复 Vite 安全漏洞 CVE-2025-62522 ([#374](https://github.com/shenjingnan/xiaozhi-client/issues/374)) ([cb6fd6b](https://github.com/shenjingnan/xiaozhi-client/commit/cb6fd6b2a0d0a463ea4e8a611d93cbecb56186c0))
* **security:** 修复 Hono 框架未授权访问安全漏洞 (CVE-2025-62522) ([#376](https://github.com/shenjingnan/xiaozhi-client/issues/376)) ([0181be9](https://github.com/shenjingnan/xiaozhi-client/commit/0181be977778ffa5e447b073e0b10a2a026b0675))

## [1.8.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.8.0...v1.8.1) (2025-10-19)

### Features

* **ux:** 优化配置模板的默认接入点设置 ([#369](https://github.com/shenjingnan/xiaozhi-client/issues/369)) ([40b10aa](https://github.com/shenjingnan/xiaozhi-client/commit/40b10aa4ad630ae35051aac7437bb5718d8200e8))

### Bug Fixes

* **ui:** 修复网站头部 QQ 群链接错误 ([#370](https://github.com/shenjingnan/xiaozhi-client/issues/370)) ([cb6c86d](https://github.com/shenjingnan/xiaozhi-client/commit/cb6c86dbfd208bdf34875343142d3e19595b592f))

## [1.8.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.9...v1.8.0) (2025-10-17)

### Bug Fixes

- **ci:** 修复 NPM 正式版本发布失败问题 ([#368](https://github.com/shenjingnan/xiaozhi-client/issues/368)) ([f79ae4d](https://github.com/shenjingnan/xiaozhi-client/commit/f79ae4deb880f1a84cc61e5965befc0d91f74598))
- **security:** 修复 happy-dom 关键安全漏洞 CVE GHSA-qpm2-6cq5-7pq5 ([#363](https://github.com/shenjingnan/xiaozhi-client/issues/363)) ([d743254](https://github.com/shenjingnan/xiaozhi-client/commit/d74325498ee7f1ce7eacb906d6fcddbbd0e9c60e))

### Features

- **api:** 实现 Docker 容器版本更新 API 功能 ([#361](https://github.com/shenjingnan/xiaozhi-client/issues/361)) ([0ff76ec](https://github.com/shenjingnan/xiaozhi-client/commit/0ff76ec2c29bdee212d4ea58c50bc32134669084))
- **ci:** 为 NPM 发布流程添加 GitHub Token 环境变量配置 ([#367](https://github.com/shenjingnan/xiaozhi-client/issues/367)) ([d6aba6b](https://github.com/shenjingnan/xiaozhi-client/commit/d6aba6bdf2b0d43ba803c1ce2bdca8c63c0a2aad))
- **ci:** 优化 NPM 发布工作流支持自定义版本号 ([#365](https://github.com/shenjingnan/xiaozhi-client/issues/365)) ([0a9fa0b](https://github.com/shenjingnan/xiaozhi-client/commit/0a9fa0b1bb863a4d169decff40d04e03686369c2))

## [1.7.9](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.8...v1.7.9) (2025-10-11)

### Features

- **cli:** 新增 Claude 命令系统支持 commit 和 fix-test 功能 ([#357](https://github.com/shenjingnan/xiaozhi-client/issues/357)) ([443097b](https://github.com/shenjingnan/xiaozhi-client/commit/443097b9da6e1ec295e4d33443b832a171899497))
- **mcp:** 支持通过 web 界面动态添加移除 MCP ([#350](https://github.com/shenjingnan/xiaozhi-client/issues/350)) ([44d3922](https://github.com/shenjingnan/xiaozhi-client/commit/44d3922142e910e360a927ffd16e9128b6aaec25))

### Bug Fixes

- **security:** 修复 happy-dom 关键安全漏洞 ([#358](https://github.com/shenjingnan/xiaozhi-client/issues/358)) ([74c22cf](https://github.com/shenjingnan/xiaozhi-client/commit/74c22cf18bcfbe6ab0cea0176140f2fffb9c1703))
- **webserver:** 修复连接管理器初始化逻辑并优化日志输出 ([#355](https://github.com/shenjingnan/xiaozhi-client/issues/355)) ([fd96893](https://github.com/shenjingnan/xiaozhi-client/commit/fd968930e1efd777694a48e90a00141881bcd262))

## [1.7.8](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.7...v1.7.8) (2025-09-29)

### Features

- **web:** 支持 Web 界面动态控制小智接入点添加/删除/连接/断开连接功能 ([#349](https://github.com/shenjingnan/xiaozhi-client/issues/349)) ([621041c](https://github.com/shenjingnan/xiaozhi-client/commit/621041cb310ba78a567aafffe6b16ea401f84ea1))

## [1.7.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.7-beta.0...v1.7.7) (2025-09-26)

## [1.7.7-beta.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.4...v1.7.7-beta.0) (2025-09-26)

### Features

- **docs:** 添加扣子工作流集成文档 ([#331](https://github.com/shenjingnan/xiaozhi-client/issues/331)) ([0944a71](https://github.com/shenjingnan/xiaozhi-client/commit/0944a71b1da625890f6b462fff82e61ddd2a6206))
- **web:** 实现 Web 管理界面版本号显示功能 ([#338](https://github.com/shenjingnan/xiaozhi-client/issues/338)) ([3f55043](https://github.com/shenjingnan/xiaozhi-client/commit/3f55043ea96a39397d9845127ce7f82633055667))

### Bug Fixes

- **deps:** update radix-ui-primitives monorepo ([#291](https://github.com/shenjingnan/xiaozhi-client/issues/291)) ([55c0ce2](https://github.com/shenjingnan/xiaozhi-client/commit/55c0ce20c05d0af76c1cc4a26fb3638b07e7a2ce))
- **logging:** 修复 --debug 参数时序问题，确保所有模块正确输出 DEBUG 日志 ([#342](https://github.com/shenjingnan/xiaozhi-client/issues/342)) ([48affe4](https://github.com/shenjingnan/xiaozhi-client/commit/48affe4cbbc1174b2f5a6c4fdfeb5021834a7adc))
- **security:** 修复 @conventional-changelog/git-client 参数注入安全漏洞 ([#343](https://github.com/shenjingnan/xiaozhi-client/issues/343)) ([bc10ad2](https://github.com/shenjingnan/xiaozhi-client/commit/bc10ad2a66c7b5f2e4929f5cf66ac4d0d3bb8fb3))
- **tool-api:** 修复 Web 界面显示已删除 MCP 工具的问题 ([#336](https://github.com/shenjingnan/xiaozhi-client/issues/336)) ([cec315b](https://github.com/shenjingnan/xiaozhi-client/commit/cec315b0b356d5316ac04a7761ff1b8ce544887b))
- upgrade version ([e0346a5](https://github.com/shenjingnan/xiaozhi-client/commit/e0346a5b8fbc42659ce0fa0fbfd38a59f144c444))
- **workflow:** add codeql ([b739d7b](https://github.com/shenjingnan/xiaozhi-client/commit/b739d7b89390d5edfb84447a1418426dd8abf942))

## [1.7.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.3...v1.7.4) (2025-09-18)

### Features

- **mcp:** 实现 MCP 工具配置双向同步机制 ([#326](https://github.com/shenjingnan/xiaozhi-client/issues/326)) ([d1b4be1](https://github.com/shenjingnan/xiaozhi-client/commit/d1b4be18fee96a787cb0cbd3267be95cb2ffff42))
- **mcp:** 实现 MCP 服务类型推断系统 ([#329](https://github.com/shenjingnan/xiaozhi-client/issues/329)) ([b907c6c](https://github.com/shenjingnan/xiaozhi-client/commit/b907c6ca1c788ff89aa5893a238423526a5c89ae))

### Bug Fixes

- **web:** 修复只有一个接入点时，无法移除的问题 ([#325](https://github.com/shenjingnan/xiaozhi-client/issues/325)) ([aabf938](https://github.com/shenjingnan/xiaozhi-client/commit/aabf938797f0d5b59b574644cf8ab507e4947ab3))

## [1.7.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.2...v1.7.3) (2025-09-15)

### Bug Fixes

- **mcp:** 放宽自定义 MCP 工具名称验证规则 ([#323](https://github.com/shenjingnan/xiaozhi-client/issues/323)) ([551ce4e](https://github.com/shenjingnan/xiaozhi-client/commit/551ce4ed2c615c07cd85c58cec934c14676e4ed4))
- **tool-sync:** 修复多服务工具同步逻辑错误 ([#322](https://github.com/shenjingnan/xiaozhi-client/issues/322)) ([0556bf9](https://github.com/shenjingnan/xiaozhi-client/commit/0556bf96b23f643fe6380f4035355cc75760e0f9))
- **workflow:** 修复 docker 发布失败的问题 ([#321](https://github.com/shenjingnan/xiaozhi-client/issues/321)) ([ab30beb](https://github.com/shenjingnan/xiaozhi-client/commit/ab30beb32aad5b9f0d966e0423321f82ec68505a))

## [1.7.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.1...v1.7.2) (2025-09-14)

### Features

- **cache:** 重构 CustomMCPHandler 缓存机制和任务状态管理 ([#317](https://github.com/shenjingnan/xiaozhi-client/issues/317)) ([6a55dec](https://github.com/shenjingnan/xiaozhi-client/commit/6a55dec21ee02ec514dfd178ee2c1b209efada2c))
- **mcp:** 实现工具配置统一管理机制 ([#313](https://github.com/shenjingnan/xiaozhi-client/issues/313)) ([d5b989b](https://github.com/shenjingnan/xiaozhi-client/commit/d5b989be46bdaa7fb07ef0f14cfe311404ef85ae))
- **platform:** 新增扣子平台集成和工作流管理功能 ([#303](https://github.com/shenjingnan/xiaozhi-client/issues/303)) ([c4d68a4](https://github.com/shenjingnan/xiaozhi-client/commit/c4d68a472cbc48a4f285e8589db9295ec4fb2baf))
- **tool-api:** 重构工具 API 系统支持多种工具类型 ([#314](https://github.com/shenjingnan/xiaozhi-client/issues/314)) ([ece18ca](https://github.com/shenjingnan/xiaozhi-client/commit/ece18cacedc49d1adb5beeea7d429ac4fb73e6df))
- **web:** 添加 Coze 工作流参数配置功能 ([#315](https://github.com/shenjingnan/xiaozhi-client/issues/315)) ([cc42b82](https://github.com/shenjingnan/xiaozhi-client/commit/cc42b829371946683c31dd73e895c4923758985d))

### Bug Fixes

- **security:** 修复安全漏洞并增强 GitHub Actions 安全审计 ([#320](https://github.com/shenjingnan/xiaozhi-client/issues/320)) ([165d6ed](https://github.com/shenjingnan/xiaozhi-client/commit/165d6ed8a0d7658a834631e771b0c777f39dfb4a))
- **ui:** 优化工作流集成对话框的宽度和高度限制 ([#318](https://github.com/shenjingnan/xiaozhi-client/issues/318)) ([494fdd6](https://github.com/shenjingnan/xiaozhi-client/commit/494fdd6504dac7e0a24cb21584c577ad0ef8fb95))
- **workflows:** 统一 pnpm 版本配置并升级 GitHub Actions ([#319](https://github.com/shenjingnan/xiaozhi-client/issues/319)) ([fa8da77](https://github.com/shenjingnan/xiaozhi-client/commit/fa8da77e8738b9669a19459a08975458706ec152))

## [1.7.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.7.0...v1.7.1) (2025-09-08)

### Features

- **cli:** xiaozhi start 命令增加 --debug 参数 ([#304](https://github.com/shenjingnan/xiaozhi-client/issues/304)) ([ead36d5](https://github.com/shenjingnan/xiaozhi-client/commit/ead36d5de7f7c42861e2089b1f6a240b2a0889c1))
- **mcp:** 放宽端点验证以支持自部署的 xiaozhi-server ([#274](https://github.com/shenjingnan/xiaozhi-client/issues/274)) ([b55a794](https://github.com/shenjingnan/xiaozhi-client/commit/b55a79408d07787edd644210f05a00049ec28d0a))

## [1.7.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.11...v1.7.0) (2025-09-08)

### Features

- **mcp:** 实现 customMCP 支持扣子工作流 ([#222](https://github.com/shenjingnan/xiaozhi-client/issues/222)) ([1817f26](https://github.com/shenjingnan/xiaozhi-client/commit/1817f2653e954165f910c93bfd5b218baa35e37d))

- **mcp:** 实现 MCP Streamable HTTP 协议支持 ([#292](https://github.com/shenjingnan/xiaozhi-client/issues/292)) ([a5aabcc](https://github.com/shenjingnan/xiaozhi-client/commit/a5aabcc9d8971a4b30c3a74e5e4f28de2b7274b1))

### Bug Fixes

- **cache:** 修复测试环境缓存文件污染项目目录问题 ([#288](https://github.com/shenjingnan/xiaozhi-client/issues/288)) ([e40710a](https://github.com/shenjingnan/xiaozhi-client/commit/e40710aa2bf64353084051a8dbdd37bd2dbd6b05))
- **deps:** update dependency hono to ^4.9.6 ([#296](https://github.com/shenjingnan/xiaozhi-client/issues/296)) ([de32901](https://github.com/shenjingnan/xiaozhi-client/commit/de32901d7d6eacca3645ff4304b4512b61bb5671))

## [1.6.11](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.10...v1.6.11) (2025-09-02)

### Features

- **cache:** 实现 MCP 服务工具列表缓存机制 ([#269](https://github.com/shenjingnan/xiaozhi-client/issues/269)) ([af674d3](https://github.com/shenjingnan/xiaozhi-client/commit/af674d349cf435ce422eb9f7f6f10a63b2be08f7))
- **mcp:** 新增 MCP 工具命令行调用功能 ([#277](https://github.com/shenjingnan/xiaozhi-client/issues/277)) ([c2ea2c8](https://github.com/shenjingnan/xiaozhi-client/commit/c2ea2c8a3e7430a6aaf7442a89c296f0e1a03883))

## [1.6.10](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.9...v1.6.10) (2025-09-02)

### Features

- **ci:** 添加 Gitee 同步工作流 ([#230](https://github.com/shenjingnan/xiaozhi-client/issues/230)) ([f6bdf83](https://github.com/shenjingnan/xiaozhi-client/commit/f6bdf83c56dda242ab59299eb63f574c3fd47ea1))

### Bug Fixes

- **ci:** 修复 Gitee 同步工作流的 SSH 连接问题 ([#231](https://github.com/shenjingnan/xiaozhi-client/issues/231)) ([306b804](https://github.com/shenjingnan/xiaozhi-client/commit/306b804d8b55bd50c14d6b51c11f75d5123c5286))
- **deps:** update dependency @modelcontextprotocol/sdk to ^1.17.4 ([#254](https://github.com/shenjingnan/xiaozhi-client/issues/254)) ([5886746](https://github.com/shenjingnan/xiaozhi-client/commit/58867463bc8c97238f775b1740fda50678cad758))
- **deps:** update dependency chalk to ^5.6.0 ([#255](https://github.com/shenjingnan/xiaozhi-client/issues/255)) ([d3e15db](https://github.com/shenjingnan/xiaozhi-client/commit/d3e15db7f611b17c1d9153d9b284fc3055fe77a4))
- **deps:** update dependency dotenv to v17 ([#260](https://github.com/shenjingnan/xiaozhi-client/issues/260)) ([3798184](https://github.com/shenjingnan/xiaozhi-client/commit/3798184fa4d2359689bdb3345baf90de64d768fd))
- **deps:** update dependency pino-pretty to ^10.3.1 ([#243](https://github.com/shenjingnan/xiaozhi-client/issues/243)) ([c6d7635](https://github.com/shenjingnan/xiaozhi-client/commit/c6d76351acec0a1a61727dd271c8180ab46f73f5))
- **deps:** update dependency pino-pretty to v13 ([#263](https://github.com/shenjingnan/xiaozhi-client/issues/263)) ([36c8f16](https://github.com/shenjingnan/xiaozhi-client/commit/36c8f1646da6f7fdbd3f4104c4c3f7dc91463d69))
- **deps:** update dependency react-hook-form to ^7.62.0 ([#258](https://github.com/shenjingnan/xiaozhi-client/issues/258)) ([a540137](https://github.com/shenjingnan/xiaozhi-client/commit/a540137408bddb0a773c5257bc43a71b7b8ad481))
- **deps:** update dependency react-router-dom to ^7.8.2 ([#259](https://github.com/shenjingnan/xiaozhi-client/issues/259)) ([a6df086](https://github.com/shenjingnan/xiaozhi-client/commit/a6df086d2cba6837fabd749355fcc5d3d8a5d9f5))
- **deps:** update react monorepo ([#249](https://github.com/shenjingnan/xiaozhi-client/issues/249)) ([ca19705](https://github.com/shenjingnan/xiaozhi-client/commit/ca1970521c0158559cca5a94391cd3e7c3acc032))

## [1.6.9](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.8...v1.6.9) (2025-08-31)

### Bug Fixes

- **mcp:** 修复 MCP 服务环境变量传递问题 ([#224](https://github.com/shenjingnan/xiaozhi-client/issues/224)) ([3f1a8be](https://github.com/shenjingnan/xiaozhi-client/commit/3f1a8beeb9b913ecbdb3ec2cb22cf510dcccced2))
- **PathUtils:** 修复 process.argv[1] 为 undefined 的问题并改进符号链接解析 ([#223](https://github.com/shenjingnan/xiaozhi-client/issues/223)) ([c2f3d0a](https://github.com/shenjingnan/xiaozhi-client/commit/c2f3d0a7ee01d5bc4b27558064395a8a04e87b7c))

## [1.6.8](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.7...v1.6.8) (2025-08-31)

### Bug Fixes

- **workflow:** 修复发布正式版时 github release 报错 ([#221](https://github.com/shenjingnan/xiaozhi-client/issues/221)) ([d74fbd6](https://github.com/shenjingnan/xiaozhi-client/commit/d74fbd6b230f5a47404fc271d708a0404f548cfc))

## [1.6.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.6...v1.6.7) (2025-08-31)

### Bug Fixes

- **workflow:** 统一发布配置并改进分支验证 ([#220](https://github.com/shenjingnan/xiaozhi-client/issues/220)) ([d9c16fb](https://github.com/shenjingnan/xiaozhi-client/commit/d9c16fb0bc40e1263754f3acefdae40c45d7a253))

## [1.6.6](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.5...v1.6.6) (2025-08-31)

### Bug Fixes

- **release:** 优化发布配置并改进预发布处理 ([#219](https://github.com/shenjingnan/xiaozhi-client/issues/219)) ([8acf625](https://github.com/shenjingnan/xiaozhi-client/commit/8acf625e2b1024d2b226d46db8a4bc7163670248))

## [1.6.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.3...v1.6.4) (2025-08-30)

### Features

- **ci:** 集成 release-it 自动化发版工具 ([#194](https://github.com/shenjingnan/xiaozhi-client/issues/194)) ([51a3ecd](https://github.com/shenjingnan/xiaozhi-client/commit/51a3ecde6134b88c7096757b046cd1322644cac4))
- **service:** 优化服务启动体验，支持自动重启已运行服务 ([#185](https://github.com/shenjingnan/xiaozhi-client/issues/185)) ([24f5542](https://github.com/shenjingnan/xiaozhi-client/commit/24f55428a0e7a6c38d07d2e375a62f91d7f3f7cf))
- 添加手动版本控制的发版脚本 ([#180](https://github.com/shenjingnan/xiaozhi-client/issues/180)) ([847a985](https://github.com/shenjingnan/xiaozhi-client/commit/847a985aa6fb2e73704bf1432c1a8a1e1f3e4c99))

### Bug Fixes

- **ci:** 增强 npm 发布流程支持预发布版本 ([#205](https://github.com/shenjingnan/xiaozhi-client/issues/205)) ([f721252](https://github.com/shenjingnan/xiaozhi-client/commit/f72125298eeab69f301eefc826ea5b0e5956b51d))
- **ci:** 添加重试机制解决间歇性失败问题 ([#203](https://github.com/shenjingnan/xiaozhi-client/issues/203)) ([074edb2](https://github.com/shenjingnan/xiaozhi-client/commit/074edb211755efc064c884a4b19838459544f489))
- **ci:** 简化 npm 发布流程并修复依赖问题 ([#214](https://github.com/shenjingnan/xiaozhi-client/issues/214)) ([2c26cf5](https://github.com/shenjingnan/xiaozhi-client/commit/2c26cf5190222a8489da552f4bc19daa2d8b528c))
- **cli:** 修复 CLI 命令参数处理逻辑，解决--info 和--version-info 命令冲突问题 ([#174](https://github.com/shenjingnan/xiaozhi-client/issues/174)) ([16743ac](https://github.com/shenjingnan/xiaozhi-client/commit/16743ac9b1d52082d8dfddc0810b4b2712ce5db5))
- **cli:** 修复守护进程模式下的启动和日志管理问题 ([#175](https://github.com/shenjingnan/xiaozhi-client/issues/175)) ([aa2ac38](https://github.com/shenjingnan/xiaozhi-client/commit/aa2ac388f4264ef635e651c4bbdb93676c6a3f96))
- **config:** 修复配置初始化时模板文件路径问题和 CLI 命令参数处理 ([#173](https://github.com/shenjingnan/xiaozhi-client/issues/173)) ([35176d6](https://github.com/shenjingnan/xiaozhi-client/commit/35176d6e766b8ddf74ef4b9b61fd2a1d44b85d42))
- **config:** 移除自动重启逻辑并添加配置清理功能 ([#186](https://github.com/shenjingnan/xiaozhi-client/issues/186)) ([5123ba2](https://github.com/shenjingnan/xiaozhi-client/commit/5123ba2ee76a03b02c2293857bf724f0181be2a9))
- **docker:** 修复容器重启时的 PID 文件清理问题 ([#169](https://github.com/shenjingnan/xiaozhi-client/issues/169)) ([f5ef458](https://github.com/shenjingnan/xiaozhi-client/commit/f5ef45855f048c5065aa2fc19e2e3d30d441eeec))
- **docker:** 增强 Docker 容器的 Python 依赖管理功能 ([#178](https://github.com/shenjingnan/xiaozhi-client/issues/178)) ([5be9518](https://github.com/shenjingnan/xiaozhi-client/commit/5be95189eacaf26397bc559cb996b0bb65407d99))
- **mcp:** 修复 MCP 服务工具配置没有自动同步到配置文件的问题 ([#181](https://github.com/shenjingnan/xiaozhi-client/issues/181)) ([d6ee64b](https://github.com/shenjingnan/xiaozhi-client/commit/d6ee64b7f85caa03faa88ee8a07035b193b65c90))
- **proxy:** 修复小智连接工具调用中的 ID 类型处理问题 ([#172](https://github.com/shenjingnan/xiaozhi-client/issues/172)) ([0e95b30](https://github.com/shenjingnan/xiaozhi-client/commit/0e95b30dea113972ecb84daa53fe2820688b54d2))
- **release:** 优化 npm 发布配置和参数处理逻辑 ([#212](https://github.com/shenjingnan/xiaozhi-client/issues/212)) ([664801f](https://github.com/shenjingnan/xiaozhi-client/commit/664801f89cbb0519ed1f90ce30dc173f37712d99))
- **release:** 优化 npm 发布脚本的版本冲突处理机制 ([#213](https://github.com/shenjingnan/xiaozhi-client/issues/213)) ([cf5b487](https://github.com/shenjingnan/xiaozhi-client/commit/cf5b4872537ab2eba4ce9afb2abb129ba5b0c1bb))
- **services:** 过滤 getAllTools 方法只返回已启用的工具 ([#204](https://github.com/shenjingnan/xiaozhi-client/issues/204)) ([cc08817](https://github.com/shenjingnan/xiaozhi-client/commit/cc08817044844cfb275891006e05d5268af472ef))
- **test:** 修复 TypeScript 类型检查和测试用例问题 ([#177](https://github.com/shenjingnan/xiaozhi-client/issues/177)) ([957dfb1](https://github.com/shenjingnan/xiaozhi-client/commit/957dfb15aff6b22fc0b97bd37f710515e3e0f6f5))
- **tools:** 增强 ProxyMCPServer 工具调用功能 ([#170](https://github.com/shenjingnan/xiaozhi-client/issues/170)) ([324aa11](https://github.com/shenjingnan/xiaozhi-client/commit/324aa11c01ba93c83620f369d75d294b4115b98b))
- **workflow:** 优化发版流程的预演模式 ([#196](https://github.com/shenjingnan/xiaozhi-client/issues/196)) ([d11f3fd](https://github.com/shenjingnan/xiaozhi-client/commit/d11f3fd370aaf99a9cd0fe05195fd16d14b6e309))
- **workflow:** 修复 package.json 中的 bin 路径问题 ([#208](https://github.com/shenjingnan/xiaozhi-client/issues/208)) ([b0a7358](https://github.com/shenjingnan/xiaozhi-client/commit/b0a7358b88d152a15df7991b545e42c52fc49e7e))
- **workflow:** 修复发版 Action 报错 ([#207](https://github.com/shenjingnan/xiaozhi-client/issues/207)) ([22cc702](https://github.com/shenjingnan/xiaozhi-client/commit/22cc70219d1e7279e1be1b554e52a68b2537b6bd))
- **workflow:** 修复发版问题 ([#210](https://github.com/shenjingnan/xiaozhi-client/issues/210)) ([2d91df0](https://github.com/shenjingnan/xiaozhi-client/commit/2d91df0cd16a44e45dcb033e84e279101c0d4828))
- **workflow:** 修复由于 .release-it.json 中的 before:init 执行顺序导致发版失败 ([#206](https://github.com/shenjingnan/xiaozhi-client/issues/206)) ([7ef0440](https://github.com/shenjingnan/xiaozhi-client/commit/7ef044045edde0594e23f33bda4f23d805632231))

## [1.6.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.2...v1.6.3) (2025-08-21)

### Features

- 添加手动版本控制的发版脚本 ([#180](https://github.com/shenjingnan/xiaozhi-client/issues/180)) ([847a985](https://github.com/shenjingnan/xiaozhi-client/commit/847a985aa6fb2e73704bf1432c1a8a1e1f3e4c99))

### Bug Fixes

- **cli:** 修复 CLI 命令参数处理逻辑，解决--info 和--version-info 命令冲突问题 ([#174](https://github.com/shenjingnan/xiaozhi-client/issues/174)) ([16743ac](https://github.com/shenjingnan/xiaozhi-client/commit/16743ac9b1d52082d8dfddc0810b4b2712ce5db5))
- **cli:** 修复守护进程模式下的启动和日志管理问题 ([#175](https://github.com/shenjingnan/xiaozhi-client/issues/175)) ([aa2ac38](https://github.com/shenjingnan/xiaozhi-client/commit/aa2ac388f4264ef635e651c4bbdb93676c6a3f96))
- **config:** 修复配置初始化时模板文件路径问题和 CLI 命令参数处理 ([#173](https://github.com/shenjingnan/xiaozhi-client/issues/173)) ([35176d6](https://github.com/shenjingnan/xiaozhi-client/commit/35176d6e766b8ddf74ef4b9b61fd2a1d44b85d42))
- **docker:** 修复容器重启时的 PID 文件清理问题 ([#169](https://github.com/shenjingnan/xiaozhi-client/issues/169)) ([f5ef458](https://github.com/shenjingnan/xiaozhi-client/commit/f5ef45855f048c5065aa2fc19e2e3d30d441eeec))
- **docker:** 增强 Docker 容器的 Python 依赖管理功能 ([#178](https://github.com/shenjingnan/xiaozhi-client/issues/178)) ([5be9518](https://github.com/shenjingnan/xiaozhi-client/commit/5be95189eacaf26397bc559cb996b0bb65407d99))
- **mcp:** 修复 MCP 服务工具配置没有自动同步到配置文件的问题 ([#181](https://github.com/shenjingnan/xiaozhi-client/issues/181)) ([d6ee64b](https://github.com/shenjingnan/xiaozhi-client/commit/d6ee64b7f85caa03faa88ee8a07035b193b65c90))
- **proxy:** 修复小智连接工具调用中的 ID 类型处理问题 ([#172](https://github.com/shenjingnan/xiaozhi-client/issues/172)) ([0e95b30](https://github.com/shenjingnan/xiaozhi-client/commit/0e95b30dea113972ecb84daa53fe2820688b54d2))
- **test:** 修复 TypeScript 类型检查和测试用例问题 ([#177](https://github.com/shenjingnan/xiaozhi-client/issues/177)) ([957dfb1](https://github.com/shenjingnan/xiaozhi-client/commit/957dfb15aff6b22fc0b97bd37f710515e3e0f6f5))
- **tools:** 增强 ProxyMCPServer 工具调用功能 ([#170](https://github.com/shenjingnan/xiaozhi-client/issues/170)) ([324aa11](https://github.com/shenjingnan/xiaozhi-client/commit/324aa11c01ba93c83620f369d75d294b4115b98b))

## [1.6.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.1...v1.6.2) (2025-08-17)

### Bug Fixes

- resolve case sensitivity issue - rename webServer.test.ts to WebServer.test.ts ([94bab63](https://github.com/shenjingnan/xiaozhi-client/commit/94bab63302f0e75d6543712f9f8a9e1f344b5808))

## [1.6.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.0...v1.6.1) (2025-08-10)

### Bug Fixes

- **docker:** 移除 Docker 容器中的非 root 用户限制 ([#157](https://github.com/shenjingnan/xiaozhi-client/issues/157)) ([e1b95e4](https://github.com/shenjingnan/xiaozhi-client/commit/e1b95e461cbf37800788a2c47d25063e87ba5cb2))

## [1.6.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.5.1...v1.6.0) (2025-08-09)

### Features

- **ci/cd:** 分离 Docker 和 NPM 发布流程并优化部署体验 ([#156](https://github.com/shenjingnan/xiaozhi-client/issues/156)) ([e417b49](https://github.com/shenjingnan/xiaozhi-client/commit/e417b49e073d58a3cdd668fef8972a9c3f299f1c))
- **config:** 支持 JSON5 和 JSONC 配置文件格式 ([#129](https://github.com/shenjingnan/xiaozhi-client/issues/129)) ([81b9271](https://github.com/shenjingnan/xiaozhi-client/commit/81b92714ee86fc7271dbc54e06192d27e7f0f038))
- **config:** 添加 JSONC 配置文件注释保留功能 ([4084f8d](https://github.com/shenjingnan/xiaozhi-client/commit/4084f8d44b56117cf455a8037b68f33b884414e4))
- **config:** 添加 ModelScope 平台配置模板 ([#140](https://github.com/shenjingnan/xiaozhi-client/issues/140)) ([15466e2](https://github.com/shenjingnan/xiaozhi-client/commit/15466e241317557ffa3ebce5c8c157c270254365))
- **docker:** 优化 Docker 容器启动体验和持久化配置 ([#145](https://github.com/shenjingnan/xiaozhi-client/issues/145)) ([add7a11](https://github.com/shenjingnan/xiaozhi-client/commit/add7a11c57bcdb7f3ea863060e4826a5ebc75e3e))
- **docker:** 优化中国网络环境下的 Docker 构建和运行体验 ([#147](https://github.com/shenjingnan/xiaozhi-client/issues/147)) ([aaf4ac4](https://github.com/shenjingnan/xiaozhi-client/commit/aaf4ac46530589e7e198313f05446cdcecb6e566))
- **docker:** 实现 docker 容器化部署 ([#144](https://github.com/shenjingnan/xiaozhi-client/issues/144)) ([e95ae82](https://github.com/shenjingnan/xiaozhi-client/commit/e95ae82e4ea4a477289e5a027190719a494fb47e))
- **stats:** 添加 MCP 工具使用统计功能 ([#148](https://github.com/shenjingnan/xiaozhi-client/issues/148)) ([6a3adbe](https://github.com/shenjingnan/xiaozhi-client/commit/6a3adbe5cf0b41b72036011c9ef12d8cdad7164c))
- 重构 web 服务界面 ([#135](https://github.com/shenjingnan/xiaozhi-client/issues/135)) ([a63a3bf](https://github.com/shenjingnan/xiaozhi-client/commit/a63a3bf2d3d5b57bba5c2040608129551ccc0b41))

### Bug Fixes

- **config:** 修复 JSON5 配置文件格式保持功能 ([#139](https://github.com/shenjingnan/xiaozhi-client/issues/139)) ([2336487](https://github.com/shenjingnan/xiaozhi-client/commit/23364872c9cd23661d461f5e111db422cb5f4f42))
- **config:** 修复配置文件包含 BOM 字符导致解析失败的问题 ([#146](https://github.com/shenjingnan/xiaozhi-client/issues/146)) ([c9a979a](https://github.com/shenjingnan/xiaozhi-client/commit/c9a979a1d57e9dd4e4b320098c38d9c0cd050a4e))
- **docker:** 修复 Docker 镜像标签问题 ([#153](https://github.com/shenjingnan/xiaozhi-client/issues/153)) ([0ceff01](https://github.com/shenjingnan/xiaozhi-client/commit/0ceff0197ee55383f8afe91216923ee4c49ac7b4))
- **mcp-server:** 并行启动 MCP 代理和客户端以避免阻塞 ([#133](https://github.com/shenjingnan/xiaozhi-client/issues/133)) ([04a4369](https://github.com/shenjingnan/xiaozhi-client/commit/04a43695cc31b004378876b8a6e29700651b0137))
- 修复飞牛 OS 无法访问 web 服务的问题 ([#136](https://github.com/shenjingnan/xiaozhi-client/issues/136)) ([bfaf356](https://github.com/shenjingnan/xiaozhi-client/commit/bfaf3566ce97d153994da002800b4fb267d16480))

## [1.5.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.5.0...v1.5.1) (2025-07-24)

### Bug Fixes

- **deps:** 升级 form-data 到 v4.0.4 以解决安全问题 ([#128](https://github.com/shenjingnan/xiaozhi-client/issues/128)) ([d28595e](https://github.com/shenjingnan/xiaozhi-client/commit/d28595ef2bc9d5ebcdfa7fddf7896da2d02b7a25))
- 实现 MCP 服务配置同步清理功能 ([#125](https://github.com/shenjingnan/xiaozhi-client/issues/125)) ([d60b2c1](https://github.com/shenjingnan/xiaozhi-client/commit/d60b2c1fd8e86f5180a78d871b7e2ed682a9017d))

## [1.5.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.4.0...v1.5.0) (2025-07-21)

### Features

- **logging:** 增强工具调用日志记录功能 ([#117](https://github.com/shenjingnan/xiaozhi-client/issues/117)) ([4124721](https://github.com/shenjingnan/xiaozhi-client/commit/41247212e63dcb9ee1c55e0cacc7cd08638489b6))
- **mcp:** 支持多 MCP 端点配置和独立进程架构 ([#97](https://github.com/shenjingnan/xiaozhi-client/issues/97)) ([40f2dfd](https://github.com/shenjingnan/xiaozhi-client/commit/40f2dfdc9628c2c74faaef3ccb43d4839945ac7d))
- **mcp:** 添加 MCP Server 模式支持，允许作为标准 MCP Server 被 Cursor 等客户端使用 ([#96](https://github.com/shenjingnan/xiaozhi-client/issues/96)) ([c091a12](https://github.com/shenjingnan/xiaozhi-client/commit/c091a122334090c58c9db430eeeab13d14b89686))
- **mcp:** 添加 SSE 方式通信的 MCP 服务支持 ([#112](https://github.com/shenjingnan/xiaozhi-client/issues/112)) ([4c88a17](https://github.com/shenjingnan/xiaozhi-client/commit/4c88a17ec7a45163fbe8c41006e6c43c118bb52a))
- **mcp:** 添加 Streamable HTTP MCP 客户端支持 ([#99](https://github.com/shenjingnan/xiaozhi-client/issues/99)) ([6b63d89](https://github.com/shenjingnan/xiaozhi-client/commit/6b63d89ffdcb8f95d85cbfc470c9400be48f6aaf))
- **web:** 添加配置更新后自动重启服务功能 ([#103](https://github.com/shenjingnan/xiaozhi-client/issues/103)) ([fed508b](https://github.com/shenjingnan/xiaozhi-client/commit/fed508b4db52aca966441c32ca43665c5fa16ac8))

### Bug Fixes

- **cli:** 支持多实例并行运行 ([#98](https://github.com/shenjingnan/xiaozhi-client/issues/98)) ([67ed498](https://github.com/shenjingnan/xiaozhi-client/commit/67ed498ddabf959d587e07cb5a8009920cb15075))
- **mcp:** 优化错误重试机制和连接稳定性 ([#102](https://github.com/shenjingnan/xiaozhi-client/issues/102)) ([e49ff2f](https://github.com/shenjingnan/xiaozhi-client/commit/e49ff2f93d741c22127b2d4d479946180b8ef25c))
- **mcp:** 修复 Streamable HTTP MCP 服务工具列表不显示的问题 ([#107](https://github.com/shenjingnan/xiaozhi-client/issues/107)) ([0b54456](https://github.com/shenjingnan/xiaozhi-client/commit/0b54456d8e0551a40bcef783b0861c7e1a1d4bec))
- **mcp:** 修复 SSE 传输中 GetLiveContext 工具响应超时问题 ([#119](https://github.com/shenjingnan/xiaozhi-client/issues/119)) ([68c34cf](https://github.com/shenjingnan/xiaozhi-client/commit/68c34cfa175746397121f6530c00acc7efd0e313))
- **mcp:** 修复远端 MCP 服务工具配置不写入配置文件的问题 ([#106](https://github.com/shenjingnan/xiaozhi-client/issues/106)) ([d87ce90](https://github.com/shenjingnan/xiaozhi-client/commit/d87ce90975a1bfb6120b11b074d51e9251ba1bf6))
- 修复 windows 中使用 ui 命令报错 ([#105](https://github.com/shenjingnan/xiaozhi-client/issues/105)) ([aefd777](https://github.com/shenjingnan/xiaozhi-client/commit/aefd777bfb6c33f12e90a151e291ab383a6e5cbf))

## [1.4.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.3.0...v1.4.0) (2025-07-07)

### Features

- **build:** 支持发布 web 界面到 npm 包 ([#82](https://github.com/shenjingnan/xiaozhi-client/issues/82)) ([2cab860](https://github.com/shenjingnan/xiaozhi-client/commit/2cab860ee8063d672ea6eb562e6d914e1895a588))
- **cli:** 添加 --ui 参数支持同时启动 Web UI 服务 ([#86](https://github.com/shenjingnan/xiaozhi-client/issues/86)) ([f9420f5](https://github.com/shenjingnan/xiaozhi-client/commit/f9420f5bfbeda341b60da44f1fa6526070ab00d9))
- **ui:** 实现可视化配置管理网页 ([#78](https://github.com/shenjingnan/xiaozhi-client/issues/78)) ([14c5e06](https://github.com/shenjingnan/xiaozhi-client/commit/14c5e06d3d73309a99b645861b663a9a670f7ae4))
- **web-ui:** 支持动态配置 WebSocket 连接地址 ([#84](https://github.com/shenjingnan/xiaozhi-client/issues/84)) ([b93b617](https://github.com/shenjingnan/xiaozhi-client/commit/b93b617e5841c12f9b7ddef2f24d5d78fcb887c3))
- **webui:** 支持在配置文件中自定义 Web UI 端口号 ([#90](https://github.com/shenjingnan/xiaozhi-client/issues/90)) ([d2b492e](https://github.com/shenjingnan/xiaozhi-client/commit/d2b492ea4a5d28ba2ac1a41e22a8c89597e2ced3))

### Bug Fixes

- **logger:** 修复守护进程模式下 EPIPE 错误导致日志文件快速膨胀问题 ([#91](https://github.com/shenjingnan/xiaozhi-client/issues/91)) ([3eefc9a](https://github.com/shenjingnan/xiaozhi-client/commit/3eefc9a20976e1d9d5b181a7e7f9b90be26ad421))
- **web-ui:** 修复 Web UI 连接状态显示不准确的问题 ([#83](https://github.com/shenjingnan/xiaozhi-client/issues/83)) ([7efdb9e](https://github.com/shenjingnan/xiaozhi-client/commit/7efdb9ea0c8173c6d8fac9e8724629ba81405274))
- **web-ui:** 修复 WebSocket 日志噪音和退出卡顿问题 ([#87](https://github.com/shenjingnan/xiaozhi-client/issues/87)) ([5034dd9](https://github.com/shenjingnan/xiaozhi-client/commit/5034dd97de11f25b684767d26744d4c781b58c13))

## [1.3.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.2.0...v1.3.0) (2025-06-29)

### Features

- trigger release for new version ([ab57dbf](https://github.com/shenjingnan/xiaozhi-client/commit/ab57dbfb3ed800acb384424b9b0277deee7fd240))

## [1.2.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.10...v1.2.0) (2025-06-29)

### Features

- **mcp:** 集成 ModelScope MCP 服务支持 ([#76](https://github.com/shenjingnan/xiaozhi-client/issues/76)) ([b93fd35](https://github.com/shenjingnan/xiaozhi-client/commit/b93fd358dceb0480a76cc16d9cc9a2eb72ac4c1a))
- **release:** 调整语义化版本发布规则 ([#75](https://github.com/shenjingnan/xiaozhi-client/issues/75)) ([0f405e0](https://github.com/shenjingnan/xiaozhi-client/commit/0f405e0127ed3cea3ff1921ce5c567b4ed6c8552))

## [1.0.10](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.9...v1.0.10) (2025-06-23)

### Bug Fixes

- **mcp:** 修复 windows 环境中 uvx mcp 无法使用的问题 ([#73](https://github.com/shenjingnan/xiaozhi-client/issues/73)) ([d44e24e](https://github.com/shenjingnan/xiaozhi-client/commit/d44e24e59af7bfcd16623a5a8286ab3d05124d64))

## [1.0.9](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.8...v1.9.0) (2025-06-23)

### Features

- **ci:** 实现 PR 合并后自动发布正式版 ([#74](https://github.com/shenjingnan/xiaozhi-client/issues/74)) ([70b03b8](https://github.com/shenjingnan/xiaozhi-client/commit/70b03b8b07e883adcad4a54e12135178b48b87fc))

## [1.0.8](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.7...v1.0.8) (2025-06-23)

### Features

- **logger:** 实现基于 consola 的日志系统 ([#71](https://github.com/shenjingnan/xiaozhi-client/issues/71)) ([0ec753d](https://github.com/shenjingnan/xiaozhi-client/commit/0ec753d9c72056e1e0d9b334662f40ee279d9e26))

## [1.0.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.6...v1.0.7) (2025-06-20)

### Features

- **config:** 实现心跳检测和连接配置的可配置化 ([#70](https://github.com/shenjingnan/xiaozhi-client/issues/70)) ([82d4f5d](https://github.com/shenjingnan/xiaozhi-client/commit/82d4f5db7c4a3e6d77b76c61139860584d1c2acf))
- **connection:** 优化断线重连机制和后台运行稳定性 ([#68](https://github.com/shenjingnan/xiaozhi-client/issues/68)) ([45b7cc8](https://github.com/shenjingnan/xiaozhi-client/commit/45b7cc813bb815e90c39186d56596fd9edd6e030))

## [1.0.6](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.5...v1.0.6) (2025-06-19)

### Bug Fixes

- **release:** 修复 beta 版本发布配置和版本号问题 ([#67](https://github.com/shenjingnan/xiaozhi-client/issues/67)) ([5389e6b](https://github.com/shenjingnan/xiaozhi-client/commit/5389e6b219919b23fe76209c90986a14cbd4f570))

## [1.0.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-beta.1...v1.0.5) (2025-06-19)

### Bug Fixes

- **completion:** 修复并重构 CLI 自动完成功能实现 ([#65](https://github.com/shenjingnan/xiaozhi-client/issues/65)) ([b94aca9](https://github.com/shenjingnan/xiaozhi-client/commit/b94aca970626166e1ef4ab9584c2086cef5ea7d8))
- **release:** 添加缺失的 semantic-release 依赖包 ([#66](https://github.com/shenjingnan/xiaozhi-client/issues/66)) ([d84b0b5](https://github.com/shenjingnan/xiaozhi-client/commit/d84b0b559e84c55e6a2fc8ec5cef74da528c67d8))

## [1.1.0-beta.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.19...v1.1.0-beta.1) (2025-06-19)

### Features

- **ci:** 实现手动触发发版 workflow 支持 stable 和 beta 版本选择 ([#61](https://github.com/shenjingnan/xiaozhi-client/issues/61)) ([6ecef26](https://github.com/shenjingnan/xiaozhi-client/commit/6ecef2650827e51f2f525fcc4deb4050ce07cd6e))

### Bug Fixes

- **release:** 修复 next 分支无法发布 beta 版本的问题 ([#63](https://github.com/shenjingnan/xiaozhi-client/issues/63)) ([7e81526](https://github.com/shenjingnan/xiaozhi-client/commit/7e81526c1d23ad5cf7e15f5a69b67e7b3a6ba400))

## [1.1.0-next.19](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.18...v1.1.0-next.19) (2025-06-18)

### Bug Fixes

- **cli:** 修复 windows 环境下无法找到 npx 命令的问题 ([#57](https://github.com/shenjingnan/xiaozhi-client/issues/57)) ([0ff64fc](https://github.com/shenjingnan/xiaozhi-client/commit/0ff64fc5e38c42dbf89a5dc61e977c6da86ae465))

## [1.1.0-next.18](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.17...v1.1.0-next.18) (2025-06-18)

### Features

- **ci:** 添加多平台多版本矩阵测试支持 ([#54](https://github.com/shenjingnan/xiaozhi-client/issues/54)) ([c661569](https://github.com/shenjingnan/xiaozhi-client/commit/c6615691d773475574bf78e8d525aacb9e417819))

## [1.1.0-next.17](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.16...v1.1.0-next.17) (2025-06-18)

### Bug Fixes

- **cli:** 修复在 windows 环境中的 cli 报错 ([#53](https://github.com/shenjingnan/xiaozhi-client/issues/53)) ([022e8b6](https://github.com/shenjingnan/xiaozhi-client/commit/022e8b6ae66d84d100b1a137981ff6d9f25f84b4))

## [1.1.0-next.16](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.15...v1.1.0-next.16) (2025-06-17)

### Features

- **build:** 完成 ESM 模块系统迁移并启用 bundling ([#52](https://github.com/shenjingnan/xiaozhi-client/issues/52)) ([4204bde](https://github.com/shenjingnan/xiaozhi-client/commit/4204bde5803dce50febfc2054c6afca3a0b48e34))

## [1.1.0-next.15](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.14...v1.1.0-next.15) (2025-06-17)

### Bug Fixes

- **cli:** 修复 ESM 环境下模板路径解析问题 ([#51](https://github.com/shenjingnan/xiaozhi-client/issues/51)) ([98b8b56](https://github.com/shenjingnan/xiaozhi-client/commit/98b8b56426ebcdccb4e79d803ea984a5602f33ff))

## [1.1.0-next.14](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.13...v1.1.0-next.14) (2025-06-17)

### Features

- **build:** 项目产物从 CommonJS 迁移到 ESM ([#50](https://github.com/shenjingnan/xiaozhi-client/issues/50)) ([944cc98](https://github.com/shenjingnan/xiaozhi-client/commit/944cc98ff4d701b3e5ddc0484fef2574106f8165))

## [1.1.0-next.13](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.12...v1.1.0-next.13) (2025-06-17)

### Bug Fixes

- **cli:** 修复和改进自动补全脚本生成功能 ([#49](https://github.com/shenjingnan/xiaozhi-client/issues/49)) ([7f8d8bc](https://github.com/shenjingnan/xiaozhi-client/commit/7f8d8bc22b51d545c0b14f756f6039c7808ea7ad))

## [1.1.0-next.12](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.11...v1.1.0-next.12) (2025-06-17)

### Bug Fixes

- **cli:** 修复自动补全模块导入路径缺少文件扩展名 ([#48](https://github.com/shenjingnan/xiaozhi-client/issues/48)) ([0e6aee4](https://github.com/shenjingnan/xiaozhi-client/commit/0e6aee49b69cd87ea6f1969861a8edc156b3435f))

## [1.1.0-next.11](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.10...v1.1.0-next.11) (2025-06-17)

### Features

- **ci:** 添加代码质量检查工具和 CI 流程 ([#47](https://github.com/shenjingnan/xiaozhi-client/issues/47)) ([3b24747](https://github.com/shenjingnan/xiaozhi-client/commit/3b24747f625e667c3f1afee1e6b59ed960854d6c))

## [1.1.0-next.10](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.9...v1.1.0-next.10) (2025-06-16)

### Features

- **cli:** 优化表格布局 ([#43](https://github.com/shenjingnan/xiaozhi-client/issues/43)) ([7d2bfce](https://github.com/shenjingnan/xiaozhi-client/commit/7d2bfce245a78a7b5748c3368e0b4486088a036e))

## [1.1.0-next.9](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.8...v1.1.0-next.9) (2025-06-16)

### Features

- **cli:** 改进服务工具列表显示格式和中文字符处理 ([#41](https://github.com/shenjingnan/xiaozhi-client/issues/41)) ([28cc0cf](https://github.com/shenjingnan/xiaozhi-client/commit/28cc0cf26bc9174c679a63a8d8398b28bcea22c9))

## [1.1.0-next.8](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.4...v1.1.0-next.8) (2025-06-16)

### Features

- **ci:** 增强语义化发布配置并添加分支同步工作流 ([#40](https://github.com/shenjingnan/xiaozhi-client/issues/40)) ([35d7117](https://github.com/shenjingnan/xiaozhi-client/commit/35d71178ea5026b0401df147ba496aff9f2f612a))

## [1.1.0-next.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.6...v1.1.0-next.7) (2025-06-15)

## [1.1.0-next.6](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.3...v1.1.0-next.6) (2025-06-15)

### Features

- **templates:** 修复模板文件的 ES 模块兼容性问题 ([#34](https://github.com/shenjingnan/xiaozhi-client/issues/34)) ([378c1bf](https://github.com/shenjingnan/xiaozhi-client/commit/378c1bfd7e6632ca9bda1204c85b0010ff6615c4))

## [1.1.0-next.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.2...v1.1.0-next.5) (2025-06-14)

### Features

- **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([d1950fc](https://github.com/shenjingnan/xiaozhi-client/commit/d1950fcb979d6771cd1cf4262476d1f45ef6053e))

## [1.0.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.7...v1.0.4) (2025-06-15)

### Features

- **templates:** 修复模板文件的 ES 模块兼容性问题 ([#39](https://github.com/shenjingnan/xiaozhi-client/issues/39)) ([d4a266b](https://github.com/shenjingnan/xiaozhi-client/commit/d4a266b15212a539b630259ce4110719707c2df1))

## [1.1.0-next.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.6...v1.1.0-next.7) (2025-06-15)

## [1.0.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.5...v1.0.3) (2025-06-14)

### Features

- **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([#33](https://github.com/shenjingnan/xiaozhi-client/issues/33)) ([a905bdb](https://github.com/shenjingnan/xiaozhi-client/commit/a905bdbd9923ea0d7334d9d8275ed5bba4dc37e9))

## [1.0.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.4...v1.0.2) (2025-06-14)

## [1.1.0-next.6](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.3...v1.1.0-next.6) (2025-06-15)

### Features

- **templates:** 修复模板文件的 ES 模块兼容性问题 ([#34](https://github.com/shenjingnan/xiaozhi-client/issues/34)) ([378c1bf](https://github.com/shenjingnan/xiaozhi-client/commit/378c1bfd7e6632ca9bda1204c85b0010ff6615c4))

## [1.1.0-next.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.2...v1.1.0-next.5) (2025-06-14)

### Features

- **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([d1950fc](https://github.com/shenjingnan/xiaozhi-client/commit/d1950fcb979d6771cd1cf4262476d1f45ef6053e))

## [1.0.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.5...v1.0.3) (2025-06-14)

### Features

- **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([#33](https://github.com/shenjingnan/xiaozhi-client/issues/33)) ([a905bdb](https://github.com/shenjingnan/xiaozhi-client/commit/a905bdbd9923ea0d7334d9d8275ed5bba4dc37e9))

## [1.0.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.4...v1.0.2) (2025-06-14)

## [1.1.0-next.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.2...v1.1.0-next.5) (2025-06-14)

### Features

- **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([d1950fc](https://github.com/shenjingnan/xiaozhi-client/commit/d1950fcb979d6771cd1cf4262476d1f45ef6053e))

## [1.0.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.4...v1.0.2) (2025-06-14)

## [1.1.0-next.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.3...v1.1.0-next.4) (2025-06-14)

### Features

- **ci:** 集成 Codecov 代码覆盖率报告 ([#24](https://github.com/shenjingnan/xiaozhi-client/issues/24)) ([0500866](https://github.com/shenjingnan/xiaozhi-client/commit/05008666a706ac3fc9e5bedc4d20be05258f1928))

## [1.1.0-next.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.2...v1.1.0-next.3) (2025-06-14)

### Features

- **release:** 增强语义化发布配置和规则 ([#22](https://github.com/shenjingnan/xiaozhi-client/issues/22)) ([b010246](https://github.com/shenjingnan/xiaozhi-client/commit/b010246d62984651e9099393b72ddbdbe3542d6b))

## [1.1.0-next.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.1...v1.1.0-next.2) (2025-06-14)

### Features

- **ci:** 添加 next 分支预发布支持和增强发布流程 ([#17](https://github.com/shenjingnan/xiaozhi-client/issues/17)) ([#19](https://github.com/shenjingnan/xiaozhi-client/issues/19)) ([db10935](https://github.com/shenjingnan/xiaozhi-client/commit/db109352082f3ddfbbb82080ea5f4a89a6137887))

## [1.1.0-next.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.1...v1.1.0-next.1) (2025-06-14)

### Features

- **ci:** 添加 next 分支预发布支持和增强发布流程 ([#17](https://github.com/shenjingnan/xiaozhi-client/issues/17)) ([c156904](https://github.com/shenjingnan/xiaozhi-client/commit/c15690427fbef51b8e935cd9295da3b125debf03))

## [1.0.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.0...v1.0.1) (2025-06-14)

### Bug Fixes

- **ci:** 修复发布工作流包管理器不一致问题 ([#14](https://github.com/shenjingnan/xiaozhi-client/issues/14)) ([9d8d38e](https://github.com/shenjingnan/xiaozhi-client/commit/9d8d38e741976ec7b224e9b100530b165b81c147))

## [1.0.0](https://github.com/shenjingnan/xiaozhi-client/compare/4b7da6e28d05da60b86f373f69c7460dbaa4c2c1...v1.0.0) (2025-06-14)

### Features

- **cli:** 添加项目模板创建功能 ([612f445](https://github.com/shenjingnan/xiaozhi-client/commit/612f445155d49d9c10be1eda2ee6255c6c1ca708))
- **mcp:** 改进 MCP 服务器执行环境和版本管理 ([6097369](https://github.com/shenjingnan/xiaozhi-client/commit/6097369c1dda2845ab0c20bba755e55b3deec2cf))
- **mcp:** 添加 MCP 工具管理功能 ([#10](https://github.com/shenjingnan/xiaozhi-client/issues/10)) ([5fc784f](https://github.com/shenjingnan/xiaozhi-client/commit/5fc784fb91fba07f13269db4d334ead8dd81433b))
- **mcp:** 添加工具名称前缀机制解决冲突问题 ([#6](https://github.com/shenjingnan/xiaozhi-client/issues/6)) ([50983aa](https://github.com/shenjingnan/xiaozhi-client/commit/50983aa422f85f7c572ce4c2eca08ca0786e43c0))
- **tooling:** 集成 Biome 代码格式化工具并统一代码风格 ([27eb2b9](https://github.com/shenjingnan/xiaozhi-client/commit/27eb2b94a288f124c136abfca343aca12e54851e))

### Bug Fixes

- 修复配置文件路径问题，改为从当前工作目录读取配置文件 ([4b7da6e](https://github.com/shenjingnan/xiaozhi-client/commit/4b7da6e28d05da60b86f373f69c7460dbaa4c2c1))
