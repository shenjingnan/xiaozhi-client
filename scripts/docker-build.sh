#!/bin/bash

# Xiaozhi Client Docker 构建脚本
# 用法: ./scripts/docker-build.sh [production|development]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        exit 1
    fi
    
    log_success "Docker 环境检查通过"
}

# 构建生产镜像
build_production() {
    log_info "开始构建生产环境镜像..."
    
    # 构建镜像
    docker build \
        --target production \
        --tag xiaozhi-client:latest \
        --tag xiaozhi-client:$(date +%Y%m%d-%H%M%S) \
        .
    
    log_success "生产环境镜像构建完成"
    
    # 显示镜像信息
    docker images | grep xiaozhi-client
}

# 构建开发镜像
build_development() {
    log_info "开始构建开发环境镜像..."
    
    # 构建镜像
    docker build \
        --target builder \
        --tag xiaozhi-client:dev \
        --tag xiaozhi-client:dev-$(date +%Y%m%d-%H%M%S) \
        .
    
    log_success "开发环境镜像构建完成"
    
    # 显示镜像信息
    docker images | grep xiaozhi-client
}

# 清理旧镜像
cleanup_images() {
    log_info "清理未使用的镜像..."
    
    # 删除悬空镜像
    docker image prune -f
    
    # 可选：删除超过 7 天的旧镜像
    # docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | grep xiaozhi-client
    
    log_success "镜像清理完成"
}

# 主函数
main() {
    local mode=${1:-production}
    
    log_info "Xiaozhi Client Docker 构建脚本"
    log_info "构建模式: $mode"
    
    # 检查环境
    check_docker
    
    # 创建必要的目录
    mkdir -p config logs
    
    case $mode in
        production|prod)
            build_production
            ;;
        development|dev)
            build_development
            ;;
        both)
            build_production
            build_development
            ;;
        clean)
            cleanup_images
            exit 0
            ;;
        *)
            log_error "无效的构建模式: $mode"
            log_info "支持的模式: production, development, both, clean"
            exit 1
            ;;
    esac
    
    # 询问是否清理旧镜像
    read -p "是否清理未使用的镜像? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cleanup_images
    fi
    
    log_success "构建完成！"
    log_info "使用以下命令启动服务:"
    
    if [[ $mode == "production" || $mode == "prod" ]]; then
        echo "  docker-compose up -d"
    elif [[ $mode == "development" || $mode == "dev" ]]; then
        echo "  docker-compose -f docker-compose.dev.yml up -d"
    fi
}

# 脚本入口
main "$@"
