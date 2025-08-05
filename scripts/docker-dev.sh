#!/bin/bash

# Xiaozhi Client Docker 开发环境管理脚本
# 用于快速管理开发环境的 Docker 容器

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
DEV_IMAGE="xiaozhi-client:dev"
DEV_CONTAINER="xiaozhi-client-dev"
COMPOSE_FILE="docker-compose.dev.yml"

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

# 显示帮助
show_help() {
    echo "Xiaozhi Client Docker 开发环境管理脚本"
    echo
    echo "用法: $0 [命令]"
    echo
    echo "命令:"
    echo "  build       构建开发环境镜像"
    echo "  start       启动开发环境容器"
    echo "  stop        停止开发环境容器"
    echo "  restart     重启开发环境容器"
    echo "  logs        查看容器日志"
    echo "  shell       进入容器 shell"
    echo "  status      查看容器状态"
    echo "  clean       清理开发环境（停止并删除容器和镜像）"
    echo "  rebuild     重新构建并启动"
    echo "  test        运行开发环境测试"
    echo "  help        显示帮助"
    echo
    echo "示例:"
    echo "  $0 build       # 构建开发镜像"
    echo "  $0 start       # 启动开发容器"
    echo "  $0 logs -f     # 实时查看日志"
    echo "  $0 shell       # 进入容器调试"
}

# 构建开发镜像
build_dev() {
    log_info "构建开发环境镜像..."

    # 备份并使用开发环境的 .dockerignore
    if [[ -f ".dockerignore.dev" ]]; then
        cp .dockerignore .dockerignore.backup 2>/dev/null || true
        cp .dockerignore.dev .dockerignore
    fi

    if docker build -t $DEV_IMAGE --target dev --no-cache .; then
        log_success "开发镜像构建成功"
    else
        log_error "开发镜像构建失败"
        # 恢复原始 .dockerignore
        if [[ -f ".dockerignore.backup" ]]; then
            mv .dockerignore.backup .dockerignore
        fi
        exit 1
    fi

    # 恢复原始 .dockerignore
    if [[ -f ".dockerignore.backup" ]]; then
        mv .dockerignore.backup .dockerignore
    fi
}

# 启动开发容器
start_dev() {
    log_info "启动开发环境容器..."

    if docker-compose -f $COMPOSE_FILE up -d; then
        log_success "开发容器启动成功"
        log_info "Web UI: http://localhost:9999"
        log_info "备用端口: http://localhost:3000"
    else
        log_error "开发容器启动失败"
        exit 1
    fi
}

# 停止开发容器
stop_dev() {
    log_info "停止开发环境容器..."

    if docker-compose -f $COMPOSE_FILE down; then
        log_success "开发容器已停止"
    else
        log_warning "停止容器时出现问题"
    fi
}

# 查看日志
show_logs() {
    local args="${@:2}"  # 获取除第一个参数外的所有参数
    log_info "查看开发容器日志..."
    docker-compose -f $COMPOSE_FILE logs $args
}

# 进入容器 shell
enter_shell() {
    log_info "进入开发容器 shell..."

    if docker ps | grep -q $DEV_CONTAINER; then
        docker exec -it $DEV_CONTAINER sh
    else
        log_error "开发容器未运行，请先启动容器"
        exit 1
    fi
}

# 查看状态
show_status() {
    log_info "开发环境状态:"
    echo

    # 检查镜像
    if docker images | grep -q "xiaozhi-client.*dev"; then
        log_success "开发镜像存在: $DEV_IMAGE"
        docker images | grep "xiaozhi-client.*dev"
    else
        log_warning "开发镜像不存在: $DEV_IMAGE"
    fi

    # 检查容器
    if docker ps | grep -q $DEV_CONTAINER; then
        log_success "开发容器正在运行: $DEV_CONTAINER"
        echo
        docker ps | grep $DEV_CONTAINER
    elif docker ps -a | grep -q $DEV_CONTAINER; then
        log_warning "开发容器已停止: $DEV_CONTAINER"
        echo
        docker ps -a | grep $DEV_CONTAINER
    else
        log_warning "开发容器不存在: $DEV_CONTAINER"
    fi
}

# 清理开发环境
clean_dev() {
    log_info "清理开发环境..."

    # 停止并删除容器
    docker-compose -f $COMPOSE_FILE down 2>/dev/null || true

    # 删除镜像
    docker rmi $DEV_IMAGE 2>/dev/null || true

    log_success "开发环境已清理"
}

# 重新构建并启动
rebuild_dev() {
    log_info "重新构建并启动开发环境..."

    stop_dev
    build_dev
    start_dev
}

# 运行测试
test_dev() {
    log_info "运行开发环境测试..."

    # 使用 docker-test.sh 的开发模式
    ./scripts/docker-test.sh --dev --test-only
}

# 主函数
main() {
    case "${1:-help}" in
        build)
            build_dev
            ;;
        start)
            start_dev
            ;;
        stop)
            stop_dev
            ;;
        restart)
            stop_dev
            start_dev
            ;;
        logs)
            show_logs "$@"
            ;;
        shell)
            enter_shell
            ;;
        status)
            show_status
            ;;
        clean)
            clean_dev
            ;;
        rebuild)
            rebuild_dev
            ;;
        test)
            test_dev
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# 脚本入口
main "$@"
