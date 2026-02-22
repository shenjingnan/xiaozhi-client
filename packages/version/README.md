# @xiaozhi-client/version

> 小智客户端版本管理工具，提供版本号获取、比较、验证等功能

[![npm version](https://badge.fury.io/js/%40xiaozhi-client%2Fversion.svg)](https://www.npmjs.com/package/@xiaozhi-client/version)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 简介

`@xiaozhi-client/version` 是一个轻量级的版本管理工具库，提供：

- **版本号获取** - 支持构建时注入和运行时读取两种方式
- **版本比较** - 语义化版本号比较功能
- **版本验证** - 验证版本号格式是否符合语义化版本规范
- **零依赖** - 无任何外部依赖
- **TypeScript** - 完整的类型定义支持

## 特性

### 核心功能

- **版本号常量** - `VERSION` 和 `APP_NAME` 常量，构建时自动注入
- **运行时读取** - 支持从 `package.json` 动态读取版本信息
- **版本比较** - 支持语义化版本号比较（如 `1.2.3` vs `1.2.4`）
- **格式验证** - 验证版本号是否符合语义化版本规范
- **缓存机制** - 内置缓存提升性能

## 安装

```bash
# 使用 npm
npm install @xiaozhi-client/version

# 使用 pnpm
pnpm add @xiaozhi-client/version

# 使用 yarn
yarn add @xiaozhi-client/version
```

## 快速开始

### 使用版本常量

```typescript
import { VERSION, APP_NAME } from '@xiaozhi-client/version';

console.log(`应用名称: ${APP_NAME}`);
console.log(`版本号: ${VERSION}`);
// 输出: 应用名称: xiaozhi-client
// 输出: 版本号: 1.10.9
```

### 使用 VersionUtils

#### 获取版本信息

```typescript
import { VersionUtils } from '@xiaozhi-client/version';

// 获取版本号
const version = VersionUtils.getVersion();
console.log(`当前版本: ${version}`);

// 获取完整版本信息
const versionInfo = VersionUtils.getVersionInfo();
console.log(versionInfo);
// 输出: {
//   version: '1.10.9',
//   name: 'xiaozhi-client',
//   description: '小智 AI 客户端',
//   author: 'shenjingnan'
// }
```

#### 比较版本号

```typescript
import { VersionUtils } from '@xiaozhi-client/version';

const result = VersionUtils.compareVersions('1.2.3', '1.2.4');

if (result === 1) {
  console.log('第一个版本更新');
} else if (result === -1) {
  console.log('第二个版本更新');
} else {
  console.log('版本相同');
}
```

#### 验证版本格式

```typescript
import { VersionUtils } from '@xiaozhi-client/version';

// 验证标准版本号
console.log(VersionUtils.isValidVersion('1.2.3'));        // true
console.log(VersionUtils.isValidVersion('1.2.3-alpha'));   // true
console.log(VersionUtils.isValidVersion('1.2.3-beta.1'));  // true
console.log(VersionUtils.isValidVersion('1.2.3+build.1')); // true
console.log(VersionUtils.isValidVersion('invalid'));       // false
```

#### 清除缓存

```typescript
import { VersionUtils } from '@xiaozhi-client/version';

// 清除版本缓存（主要用于测试场景）
VersionUtils.clearCache();

// 重新获取版本信息
const freshVersion = VersionUtils.getVersion();
```

## API 参考

### 常量

#### VERSION

当前版本号常量，构建时自动注入。

```typescript
declare const VERSION: string;
```

#### APP_NAME

应用名称常量，构建时自动注入。

```typescript
declare const APP_NAME: string;
```

### VersionUtils 类

版本工具类，提供静态方法用于版本管理。

#### getVersion()

获取当前版本号。

```typescript
static getVersion(): string
```

**返回值**: 版本号字符串

**说明**:
- 优先使用构建时注入的版本号
- 如果是占位符，则运行时从 `package.json` 读取
- 内置缓存机制，重复调用不会重复读取

#### getVersionInfo()

获取完整版本信息。

```typescript
static getVersionInfo(): VersionInfo
```

**返回值**: 版本信息对象

```typescript
interface VersionInfo {
  version: string;        // 版本号
  name?: string;          // 应用名称
  description?: string;   // 应用描述
  author?: string;        // 作者信息
}
```

#### compareVersions()

比较两个版本号。

```typescript
static compareVersions(version1: string, version2: string): number
```

**参数**:
- `version1` - 第一个版本号
- `version2` - 第二个版本号

**返回值**:
- `1` - version1 > version2
- `-1` - version1 < version2
- `0` - 版本相等

**示例**:
```typescript
VersionUtils.compareVersions('1.2.3', '1.2.4');  // -1
VersionUtils.compareVersions('1.2.4', '1.2.3');  // 1
VersionUtils.compareVersions('1.2.3', '1.2.3');  // 0
VersionUtils.compareVersions('1.10.0', '1.2.0'); // 1
```

#### isValidVersion()

检查版本号格式是否有效。

```typescript
static isValidVersion(version: string): boolean
```

**参数**:
- `version` - 版本号字符串

**返回值**: 是否为有效的语义化版本号

**支持的格式**:
- 标准版本号: `1.2.3`
- 带预发布标识: `1.2.3-alpha`, `1.2.3-beta.1`
- 带构建元数据: `1.2.3+build.123`
- 完整格式: `1.2.3-alpha.1+build.123`

#### clearCache()

清除版本缓存。

```typescript
static clearCache(): void
```

**说明**: 主要用于测试场景，清除后下次调用会重新读取版本信息。

## 类型定义

### VersionInfo

版本信息接口。

```typescript
interface VersionInfo {
  version: string;        // 版本号（必需）
  name?: string;          // 应用名称（可选）
  description?: string;   // 应用描述（可选）
  author?: string;        // 作者信息（可选）
}
```

## 使用场景

### 检查版本更新

```typescript
import { VersionUtils } from '@xiaozhi-client/version';

async function checkForUpdates() {
  const currentVersion = VersionUtils.getVersion();
  const latestVersion = await fetchLatestVersion();

  if (VersionUtils.compareVersions(latestVersion, currentVersion) === 1) {
    console.log('发现新版本，请更新！');
    showUpdateNotification(latestVersion);
  }
}
```

### 版本兼容性检查

```typescript
import { VersionUtils } from '@xiaozhi-client/version';

function checkCompatibility(requiredVersion: string): boolean {
  const currentVersion = VersionUtils.getVersion();

  if (!VersionUtils.isValidVersion(requiredVersion)) {
    throw new Error('无效的版本号格式');
  }

  return VersionUtils.compareVersions(currentVersion, requiredVersion) >= 0;
}

// 使用示例
if (checkCompatibility('1.10.0')) {
  console.log('版本兼容，可以继续');
} else {
  console.log('版本过低，请升级');
}
```

### CLI 版本显示

```typescript
import { VERSION, APP_NAME, VersionUtils } from '@xiaozhi-client/version';

function showVersion() {
  const info = VersionUtils.getVersionInfo();

  console.log(`${info.name} v${info.version}`);
  if (info.description) {
    console.log(info.description);
  }
  if (info.author) {
    console.log(`作者: ${info.author}`);
  }
}

// 输出示例:
// xiaozhi-client v1.10.9
// 小智 AI 客户端
// 作者: shenjingnan
```

## 版本号注入机制

本包支持两种版本号获取方式：

### 构建时注入（推荐）

构建时通过 `tsup` 的 `define` 选项注入版本号：

```typescript
// tsup.config.ts
{
  define: {
    __VERSION__: `"${packageJson.version}"`,
    __APP_NAME__: `"${packageJson.name}"`
  }
}
```

优点：
- 构建后版本号固定
- 无运行时文件读取开销
- 适合生产环境

### 运行时读取

如果构建时未注入版本号，包会自动从 `package.json` 读取：

```typescript
// 逻辑：VERSION === "__VERSION__" → 运行时读取
```

优点：
- 开发环境方便
- 无需额外配置

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/shenjingnan/xiaozhi-client.git
cd xiaozhi-client/packages/version

# 安装依赖
pnpm install

# 构建
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm type-check
```

### 构建产物

```bash
dist/
├── index.js           # ESM 格式的编译产物
├── index.d.ts         # TypeScript 类型声明
└── index.js.map       # Source Map
```

## 常见问题

### Q: 如何获取当前运行时的版本号？

A: 使用 `VersionUtils.getVersion()` 方法：

```typescript
const version = VersionUtils.getVersion();
```

### Q: 如何比较两个版本号？

A: 使用 `VersionUtils.compareVersions()` 方法：

```typescript
const result = VersionUtils.compareVersions('1.2.3', '1.2.4');
// result: -1 (表示 1.2.3 < 1.2.4)
```

### Q: 为什么版本号是 `__VERSION__` 占位符？

A: 这表示构建时未正确注入版本号。请检查 `tsup.config.ts` 中的 `define` 配置，或使用运行时读取模式。

### Q: 版本号是否支持预发布标识？

A: 验证功能支持预发布标识格式（如 `1.2.3-alpha`），但比较功能仅比较数字部分。

## 许可证

[MIT](LICENSE)

## 相关资源

- [小智客户端](https://github.com/shenjingnan/xiaozhi-client)
- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [问题反馈](https://github.com/shenjingnan/xiaozhi-client/issues)

---

**作者**: xiaozhi-client
**版本**: 1.10.9
