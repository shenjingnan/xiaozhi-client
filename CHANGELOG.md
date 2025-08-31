# Changelog

## [1.6.9-beta.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.8...v1.6.9-beta.0) (2025-08-31)

## [1.6.8](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.7...v1.6.8) (2025-08-31)

### Bug Fixes

* **workflow:** 修复发布正式版时 github release 报错 ([#221](https://github.com/shenjingnan/xiaozhi-client/issues/221)) ([d74fbd6](https://github.com/shenjingnan/xiaozhi-client/commit/d74fbd6b230f5a47404fc271d708a0404f548cfc))

## [1.6.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.6...v1.6.7) (2025-08-31)

### Bug Fixes

* **workflow:** 统一发布配置并改进分支验证 ([#220](https://github.com/shenjingnan/xiaozhi-client/issues/220)) ([d9c16fb](https://github.com/shenjingnan/xiaozhi-client/commit/d9c16fb0bc40e1263754f3acefdae40c45d7a253))

## [1.6.7-beta.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.6...v1.6.7-beta.0) (2025-08-31)

## [1.6.6](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.5...v1.6.6) (2025-08-31)

### Bug Fixes

* **release:** 优化发布配置并改进预发布处理 ([#219](https://github.com/shenjingnan/xiaozhi-client/issues/219)) ([8acf625](https://github.com/shenjingnan/xiaozhi-client/commit/8acf625e2b1024d2b226d46db8a4bc7163670248))


## [1.6.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.5-beta.0...v1.6.5) (2025-08-30)

## [1.6.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.3...v1.6.4) (2025-08-30)

### Features

* **ci:** 集成 release-it 自动化发版工具 ([#194](https://github.com/shenjingnan/xiaozhi-client/issues/194)) ([51a3ecd](https://github.com/shenjingnan/xiaozhi-client/commit/51a3ecde6134b88c7096757b046cd1322644cac4))
* **service:** 优化服务启动体验，支持自动重启已运行服务 ([#185](https://github.com/shenjingnan/xiaozhi-client/issues/185)) ([24f5542](https://github.com/shenjingnan/xiaozhi-client/commit/24f55428a0e7a6c38d07d2e375a62f91d7f3f7cf))
* 添加手动版本控制的发版脚本 ([#180](https://github.com/shenjingnan/xiaozhi-client/issues/180)) ([847a985](https://github.com/shenjingnan/xiaozhi-client/commit/847a985aa6fb2e73704bf1432c1a8a1e1f3e4c99))

### Bug Fixes

* **ci:** 增强 npm 发布流程支持预发布版本 ([#205](https://github.com/shenjingnan/xiaozhi-client/issues/205)) ([f721252](https://github.com/shenjingnan/xiaozhi-client/commit/f72125298eeab69f301eefc826ea5b0e5956b51d))
* **ci:** 添加重试机制解决间歇性失败问题 ([#203](https://github.com/shenjingnan/xiaozhi-client/issues/203)) ([074edb2](https://github.com/shenjingnan/xiaozhi-client/commit/074edb211755efc064c884a4b19838459544f489))
* **ci:** 简化 npm 发布流程并修复依赖问题 ([#214](https://github.com/shenjingnan/xiaozhi-client/issues/214)) ([2c26cf5](https://github.com/shenjingnan/xiaozhi-client/commit/2c26cf5190222a8489da552f4bc19daa2d8b528c))
* **cli:** 修复CLI命令参数处理逻辑，解决--info和--version-info命令冲突问题 ([#174](https://github.com/shenjingnan/xiaozhi-client/issues/174)) ([16743ac](https://github.com/shenjingnan/xiaozhi-client/commit/16743ac9b1d52082d8dfddc0810b4b2712ce5db5))
* **cli:** 修复守护进程模式下的启动和日志管理问题 ([#175](https://github.com/shenjingnan/xiaozhi-client/issues/175)) ([aa2ac38](https://github.com/shenjingnan/xiaozhi-client/commit/aa2ac388f4264ef635e651c4bbdb93676c6a3f96))
* **config:** 修复配置初始化时模板文件路径问题和CLI命令参数处理 ([#173](https://github.com/shenjingnan/xiaozhi-client/issues/173)) ([35176d6](https://github.com/shenjingnan/xiaozhi-client/commit/35176d6e766b8ddf74ef4b9b61fd2a1d44b85d42))
* **config:** 移除自动重启逻辑并添加配置清理功能 ([#186](https://github.com/shenjingnan/xiaozhi-client/issues/186)) ([5123ba2](https://github.com/shenjingnan/xiaozhi-client/commit/5123ba2ee76a03b02c2293857bf724f0181be2a9))
* **docker:** 修复容器重启时的PID文件清理问题 ([#169](https://github.com/shenjingnan/xiaozhi-client/issues/169)) ([f5ef458](https://github.com/shenjingnan/xiaozhi-client/commit/f5ef45855f048c5065aa2fc19e2e3d30d441eeec))
* **docker:** 增强 Docker 容器的 Python 依赖管理功能 ([#178](https://github.com/shenjingnan/xiaozhi-client/issues/178)) ([5be9518](https://github.com/shenjingnan/xiaozhi-client/commit/5be95189eacaf26397bc559cb996b0bb65407d99))
* **mcp:** 修复MCP服务工具配置没有自动同步到配置文件的问题 ([#181](https://github.com/shenjingnan/xiaozhi-client/issues/181)) ([d6ee64b](https://github.com/shenjingnan/xiaozhi-client/commit/d6ee64b7f85caa03faa88ee8a07035b193b65c90))
* **proxy:** 修复小智连接工具调用中的ID类型处理问题 ([#172](https://github.com/shenjingnan/xiaozhi-client/issues/172)) ([0e95b30](https://github.com/shenjingnan/xiaozhi-client/commit/0e95b30dea113972ecb84daa53fe2820688b54d2))
* **release:** 优化 npm 发布配置和参数处理逻辑 ([#212](https://github.com/shenjingnan/xiaozhi-client/issues/212)) ([664801f](https://github.com/shenjingnan/xiaozhi-client/commit/664801f89cbb0519ed1f90ce30dc173f37712d99))
* **release:** 优化npm发布脚本的版本冲突处理机制 ([#213](https://github.com/shenjingnan/xiaozhi-client/issues/213)) ([cf5b487](https://github.com/shenjingnan/xiaozhi-client/commit/cf5b4872537ab2eba4ce9afb2abb129ba5b0c1bb))
* **services:** 过滤 getAllTools 方法只返回已启用的工具 ([#204](https://github.com/shenjingnan/xiaozhi-client/issues/204)) ([cc08817](https://github.com/shenjingnan/xiaozhi-client/commit/cc08817044844cfb275891006e05d5268af472ef))
* **test:** 修复 TypeScript 类型检查和测试用例问题 ([#177](https://github.com/shenjingnan/xiaozhi-client/issues/177)) ([957dfb1](https://github.com/shenjingnan/xiaozhi-client/commit/957dfb15aff6b22fc0b97bd37f710515e3e0f6f5))
* **tools:** 增强ProxyMCPServer工具调用功能 ([#170](https://github.com/shenjingnan/xiaozhi-client/issues/170)) ([324aa11](https://github.com/shenjingnan/xiaozhi-client/commit/324aa11c01ba93c83620f369d75d294b4115b98b))
* **workflow:** 优化发版流程的预演模式 ([#196](https://github.com/shenjingnan/xiaozhi-client/issues/196)) ([d11f3fd](https://github.com/shenjingnan/xiaozhi-client/commit/d11f3fd370aaf99a9cd0fe05195fd16d14b6e309))
* **workflow:** 修复 package.json 中的 bin 路径问题 ([#208](https://github.com/shenjingnan/xiaozhi-client/issues/208)) ([b0a7358](https://github.com/shenjingnan/xiaozhi-client/commit/b0a7358b88d152a15df7991b545e42c52fc49e7e))
* **workflow:** 修复发版Action报错 ([#207](https://github.com/shenjingnan/xiaozhi-client/issues/207)) ([22cc702](https://github.com/shenjingnan/xiaozhi-client/commit/22cc70219d1e7279e1be1b554e52a68b2537b6bd))
* **workflow:** 修复发版问题 ([#210](https://github.com/shenjingnan/xiaozhi-client/issues/210)) ([2d91df0](https://github.com/shenjingnan/xiaozhi-client/commit/2d91df0cd16a44e45dcb033e84e279101c0d4828))
* **workflow:** 修复由于 .release-it.json 中的 before:init 执行顺序导致发版失败 ([#206](https://github.com/shenjingnan/xiaozhi-client/issues/206)) ([7ef0440](https://github.com/shenjingnan/xiaozhi-client/commit/7ef044045edde0594e23f33bda4f23d805632231))

## [1.6.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.2...v1.6.3) (2025-08-21)

### Features

* 添加手动版本控制的发版脚本 ([#180](https://github.com/shenjingnan/xiaozhi-client/issues/180)) ([847a985](https://github.com/shenjingnan/xiaozhi-client/commit/847a985aa6fb2e73704bf1432c1a8a1e1f3e4c99))

### Bug Fixes

* **cli:** 修复CLI命令参数处理逻辑，解决--info和--version-info命令冲突问题 ([#174](https://github.com/shenjingnan/xiaozhi-client/issues/174)) ([16743ac](https://github.com/shenjingnan/xiaozhi-client/commit/16743ac9b1d52082d8dfddc0810b4b2712ce5db5))
* **cli:** 修复守护进程模式下的启动和日志管理问题 ([#175](https://github.com/shenjingnan/xiaozhi-client/issues/175)) ([aa2ac38](https://github.com/shenjingnan/xiaozhi-client/commit/aa2ac388f4264ef635e651c4bbdb93676c6a3f96))
* **config:** 修复配置初始化时模板文件路径问题和CLI命令参数处理 ([#173](https://github.com/shenjingnan/xiaozhi-client/issues/173)) ([35176d6](https://github.com/shenjingnan/xiaozhi-client/commit/35176d6e766b8ddf74ef4b9b61fd2a1d44b85d42))
* **docker:** 修复容器重启时的PID文件清理问题 ([#169](https://github.com/shenjingnan/xiaozhi-client/issues/169)) ([f5ef458](https://github.com/shenjingnan/xiaozhi-client/commit/f5ef45855f048c5065aa2fc19e2e3d30d441eeec))
* **docker:** 增强 Docker 容器的 Python 依赖管理功能 ([#178](https://github.com/shenjingnan/xiaozhi-client/issues/178)) ([5be9518](https://github.com/shenjingnan/xiaozhi-client/commit/5be95189eacaf26397bc559cb996b0bb65407d99))
* **mcp:** 修复MCP服务工具配置没有自动同步到配置文件的问题 ([#181](https://github.com/shenjingnan/xiaozhi-client/issues/181)) ([d6ee64b](https://github.com/shenjingnan/xiaozhi-client/commit/d6ee64b7f85caa03faa88ee8a07035b193b65c90))
* **proxy:** 修复小智连接工具调用中的ID类型处理问题 ([#172](https://github.com/shenjingnan/xiaozhi-client/issues/172)) ([0e95b30](https://github.com/shenjingnan/xiaozhi-client/commit/0e95b30dea113972ecb84daa53fe2820688b54d2))
* **test:** 修复 TypeScript 类型检查和测试用例问题 ([#177](https://github.com/shenjingnan/xiaozhi-client/issues/177)) ([957dfb1](https://github.com/shenjingnan/xiaozhi-client/commit/957dfb15aff6b22fc0b97bd37f710515e3e0f6f5))
* **tools:** 增强ProxyMCPServer工具调用功能 ([#170](https://github.com/shenjingnan/xiaozhi-client/issues/170)) ([324aa11](https://github.com/shenjingnan/xiaozhi-client/commit/324aa11c01ba93c83620f369d75d294b4115b98b))

## [1.6.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.1...v1.6.2) (2025-08-17)

### Bug Fixes

* resolve case sensitivity issue - rename webServer.test.ts to WebServer.test.ts ([94bab63](https://github.com/shenjingnan/xiaozhi-client/commit/94bab63302f0e75d6543712f9f8a9e1f344b5808))

## [1.6.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.6.0...v1.6.1) (2025-08-10)

### Bug Fixes

* **docker:** 移除Docker容器中的非root用户限制 ([#157](https://github.com/shenjingnan/xiaozhi-client/issues/157)) ([e1b95e4](https://github.com/shenjingnan/xiaozhi-client/commit/e1b95e461cbf37800788a2c47d25063e87ba5cb2))
## [1.6.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.5.1...v1.6.0) (2025-08-09)

### Features

* **ci/cd:** 分离 Docker 和 NPM 发布流程并优化部署体验 ([#156](https://github.com/shenjingnan/xiaozhi-client/issues/156)) ([e417b49](https://github.com/shenjingnan/xiaozhi-client/commit/e417b49e073d58a3cdd668fef8972a9c3f299f1c))
* **config:** 支持 JSON5 和 JSONC 配置文件格式 ([#129](https://github.com/shenjingnan/xiaozhi-client/issues/129)) ([81b9271](https://github.com/shenjingnan/xiaozhi-client/commit/81b92714ee86fc7271dbc54e06192d27e7f0f038))
* **config:** 添加 JSONC 配置文件注释保留功能 ([4084f8d](https://github.com/shenjingnan/xiaozhi-client/commit/4084f8d44b56117cf455a8037b68f33b884414e4))
* **config:** 添加ModelScope平台配置模板 ([#140](https://github.com/shenjingnan/xiaozhi-client/issues/140)) ([15466e2](https://github.com/shenjingnan/xiaozhi-client/commit/15466e241317557ffa3ebce5c8c157c270254365))
* **docker:** 优化 Docker 容器启动体验和持久化配置 ([#145](https://github.com/shenjingnan/xiaozhi-client/issues/145)) ([add7a11](https://github.com/shenjingnan/xiaozhi-client/commit/add7a11c57bcdb7f3ea863060e4826a5ebc75e3e))
* **docker:** 优化中国网络环境下的Docker构建和运行体验 ([#147](https://github.com/shenjingnan/xiaozhi-client/issues/147)) ([aaf4ac4](https://github.com/shenjingnan/xiaozhi-client/commit/aaf4ac46530589e7e198313f05446cdcecb6e566))
* **docker:** 实现 docker 容器化部署 ([#144](https://github.com/shenjingnan/xiaozhi-client/issues/144)) ([e95ae82](https://github.com/shenjingnan/xiaozhi-client/commit/e95ae82e4ea4a477289e5a027190719a494fb47e))
* **stats:** 添加MCP工具使用统计功能 ([#148](https://github.com/shenjingnan/xiaozhi-client/issues/148)) ([6a3adbe](https://github.com/shenjingnan/xiaozhi-client/commit/6a3adbe5cf0b41b72036011c9ef12d8cdad7164c))
* 重构 web 服务界面 ([#135](https://github.com/shenjingnan/xiaozhi-client/issues/135)) ([a63a3bf](https://github.com/shenjingnan/xiaozhi-client/commit/a63a3bf2d3d5b57bba5c2040608129551ccc0b41))

### Bug Fixes

* **config:** 修复JSON5配置文件格式保持功能 ([#139](https://github.com/shenjingnan/xiaozhi-client/issues/139)) ([2336487](https://github.com/shenjingnan/xiaozhi-client/commit/23364872c9cd23661d461f5e111db422cb5f4f42))
* **config:** 修复配置文件包含BOM字符导致解析失败的问题 ([#146](https://github.com/shenjingnan/xiaozhi-client/issues/146)) ([c9a979a](https://github.com/shenjingnan/xiaozhi-client/commit/c9a979a1d57e9dd4e4b320098c38d9c0cd050a4e))
* **docker:** 修复Docker镜像标签问题 ([#153](https://github.com/shenjingnan/xiaozhi-client/issues/153)) ([0ceff01](https://github.com/shenjingnan/xiaozhi-client/commit/0ceff0197ee55383f8afe91216923ee4c49ac7b4))
* **mcp-server:** 并行启动 MCP 代理和客户端以避免阻塞 ([#133](https://github.com/shenjingnan/xiaozhi-client/issues/133)) ([04a4369](https://github.com/shenjingnan/xiaozhi-client/commit/04a43695cc31b004378876b8a6e29700651b0137))
* 修复飞牛OS无法访问web服务的问题 ([#136](https://github.com/shenjingnan/xiaozhi-client/issues/136)) ([bfaf356](https://github.com/shenjingnan/xiaozhi-client/commit/bfaf3566ce97d153994da002800b4fb267d16480))
## [1.5.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.5.0...v1.5.1) (2025-07-24)

### Bug Fixes

* **deps:** 升级 form-data 到 v4.0.4 以解决安全问题 ([#128](https://github.com/shenjingnan/xiaozhi-client/issues/128)) ([d28595e](https://github.com/shenjingnan/xiaozhi-client/commit/d28595ef2bc9d5ebcdfa7fddf7896da2d02b7a25))
* 实现 MCP 服务配置同步清理功能 ([#125](https://github.com/shenjingnan/xiaozhi-client/issues/125)) ([d60b2c1](https://github.com/shenjingnan/xiaozhi-client/commit/d60b2c1fd8e86f5180a78d871b7e2ed682a9017d))
## [1.5.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.4.0...v1.5.0) (2025-07-21)

### Features

* **logging:** 增强工具调用日志记录功能 ([#117](https://github.com/shenjingnan/xiaozhi-client/issues/117)) ([4124721](https://github.com/shenjingnan/xiaozhi-client/commit/41247212e63dcb9ee1c55e0cacc7cd08638489b6))
* **mcp:** 支持多 MCP 端点配置和独立进程架构 ([#97](https://github.com/shenjingnan/xiaozhi-client/issues/97)) ([40f2dfd](https://github.com/shenjingnan/xiaozhi-client/commit/40f2dfdc9628c2c74faaef3ccb43d4839945ac7d))
* **mcp:** 添加 MCP Server 模式支持，允许作为标准 MCP Server 被 Cursor 等客户端使用 ([#96](https://github.com/shenjingnan/xiaozhi-client/issues/96)) ([c091a12](https://github.com/shenjingnan/xiaozhi-client/commit/c091a122334090c58c9db430eeeab13d14b89686))
* **mcp:** 添加 SSE 方式通信的 MCP 服务支持 ([#112](https://github.com/shenjingnan/xiaozhi-client/issues/112)) ([4c88a17](https://github.com/shenjingnan/xiaozhi-client/commit/4c88a17ec7a45163fbe8c41006e6c43c118bb52a))
* **mcp:** 添加 Streamable HTTP MCP 客户端支持 ([#99](https://github.com/shenjingnan/xiaozhi-client/issues/99)) ([6b63d89](https://github.com/shenjingnan/xiaozhi-client/commit/6b63d89ffdcb8f95d85cbfc470c9400be48f6aaf))
* **web:** 添加配置更新后自动重启服务功能 ([#103](https://github.com/shenjingnan/xiaozhi-client/issues/103)) ([fed508b](https://github.com/shenjingnan/xiaozhi-client/commit/fed508b4db52aca966441c32ca43665c5fa16ac8))

### Bug Fixes

* **cli:** 支持多实例并行运行 ([#98](https://github.com/shenjingnan/xiaozhi-client/issues/98)) ([67ed498](https://github.com/shenjingnan/xiaozhi-client/commit/67ed498ddabf959d587e07cb5a8009920cb15075))
* **mcp:** 优化错误重试机制和连接稳定性 ([#102](https://github.com/shenjingnan/xiaozhi-client/issues/102)) ([e49ff2f](https://github.com/shenjingnan/xiaozhi-client/commit/e49ff2f93d741c22127b2d4d479946180b8ef25c))
* **mcp:** 修复 Streamable HTTP MCP 服务工具列表不显示的问题 ([#107](https://github.com/shenjingnan/xiaozhi-client/issues/107)) ([0b54456](https://github.com/shenjingnan/xiaozhi-client/commit/0b54456d8e0551a40bcef783b0861c7e1a1d4bec))
* **mcp:** 修复SSE传输中GetLiveContext工具响应超时问题 ([#119](https://github.com/shenjingnan/xiaozhi-client/issues/119)) ([68c34cf](https://github.com/shenjingnan/xiaozhi-client/commit/68c34cfa175746397121f6530c00acc7efd0e313))
* **mcp:** 修复远端MCP服务工具配置不写入配置文件的问题 ([#106](https://github.com/shenjingnan/xiaozhi-client/issues/106)) ([d87ce90](https://github.com/shenjingnan/xiaozhi-client/commit/d87ce90975a1bfb6120b11b074d51e9251ba1bf6))
* 修复windows中使用ui命令报错 ([#105](https://github.com/shenjingnan/xiaozhi-client/issues/105)) ([aefd777](https://github.com/shenjingnan/xiaozhi-client/commit/aefd777bfb6c33f12e90a151e291ab383a6e5cbf))
## [1.4.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.3.0...v1.4.0) (2025-07-07)

### Features

* **build:** 支持发布 web 界面到 npm 包 ([#82](https://github.com/shenjingnan/xiaozhi-client/issues/82)) ([2cab860](https://github.com/shenjingnan/xiaozhi-client/commit/2cab860ee8063d672ea6eb562e6d914e1895a588))
* **cli:** 添加 --ui 参数支持同时启动 Web UI 服务 ([#86](https://github.com/shenjingnan/xiaozhi-client/issues/86)) ([f9420f5](https://github.com/shenjingnan/xiaozhi-client/commit/f9420f5bfbeda341b60da44f1fa6526070ab00d9))
* **ui:** 实现可视化配置管理网页 ([#78](https://github.com/shenjingnan/xiaozhi-client/issues/78)) ([14c5e06](https://github.com/shenjingnan/xiaozhi-client/commit/14c5e06d3d73309a99b645861b663a9a670f7ae4))
* **web-ui:** 支持动态配置 WebSocket 连接地址 ([#84](https://github.com/shenjingnan/xiaozhi-client/issues/84)) ([b93b617](https://github.com/shenjingnan/xiaozhi-client/commit/b93b617e5841c12f9b7ddef2f24d5d78fcb887c3))
* **webui:** 支持在配置文件中自定义 Web UI 端口号 ([#90](https://github.com/shenjingnan/xiaozhi-client/issues/90)) ([d2b492e](https://github.com/shenjingnan/xiaozhi-client/commit/d2b492ea4a5d28ba2ac1a41e22a8c89597e2ced3))

### Bug Fixes

* **logger:** 修复守护进程模式下 EPIPE 错误导致日志文件快速膨胀问题 ([#91](https://github.com/shenjingnan/xiaozhi-client/issues/91)) ([3eefc9a](https://github.com/shenjingnan/xiaozhi-client/commit/3eefc9a20976e1d9d5b181a7e7f9b90be26ad421))
* **web-ui:** 修复 Web UI 连接状态显示不准确的问题 ([#83](https://github.com/shenjingnan/xiaozhi-client/issues/83)) ([7efdb9e](https://github.com/shenjingnan/xiaozhi-client/commit/7efdb9ea0c8173c6d8fac9e8724629ba81405274))
* **web-ui:** 修复 WebSocket 日志噪音和退出卡顿问题 ([#87](https://github.com/shenjingnan/xiaozhi-client/issues/87)) ([5034dd9](https://github.com/shenjingnan/xiaozhi-client/commit/5034dd97de11f25b684767d26744d4c781b58c13))
## [1.3.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.2.0...v1.3.0) (2025-06-29)

### Features

* trigger release for new version ([ab57dbf](https://github.com/shenjingnan/xiaozhi-client/commit/ab57dbfb3ed800acb384424b9b0277deee7fd240))
## [1.2.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.10...v1.2.0) (2025-06-29)

### Features

* **mcp:** 集成 ModelScope MCP 服务支持 ([#76](https://github.com/shenjingnan/xiaozhi-client/issues/76)) ([b93fd35](https://github.com/shenjingnan/xiaozhi-client/commit/b93fd358dceb0480a76cc16d9cc9a2eb72ac4c1a))
* **release:** 调整语义化版本发布规则 ([#75](https://github.com/shenjingnan/xiaozhi-client/issues/75)) ([0f405e0](https://github.com/shenjingnan/xiaozhi-client/commit/0f405e0127ed3cea3ff1921ce5c567b4ed6c8552))
## [1.0.10](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.9...v1.0.10) (2025-06-23)

### Bug Fixes

* **mcp:** 修复windows环境中uvx mcp无法使用的问题 ([#73](https://github.com/shenjingnan/xiaozhi-client/issues/73)) ([d44e24e](https://github.com/shenjingnan/xiaozhi-client/commit/d44e24e59af7bfcd16623a5a8286ab3d05124d64))
## [1.0.9](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.8...v1.0.9) (2025-06-23)

### Features

* **ci:** 实现 PR 合并后自动发布正式版 ([#74](https://github.com/shenjingnan/xiaozhi-client/issues/74)) ([70b03b8](https://github.com/shenjingnan/xiaozhi-client/commit/70b03b8b07e883adcad4a54e12135178b48b87fc))
## [1.0.8](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.7...v1.0.8) (2025-06-23)

### Features

* **logger:** 实现基于consola的日志系统 ([#71](https://github.com/shenjingnan/xiaozhi-client/issues/71)) ([0ec753d](https://github.com/shenjingnan/xiaozhi-client/commit/0ec753d9c72056e1e0d9b334662f40ee279d9e26))
## [1.0.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.6...v1.0.7) (2025-06-20)

### Features

* **config:** 实现心跳检测和连接配置的可配置化 ([#70](https://github.com/shenjingnan/xiaozhi-client/issues/70)) ([82d4f5d](https://github.com/shenjingnan/xiaozhi-client/commit/82d4f5db7c4a3e6d77b76c61139860584d1c2acf))
* **connection:** 优化断线重连机制和后台运行稳定性 ([#68](https://github.com/shenjingnan/xiaozhi-client/issues/68)) ([45b7cc8](https://github.com/shenjingnan/xiaozhi-client/commit/45b7cc813bb815e90c39186d56596fd9edd6e030))
## [1.0.6](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.5...v1.0.6) (2025-06-19)

### Bug Fixes

* **release:** 修复beta版本发布配置和版本号问题 ([#67](https://github.com/shenjingnan/xiaozhi-client/issues/67)) ([5389e6b](https://github.com/shenjingnan/xiaozhi-client/commit/5389e6b219919b23fe76209c90986a14cbd4f570))
## [1.0.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-beta.1...v1.0.5) (2025-06-19)

### Bug Fixes

* **completion:** 修复并重构CLI自动完成功能实现 ([#65](https://github.com/shenjingnan/xiaozhi-client/issues/65)) ([b94aca9](https://github.com/shenjingnan/xiaozhi-client/commit/b94aca970626166e1ef4ab9584c2086cef5ea7d8))
* **release:** 添加缺失的semantic-release依赖包 ([#66](https://github.com/shenjingnan/xiaozhi-client/issues/66)) ([d84b0b5](https://github.com/shenjingnan/xiaozhi-client/commit/d84b0b559e84c55e6a2fc8ec5cef74da528c67d8))
## [1.1.0-beta.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.19...v1.1.0-beta.1) (2025-06-19)

### Features

* **ci:** 实现手动触发发版workflow支持stable和beta版本选择 ([#61](https://github.com/shenjingnan/xiaozhi-client/issues/61)) ([6ecef26](https://github.com/shenjingnan/xiaozhi-client/commit/6ecef2650827e51f2f525fcc4deb4050ce07cd6e))

### Bug Fixes

* **release:** 修复next分支无法发布beta版本的问题 ([#63](https://github.com/shenjingnan/xiaozhi-client/issues/63)) ([7e81526](https://github.com/shenjingnan/xiaozhi-client/commit/7e81526c1d23ad5cf7e15f5a69b67e7b3a6ba400))
## [1.1.0-next.19](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.18...v1.1.0-next.19) (2025-06-18)

### Bug Fixes

* **cli:** 修复windows环境下无法找到npx命令的问题 ([#57](https://github.com/shenjingnan/xiaozhi-client/issues/57)) ([0ff64fc](https://github.com/shenjingnan/xiaozhi-client/commit/0ff64fc5e38c42dbf89a5dc61e977c6da86ae465))
## [1.1.0-next.18](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.17...v1.1.0-next.18) (2025-06-18)

### Features

* **ci:** 添加多平台多版本矩阵测试支持 ([#54](https://github.com/shenjingnan/xiaozhi-client/issues/54)) ([c661569](https://github.com/shenjingnan/xiaozhi-client/commit/c6615691d773475574bf78e8d525aacb9e417819))
## [1.1.0-next.17](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.16...v1.1.0-next.17) (2025-06-18)

### Bug Fixes

* **cli:** 修复在windows环境中的cli报错 ([#53](https://github.com/shenjingnan/xiaozhi-client/issues/53)) ([022e8b6](https://github.com/shenjingnan/xiaozhi-client/commit/022e8b6ae66d84d100b1a137981ff6d9f25f84b4))
## [1.1.0-next.16](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.15...v1.1.0-next.16) (2025-06-17)

### Features

* **build:** 完成ESM模块系统迁移并启用bundling ([#52](https://github.com/shenjingnan/xiaozhi-client/issues/52)) ([4204bde](https://github.com/shenjingnan/xiaozhi-client/commit/4204bde5803dce50febfc2054c6afca3a0b48e34))
## [1.1.0-next.15](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.14...v1.1.0-next.15) (2025-06-17)

### Bug Fixes

* **cli:** 修复ESM环境下模板路径解析问题 ([#51](https://github.com/shenjingnan/xiaozhi-client/issues/51)) ([98b8b56](https://github.com/shenjingnan/xiaozhi-client/commit/98b8b56426ebcdccb4e79d803ea984a5602f33ff))
## [1.1.0-next.14](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.13...v1.1.0-next.14) (2025-06-17)

### Features

* **build:** 项目产物从 CommonJS 迁移到 ESM ([#50](https://github.com/shenjingnan/xiaozhi-client/issues/50)) ([944cc98](https://github.com/shenjingnan/xiaozhi-client/commit/944cc98ff4d701b3e5ddc0484fef2574106f8165))
## [1.1.0-next.13](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.12...v1.1.0-next.13) (2025-06-17)

### Bug Fixes

* **cli:** 修复和改进自动补全脚本生成功能 ([#49](https://github.com/shenjingnan/xiaozhi-client/issues/49)) ([7f8d8bc](https://github.com/shenjingnan/xiaozhi-client/commit/7f8d8bc22b51d545c0b14f756f6039c7808ea7ad))
## [1.1.0-next.12](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.11...v1.1.0-next.12) (2025-06-17)

### Bug Fixes

* **cli:** 修复自动补全模块导入路径缺少文件扩展名 ([#48](https://github.com/shenjingnan/xiaozhi-client/issues/48)) ([0e6aee4](https://github.com/shenjingnan/xiaozhi-client/commit/0e6aee49b69cd87ea6f1969861a8edc156b3435f))
## [1.1.0-next.11](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.10...v1.1.0-next.11) (2025-06-17)

### Features

* **ci:** 添加代码质量检查工具和 CI 流程 ([#47](https://github.com/shenjingnan/xiaozhi-client/issues/47)) ([3b24747](https://github.com/shenjingnan/xiaozhi-client/commit/3b24747f625e667c3f1afee1e6b59ed960854d6c))
## [1.1.0-next.10](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.9...v1.1.0-next.10) (2025-06-16)

### Features

* **cli:** 优化表格布局 ([#43](https://github.com/shenjingnan/xiaozhi-client/issues/43)) ([7d2bfce](https://github.com/shenjingnan/xiaozhi-client/commit/7d2bfce245a78a7b5748c3368e0b4486088a036e))
## [1.1.0-next.9](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.8...v1.1.0-next.9) (2025-06-16)

### Features

* **cli:** 改进服务工具列表显示格式和中文字符处理 ([#41](https://github.com/shenjingnan/xiaozhi-client/issues/41)) ([28cc0cf](https://github.com/shenjingnan/xiaozhi-client/commit/28cc0cf26bc9174c679a63a8d8398b28bcea22c9))
## [1.1.0-next.8](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.4...v1.1.0-next.8) (2025-06-16)

### Features

* **ci:** 增强语义化发布配置并添加分支同步工作流 ([#40](https://github.com/shenjingnan/xiaozhi-client/issues/40)) ([35d7117](https://github.com/shenjingnan/xiaozhi-client/commit/35d71178ea5026b0401df147ba496aff9f2f612a))
## [1.1.0-next.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.6...v1.1.0-next.7) (2025-06-15)
## [1.1.0-next.6](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.3...v1.1.0-next.6) (2025-06-15)

### Features

* **templates:** 修复模板文件的 ES 模块兼容性问题 ([#34](https://github.com/shenjingnan/xiaozhi-client/issues/34)) ([378c1bf](https://github.com/shenjingnan/xiaozhi-client/commit/378c1bfd7e6632ca9bda1204c85b0010ff6615c4))
## [1.1.0-next.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.2...v1.1.0-next.5) (2025-06-14)

### Features

* **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([d1950fc](https://github.com/shenjingnan/xiaozhi-client/commit/d1950fcb979d6771cd1cf4262476d1f45ef6053e))
## [1.0.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.7...v1.0.4) (2025-06-15)

### Features

* **templates:** 修复模板文件的 ES 模块兼容性问题 ([#39](https://github.com/shenjingnan/xiaozhi-client/issues/39)) ([d4a266b](https://github.com/shenjingnan/xiaozhi-client/commit/d4a266b15212a539b630259ce4110719707c2df1))
## [1.1.0-next.7](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.6...v1.1.0-next.7) (2025-06-15)
## [1.0.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.5...v1.0.3) (2025-06-14)

### Features

* **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([#33](https://github.com/shenjingnan/xiaozhi-client/issues/33)) ([a905bdb](https://github.com/shenjingnan/xiaozhi-client/commit/a905bdbd9923ea0d7334d9d8275ed5bba4dc37e9))
## [1.0.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.4...v1.0.2) (2025-06-14)
## [1.1.0-next.6](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.3...v1.1.0-next.6) (2025-06-15)

### Features

* **templates:** 修复模板文件的 ES 模块兼容性问题 ([#34](https://github.com/shenjingnan/xiaozhi-client/issues/34)) ([378c1bf](https://github.com/shenjingnan/xiaozhi-client/commit/378c1bfd7e6632ca9bda1204c85b0010ff6615c4))
## [1.1.0-next.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.2...v1.1.0-next.5) (2025-06-14)

### Features

* **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([d1950fc](https://github.com/shenjingnan/xiaozhi-client/commit/d1950fcb979d6771cd1cf4262476d1f45ef6053e))
## [1.0.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.5...v1.0.3) (2025-06-14)

### Features

* **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([#33](https://github.com/shenjingnan/xiaozhi-client/issues/33)) ([a905bdb](https://github.com/shenjingnan/xiaozhi-client/commit/a905bdbd9923ea0d7334d9d8275ed5bba4dc37e9))
## [1.0.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.4...v1.0.2) (2025-06-14)
## [1.1.0-next.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.2...v1.1.0-next.5) (2025-06-14)

### Features

* **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([d1950fc](https://github.com/shenjingnan/xiaozhi-client/commit/d1950fcb979d6771cd1cf4262476d1f45ef6053e))
## [1.0.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.4...v1.0.2) (2025-06-14)
## [1.1.0-next.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.3...v1.1.0-next.4) (2025-06-14)

### Features

* **ci:** 集成 Codecov 代码覆盖率报告 ([#24](https://github.com/shenjingnan/xiaozhi-client/issues/24)) ([0500866](https://github.com/shenjingnan/xiaozhi-client/commit/05008666a706ac3fc9e5bedc4d20be05258f1928))
## [1.1.0-next.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.2...v1.1.0-next.3) (2025-06-14)

### Features

* **release:** 增强语义化发布配置和规则 ([#22](https://github.com/shenjingnan/xiaozhi-client/issues/22)) ([b010246](https://github.com/shenjingnan/xiaozhi-client/commit/b010246d62984651e9099393b72ddbdbe3542d6b))
## [1.1.0-next.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.1...v1.1.0-next.2) (2025-06-14)

### Features

* **ci:** 添加 next 分支预发布支持和增强发布流程 ([#17](https://github.com/shenjingnan/xiaozhi-client/issues/17)) ([#19](https://github.com/shenjingnan/xiaozhi-client/issues/19)) ([db10935](https://github.com/shenjingnan/xiaozhi-client/commit/db109352082f3ddfbbb82080ea5f4a89a6137887))
## [1.1.0-next.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.1...v1.1.0-next.1) (2025-06-14)

### Features

* **ci:** 添加 next 分支预发布支持和增强发布流程 ([#17](https://github.com/shenjingnan/xiaozhi-client/issues/17)) ([c156904](https://github.com/shenjingnan/xiaozhi-client/commit/c15690427fbef51b8e935cd9295da3b125debf03))
## [1.0.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.0...v1.0.1) (2025-06-14)

### Bug Fixes

* **ci:** 修复发布工作流包管理器不一致问题 ([#14](https://github.com/shenjingnan/xiaozhi-client/issues/14)) ([9d8d38e](https://github.com/shenjingnan/xiaozhi-client/commit/9d8d38e741976ec7b224e9b100530b165b81c147))
## [1.0.0](https://github.com/shenjingnan/xiaozhi-client/compare/4b7da6e28d05da60b86f373f69c7460dbaa4c2c1...v1.0.0) (2025-06-14)

### Features

* **cli:** 添加项目模板创建功能 ([612f445](https://github.com/shenjingnan/xiaozhi-client/commit/612f445155d49d9c10be1eda2ee6255c6c1ca708))
* **mcp:** 改进 MCP 服务器执行环境和版本管理 ([6097369](https://github.com/shenjingnan/xiaozhi-client/commit/6097369c1dda2845ab0c20bba755e55b3deec2cf))
* **mcp:** 添加 MCP 工具管理功能 ([#10](https://github.com/shenjingnan/xiaozhi-client/issues/10)) ([5fc784f](https://github.com/shenjingnan/xiaozhi-client/commit/5fc784fb91fba07f13269db4d334ead8dd81433b))
* **mcp:** 添加工具名称前缀机制解决冲突问题 ([#6](https://github.com/shenjingnan/xiaozhi-client/issues/6)) ([50983aa](https://github.com/shenjingnan/xiaozhi-client/commit/50983aa422f85f7c572ce4c2eca08ca0786e43c0))
* **tooling:** 集成 Biome 代码格式化工具并统一代码风格 ([27eb2b9](https://github.com/shenjingnan/xiaozhi-client/commit/27eb2b94a288f124c136abfca343aca12e54851e))

### Bug Fixes

* 修复配置文件路径问题，改为从当前工作目录读取配置文件 ([4b7da6e](https://github.com/shenjingnan/xiaozhi-client/commit/4b7da6e28d05da60b86f373f69c7460dbaa4c2c1))
