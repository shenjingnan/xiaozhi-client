#!/bin/bash

# Xiaozhi Client Docker 运行脚本
# 用法: ./scripts/docker-run.sh [start|stop|restart|logs|status] [production|development]

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

# 获取 docker-compose 文件
get_compose_file() {
    local mode=${1:-production}
    
    case $mode in
        production|prod)
            echo "docker-compose.yml"
            ;;
        development|dev)
            echo "docker-compose.dev.yml"
            ;;
        *)
            log_error "无效的运行模式: $mode"
            exit 1
            ;;
    esac
}

# 启动服务
start_service() {
    local mode=${1:-production}
    local compose_file=$(get_compose_file $mode)
    
    log_info "启动 $mode 环境服务..."
    
    # 创建必要的目录
    mkdir -p config logs
    
    # 启动服务
    docker-compose -f $compose_file up -d
    
    log_success "服务启动完成"
    
    # 显示服务状态
    docker-compose -f $compose_file ps
    
    # 显示访问信息
    log_info "服务访问信息:"
    echo "  Web 配置界面: http://localhost:3000"
    if [[ $mode == "development" || $mode == "dev" ]]; then
        echo "  Vite 开发服务器: http://localhost:5173"
    fi
    echo "  MCP 服务端口: 8080"
}

# 停止服务
stop_service() {
    local mode=${1:-production}
    local compose_file=$(get_compose_file $mode)
    
    log_info "停止 $mode 环境服务..."
    
    docker-compose -f $compose_file down
    
    log_success "服务已停止"
}

# 重启服务
restart_service() {
    local mode=${1:-production}
    
    log_info "重启 $mode 环境服务..."
    
    stop_service $mode
    sleep 2
    start_service $mode
}

# 查看日志
show_logs() {
    local mode=${1:-production}
    local compose_file=$(get_compose_file $mode)
    
    log_info "显示 $mode 环境日志..."
    
    # 检查服务是否运行
    if ! docker-compose -f $compose_file ps | grep -q "Up"; then
        log_warning "服务未运行，显示最近的日志..."
    fi
    
    docker-compose -f $compose_file logs -f --tail=100
}

# 查看服务状态
show_status() {
    local mode=${1:-production}
    local compose_file=$(get_compose_file $mode)
    
    log_info "$mode 环境服务状态:"
    
    # 显示容器状态
    docker-compose -f $compose_file ps
    
    # 显示资源使用情况
    echo
    log_info "资源使用情况:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" | grep xiaozhi || echo "未找到运行中的容器"
    
    # 显示健康检查状态
    echo
    log_info "健康检查状态:"
    docker-compose -f $compose_file exec xiaozhi-client node dist/cli.js --version 2>/dev/null && log_success "服务健康" || log_warning "服务可能存在问题"
}

# 进入容器
enter_container() {
    local mode=${1:-production}
    local compose_file=$(get_compose_file $mode)
    
    log_info "进入 $mode 环境容器..."
    
    # 检查容器是否运行
    if ! docker-compose -f $compose_file ps | grep -q "Up"; then
        log_error "容器未运行，请先启动服务"
        exit 1
    fi
    
    docker-compose -f $compose_file exec xiaozhi-client sh
}

# 显示帮助信息
show_help() {
    echo "Xiaozhi Client Docker 运行脚本"
    echo
    echo "用法: $0 [命令] [模式]"
    echo
    echo "命令:"
    echo "  start     启动服务"
    echo "  stop      停止服务"
    echo "  restart   重启服务"
    echo "  logs      查看日志"
    echo "  status    查看状态"
    echo "  shell     进入容器"
    echo "  help      显示帮助"
    echo
    echo "模式:"
    echo "  production   生产环境 (默认)"
    echo "  development  开发环境"
    echo
    echo "示例:"
    echo "  $0 start production     # 启动生产环境"
    echo "  $0 logs development     # 查看开发环境日志"
    echo "  $0 status              # 查看生产环境状态"
}

# 主函数
main() {
    local command=${1:-help}
    local mode=${2:-production}
    
    case $command in
        start)
            start_service $mode
            ;;
        stop)
            stop_service $mode
            ;;
        restart)
            restart_service $mode
            ;;
        logs)
            show_logs $mode
            ;;
        status)
            show_status $mode
            ;;
        shell|bash|sh)
            enter_container $mode
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "无效的命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 脚本入口
main "$@"
