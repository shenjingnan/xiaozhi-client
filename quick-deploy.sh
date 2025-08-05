#!/bin/bash

# Xiaozhi Client 快速部署脚本
# 一键部署 xiaozhi-client Docker 环境

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

# 显示欢迎信息
show_welcome() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    Xiaozhi Client                           ║"
    echo "║                   Docker 快速部署                           ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 检查系统要求
check_requirements() {
    log_info "检查系统要求..."

    # 检查 Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        echo "安装指南: https://docs.docker.com/get-docker/"
        exit 1
    fi

    # 检查 Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装，请先安装 Docker Compose"
        echo "安装指南: https://docs.docker.com/compose/install/"
        exit 1
    fi

    # 检查 Docker 服务状态
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请启动 Docker 服务"
        exit 1
    fi

    log_success "系统要求检查通过"
}

# 创建必要的目录和配置文件
create_directories() {
    log_info "创建必要的目录和配置文件..."

    # 创建目录
    mkdir -p logs workspace mcpServers

    # 创建配置文件（如果不存在）
    if [ ! -f "xiaozhi.config.json" ]; then
        log_info "创建配置文件模板..."
        cp xiaozhi.config.example.json xiaozhi.config.json
        log_warning "请编辑 xiaozhi.config.json 文件，填入你的接入点地址"
        log_info "获取接入点地址：https://xiaozhi.me"
    fi

    # 设置目录权限
    chmod 755 logs workspace mcpServers

    log_success "目录和配置文件创建完成"
}

# 构建镜像
build_image() {
    log_info "构建 Docker 镜像..."

    # 构建镜像
    docker build -t xiaozhi-client:latest .

    log_success "镜像构建完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."

    # 启动服务
    docker-compose up -d

    # 等待服务启动
    log_info "等待服务启动..."
    sleep 10

    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败"
        docker-compose logs
        exit 1
    fi
}

# 显示访问信息
show_access_info() {
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                      部署完成！                             ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Web 配置界面: http://localhost:9999                        ║"
    echo "║  备用端口: http://localhost:3000                            ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  重要提示:                                                   ║"
    echo "║    请确保已正确配置 xiaozhi.config.json 文件                ║"
    echo "║    获取接入点地址：https://xiaozhi.me                       ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  管理命令:                                                   ║"
    echo "║    make logs    - 查看日志                                   ║"
    echo "║    make status  - 查看状态                                   ║"
    echo "║    make stop    - 停止服务                                   ║"
    echo "║    make restart - 重启服务                                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 显示帮助信息
show_help() {
    echo "Xiaozhi Client Docker 快速部署脚本"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  --dev       部署开发环境"
    echo "  --clean     清理现有部署"
    echo "  --help      显示帮助信息"
    echo
    echo "示例:"
    echo "  $0          # 部署生产环境"
    echo "  $0 --dev    # 部署开发环境"
    echo "  $0 --clean  # 清理现有部署"
}

# 清理现有部署
clean_deployment() {
    log_info "清理现有部署..."

    # 停止并删除容器
    docker-compose down --rmi all --volumes --remove-orphans 2>/dev/null || true

    # 清理镜像
    docker rmi xiaozhi-client:latest xiaozhi-client:dev 2>/dev/null || true

    # 清理系统
    docker system prune -f

    log_success "清理完成"
}

# 部署开发环境
deploy_dev() {
    log_info "部署开发环境..."

    # 构建开发镜像
    docker build -t xiaozhi-client:dev .

    # 启动开发服务
    docker-compose -f docker-compose.dev.yml up -d

    # 等待服务启动
    sleep 10

    log_success "开发环境部署完成"

    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                   开发环境部署完成！                         ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Web 配置界面: http://localhost:9999                        ║"
    echo "║  备用端口: http://localhost:3000                            ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  开发环境支持文件挂载，可直接修改配置文件                   ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 主函数
main() {
    local mode="production"

    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev)
                mode="development"
                shift
                ;;
            --clean)
                clean_deployment
                exit 0
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done

    # 显示欢迎信息
    show_welcome

    # 检查系统要求
    check_requirements

    # 创建必要的目录
    create_directories

    if [[ $mode == "development" ]]; then
        deploy_dev
    else
        # 构建镜像
        build_image

        # 启动服务
        start_services

        # 显示访问信息
        show_access_info
    fi
}

# 脚本入口
main "$@"
