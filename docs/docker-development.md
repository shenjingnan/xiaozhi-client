# Docker 开发环境使用指南

本文档介绍如何使用 Docker 进行 xiaozhi-client 的开发和测试。

## 概述

项目现在支持两种 Docker 构建模式：

1. **开发模式** (`--dev`): 使用本地代码构建，适用于开发和测试本地修改
2. **生产模式** (`--prod`): 使用 npm 正式版本，适用于测试发布版本

## 快速开始

### 方式一：使用开发环境管理脚本（推荐）

```bash
# 构建开发镜像
./scripts/docker-dev.sh build

# 启动开发容器
./scripts/docker-dev.sh start

# 查看状态
./scripts/docker-dev.sh status

# 查看日志
./scripts/docker-dev.sh logs -f

# 进入容器调试
./scripts/docker-dev.sh shell

# 停止容器
./scripts/docker-dev.sh stop
```

### 方式二：使用测试脚本

#### 开发模式测试

使用本地代码构建和测试：

```bash
# 完整的开发模式测试
./scripts/docker-test.sh --dev

# 只构建开发镜像
./scripts/docker-test.sh --dev --build-only

# 开发模式测试并进入调试
./scripts/docker-test.sh --dev --debug
```

#### 生产模式测试

使用 npm 正式版本测试（默认模式）：

```bash
# 完整的生产模式测试
./scripts/docker-test.sh

# 或者显式指定生产模式
./scripts/docker-test.sh --prod

# 只构建生产镜像
./scripts/docker-test.sh --prod --build-only
```

### 方式三：使用 Docker Compose

```bash
# 开发环境
docker-compose -f docker-compose.dev.yml up -d

# 生产环境
docker-compose up -d
```

## 构建模式详解

### 开发模式 (`--dev`)

**特点：**
- 使用当前工作目录的本地源码
- 在容器内安装依赖并构建项目
- 全局安装本地构建的包
- 环境变量 `NODE_ENV=development`

**适用场景：**
- 测试本地代码修改
- 验证新功能
- 调试问题

**构建过程：**
1. 复制 `package.json` 和 `pnpm-lock.yaml`
2. 安装项目依赖（包括 devDependencies）
3. 复制源码和配置文件
4. 执行 `pnpm run build` 构建项目
5. 使用 `npm install -g .` 全局安装本地包

### 生产模式 (`--prod`)

**特点：**
- 使用 `npm install -g xiaozhi-client` 安装正式版本
- 不包含源码和构建工具
- 镜像体积更小
- 环境变量 `NODE_ENV=production`

**适用场景：**
- 测试发布版本
- 生产环境部署
- 性能测试

## 文件说明

### Dockerfile

多阶段构建的 Dockerfile，包含以下阶段：

- `base`: 基础环境，安装系统依赖
- `development`: 开发阶段，构建本地代码
- `production`: 生产阶段，安装 npm 正式版本
- `dev`: 开发环境最终阶段
- 默认阶段: 生产环境最终阶段

### .dockerignore 文件

- `.dockerignore`: 生产模式使用，排除源码和开发文件
- `.dockerignore.dev`: 开发模式使用，保留源码和构建配置

## 常用命令

```bash
# 查看帮助
./scripts/docker-test.sh --help

# 清理测试环境
./scripts/docker-test.sh --cleanup

# 查看容器日志
docker logs -f xiaozhi-test    # 生产模式
docker logs -f xiaozhi-dev     # 开发模式

# 进入容器调试
docker exec -it xiaozhi-test sh    # 生产模式
docker exec -it xiaozhi-dev sh     # 开发模式

# 停止容器
docker stop xiaozhi-test      # 生产模式
docker stop xiaozhi-dev       # 开发模式
```

## 故障排除

### 构建失败

1. 检查本地代码是否能正常构建：
   ```bash
   pnpm install
   pnpm run build
   ```

2. 清理 Docker 缓存：
   ```bash
   docker system prune -f
   ```

3. 查看构建日志：
   ```bash
   ./scripts/docker-test.sh --dev --build-only
   ```

### 容器启动失败

1. 查看容器日志：
   ```bash
   docker logs xiaozhi-dev
   ```

2. 检查端口占用：
   ```bash
   lsof -i :9999
   lsof -i :3000
   ```

3. 进入容器调试：
   ```bash
   docker exec -it xiaozhi-dev sh
   xiaozhi --version
   ```

## 最佳实践

1. **开发时使用开发模式**：确保测试的是最新的本地代码
2. **发布前使用生产模式**：验证 npm 包的正确性
3. **定期清理**：使用 `--cleanup` 选项清理测试环境
4. **查看日志**：遇到问题时及时查看容器日志

## 注意事项

1. 开发模式构建时间较长，因为需要安装依赖和构建项目
2. 生产模式依赖 npm 上的正式版本，确保版本已发布
3. 两种模式使用不同的镜像名称和容器名称，可以同时存在
4. 修改本地代码后，需要重新构建开发镜像才能生效
