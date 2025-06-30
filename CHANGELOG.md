# [1.3.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.2.0...v1.3.0) (2025-06-29)


### Features

* trigger release for new version ([ab57dbf](https://github.com/shenjingnan/xiaozhi-client/commit/ab57dbfb3ed800acb384424b9b0277deee7fd240))

# [1.1.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.10...v1.1.0) (2025-06-29)


### Features

* **mcp:** 集成 ModelScope MCP 服务支持 ([#76](https://github.com/shenjingnan/xiaozhi-client/issues/76)) ([b93fd35](https://github.com/shenjingnan/xiaozhi-client/commit/b93fd358dceb0480a76cc16d9cc9a2eb72ac4c1a))
* **release:** 调整语义化版本发布规则 ([#75](https://github.com/shenjingnan/xiaozhi-client/issues/75)) ([0f405e0](https://github.com/shenjingnan/xiaozhi-client/commit/0f405e0127ed3cea3ff1921ce5c567b4ed6c8552))

# [1.1.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.10...v1.1.0) (2025-06-23)


### Features

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

## [1.0.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.4...v1.0.5) (2025-06-19)


### Bug Fixes

* **cli:** 修复ESM环境下模板路径解析问题 ([#51](https://github.com/shenjingnan/xiaozhi-client/issues/51)) ([98b8b56](https://github.com/shenjingnan/xiaozhi-client/commit/98b8b56426ebcdccb4e79d803ea984a5602f33ff))
* **cli:** 修复windows环境下无法找到npx命令的问题 ([#57](https://github.com/shenjingnan/xiaozhi-client/issues/57)) ([0ff64fc](https://github.com/shenjingnan/xiaozhi-client/commit/0ff64fc5e38c42dbf89a5dc61e977c6da86ae465))
* **cli:** 修复和改进自动补全脚本生成功能 ([#49](https://github.com/shenjingnan/xiaozhi-client/issues/49)) ([7f8d8bc](https://github.com/shenjingnan/xiaozhi-client/commit/7f8d8bc22b51d545c0b14f756f6039c7808ea7ad))
* **cli:** 修复在windows环境中的cli报错 ([#53](https://github.com/shenjingnan/xiaozhi-client/issues/53)) ([022e8b6](https://github.com/shenjingnan/xiaozhi-client/commit/022e8b6ae66d84d100b1a137981ff6d9f25f84b4))
* **cli:** 修复自动补全模块导入路径缺少文件扩展名 ([#48](https://github.com/shenjingnan/xiaozhi-client/issues/48)) ([0e6aee4](https://github.com/shenjingnan/xiaozhi-client/commit/0e6aee49b69cd87ea6f1969861a8edc156b3435f))
* **completion:** 修复并重构CLI自动完成功能实现 ([#65](https://github.com/shenjingnan/xiaozhi-client/issues/65)) ([b94aca9](https://github.com/shenjingnan/xiaozhi-client/commit/b94aca970626166e1ef4ab9584c2086cef5ea7d8))
* **release:** 修复next分支无法发布beta版本的问题 ([#63](https://github.com/shenjingnan/xiaozhi-client/issues/63)) ([7e81526](https://github.com/shenjingnan/xiaozhi-client/commit/7e81526c1d23ad5cf7e15f5a69b67e7b3a6ba400))
* **release:** 添加缺失的semantic-release依赖包 ([#66](https://github.com/shenjingnan/xiaozhi-client/issues/66)) ([d84b0b5](https://github.com/shenjingnan/xiaozhi-client/commit/d84b0b559e84c55e6a2fc8ec5cef74da528c67d8))


### Features

* **build:** 完成ESM模块系统迁移并启用bundling ([#52](https://github.com/shenjingnan/xiaozhi-client/issues/52)) ([4204bde](https://github.com/shenjingnan/xiaozhi-client/commit/4204bde5803dce50febfc2054c6afca3a0b48e34))
* **build:** 项目产物从 CommonJS 迁移到 ESM ([#50](https://github.com/shenjingnan/xiaozhi-client/issues/50)) ([944cc98](https://github.com/shenjingnan/xiaozhi-client/commit/944cc98ff4d701b3e5ddc0484fef2574106f8165))
* **ci:** 增强语义化发布配置并添加分支同步工作流 ([#40](https://github.com/shenjingnan/xiaozhi-client/issues/40)) ([35d7117](https://github.com/shenjingnan/xiaozhi-client/commit/35d71178ea5026b0401df147ba496aff9f2f612a))
* **ci:** 实现手动触发发版workflow支持stable和beta版本选择 ([#61](https://github.com/shenjingnan/xiaozhi-client/issues/61)) ([6ecef26](https://github.com/shenjingnan/xiaozhi-client/commit/6ecef2650827e51f2f525fcc4deb4050ce07cd6e))
* **ci:** 添加代码质量检查工具和 CI 流程 ([#47](https://github.com/shenjingnan/xiaozhi-client/issues/47)) ([3b24747](https://github.com/shenjingnan/xiaozhi-client/commit/3b24747f625e667c3f1afee1e6b59ed960854d6c))
* **ci:** 添加多平台多版本矩阵测试支持 ([#54](https://github.com/shenjingnan/xiaozhi-client/issues/54)) ([c661569](https://github.com/shenjingnan/xiaozhi-client/commit/c6615691d773475574bf78e8d525aacb9e417819))
* **cli:** 优化表格布局 ([#43](https://github.com/shenjingnan/xiaozhi-client/issues/43)) ([7d2bfce](https://github.com/shenjingnan/xiaozhi-client/commit/7d2bfce245a78a7b5748c3368e0b4486088a036e))
* **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([d1950fc](https://github.com/shenjingnan/xiaozhi-client/commit/d1950fcb979d6771cd1cf4262476d1f45ef6053e))
* **cli:** 改进服务工具列表显示格式和中文字符处理 ([#41](https://github.com/shenjingnan/xiaozhi-client/issues/41)) ([28cc0cf](https://github.com/shenjingnan/xiaozhi-client/commit/28cc0cf26bc9174c679a63a8d8398b28bcea22c9))
* **templates:** 修复模板文件的 ES 模块兼容性问题 ([#34](https://github.com/shenjingnan/xiaozhi-client/issues/34)) ([378c1bf](https://github.com/shenjingnan/xiaozhi-client/commit/378c1bfd7e6632ca9bda1204c85b0010ff6615c4))

## [1.1.0](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.4...v1.1.0) (2025-06-18)

### Features

## [1.0.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.3...v1.0.4) (2025-06-15)


### Features

* **templates:** 修复模板文件的 ES 模块兼容性问题 ([#39](https://github.com/shenjingnan/xiaozhi-client/issues/39)) ([d4a266b](https://github.com/shenjingnan/xiaozhi-client/commit/d4a266b15212a539b630259ce4110719707c2df1))


## [1.0.3](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.2...v1.0.3) (2025-06-14)


### Features

* **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([#33](https://github.com/shenjingnan/xiaozhi-client/issues/33)) ([a905bdb](https://github.com/shenjingnan/xiaozhi-client/commit/a905bdbd9923ea0d7334d9d8275ed5bba4dc37e9))

# [1.1.0-next.5](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.4...v1.1.0-next.5) (2025-06-14)


### Features

* **cli:** 实现动态版本号读取机制 ([#29](https://github.com/shenjingnan/xiaozhi-client/issues/29)) ([d1950fc](https://github.com/shenjingnan/xiaozhi-client/commit/d1950fcb979d6771cd1cf4262476d1f45ef6053e))

## [1.0.2](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.1...v1.0.2) (2025-06-14)


### Features

* **ci:** 添加 next 分支预发布支持和增强发布流程 ([#17](https://github.com/shenjingnan/xiaozhi-client/issues/17)) ([c156904](https://github.com/shenjingnan/xiaozhi-client/commit/c15690427fbef51b8e935cd9295da3b125debf03))
* **ci:** 添加 next 分支预发布支持和增强发布流程 ([#17](https://github.com/shenjingnan/xiaozhi-client/issues/17)) ([#19](https://github.com/shenjingnan/xiaozhi-client/issues/19)) ([db10935](https://github.com/shenjingnan/xiaozhi-client/commit/db109352082f3ddfbbb82080ea5f4a89a6137887))
* **ci:** 集成 Codecov 代码覆盖率报告 ([#24](https://github.com/shenjingnan/xiaozhi-client/issues/24)) ([0500866](https://github.com/shenjingnan/xiaozhi-client/commit/05008666a706ac3fc9e5bedc4d20be05258f1928))
* **release:** 增强语义化发布配置和规则 ([#22](https://github.com/shenjingnan/xiaozhi-client/issues/22)) ([b010246](https://github.com/shenjingnan/xiaozhi-client/commit/b010246d62984651e9099393b72ddbdbe3542d6b))

# [1.1.0-next.4](https://github.com/shenjingnan/xiaozhi-client/compare/v1.1.0-next.3...v1.1.0-next.4) (2025-06-14)


### Features

* **ci:** 添加 next 分支预发布支持和增强发布流程 ([#17](https://github.com/shenjingnan/xiaozhi-client/issues/17)) ([c156904](https://github.com/shenjingnan/xiaozhi-client/commit/c15690427fbef51b8e935cd9295da3b125debf03))
* **ci:** 添加 next 分支预发布支持和增强发布流程 ([#17](https://github.com/shenjingnan/xiaozhi-client/issues/17)) ([#19](https://github.com/shenjingnan/xiaozhi-client/issues/19)) ([db10935](https://github.com/shenjingnan/xiaozhi-client/commit/db109352082f3ddfbbb82080ea5f4a89a6137887))
* **ci:** 集成 Codecov 代码覆盖率报告 ([#24](https://github.com/shenjingnan/xiaozhi-client/issues/24)) ([0500866](https://github.com/shenjingnan/xiaozhi-client/commit/05008666a706ac3fc9e5bedc4d20be05258f1928))
* **release:** 增强语义化发布配置和规则 ([#22](https://github.com/shenjingnan/xiaozhi-client/issues/22)) ([b010246](https://github.com/shenjingnan/xiaozhi-client/commit/b010246d62984651e9099393b72ddbdbe3542d6b))


## [1.0.1](https://github.com/shenjingnan/xiaozhi-client/compare/v1.0.0...v1.0.1) (2025-06-14)


### Bug Fixes

* **ci:** 修复发布工作流包管理器不一致问题 ([#14](https://github.com/shenjingnan/xiaozhi-client/issues/14)) ([9d8d38e](https://github.com/shenjingnan/xiaozhi-client/commit/9d8d38e741976ec7b224e9b100530b165b81c147))

# 1.0.0 (2025-06-14)


### Bug Fixes

* 修复配置文件路径问题，改为从当前工作目录读取配置文件 ([4b7da6e](https://github.com/shenjingnan/xiaozhi-client/commit/4b7da6e28d05da60b86f373f69c7460dbaa4c2c1))


### Features

* **cli:** 添加项目模板创建功能 ([612f445](https://github.com/shenjingnan/xiaozhi-client/commit/612f445155d49d9c10be1eda2ee6255c6c1ca708))
* **mcp:** 改进 MCP 服务器执行环境和版本管理 ([6097369](https://github.com/shenjingnan/xiaozhi-client/commit/6097369c1dda2845ab0c20bba755e55b3deec2cf))
* **mcp:** 添加 MCP 工具管理功能 ([#10](https://github.com/shenjingnan/xiaozhi-client/issues/10)) ([5fc784f](https://github.com/shenjingnan/xiaozhi-client/commit/5fc784fb91fba07f13269db4d334ead8dd81433b))
* **mcp:** 添加工具名称前缀机制解决冲突问题 ([#6](https://github.com/shenjingnan/xiaozhi-client/issues/6)) ([50983aa](https://github.com/shenjingnan/xiaozhi-client/commit/50983aa422f85f7c572ce4c2eca08ca0786e43c0))
* **tooling:** 集成 Biome 代码格式化工具并统一代码风格 ([27eb2b9](https://github.com/shenjingnan/xiaozhi-client/commit/27eb2b94a288f124c136abfca343aca12e54851e))
