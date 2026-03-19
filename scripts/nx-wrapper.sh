#!/bin/bash
# nx 包装脚本
# 用于设置 Node.js maxListeners 并运行 nx 命令

# 获取脚本所在目录的绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAX_LISTENERS_SETUP="$SCRIPT_DIR/max-listeners-setup.cjs"

# 设置 NODE_OPTIONS（追加到现有的 NODE_OPTIONS）
if [ -n "$NODE_OPTIONS" ]; then
  export NODE_OPTIONS="$NODE_OPTIONS --require $MAX_LISTENERS_SETUP"
else
  export NODE_OPTIONS="--require $MAX_LISTENERS_SETUP"
fi

# 运行传入的命令
exec "$@"
