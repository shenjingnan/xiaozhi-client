#!/bin/bash

# 检查 npm 版本是否存在的脚本
# 用法: ./scripts/check-npm-version.sh [version]

set -e

PACKAGE_NAME="xiaozhi-client"

# 获取要检查的版本号
if [ -n "$1" ]; then
    VERSION="$1"
else
    # 从 package.json 获取当前版本
    VERSION=$(node -p "require('./package.json').version")
fi

echo "🔍 检查版本: $VERSION"

# 检查 npm registry 中是否已存在该版本
if npm view $PACKAGE_NAME@$VERSION version 2>/dev/null; then
    echo "✅ 版本 $VERSION 已存在于 npm registry"
    echo "📦 NPM: https://www.npmjs.com/package/$PACKAGE_NAME/v/$VERSION"
    exit 0
else
    echo "📦 版本 $VERSION 不存在于 npm registry，可以发布"
    exit 1
fi
