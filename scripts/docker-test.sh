#!/bin/bash

# Xiaozhi Client Docker 测试脚本
# 用于测试和调试 Docker 配置

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
IMAGE_NAME="xiaozhi-client:test"
CONTAINER_NAME="xiaozhi-test"
TEST_DIR="docker-test"
BUILD_MODE="production"  # 默认为生产模式

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

# 清理函数
cleanup() {
    log_info "清理测试环境..."
    docker stop $CONTAINER_NAME 2>/dev/null || true
    docker rm $CONTAINER_NAME 2>/dev/null || true
}

# 构建镜像
build_image() {
    local build_target=""
    local dockerignore_file=""
    local cache_option="--no-cache"

    if [[ $BUILD_MODE == "development" ]]; then
        build_target="--target dev"
        dockerignore_file=".dockerignore.dev"
        IMAGE_NAME="xiaozhi-client:dev"
        CONTAINER_NAME="xiaozhi-dev"
        log_info "构建开发环境 Docker 镜像（使用本地代码）..."
    else
        build_target=""  # 默认使用最后一个阶段（生产环境）
        dockerignore_file=".dockerignore"
        log_info "构建生产环境 Docker 镜像（使用 npm 正式版）..."
    fi

    # 清理旧镜像
    docker rmi $IMAGE_NAME 2>/dev/null || true

    # 备份原始 .dockerignore 并使用对应的版本
    if [[ -f "$dockerignore_file" ]]; then
        if [[ "$dockerignore_file" != ".dockerignore" ]]; then
            cp .dockerignore .dockerignore.backup 2>/dev/null || true
            cp $dockerignore_file .dockerignore
        fi
    fi

    # 构建新镜像
    if docker build -t $IMAGE_NAME $cache_option $build_target .; then
        log_success "镜像构建成功 (模式: $BUILD_MODE)"
        docker images | grep xiaozhi-client
    else
        log_error "镜像构建失败"
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

# 创建测试配置
create_test_config() {
    log_info "创建测试配置..."

    # 创建测试目录
    mkdir -p $TEST_DIR/logs

    # 创建配置文件
    cat > $TEST_DIR/xiaozhi.config.json << 'EOF'
{
  "mcpEndpoint": "wss://test-endpoint.xiaozhi.me/ws",
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": ["./mcpServers/calculator.js"]
    },
    "datetime": {
      "command": "node",
      "args": ["./mcpServers/datetime.js"]
    }
  },
  "connection": {
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 10000,
    "reconnectInterval": 5000
  },
  "webUI": {
    "port": 9999,
    "host": "0.0.0.0"
  }
}
EOF

    # 验证配置文件
    if command -v jq &> /dev/null; then
        if cat $TEST_DIR/xiaozhi.config.json | jq . > /dev/null; then
            log_success "配置文件格式正确"
        else
            log_error "配置文件格式错误"
            exit 1
        fi
    else
        log_warning "未安装 jq，跳过配置文件格式验证"
    fi
}

# 启动容器
start_container() {
    log_info "启动测试容器..."

    # 清理旧容器
    cleanup

    # 启动新容器
    docker run -d \
        --name $CONTAINER_NAME \
        -p 9999:9999 \
        -p 3000:3000 \
        -v $(pwd)/$TEST_DIR:/workspace/config \
        -v $(pwd)/$TEST_DIR/logs:/workspace/logs \
        -e XIAOZHI_CONFIG_DIR=/workspace/config \
        -e XIAOZHI_CONTAINER=true \
        $IMAGE_NAME

    # 等待容器启动
    sleep 5

    # 检查容器状态
    if docker ps | grep -q $CONTAINER_NAME; then
        log_success "容器启动成功"
    else
        log_error "容器启动失败"
        docker logs $CONTAINER_NAME
        exit 1
    fi
}

