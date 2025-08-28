#!/bin/bash

# 修复部署脚本 - 处理当前目录被删除的问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔧 修复部署环境...${NC}"

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

# 修复当前目录问题
fix_working_directory() {
    info_msg "修复工作目录问题..."
    
    # 切换到安全目录
    cd "$HOME" || cd /tmp || error_exit "无法切换到安全目录"
    
    success_msg "已切换到安全目录: $(pwd)"
}

# 清理残留进程
cleanup_processes() {
    info_msg "清理残留进程..."
    
    # 杀死可能的残留进程
    pkill -f "xiaozhi" 2>/dev/null || true
    pkill -f "node.*cli.js" 2>/dev/null || true
    
    success_msg "残留进程已清理"
}

# 重新部署
redeploy() {
    local work_dir="$HOME/xiaozhi-client-source"
    local web_port="${1:-9999}"
    local admin_user="${2:-admin}"
    local admin_pass="${3:-xiaozhi123}"
    
    info_msg "开始重新部署..."
    
    # 确保工作目录不存在
    if [ -d "$work_dir" ]; then
        rm -rf "$work_dir"
        info_msg "清理了已存在的源码目录"
    fi
    
    # 克隆项目
    info_msg "克隆项目仓库..."
    git clone https://github.com/cfy114514/xiaozhi-client.git "$work_dir"
    
    cd "$work_dir"
    
    # 安装依赖
    info_msg "安装项目依赖..."
    pnpm install
    
    # 构建项目
    info_msg "构建项目 (包含Web UI)..."
    pnpm build
    
    # 生成配置文件
    info_msg "生成配置文件..."
    local jwt_secret=$(openssl rand -hex 32 2>/dev/null || echo 'xiaozhi-jwt-secret-key-change-this-in-production')
    
    cat > "$work_dir/xiaozhi.config.json" << EOF
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
    "port": ${web_port},
    "auth": {
      "enabled": true,
      "admin": {
        "username": "${admin_user}",
        "password": "${admin_pass}"
      },
      "jwtSecret": "${jwt_secret}",
      "sessionTimeout": 86400
    }
  }
}
EOF
    
    # 创建示例MCP服务器
    info_msg "创建示例MCP服务器..."
    mkdir -p "$work_dir/examples/mcpServers"
    
    # 创建calculator.js
    cat > "$work_dir/examples/mcpServers/calculator.js" << 'EOF'
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
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
EOF

    # 创建datetime.js
    cat > "$work_dir/examples/mcpServers/datetime.js" << 'EOF'
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
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

const transport = new StdioServerTransport();
server.connect(transport);
EOF

    chmod +x "$work_dir/examples/mcpServers/calculator.js"
    chmod +x "$work_dir/examples/mcpServers/datetime.js"
    
    # 启动服务
    info_msg "启动服务..."
    nohup node dist/cli.js start > xiaozhi.log 2>&1 &
    local pid=$!
    
    # 等待服务启动
    sleep 3
    
    # 检查服务是否启动成功
    if kill -0 $pid 2>/dev/null; then
        success_msg "服务启动成功 (PID: $pid)"
        echo "$pid" > xiaozhi.pid
        
        echo ""
        echo -e "${GREEN}🎉 部署完成！${NC}"
        echo ""
        echo -e "${BLUE}Web管理界面:${NC}"
        echo "   访问地址: http://$(hostname -I | awk '{print $1}'):${web_port}"
        echo "   本地访问: http://localhost:${web_port}"
        echo "   管理员账号: ${admin_user}"
        echo -e "${YELLOW}   管理员密码: ${admin_pass}${NC}"
        echo ""
        echo -e "${BLUE}项目信息:${NC}"
        echo "   项目目录: $work_dir"
        echo "   配置文件: $work_dir/xiaozhi.config.json"
        echo "   日志文件: $work_dir/xiaozhi.log"
        echo ""
        echo -e "${BLUE}管理命令:${NC}"
        echo "   查看日志: tail -f $work_dir/xiaozhi.log"
        echo "   停止服务: kill \$(cat $work_dir/xiaozhi.pid)"
        echo ""
    else
        error_exit "服务启动失败，请检查日志: $work_dir/xiaozhi.log"
    fi
}

# 主函数
main() {
    # 检查必要命令
    if ! check_command git; then
        info_msg "安装Git..."
        apt-get update && apt-get install -y git
    fi
    
    if ! check_command pnpm; then
        info_msg "安装pnpm..."
        npm install -g pnpm
    fi
    
    # 执行修复步骤
    fix_working_directory
    cleanup_processes
    redeploy "$@"
}

# 执行主函数
main "$@"
