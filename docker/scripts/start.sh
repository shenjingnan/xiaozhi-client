#!/bin/bash

# Xiaozhi Client Docker 启动脚本
# 使用改进的挂载点配置，支持自定义镜像版本

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
IMAGE_TAG="latest"  # 默认版本，可通过参数覆盖
WORKSPACE_DIR="$HOME/xiaozhi-client"
WEB_PORT="9999"
HTTP_PORT="3000"

# 显示帮助信息
show_help() {
    echo -e "${BLUE}Xiaozhi Client Docker 启动脚本${NC}"
    echo "=================================="
    echo ""
    echo "使用方法:"
    echo "  $0                        # 使用默认版本 (latest)"
    echo "  $0 <version>              # 通过位置参数指定版本号"
    echo "  $0 --version <version>    # 通过命名参数指定版本号"
    echo "  $0 --help|-h              # 显示此帮助信息"
    echo ""
    echo "版本号格式示例:"
    echo "  • 语义化版本: v1.2.3, 1.2.3"
    echo "  • 预发布版本: v1.2.3-alpha, v1.2.3-beta.1"
    echo "  • 特殊标签: latest, stable, dev, main"
    echo "  • Git commit: abc123f"
    echo ""
    echo "使用示例:"
    echo "  $0                        # 使用 latest 版本"
    echo "  $0 v1.2.3                 # 使用 v1.2.3 版本"
    echo "  $0 --version stable       # 使用 stable 版本"
    echo ""
}

# 验证版本号格式
validate_version() {
    local version="$1"

    # 允许的格式：
    # 1. 语义化版本：v1.2.3, 1.2.3 (可选的v前缀，可选的预发布标识和构建元数据)
    # 2. 特殊标签：latest, stable, dev, main
    # 3. Git commit hash：6-40位十六进制字符
    if [[ "$version" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9\.-]+)?(\+[a-zA-Z0-9\.-]+)?$ ]] || \
       [[ "$version" =~ ^(latest|stable|dev|main)$ ]] || \
       [[ "$version" =~ ^[a-f0-9]{6,40}$ ]]; then
        return 0
    else
        return 1
    fi
}

# 参数解析
IMAGE_TAG_SET=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --version)
            if [[ -n "$2" && ! "$2" =~ ^- ]]; then
                IMAGE_TAG="$2"
                IMAGE_TAG_SET=true
                shift 2
            else
                echo -e "${RED}❌ 错误：--version 参数需要指定版本号${NC}"
                echo ""
                show_help
                exit 1
            fi
            ;;
        -*)
            echo -e "${RED}❌ 错误：未知参数 $1${NC}"
            echo ""
            show_help
            exit 1
            ;;
        *)
            # 位置参数
            if [[ "$IMAGE_TAG_SET" == "false" ]]; then
                IMAGE_TAG="$1"
                IMAGE_TAG_SET=true
                shift
            else
                echo -e "${RED}❌ 错误：只能指定一个版本号${NC}"
                echo ""
                show_help
                exit 1
            fi
            ;;
    esac
done

# 验证版本号格式
if ! validate_version "$IMAGE_TAG"; then
    echo -e "${RED}❌ 错误：无效的版本号格式: $IMAGE_TAG${NC}"
    echo ""
    echo "支持的版本号格式："
    echo "  • 语义化版本: v1.2.3, 1.2.3"
    echo "  • 预发布版本: v1.2.3-alpha, v1.2.3-beta.1"
    echo "  • 特殊标签: latest, stable, dev, main"
    echo "  • Git commit: abc123f"
    echo ""
    show_help
    exit 1
fi



echo -e "${BLUE}🚀 Xiaozhi Client Docker 启动脚本${NC}"
echo "=================================="
echo -e "${BLUE}📦 使用镜像版本: ${GREEN}$IMAGE_TAG${NC}"
echo ""

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

# 拉取指定版本的镜像
echo -e "${YELLOW}📥 拉取镜像: $IMAGE_NAME:$IMAGE_TAG${NC}"
docker pull "$IMAGE_NAME:$IMAGE_TAG"

# 启动容器
echo -e "${YELLOW}🚀 启动 Xiaozhi Client 容器${NC}"
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "0.0.0.0:$WEB_PORT:9999" \
    -p "[::]:$WEB_PORT:9999" \
    -p "0.0.0.0:$HTTP_PORT:3000" \
    -p "[::]:$HTTP_PORT:3000" \
    -v "$WORKSPACE_DIR:/workspaces" \
    --restart unless-stopped \
    "$IMAGE_NAME:$IMAGE_TAG"

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