# 测试容器功能
test_container() {
    log_info "测试容器功能..."

    # 检查容器状态
    log_info "检查容器状态..."
    docker ps | grep $CONTAINER_NAME

    # 检查端口映射
    log_info "检查端口映射..."
    docker port $CONTAINER_NAME

    # 检查日志
    log_info "检查容器日志..."
    docker logs --tail=20 $CONTAINER_NAME

    # 测试健康检查
    log_info "测试健康检查..."
    if docker exec $CONTAINER_NAME xiaozhi --version; then
        log_success "健康检查通过"
    else
        log_error "健康检查失败"
    fi

    # 测试 Web UI
    log_info "测试 Web UI 访问..."
    sleep 10  # 等待服务完全启动

    if curl -s -I http://localhost:9999 | grep -q "HTTP"; then
        log_success "Web UI 可以访问"
    else
        log_warning "Web UI 可能未启动或端口未开放"
        log_info "尝试检查容器内部端口..."
        docker exec $CONTAINER_NAME netstat -tlnp 2>/dev/null || true
    fi
}

# 进入调试模式
debug_mode() {
    log_info "进入调试模式..."

    echo -e "${YELLOW}调试命令提示:${NC}"
    echo "  docker logs -f $CONTAINER_NAME     # 查看实时日志"
    echo "  docker exec -it $CONTAINER_NAME sh # 进入容器"
    echo "  docker stop $CONTAINER_NAME        # 停止容器"
    echo "  curl http://localhost:9999         # 测试 Web UI"
    echo ""

    # 显示容器信息
    echo -e "${BLUE}容器信息:${NC}"
    docker inspect $CONTAINER_NAME | jq '.[] | {State, NetworkSettings}' 2>/dev/null || docker inspect $CONTAINER_NAME

    # 询问是否进入容器
    read -p "是否进入容器进行调试? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker exec -it $CONTAINER_NAME sh
    fi
}

# 显示帮助
show_help() {
    echo "Xiaozhi Client Docker 测试脚本"
    echo
    echo "用法: $0 [选项]"
    echo
    echo "选项:"
    echo "  --dev           使用开发模式（本地代码构建）"
    echo "  --prod          使用生产模式（npm 正式版，默认）"
    echo "  --build-only    只构建镜像"
    echo "  --test-only     只测试现有镜像"
    echo "  --debug         启动调试模式"
    echo "  --cleanup       清理测试环境"
    echo "  --help          显示帮助"
    echo
    echo "构建模式说明:"
    echo "  开发模式 (--dev):"
    echo "    - 使用当前工作目录的本地代码"
    echo "    - 在容器内构建项目"
    echo "    - 适用于测试本地代码变更"
    echo "  生产模式 (--prod, 默认):"
    echo "    - 使用 npm install -g xiaozhi-client 安装正式版"
    echo "    - 适用于测试发布版本"
    echo
    echo "使用示例:"
    echo "  $0                    # 生产模式完整测试"
    echo "  $0 --dev             # 开发模式完整测试"
    echo "  $0 --dev --debug     # 开发模式测试并进入调试"
    echo "  $0 --build-only --dev # 只构建开发镜像"
}

# 主函数
main() {
    local mode="full"

    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dev)
                BUILD_MODE="development"
                shift
                ;;
            --prod)
                BUILD_MODE="production"
                shift
                ;;
            --build-only)
                mode="build"
                shift
                ;;
            --test-only)
                mode="test"
                shift
                ;;
            --debug)
                mode="debug"
                shift
                ;;
            --cleanup)
                cleanup
                rm -rf $TEST_DIR
                log_success "清理完成"
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

    log_info "开始 Xiaozhi Client Docker 测试 (模式: $BUILD_MODE)"

    # 执行测试流程
    case $mode in
        build)
            build_image
            ;;
        test)
            create_test_config
            start_container
            test_container
            ;;
        debug|full)
            if [[ $mode == "full" ]]; then
                build_image
            fi
            create_test_config
            start_container
            test_container
            if [[ $mode == "debug" ]]; then
                debug_mode
            fi
            ;;
    esac

    log_success "测试完成！"

    if [[ $mode != "debug" ]]; then
        echo -e "${YELLOW}容器仍在运行，访问地址:${NC}"
        echo "  Web UI: http://localhost:9999"
        echo "  备用端口: http://localhost:3000"
        echo ""
        echo -e "${YELLOW}管理命令:${NC}"
        echo "  docker logs -f $CONTAINER_NAME  # 查看日志"
        echo "  docker stop $CONTAINER_NAME     # 停止容器"
        echo "  $0 --cleanup                    # 清理环境"
    fi
}

# 脚本入口
main "$@"
