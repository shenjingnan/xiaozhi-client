#!/bin/bash

# 服务器端完整部署脚本 - 包含Web UI重新构建
# 确保认证功能完整可用

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 配置
PROJECT_NAME="xiaozhi-client"
WORK_DIR="$HOME/${PROJECT_NAME}-source"
WEB_PORT="${1:-9999}"
ADMIN_USER="${2:-admin}"
ADMIN_PASS="${3:-xiaozhi123}"

echo -e "${CYAN}"
echo "================================================================"
echo "     Xiaozhi Client 服务器端完整部署 (包含Web UI构建)"
echo "================================================================"
echo -e "${NC}"

# 信息函数
info_msg() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success_msg() {
    echo -e "${GREEN}✅ $1${NC}"
}

error_exit() {
    echo -e "${RED}❌ 错误: $1${NC}" >&2
    exit 1
}

# 检查命令是否存在
check_command() {
    command -v "$1" >/dev/null 2>&1
}

# 安装Node.js (如果需要)
install_nodejs() {
    if check_command node; then
        local node_version=$(node --version | cut -d'v' -f2)
        local major_version=$(echo $node_version | cut -d'.' -f1)
        
        if [ "$major_version" -ge 18 ]; then
            success_msg "Node.js 已安装 (版本: v$node_version)"
            return 0
        fi
    fi
    
    info_msg "安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    success_msg "Node.js 安装完成"
}

# 安装pnpm
install_pnpm() {
    if check_command pnpm; then
        success_msg "pnpm 已安装"
        return 0
    fi
    
    info_msg "安装 pnpm..."
    npm install -g pnpm
    success_msg "pnpm 安装完成"
}

# 停止当前服务
stop_current_service() {
    info_msg "停止当前xiaozhi服务..."
    
    # 停止全局xiaozhi服务
    if check_command xiaozhi; then
        xiaozhi stop 2>/dev/null || true
        success_msg "全局xiaozhi服务已停止"
    fi
    
    # 杀死可能的残留进程
    pkill -f "xiaozhi" 2>/dev/null || true
    pkill -f "node.*cli.js" 2>/dev/null || true
    
    # 等待端口释放
    sleep 2
}

# 清理旧安装
cleanup_old_installation() {
    info_msg "清理旧的安装..."
    
    # 卸载全局包
    if npm list -g xiaozhi-client &>/dev/null; then
        npm uninstall -g xiaozhi-client
        success_msg "已卸载全局xiaozhi-client"
    fi
    
    # 清理旧目录
    if [ -d "$HOME/xiaozhi-client" ]; then
        rm -rf "$HOME/xiaozhi-client"
        success_msg "已删除旧的xiaozhi-client目录"
    fi
}

# 克隆并构建项目
build_project() {
    info_msg "准备项目源码..."
    
    # 安装Git（如果需要）
    if ! check_command git; then
        sudo apt-get update
        sudo apt-get install -y git
    fi
    
    # 克隆或更新项目
    if [ ! -d "$WORK_DIR" ]; then
        info_msg "克隆项目仓库..."
        git clone https://github.com/cfy114514/xiaozhi-client.git "$WORK_DIR"
    else
        info_msg "更新项目仓库..."
        cd "$WORK_DIR"
        git pull
    fi
    
    cd "$WORK_DIR"
    
    # 安装依赖
    info_msg "安装项目依赖..."
    pnpm install
    
    # 构建项目 (包含Web UI)
    info_msg "构建项目 (包含Web UI)..."
    pnpm build
    
    success_msg "项目构建完成"
}

# 生成配置文件
generate_config() {
    info_msg "生成配置文件..."
    
    # 生成JWT密钥
    local jwt_secret=$(openssl rand -hex 32 2>/dev/null || echo 'xiaozhi-jwt-secret-key-change-this-in-production')
    
    cat > "$WORK_DIR/xiaozhi.config.json" << EOF
{
  "mcpEndpoint": "<请填写你的接入点地址（获取地址在 xiaozhi.me）>",
  "mcpServers": {
    "calculator": {
      "command": "node",
      "args": ["./examples/mcpServers/calculator.js"]
    },
    "datetime": {
      "command": "node", 
      "args": ["./examples/mcpServers/datetime.js"]
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
      "enabled": true,
      "admin": {
        "username": "${ADMIN_USER}",
        "password": "${ADMIN_PASS}"
      },
      "jwtSecret": "${jwt_secret}",
      "sessionTimeout": 86400
    }
  }
}
EOF
    
    success_msg "配置文件已生成"
}

