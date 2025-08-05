# Xiaozhi Client Docker 部署指南

本文档介绍如何使用 Docker 容器化部署 xiaozhi-client 项目。

## 📋 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 至少 1GB 可用内存
- 至少 2GB 可用磁盘空间

## 🚀 快速开始

### 1. 生产环境部署

```bash
# 克隆项目
git clone <repository-url>
cd xiaozhi-client

# 创建配置目录
mkdir -p config logs

# 构建并启动服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f xiaozhi-client
```

### 2. 开发环境部署

```bash
# 使用开发配置启动
docker-compose -f docker-compose.dev.yml up -d

# 查看开发服务状态
docker-compose -f docker-compose.dev.yml ps
```

## 🔧 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `production` | 运行环境 |
| `XIAOZHI_CONFIG_DIR` | `/app/config` | 配置文件目录 |
| `XIAOZHI_LOG_DIR` | `/app/logs` | 日志文件目录 |
| `XIAOZHI_WEB_PORT` | `3000` | Web 界面端口 |
| `XIAOZHI_MCP_PORT` | `8080` | MCP 服务端口 |

### 端口映射

- `3000`: Web 配置管理界面
- `8080`: MCP 服务端口
- `5173`: 开发环境 Vite 服务器端口

### 数据持久化

项目使用以下目录进行数据持久化：

- `./config`: 配置文件存储
- `./logs`: 日志文件存储

## 📝 常用命令

### 构建镜像

```bash
# 构建生产镜像
docker build -t xiaozhi-client:latest .

# 构建开发镜像
docker build --target builder -t xiaozhi-client:dev .
```

### 服务管理

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 进入容器
docker-compose exec xiaozhi-client sh
```

### 镜像管理

```bash
# 查看镜像
docker images | grep xiaozhi-client

# 删除镜像
docker rmi xiaozhi-client:latest

# 清理未使用的镜像
docker image prune
```

## 🔍 故障排除

### 常见问题

1. **容器启动失败**
   ```bash
   # 查看详细日志
   docker-compose logs xiaozhi-client
   
   # 检查容器状态
   docker-compose ps
   ```

2. **端口冲突**
   ```bash
   # 修改 docker-compose.yml 中的端口映射
   ports:
     - "3001:3000"  # 将本地端口改为 3001
   ```

3. **配置文件问题**
   ```bash
   # 检查配置目录权限
   ls -la config/
   
   # 重新创建配置目录
   sudo chown -R 1001:1001 config/
   ```

### 健康检查

```bash
# 检查容器健康状态
docker-compose ps

# 手动执行健康检查
docker-compose exec xiaozhi-client node dist/cli.js --version
```

## 🛡️ 安全建议

1. **使用非 root 用户运行**
   - 容器内使用 `xiaozhi` 用户（UID: 1001）

2. **资源限制**
   - 内存限制：512MB
   - CPU 限制：0.5 核心

3. **网络安全**
   - 使用自定义网络隔离
   - 只暴露必要的端口

4. **数据安全**
   - 配置文件挂载为只读（如需要）
   - 定期备份配置和日志

## 📊 监控和日志

### 日志管理

```bash
# 查看实时日志
docker-compose logs -f xiaozhi-client

# 查看最近 100 行日志
docker-compose logs --tail=100 xiaozhi-client

# 导出日志
docker-compose logs xiaozhi-client > xiaozhi.log
```

### 性能监控

```bash
# 查看容器资源使用情况
docker stats xiaozhi-client

# 查看容器详细信息
docker inspect xiaozhi-client
```

## 🔄 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并部署
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 清理旧镜像
docker image prune
```

## 📞 支持

如果遇到问题，请：

1. 查看本文档的故障排除部分
2. 检查项目的 GitHub Issues
3. 提交新的 Issue 并附上详细的错误日志
