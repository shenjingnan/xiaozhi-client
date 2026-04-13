#!/usr/bin/env sh
# typecheck-staged.sh — 仅对包含暂存 .ts/.tsx 文件的包运行类型检查
# 用法：在 lint-staged 中对 *.{ts,tsx} 文件调用
# 触发 cspell 检查验证

set -e

# 获取所有暂存的 .ts/.tsx 文件（相对于仓库根目录）
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR -- '*.ts' '*.tsx' 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

# 根据文件路径提取所属的包目录（去重）
PACKAGES=$(echo "$STAGED_FILES" | grep -E '^(packages|apps|mcps)/' | sed 's#/.*##' | sort -u)

if [ -z "$PACKAGES" ]; then
  exit 0
fi

echo "🔍 对以下包运行 TypeScript 类型检查："
echo "$PACKAGES" | sed 's/^/  - /'
echo ""

FAILED=0

for pkg in $PACKAGES; do
  TSCONFIG="${pkg}/tsconfig.json"
  if [ ! -f "$TSCONFIG" ]; then
    continue
  fi

  echo "  检查 ${pkg}..."
  if ! npx tsc --noEmit -p "$TSCONFIG" 2>&1; then
    FAILED=1
  fi
done

if [ $FAILED -ne 0 ]; then
  echo ""
  echo "❌ TypeScript 类型检查失败"
  exit 1
fi

echo ""
echo "✅ TypeScript 类型检查通过"