# 创建示例MCP服务器
create_example_servers() {
    info_msg "创建示例MCP服务器..."
    
    mkdir -p "$WORK_DIR/examples/mcpServers"
    
    # 创建calculator.js
    cat > "$WORK_DIR/examples/mcpServers/calculator.js" << 'EOF'
#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const server = new Server({
  name: 'calculator',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'add',
        description: 'Add two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        }
      },
      {
        name: 'multiply',
        description: 'Multiply two numbers',
        inputSchema: {
          type: 'object',
          properties: {
            a: { type: 'number', description: 'First number' },
            b: { type: 'number', description: 'Second number' }
          },
          required: ['a', 'b']
        }
      }
    ]
  };
});

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'add':
      return {
        content: [
          {
            type: 'text',
            text: `${args.a} + ${args.b} = ${args.a + args.b}`
          }
        ]
      };
    case 'multiply':
      return {
        content: [
          {
            type: 'text',
            text: `${args.a} × ${args.b} = ${args.a * args.b}`
          }
        ]
      };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
EOF

    # 创建datetime.js
    cat > "$WORK_DIR/examples/mcpServers/datetime.js" << 'EOF'
#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const server = new Server({
  name: 'datetime',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'get_current_time',
        description: 'Get the current date and time',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'format_date',
        description: 'Format a date string',
        inputSchema: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'Date to format (ISO string)' },
            format: { type: 'string', description: 'Format pattern' }
          },
          required: ['date']
        }
      }
    ]
  };
});

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'get_current_time':
      const now = new Date();
      return {
        content: [
          {
            type: 'text',
            text: `Current time: ${now.toISOString()}\nLocal time: ${now.toLocaleString()}`
          }
        ]
      };
    case 'format_date':
      const date = new Date(args.date);
      const formatted = args.format ? date.toLocaleDateString('zh-CN') : date.toISOString();
      return {
        content: [
          {
            type: 'text',
            text: `Formatted date: ${formatted}`
          }
        ]
      };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
EOF

    chmod +x "$WORK_DIR/examples/mcpServers/calculator.js"
    chmod +x "$WORK_DIR/examples/mcpServers/datetime.js"
    
    success_msg "示例MCP服务器已创建"
}

# 启动服务
start_service() {
    info_msg "启动服务..."
    
    cd "$WORK_DIR"
    
    # 启动服务
    nohup node dist/cli.js start > xiaozhi.log 2>&1 &
    local pid=$!
    
    # 等待服务启动
    sleep 3
    
    # 检查服务是否启动成功
    if kill -0 $pid 2>/dev/null; then
        success_msg "服务启动成功 (PID: $pid)"
        echo "$pid" > xiaozhi.pid
    else
        error_exit "服务启动失败，请检查日志: $WORK_DIR/xiaozhi.log"
    fi
}

# 显示使用说明
show_usage() {
    echo ""
    echo -e "${GREEN}🎉 部署完成！${NC}"
    echo ""
    echo -e "${BLUE}Web管理界面:${NC}"
    echo "   访问地址: http://$(hostname -I | awk '{print $1}'):${WEB_PORT}"
    echo "   本地访问: http://localhost:${WEB_PORT}"
    echo "   管理员账号: ${ADMIN_USER}"
    echo -e "${YELLOW}   管理员密码: ${ADMIN_PASS}${NC}"
    echo ""
    echo -e "${BLUE}项目信息:${NC}"
    echo "   项目目录: $WORK_DIR"
    echo "   配置文件: $WORK_DIR/xiaozhi.config.json"
    echo "   日志文件: $WORK_DIR/xiaozhi.log"
    echo "   PID文件: $WORK_DIR/xiaozhi.pid"
    echo ""
    echo -e "${BLUE}管理命令:${NC}"
    echo "   查看日志: tail -f $WORK_DIR/xiaozhi.log"
    echo "   停止服务: kill \$(cat $WORK_DIR/xiaozhi.pid)"
    echo "   重启服务: cd $WORK_DIR && node dist/cli.js start"
    echo ""
    echo -e "${YELLOW}注意: 请编辑配置文件设置你的小智接入点地址${NC}"
}

# 主函数
main() {
    echo -e "${CYAN}开始服务器端完整部署...${NC}"
    
    # 检查权限
    if [ "$EUID" -eq 0 ]; then
        echo -e "${YELLOW}⚠️  检测到root权限，建议使用普通用户运行${NC}"
    fi
    
    # 执行部署步骤
    install_nodejs
    install_pnpm
    stop_current_service
    cleanup_old_installation
    build_project
    generate_config
    create_example_servers
    start_service
    show_usage
}

# 执行主函数
main "$@"
