# Xiaozhi Client

小智AI客户端，目前主要用于MCP的对接

![效果图](./docs/preview.png)

## 开发环境

本项目使用 TypeScript 开发，需要先编译后运行。

### 安装依赖

```bash
pnpm install
```

### 编译项目

```bash
pnpm run build
```

### 开发模式

```bash
pnpm run dev  # 监听文件变化并自动编译
```

### 可用脚本

- `pnpm run build` - 编译 TypeScript 代码到 dist/ 目录
- `pnpm run dev` - 开发模式，监听文件变化
- `pnpm run clean` - 清理编译输出
- `pnpm run type-check` - 仅进行类型检查，不生成文件
- `pnpm run start` - 编译并启动服务

## 使用方法

编译完成后，可以使用以下命令：

```bash
# 查看帮助
node bin/xiaozhi --help

# 配置端点
node bin/xiaozhi set-config xiaozhi.endpoint=wss://your-endpoint

# 查看配置
node bin/xiaozhi get-config

# 启动服务
node bin/xiaozhi start

# 查看服务状态
node bin/xiaozhi status
```
