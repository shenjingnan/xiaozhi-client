#!/bin/bash
set -euo pipefail

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

log "Xiaozhi Client Docker 容器启动中..."

# 检查工作目录初始化状态
log "检查工作目录初始化状态..."

# 检查关键配置文件是否存在
if [ ! -f "/workspaces/xiaozhi.config.json" ] || [ ! -f "/workspaces/package.json" ]; then
    log "初始化工作目录..."
    log "将模板文件复制到 ~/xiaozhi-client (挂载到 /workspaces)"

    # 确保目录存在
    mkdir -p /workspaces

    # 复制模板文件到工作目录
    if ! cp -r /templates-backup/* /workspaces/; then
        log "错误: 复制模板文件失败"
        exit 1
    fi

    log "工作目录初始化完成"
    log "配置文件位置: ~/xiaozhi-client/xiaozhi.config.json"
else
    log "工作目录已存在配置文件，跳过初始化"
fi

# 确保依赖已安装
cd /workspaces
if [ ! -d "node_modules" ]; then
    log "安装项目依赖..."
    if ! npm install; then
        log "错误: 依赖安装失败"
        exit 1
    fi
    log "依赖安装完成"
else
    log "依赖已存在，跳过安装"
fi

# 清理可能存在的旧 PID 文件（容器重启时）
log "清理容器启动前的状态..."
if [ -f "/workspaces/.xiaozhi-client.pid" ]; then
    log "发现旧的 PID 文件，正在清理..."
    rm -f "/workspaces/.xiaozhi-client.pid"
    log "旧 PID 文件已清理"
fi

# 清理其他可能的 PID 文件
find /workspaces -name "*.pid" -type f -delete 2>/dev/null || true

log "启动 xiaozhi-client..."
exec "$@"
