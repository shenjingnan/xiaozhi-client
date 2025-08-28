# Xiaozhi Client 部署指南

本文档提供 Xiaozhi Client 的详细部署指南，包括本地部署、Docker 部署和远程服务器部署。

## 🚀 快速开始

### 一键部署（推荐）

我们提供了一键部署脚本，自动完成环境配置和项目部署：

**Linux/macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/cfy114514/xiaozhi-client/main/quick-deploy.sh | bash
```

**Windows:**
```cmd
curl -O https://raw.githubusercontent.com/cfy114514/xiaozhi-client/main/quick-deploy.bat
quick-deploy.bat
```

## 📋 部署方式对比

| 部署方式 | 适用场景 | 优势 | 劣势 |
|---------|----------|------|------|
| **本地部署** | 开发测试 | 配置灵活，调试方便 | 需要安装依赖 |
| **Docker部署** | 生产环境 | 环境隔离，易于管理 | 需要Docker环境 |
| **源码部署** | 定制开发 | 可修改源码，功能扩展 | 构建时间较长 |

## 🖥️ 本地部署

### 环境要求
- Node.js 18 或更高版本
- npm 或 pnpm 包管理器

### 部署步骤

1. **安装 xiaozhi-client**
   ```bash
   npm install -g xiaozhi-client
   ```

2. **初始化项目**
   ```bash
   mkdir my-xiaozhi && cd my-xiaozhi
   xiaozhi config init
   ```

3. **配置接入点**
   ```bash
   xiaozhi config set mcpEndpoint "your-endpoint-url"
   ```

4. **启动服务**
   ```bash
   xiaozhi start
   ```

## 🐳 Docker 部署

### 环境要求
- Docker Engine
- Docker Compose (可选)

### 快速启动

**方式一：使用启动脚本**
```bash
curl -fsSL https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docker-start.sh | bash
```

**方式二：手动启动**
```bash
# 创建工作目录
mkdir -p ~/xiaozhi-client

# 运行容器
docker run -d \
  --name xiaozhi-client \
  -p 9999:9999 \
  -p 3000:3000 \
  -v ~/xiaozhi-client:/workspaces \
  --restart unless-stopped \
  shenjingnan/xiaozhi-client:latest
```

### Docker Compose 部署

1. **下载配置文件**
   ```bash
   curl -O https://raw.githubusercontent.com/shenjingnan/xiaozhi-client/main/docker-compose.yml
   ```

2. **启动服务**
   ```bash
   docker-compose up -d
   ```

## 🌐 远程服务器部署

### 服务器要求
- Ubuntu 18.04+ / CentOS 7+ / Debian 9+
- 至少 512MB RAM
- 至少 1GB 存储空间
- 网络访问权限

### 部署步骤

1. **连接服务器**
   ```bash
   ssh username@your-server-ip
   ```

2. **运行一键部署脚本**
   ```bash
   # 本地部署
   curl -fsSL https://raw.githubusercontent.com/cfy114514/xiaozhi-client/main/quick-deploy.sh | bash

   # 或 Docker 部署
   curl -fsSL https://raw.githubusercontent.com/cfy114514/xiaozhi-client/main/quick-deploy.sh | bash -s docker
   ```

3. **配置防火墙**
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 9999

   # CentOS/RHEL
   sudo firewall-cmd --permanent --add-port=9999/tcp
   sudo firewall-cmd --reload
   ```

4. **访问 Web 界面**
   ```
   http://your-server-ip:9999
   ```

## 🔐 安全配置

### 默认认证信息
- **用户名**: admin
- **密码**: xiaozhi123

### 修改管理员密码

编辑配置文件 `xiaozhi.config.json`:
```json
{
  "webUI": {
    "auth": {
      "enabled": true,
      "admin": {
        "username": "admin",
        "password": "your-new-password"
      }
    }
  }
}
```

### 禁用认证（仅本地开发）
```json
{
  "webUI": {
    "auth": {
      "enabled": false
    }
  }
}
```

## 🔧 配置管理

### 配置文件位置
- **本地部署**: `./xiaozhi.config.json`
- **Docker部署**: `~/xiaozhi-client/xiaozhi.config.json`

### 常用配置

```json
{
  "mcpEndpoint": "wss://api.xiaozhi.me/mcp/your-endpoint",
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": ["./mcpServers/calculator.js"]
    }
  },
  "webUI": {
    "port": 9999,
    "auth": {
      "enabled": true,
      "admin": {
        "username": "admin",
        "password": "xiaozhi123"
      }
    }
  }
}
```

## 📊 监控和维护

### 查看服务状态

**本地部署:**
```bash
xiaozhi status
```

**Docker部署:**
```bash
docker logs -f xiaozhi-client
```

### 重启服务

**本地部署:**
```bash
xiaozhi restart
```

**Docker部署:**
```bash
docker restart xiaozhi-client
```

### 备份配置

```bash
# 备份配置文件
cp xiaozhi.config.json xiaozhi.config.json.backup

# 或使用时间戳
cp xiaozhi.config.json xiaozhi.config.json.$(date +%Y%m%d_%H%M%S)
```

## 🐛 故障排除

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   lsof -i :9999
   
   # 或修改配置文件中的端口
   "webUI": { "port": 8080 }
   ```

2. **容器启动失败**
   ```bash
   # 查看容器日志
   docker logs xiaozhi-client
   
   # 检查容器状态
   docker ps -a
   ```

3. **配置文件格式错误**
   ```bash
   # 验证JSON格式
   cat xiaozhi.config.json | python -m json.tool
   ```

### 获取帮助

- 查看一键部署脚本帮助: `./quick-deploy.sh --help`
- 查看命令行帮助: `xiaozhi --help`
- 提交问题: [GitHub Issues](https://github.com/cfy114514/xiaozhi-client/issues)

## 📝 更新日志

### v1.6.3
- ✅ 新增 Web 管理界面认证功能
- ✅ 新增一键部署脚本
- ✅ 改进安全性和易用性

### 升级指南

**本地部署升级:**
```bash
npm update -g xiaozhi-client
```

**Docker部署升级:**
```bash
docker pull shenjingnan/xiaozhi-client:latest
docker restart xiaozhi-client
```
