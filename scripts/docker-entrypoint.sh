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

# 确保 Node.js 依赖已安装
cd /workspaces
if [ ! -d "node_modules" ]; then
    log "安装 Node.js 项目依赖..."
    if ! npm install; then
        log "错误: Node.js 依赖安装失败"
        exit 1
    fi
    log "Node.js 依赖安装完成"
else
    log "Node.js 依赖已存在，跳过安装"
fi

# 动态安装 Python 依赖
log "检查 Python 依赖..."
install_python_dependencies() {
    local requirements_file="$1"
    local requirements_name="$2"

    if [ -f "$requirements_file" ]; then
        # 检查文件是否有非注释、非空行的内容
        if grep -v '^#' "$requirements_file" | grep -v '^$' | head -1 > /dev/null 2>&1; then
            log "发现 $requirements_name 文件，开始安装 Python 依赖..."

            # 确保使用虚拟环境
            export PATH="/opt/venv/bin:$PATH"

            # 显示将要安装的包（仅非注释行）
            log "将要安装的包："
            grep -v '^#' "$requirements_file" | grep -v '^$' | while read -r line; do
                log "  - $line"
            done

            # 安装依赖
            if pip install -r "$requirements_file"; then
                log "✓ Python 依赖安装成功"

                # 记录安装的包版本（用于调试）
                log "已安装的 Python 包版本："
                pip list | grep -E "(mcp|fastmcp|httpx|websockets|pydantic)" | while read -r line; do
                    log "  $line"
                done
            else
                log "⚠️  警告: Python 依赖安装失败，但容器将继续启动"
                log "请检查 $requirements_name 文件中的包名和版本是否正确"
                return 1
            fi
        else
            log "$requirements_name 文件存在但为空或只包含注释，跳过安装"
        fi
    else
        log "$requirements_name 文件不存在，跳过 Python 依赖安装"
    fi
}

# 安装用户自定义的 Python 依赖（优先级更高）
install_python_dependencies "/workspaces/requirements.txt" "用户自定义 requirements.txt"

# 如果用户没有自定义 requirements.txt，则检查是否需要安装默认依赖
if [ ! -f "/workspaces/requirements.txt" ]; then
    log "未找到用户自定义 requirements.txt，检查是否需要安装默认 Python 依赖..."

    # 检查是否已经安装了基本的 MCP 包
    export PATH="/opt/venv/bin:$PATH"
    if ! python -c "import mcp" 2>/dev/null; then
        log "检测到 MCP 包未安装，将从模板安装默认依赖..."
        if [ -f "/templates-backup/requirements.txt" ]; then
            install_python_dependencies "/templates-backup/requirements.txt" "默认模板 requirements.txt"
        fi
    else
        log "MCP 包已安装，跳过默认依赖安装"
    fi
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
