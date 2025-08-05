#!/bin/bash

# Xiaozhi Client Docker 镜像发布脚本
# 用法: ./scripts/docker-publish.sh [username] [version]

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

# 显示帮助信息
show_help() {
    echo "Xiaozhi Client Docker 镜像发布脚本"
    echo
    echo "用法: $0 [Docker Hub 用户名] [版本号]"
    echo
    echo "参数:"
    echo "  username    Docker Hub 用户名（必需）"
    echo "  version     版本号（可选，默认从 package.json 读取）"
    echo
    echo "示例:"
    echo "  $0 myusername                    # 使用 package.json 中的版本号"
    echo "  $0 myusername v1.5.1            # 指定版本号"
    echo "  $0 myusername latest            # 发布为 latest"
    echo
    echo "环境变量:"
    echo "  DOCKER_USERNAME    Docker Hub 用户名"
    echo "  DOCKER_PASSWORD    Docker Hub 密码或访问令牌"
}

# 检查 Docker 是否已登录
check_docker_login() {
    log_info "检查 Docker 登录状态..."
    
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请启动 Docker"
        exit 1
    fi
    
    # 尝试访问 Docker Hub
    if ! docker pull hello-world:latest &> /dev/null; then
        log_warning "Docker 未登录或网络连接问题"
        
        if [[ -n "$DOCKER_USERNAME" && -n "$DOCKER_PASSWORD" ]]; then
            log_info "使用环境变量登录 Docker Hub..."
            echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
        else
            log_info "请手动登录 Docker Hub..."
            docker login
        fi
    fi
    
    log_success "Docker 登录检查通过"
}

# 获取版本号
get_version() {
    local version="$1"
    
    if [[ -z "$version" ]]; then
        # 从 package.json 读取版本号
        if [[ -f "package.json" ]]; then
            version=$(grep '"version"' package.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
            log_info "从 package.json 读取版本号: $version"
        else
            log_error "未找到 package.json 文件，请指定版本号"
            exit 1
        fi
    fi
    
    echo "$version"
}

# 构建镜像
build_image() {
    local username="$1"
    local version="$2"
    local image_name="$username/xiaozhi-client"
    
    log_info "构建 Docker 镜像..."
    
    # 构建镜像
    docker build -t "$image_name:$version" .
    
    # 如果版本不是 latest，也标记为 latest
    if [[ "$version" != "latest" ]]; then
        docker tag "$image_name:$version" "$image_name:latest"
        log_info "已标记为 latest 版本"
    fi
    
    log_success "镜像构建完成"
    
    # 显示镜像信息
    docker images | grep "$username/xiaozhi-client"
}

# 推送镜像
push_image() {
    local username="$1"
    local version="$2"
    local image_name="$username/xiaozhi-client"
    
    log_info "推送镜像到 Docker Hub..."
    
    # 推送指定版本
    docker push "$image_name:$version"
    log_success "已推送版本: $version"
    
    # 如果版本不是 latest，也推送 latest
    if [[ "$version" != "latest" ]]; then
        docker push "$image_name:latest"
        log_success "已推送 latest 版本"
    fi
    
    log_success "镜像推送完成"
}

# 显示发布信息
show_publish_info() {
    local username="$1"
    local version="$2"
    
    echo -e "${GREEN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    发布成功！                               ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Docker Hub 地址:                                            ║"
    echo "║    https://hub.docker.com/r/$username/xiaozhi-client        ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  使用方法:                                                   ║"
    echo "║    docker pull $username/xiaozhi-client:$version            ║"
    echo "║    docker pull $username/xiaozhi-client:latest              ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  运行容器:                                                   ║"
    echo "║    docker run -d -p 9999:9999 \\                             ║"
    echo "║      -v ./xiaozhi.config.json:/workspace/xiaozhi.config.json \\║"
    echo "║      $username/xiaozhi-client:latest                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# 清理本地镜像（可选）
cleanup_local() {
    local username="$1"
    
    read -p "是否清理本地镜像? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log_info "清理本地镜像..."
        docker rmi "$username/xiaozhi-client:latest" 2>/dev/null || true
        docker image prune -f
        log_success "本地镜像清理完成"
    fi
}

# 主函数
main() {
    local username="$1"
    local version="$2"
    
    # 检查参数
    if [[ -z "$username" ]]; then
        log_error "请提供 Docker Hub 用户名"
        show_help
        exit 1
    fi
    
    if [[ "$username" == "--help" || "$username" == "-h" ]]; then
        show_help
        exit 0
    fi
    
    # 获取版本号
    version=$(get_version "$version")
    
    log_info "准备发布 xiaozhi-client Docker 镜像"
    log_info "用户名: $username"
    log_info "版本号: $version"
    
    # 确认发布
    read -p "确认发布到 Docker Hub? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "取消发布"
        exit 0
    fi
    
    # 执行发布流程
    check_docker_login
    build_image "$username" "$version"
    push_image "$username" "$version"
    show_publish_info "$username" "$version"
    cleanup_local "$username"
    
    log_success "发布流程完成！"
}

# 脚本入口
main "$@"
