# Python 依赖管理指南

xiaozhi-client Docker 容器支持动态 Python 依赖管理，让你可以轻松添加和管理 Python 包，特别适用于 MCP (Model Context Protocol) 服务器开发。

## 🚀 快速开始

### 1. 创建自定义依赖文件

在你的挂载目录（通常是 `~/xiaozhi-client/`）中创建 `requirements.txt` 文件：

```bash
# 在主机上创建文件
echo "mcp-proxy>=0.8.2" > ~/xiaozhi-client/requirements.txt
```

### 2. 重启容器

```bash
docker restart xiaozhi-client
```

容器启动时会自动检测并安装新的依赖包。

## 📋 工作原理

### 依赖安装优先级

1. **用户自定义** (`~/xiaozhi-client/requirements.txt`) - 最高优先级
2. **默认模板** (`templates/docker/requirements.txt`) - 仅在用户未自定义时使用

### 安装流程

容器启动时会按以下顺序执行：

1. 检查 `/workspaces/requirements.txt`（用户自定义文件）
2. 如果存在且包含有效内容，安装用户依赖
3. 如果不存在，检查是否需要安装默认依赖
4. 所有依赖都安装在 Python 虚拟环境中（`/opt/venv`）

## 📝 使用示例

### 示例 1：添加 MCP 相关包

```bash
# ~/xiaozhi-client/requirements.txt
mcp-proxy>=0.8.2
mcp-server-git>=0.1.0
```

### 示例 2：添加数据科学包

```bash
# ~/xiaozhi-client/requirements.txt
numpy>=1.24.0
pandas>=2.0.0
matplotlib>=3.7.0
```

### 示例 3：添加 Web 开发包

```bash
# ~/xiaozhi-client/requirements.txt
fastapi>=0.104.0
uvicorn>=0.24.0
sqlalchemy>=2.0.0
```

### 示例 4：完整的 MCP 服务器依赖

```bash
# ~/xiaozhi-client/requirements.txt
# MCP 核心
mcp>=1.13.0
fastmcp>=2.11.0

# 网络通信
httpx>=0.27.0
websockets>=12.0

# 数据处理
pydantic>=2.11.0
python-dotenv>=1.0.0

# 自定义包
mcp-proxy>=0.8.2
openai>=1.0.0
```

## 🔧 高级用法

### 版本固定

```bash
# 固定特定版本
mcp==1.13.0
fastmcp==2.11.0

# 版本范围
httpx>=0.27.0,<1.0.0
pydantic>=2.11.0,<3.0.0
```

### 从 Git 安装

```bash
# 从 GitHub 安装开发版本
git+https://github.com/user/repo.git
git+https://github.com/user/repo.git@branch_name
```

### 可选依赖

```bash
# 安装包的可选依赖
fastapi[all]>=0.104.0
httpx[http2]>=0.27.0
```

## 🐛 故障排除

### 查看安装日志

容器启动时会显示详细的安装日志：

```bash
docker logs xiaozhi-client
```

### 常见问题

#### 1. 依赖安装失败

**症状**：容器启动时显示警告信息
**解决**：
- 检查包名拼写是否正确
- 确认版本号是否存在
- 查看完整错误日志

#### 2. 包版本冲突

**症状**：安装过程中出现依赖冲突
**解决**：
- 使用兼容的版本范围
- 移除冲突的包
- 使用虚拟环境隔离

#### 3. 网络连接问题

**症状**：下载包时超时
**解决**：
- 容器已配置清华大学 PyPI 镜像源
- 检查网络连接
- 重试安装

### 手动安装包

如果需要在运行中的容器内手动安装包：

```bash
# 进入容器
docker exec -it xiaozhi-client bash

# 激活虚拟环境并安装
source /opt/venv/bin/activate
pip install package_name
```

## 📚 默认预装包

容器默认包含以下 MCP 开发常用包：

- `mcp` - 官方 MCP Python SDK
- `fastmcp` - 高级 MCP 框架
- `httpx` - 现代 HTTP 客户端
- `websockets` - WebSocket 支持
- `pydantic` - 数据验证
- `python-dotenv` - 环境变量管理
- `aiofiles` - 异步文件操作

完整列表请查看 `templates/docker/requirements.txt`。

## 🔄 更新依赖

### 更新单个包

```bash
# 修改 requirements.txt 中的版本号
mcp>=1.14.0  # 从 1.13.0 更新到 1.14.0

# 重启容器
docker restart xiaozhi-client
```

### 批量更新

```bash
# 在容器内手动更新
docker exec -it xiaozhi-client bash
source /opt/venv/bin/activate
pip install --upgrade -r requirements.txt
```

## 💡 最佳实践

1. **版本管理**：使用版本范围而不是固定版本，确保兼容性
2. **依赖分组**：在 requirements.txt 中使用注释分组相关依赖
3. **测试验证**：添加新依赖后测试 MCP 服务器功能
4. **备份配置**：定期备份 requirements.txt 文件
5. **最小化原则**：只安装必需的包，避免臃肿

## 🔗 相关链接

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [FastMCP 文档](https://gofastmcp.com/)
- [Python 包索引 (PyPI)](https://pypi.org/)
- [pip 用户指南](https://pip.pypa.io/en/stable/user_guide/)
