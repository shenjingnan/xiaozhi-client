#!/bin/bash

# Nx Release 发布脚本 - 根据 prerelease 版本自动选择 npm tag
#
# 功能：
# - 读取 package.json 获取版本号
# - 使用正则表达式检测版本类型
# - 根据类型选择正确的 tag：
#   - 正式版（1.0.0）：不添加 --tag 参数（默认使用 latest）
#   - Beta 版（1.0.0-beta.0）：添加 --tag beta
#   - RC 版（1.0.0-rc.0）：添加 --tag rc
# - 执行 pnpm publish 命令

set -e

# 获取当前目录的版本号
if [ ! -f "package.json" ]; then
    echo "错误: 当前目录中没有 package.json 文件"
    exit 1
fi

VERSION=$(node -e "console.log(require('./package.json').version)")

if [ -z "$VERSION" ]; then
    echo "错误: 无法从 package.json 读取版本号"
    exit 1
fi

# 检测版本类型并选择对应的 tag
if [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$ ]]; then
    # Beta 版本
    TAG="--tag beta"
    echo "检测到 Beta 版本: $VERSION，使用 tag: beta"
elif [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+-rc\.[0-9]+$ ]]; then
    # RC 版本
    TAG="--tag rc"
    echo "检测到 RC 版本: $VERSION，使用 tag: rc"
elif [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # 正式版本
    TAG=""
    echo "检测到正式版本: $VERSION，使用默认 tag: latest"
else
    echo "错误: 无法识别的版本号格式: $VERSION"
    echo "支持的格式: 1.0.0, 1.0.0-beta.0, 1.0.0-rc.0"
    exit 1
fi

# 执行发布命令
echo "正在发布包..."
pnpm publish --access public $TAG --no-git-checks
