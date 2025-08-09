#!/bin/bash

# Xiaozhi Client Docker 启动脚本
# 使用改进的挂载点配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
CONTAINER_NAME="xiaozhi-client"
IMAGE_NAME="shenjingnan/xiaozhi-client"
WORKSPACE_DIR="$HOME/xiaozhi-client"
WEB_PORT="9999"
HTTP_PORT="3000"

echo -e "${BLUE}🚀 Xiaozhi Client Docker 启动脚本${NC}"
echo "=================================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

# 创建工作目录
echo -e "${YELLOW}📁 创建工作目录: $WORKSPACE_DIR${NC}"
mkdir -p "$WORKSPACE_DIR"

# 停止并删除已存在的容器
if docker ps -a --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo -e "${YELLOW}🛑 停止并删除已存在的容器${NC}"
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# 拉取最新镜像
echo -e "${YELLOW}📥 拉取最新镜像${NC}"
docker pull "$IMAGE_NAME"

# 启动容器
echo -e "${YELLOW}🚀 启动 Xiaozhi Client 容器${NC}"
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$WEB_PORT:9999" \
    -p "$HTTP_PORT:3000" \
    -v "$WORKSPACE_DIR:/workspaces" \
    --restart unless-stopped \
    "$IMAGE_NAME"

# 等待容器启动
echo -e "${YELLOW}⏳ 等待容器启动...${NC}"
sleep 3

# 检查容器状态
if docker ps --format 'table {{.Names}}' | grep -q "^$CONTAINER_NAME$"; then
    echo -e "${GREEN}✅ 容器启动成功！${NC}"
    echo ""
    echo "📋 服务信息:"
    echo "  • Web UI: http://localhost:$WEB_PORT"
    echo "  • HTTP Server: http://localhost:$HTTP_PORT"
    echo "  • 工作目录: $WORKSPACE_DIR"
    echo "  • 配置文件: $WORKSPACE_DIR/xiaozhi.config.json"
    echo ""
    echo "🔧 常用命令:"
    echo "  • 查看日志: docker logs -f $CONTAINER_NAME"
    echo "  • 停止服务: docker stop $CONTAINER_NAME"
    echo "  • 重启服务: docker restart $CONTAINER_NAME"
    echo ""
    echo -e "${GREEN}🎉 现在可以访问 http://localhost:$WEB_PORT 开始配置！${NC}"
else
    echo -e "${RED}❌ 容器启动失败${NC}"
    echo "查看错误日志:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi
