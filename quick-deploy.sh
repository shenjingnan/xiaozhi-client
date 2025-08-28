#!/bin/bash

# Xiaozhi Client 一键部署脚本
# 支持本地部署和Docker部署，自动安装依赖和配置
# 针对中国国内网络环境优化

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
SCRIPT_VERSION="1.0.0"
PROJECT_NAME="xiaozhi-client"
DEFAULT_PORT=9999
DEFAULT_ADMIN_USER="admin"
DEFAULT_ADMIN_PASS="xiaozhi123"

# 显示横幅
show_banner() {
    echo -e "${CYAN}"
    echo "================================================================"
    echo "          Xiaozhi Client 一键部署脚本 v${SCRIPT_VERSION}"
    echo "================================================================"
    echo -e "${NC}"
}

# 显示帮助信息
show_help() {
    show_banner
    echo -e "${BLUE}使用方法:${NC}"
    echo "  $0 [模式] [选项]"
    echo ""
    echo -e "${BLUE}部署模式:${NC}"
    echo "  local         本地部署 (默认)"
    echo "  docker        Docker容器部署"
    echo "  source        从源码构建部署"
    echo ""
    echo -e "${BLUE}选项:${NC}"
    echo "  --port        Web UI端口 (默认: 9999)"
    echo "  --endpoint    小智接入点地址"
    echo "  --admin-user  管理员用户名 (默认: admin)"
    echo "  --admin-pass  管理员密码 (默认: xiaozhi123)"
    echo "  --no-auth     禁用认证"
    echo "  --help        显示此帮助信息"
    echo ""
    echo -e "${BLUE}使用示例:${NC}"
    echo "  $0                                           # 本地部署"
    echo "  $0 docker                                    # Docker部署"
    echo "  $0 local --port 8080 --endpoint 'ws://...'  # 自定义配置"
    echo "  $0 docker --no-auth                         # Docker部署且禁用认证"
    echo ""
    echo -e "${YELLOW}注意: 首次运行前请确保已从 xiaozhi.me 获取接入点地址${NC}"
}

# 错误处理
error_exit() {
    echo -e "${RED}❌ 错误: $1${NC}" >&2
    exit 1
}

# 成功提示
success_msg() {
    echo -e "${GREEN}✅ $1${NC}"
}

# 警告提示
warning_msg() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 信息提示
info_msg() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# 检查命令是否存在
check_command() {
    command -v "$1" >/dev/null 2>&1
}

# 检查系统类型
detect_os() {
    case "$(uname -s)" in
        Linux*)     echo "linux";;
        Darwin*)    echo "macos";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)          echo "unknown";;
    esac
}

# 安装Node.js
install_nodejs() {
    local os=$(detect_os)
    
    info_msg "检测到系统: $os"
    
    if check_command node; then
        local node_version=$(node --version | cut -d'v' -f2)
        local major_version=$(echo $node_version | cut -d'.' -f1)
        
        if [ "$major_version" -ge 18 ]; then
            success_msg "Node.js 已安装 (版本: v$node_version)"
            return 0
        else
            warning_msg "Node.js 版本过低 (v$node_version)，需要 v18 或更高版本"
        fi
    fi
    
    info_msg "正在安装 Node.js..."
    
    case $os in
        "linux")
            if check_command apt; then
                # Ubuntu/Debian
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                sudo apt-get install -y nodejs
            elif check_command yum; then
                # CentOS/RHEL
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
                sudo yum install -y nodejs npm
            elif check_command dnf; then
                # Fedora
                curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
                sudo dnf install -y nodejs npm
            else
                error_exit "不支持的Linux发行版，请手动安装 Node.js 20"
            fi
            ;;
        "macos")
            if check_command brew; then
                brew install node@20
            else
                error_exit "请先安装 Homebrew 或手动安装 Node.js 20"
            fi
            ;;
        *)
            error_exit "不支持的操作系统，请手动安装 Node.js 20"
            ;;
    esac
    
    success_msg "Node.js 安装完成"
}

# 安装包管理器
install_package_manager() {
    if check_command pnpm; then
        success_msg "pnpm 已安装"
        return 0
    fi
    
    info_msg "正在安装 pnpm..."
    
    # 配置npm镜像源（中国用户）
    npm config set registry https://registry.npmmirror.com
    
    npm install -g pnpm
    pnpm config set registry https://registry.npmmirror.com
    
    success_msg "pnpm 安装完成"
}

# 安装Docker
install_docker() {
    if check_command docker; then
        success_msg "Docker 已安装"
        return 0
    fi
    
    local os=$(detect_os)
    info_msg "正在安装 Docker..."
    
    case $os in
        "linux")
            # 使用官方脚本安装Docker
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo usermod -aG docker $USER
            rm get-docker.sh
            warning_msg "Docker 安装完成，请重新登录以使用户组更改生效"
            ;;
        "macos")
            error_exit "请从 https://docs.docker.com/desktop/mac/install/ 下载并安装 Docker Desktop"
            ;;
        *)
            error_exit "不支持的操作系统，请手动安装 Docker"
            ;;
    esac
}

# 本地部署
deploy_local() {
    local work_dir="$HOME/${PROJECT_NAME}"
    
    info_msg "开始本地部署..."
    
    # 检查并安装依赖
    install_nodejs
    install_package_manager
    
    # 创建工作目录
    info_msg "创建工作目录: $work_dir"
    mkdir -p "$work_dir"
    cd "$work_dir"
    
    # 全局安装xiaozhi-client
    info_msg "安装 xiaozhi-client..."
    npm install -g xiaozhi-client
    
    # 初始化项目
    if [ ! -f "xiaozhi.config.json" ]; then
        info_msg "初始化配置文件..."
        xiaozhi config init
    else
        success_msg "配置文件已存在"
    fi
    
    # 生成配置
    generate_config "$work_dir/xiaozhi.config.json"
    
    success_msg "本地部署完成！"
    show_local_usage "$work_dir"
}

# Docker部署
deploy_docker() {
    local work_dir="$HOME/${PROJECT_NAME}"
    
    info_msg "开始Docker部署..."
    
    # 检查并安装Docker
    install_docker
    
    # 创建工作目录
    info_msg "创建工作目录: $work_dir"
    mkdir -p "$work_dir"
    
    # 生成配置文件
    generate_config "$work_dir/xiaozhi.config.json"
    
    # 停止并删除已存在的容器
    if docker ps -a --format 'table {{.Names}}' | grep -q "^${PROJECT_NAME}$"; then
        info_msg "停止并删除已存在的容器..."
        docker stop "$PROJECT_NAME" >/dev/null 2>&1 || true
        docker rm "$PROJECT_NAME" >/dev/null 2>&1 || true
    fi
    
    # 拉取并运行容器
    info_msg "拉取Docker镜像..."
    docker pull "shenjingnan/${PROJECT_NAME}:latest"
    
    info_msg "启动Docker容器..."
    docker run -d \
        --name "$PROJECT_NAME" \
        -p "${WEB_PORT}:9999" \
        -p "3000:3000" \
        -v "$work_dir:/workspaces" \
        --restart unless-stopped \
        "shenjingnan/${PROJECT_NAME}:latest"
    
    # 等待容器启动
    sleep 5
    
    success_msg "Docker部署完成！"
    show_docker_usage
}

# 从源码部署
deploy_from_source() {
    local work_dir="$HOME/${PROJECT_NAME}-source"
    
    info_msg "开始从源码部署..."
    
    # 检查并安装依赖
    install_nodejs
    install_package_manager
    
    if ! check_command git; then
        error_exit "Git 未安装，请先安装 Git"
    fi
    
# 克隆仓库
if [ ! -d "$work_dir" ]; then
    info_msg "克隆项目仓库..."
    git clone https://github.com/cfy114514/xiaozhi-client.git "$work_dir"
    if [ $? -ne 0 ]; then
        error_exit "项目克隆失败"
    fi
else
    info_msg "更新项目仓库..."
    cd "$work_dir"
    git pull
fi    cd "$work_dir"
    
    # 安装依赖
    info_msg "安装项目依赖..."
    pnpm install
    
    # 构建项目
    info_msg "构建项目..."
    pnpm build
    
    # 生成配置
    generate_config "$work_dir/xiaozhi.config.json"
    
    success_msg "源码部署完成！"
    show_source_usage "$work_dir"
}

# 生成配置文件
generate_config() {
    local config_file="$1"
    
    info_msg "生成配置文件: $config_file"
    
    # 创建配置文件
    cat > "$config_file" << EOF
{
  "mcpEndpoint": "${ENDPOINT_URL:-<请填写你的接入点地址（获取地址在 xiaozhi.me）>}",
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
  "modelscope": {
    "apiKey": "<你的API密钥>"
  },
  "connection": {
    "heartbeatInterval": 30000,
    "heartbeatTimeout": 10000,
    "reconnectInterval": 5000
  },
  "webUI": {
    "port": ${WEB_PORT},
    "auth": {
      "enabled": ${AUTH_ENABLED},
      "admin": {
        "username": "${ADMIN_USER}",
        "password": "${ADMIN_PASS}"
      },
      "jwtSecret": "$(openssl rand -hex 32 2>/dev/null || echo 'your-super-secret-jwt-key-change-this-in-production')",
      "sessionTimeout": 86400
    }
  }
}
EOF
    
    success_msg "配置文件已生成"
}

# 显示本地部署使用说明
show_local_usage() {
    local work_dir="$1"
    
    echo ""
    echo -e "${GREEN}🎉 本地部署成功！${NC}"
    echo ""
    echo -e "${BLUE}使用说明:${NC}"
    echo "1. 配置文件位置: $work_dir/xiaozhi.config.json"
    echo "2. 编辑配置文件，设置你的小智接入点地址"
    echo "3. 启动服务："
    echo "   cd $work_dir"
    echo "   xiaozhi start"
    echo ""
    echo -e "${BLUE}Web管理界面:${NC}"
    echo "   访问地址: http://localhost:${WEB_PORT}"
    if [ "$AUTH_ENABLED" = "true" ]; then
        echo "   管理员账号: ${ADMIN_USER}"
        echo "   管理员密码: ${ADMIN_PASS}"
    fi
    echo ""
    echo -e "${BLUE}常用命令:${NC}"
    echo "   xiaozhi start -d        # 后台运行"
    echo "   xiaozhi status          # 查看状态"
    echo "   xiaozhi stop            # 停止服务"
    echo "   xiaozhi ui              # 启动Web界面"
    echo ""
}

# 显示Docker部署使用说明
show_docker_usage() {
    echo ""
    echo -e "${GREEN}🎉 Docker部署成功！${NC}"
    echo ""
    echo -e "${BLUE}Web管理界面:${NC}"
    echo "   访问地址: http://localhost:${WEB_PORT}"
    if [ "$AUTH_ENABLED" = "true" ]; then
        echo "   管理员账号: ${ADMIN_USER}"
        echo "   管理员密码: ${ADMIN_PASS}"
    fi
    echo ""
    echo -e "${BLUE}Docker常用命令:${NC}"
    echo "   docker logs -f $PROJECT_NAME     # 查看日志"
    echo "   docker restart $PROJECT_NAME     # 重启容器"
    echo "   docker stop $PROJECT_NAME        # 停止容器"
    echo "   docker start $PROJECT_NAME       # 启动容器"
    echo ""
    echo -e "${BLUE}配置文件:${NC}"
    echo "   位置: $HOME/$PROJECT_NAME/xiaozhi.config.json"
    echo "   修改配置后请重启容器使其生效"
    echo ""
}

# 显示源码部署使用说明
show_source_usage() {
    local work_dir="$1"
    
    echo ""
    echo -e "${GREEN}🎉 源码部署成功！${NC}"
    echo ""
    echo -e "${BLUE}使用说明:${NC}"
    echo "1. 项目目录: $work_dir"
    echo "2. 配置文件: $work_dir/xiaozhi.config.json"
    echo "3. 启动服务："
    echo "   cd $work_dir"
    echo "   node dist/cli.js start"
    echo ""
    echo -e "${BLUE}Web管理界面:${NC}"
    echo "   访问地址: http://localhost:${WEB_PORT}"
    if [ "$AUTH_ENABLED" = "true" ]; then
        echo "   管理员账号: ${ADMIN_USER}"
        echo "   管理员密码: ${ADMIN_PASS}"
    fi
    echo ""
    echo -e "${BLUE}开发命令:${NC}"
    echo "   pnpm dev                # 开发模式"
    echo "   pnpm build              # 构建项目"
    echo "   pnpm test               # 运行测试"
    echo ""
}

# 主函数
main() {
    # 默认值
    local deploy_mode="local"
    WEB_PORT="$DEFAULT_PORT"
    ADMIN_USER="$DEFAULT_ADMIN_USER"
    ADMIN_PASS="$DEFAULT_ADMIN_PASS"
    AUTH_ENABLED="true"
    ENDPOINT_URL=""
    
    # 解析参数
    while [ $# -gt 0 ]; do
        case $1 in
            local|docker|source)
                deploy_mode="$1"
                ;;
            --port)
                WEB_PORT="$2"
                shift
                ;;
            --endpoint)
                ENDPOINT_URL="$2"
                shift
                ;;
            --admin-user)
                ADMIN_USER="$2"
                shift
                ;;
            --admin-pass)
                ADMIN_PASS="$2"
                shift
                ;;
            --no-auth)
                AUTH_ENABLED="false"
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                error_exit "未知选项: $1"
                ;;
        esac
        shift
    done
    
    # 显示横幅
    show_banner
    
    # 根据模式执行部署
    case $deploy_mode in
        "local")
            deploy_local
            ;;
        "docker")
            deploy_docker
            ;;
        "source")
            deploy_from_source
            ;;
        *)
            error_exit "未知部署模式: $deploy_mode"
            ;;
    esac
}

# 如果直接运行脚本，则执行main函数
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
